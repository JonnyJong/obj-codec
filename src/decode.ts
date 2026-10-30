import { BufferReader, WouldBlock } from './buffer';
import {
	containerOf,
	isContainerTag,
	isReferableTag,
	readerOf,
} from './builtins';
import { ARRAY_HOLE } from './codecs/container/array';
import { CUSTOM_BEGIN, CUSTOM_FLAG, TAG, VERSION } from './protocol';
import type { CodecSnapshot } from './snapshot';
import type {
	CodecOptions,
	ContainerCodec,
	CustomCodec,
	CustomContainerCodec,
	DecodeContext,
} from './types';
import { Queue } from './utils';

/** 释放节流阈值 */
const RELEASE_THRESHOLD = 64 * 1024;

export interface DecoderOptions extends CodecOptions {
	/** 自定义编解码器快照 */
	snapshot: CodecSnapshot;
}

/** 待填充的容器帧 */
interface PendingFrame {
	codec: ContainerCodec<unknown, unknown> | CustomContainerCodec<unknown>;
	shell: unknown;
	/** 还要读多少个子项 */
	remaining: number;
	/** 跨子项累加状态 */
	state: unknown;
}

/**
 * 解码器
 * @description
 * - 增量：收到任意长度分块，尽力推进
 * - BFS：
 *   - 标量：解码，返回
 *   - 可引用标量：解码，加入引用表，返回
 *   - 容器：解码头部，加入引用表，入队，返回
 */
export class Decoder {
	#snapshot: CodecSnapshot;
	/** 自定义 ID -> codec，按类型表建立 */
	#customs: CustomCodec[] = [];
	/** 外部引用表 */
	#extRefs: unknown[];
	/** 引用表：引用号 -> 值 */
	#refs: unknown[] = [];
	/** 待填充的容器队列 */
	#pending = new Queue<PendingFrame>();
	#root: unknown;
	#complete = false;
	/**
	 * 当前帧的类型 ID
	 * @description
	 * `undefined` 表示当前没有半成品
	 */
	#frameId?: number;
	/**
	 * 帧上下文
	 * @description
	 * `reader` 在整个解码器生命周期内不变，因此可以跨帧复用：
	 * 只有被打断的帧才需要保留，其余帧省掉每次两个对象的分配。
	 */
	#ctx: DecodeContext;
	/** 下一步要执行的操作 */
	#next: () => void = this.#doVersion;
	#reader = new BufferReader();
	constructor(options: DecoderOptions) {
		this.#snapshot = options.snapshot;
		this.#extRefs = options.externalRefs ?? [];
		this.#ctx = { reader: this.#reader };
	}
	/** 是否已解码完成 */
	get done(): boolean {
		return this.#complete;
	}
	/** 解码结果；未完成时抛错 */
	get result(): unknown {
		if (!this.#complete) throw new Error('Decoding is not complete');
		return this.#root;
	}
	/** 推入一个分块，尽可能推进解码 */
	push(chunk: Uint8Array): this {
		if (this.#complete) throw new Error('Decoder has already finished');
		this.#reader.push(chunk);
		this.#step();
		return this;
	}
	/**
	 * 标记输入结束并取回结果
	 * @description
	 * 再推进一次后检查是否真的解完；读不完整说明输入被截断。
	 */
	end(): unknown {
		if (this.#complete) return this.#root;
		this.#reader.end();
		// 标记结束后再推进：此时读不完整会变成 `UnexpectedEnd`
		this.#step();
		if (!this.#complete) {
			throw new Error(
				`Unexpected end of input: ${this.#pending.size} container(s) still pending`,
			);
		}
		return this.#root;
	}
	/** 推进解码 */
	#step(): void {
		while (!this.#complete) {
			try {
				this.#next();
			} catch (error) {
				if (!(error instanceof WouldBlock)) throw error;
				return;
			}
		}
	}
	/**
	 * 释放已消费的字节
	 * @description
	 * 避免长时间解码无界占内存
	 */
	#release(): void {
		// 超过上限再清理，避免反复扫描分块
		const reader = this.#reader;
		if (reader.position - reader.front < RELEASE_THRESHOLD) return;
		this.#reader.discard(this.#reader.position);
	}
	//#region 头部
	/** 处理版本 */
	#doVersion(): void {
		const version = this.#reader.u8();
		// 检查版本
		if ((version & ~CUSTOM_FLAG) !== VERSION) {
			throw new Error(`Unsupported version: ${version}`);
		}
		// 检查类型表
		if (version & CUSTOM_FLAG) this.#next = this.#doTable;
		else this.#next = this.#doRoot;
	}
	/** 处理类型表 */
	#doTable(): void {
		while (true) {
			const name = this.#reader.utf8Prefixed();
			// 读到终止符
			if (!name) break;
			const codec = this.#snapshot.get(name);
			if (!codec) throw new Error(`Missing codec: ${name}`);
			this.#customs.push(codec);
		}
		this.#release();
		this.#next = this.#doRoot;
	}
	//#endregion
	//#region 队列
	/** 处理根对象 */
	#doRoot(): void {
		this.#root = this.#readFrame();
		this.#release();
		this.#next = this.#doContainers;
	}
	/**
	 * 处理容器帧
	 * @description
	 * 逐个填充队首容器，充满后出队；
	 * 队列空即解码完成
	 */
	#doContainers(): void {
		while (true) {
			const frame = this.#pending.peek();
			if (!frame) break;
			// XXX: 容器完成时再释放，减少释放频率，内存占用可能高一些
			if (frame.remaining === 0) {
				this.#pending.dequeue();
				this.#release();
				continue;
			}
			const child = this.#readFrame();
			frame.state = frame.codec.addChild(frame.shell, child, frame.state);
			frame.remaining--;
		}
		this.#complete = true;
	}
	//#endregion
	//#region 帧
	/** 读一个完整帧 */
	#readFrame(): unknown {
		this.#frameId ??= this.#reader.varint();
		const value = this.#dispatch(this.#frameId);
		// 收尾清理
		this.#frameId = undefined;
		this.#ctx.state = undefined;

		return value;
	}
	/** 按类型 ID 分派 */
	#dispatch(id: number): unknown {
		if (id >= CUSTOM_BEGIN) return this.#readCustom(id);
		return this.#readBuiltin(id);
	}
	/** 读内置类型 */
	#readBuiltin(id: number): unknown {
		// 不可引用标量
		switch (id) {
			case TAG.NULL:
				return null;
			case TAG.UNDEFINED:
				return undefined;
			case TAG.FALSE:
				return false;
			case TAG.TRUE:
				return true;
			case TAG.ARRAY_HOLE:
				return ARRAY_HOLE;
			case TAG.POINTER: {
				const index = this.#reader.varint();
				if (index >= this.#refs.length) {
					throw new Error(`Unknown pointer: ${index}`);
				}
				return this.#refs[index];
			}
			case TAG.EXT_REF: {
				const index = this.#reader.varint();
				if (index >= this.#extRefs.length) {
					throw new Error(`Unknown external reference: ${index}`);
				}
				return this.#extRefs[index];
			}
		}
		// 内置容器
		if (isContainerTag(id)) {
			const codec = containerOf(id);
			if (!codec) throw new Error(`Internal: missing container codec for ${id}`);
			return this.#readContainer(codec);
		}
		// 其它可引用类型
		const read = readerOf(id);
		if (!read) throw new Error(`Unknown type tag: ${id}`);
		const value = read(this.#ctx);
		if (isReferableTag(id)) this.#refs.push(value);
		return value;
	}
	/** 读自定义类型 */
	#readCustom(id: number): unknown {
		const codec = this.#customs[id - CUSTOM_BEGIN];
		if (!codec) throw new Error(`Unknown custom type: ${id}`);
		if (codec.kind === 'referable') {
			const value = codec.read(this.#ctx);
			this.#refs.push(value);
			return value;
		}
		return this.#readContainer(codec);
	}
	/**
	 * 读容器头部并建壳
	 * @description
	 * 已自动入队、进引用表
	 */
	#readContainer(
		codec: ContainerCodec<unknown> | CustomContainerCodec<unknown>,
	): unknown {
		const count = this.#reader.varint();
		const shell = codec.create();
		this.#refs.push(shell);
		this.#pending.enqueue({
			codec,
			shell,
			remaining: count,
			state: codec.initialState?.(),
		});
		return shell;
	}
	//#endregion
}
