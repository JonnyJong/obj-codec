import { BufferWriter } from './buffer';
import { scalarFor } from './builtins';
import { ARRAY_HOLE, arrayCodec } from './codecs/container/array';
import { mapCodec } from './codecs/container/map';
import { objectCodec } from './codecs/container/object';
import { setCodec } from './codecs/container/set';
import { CUSTOM_FLAG, TAG, VERSION } from './protocol';
import type { CodecSnapshot } from './snapshot';
import type {
	BuiltinContainerCodec,
	CodecOptions,
	ContainerCodec,
	CustomContainerCodec,
	EncodeContext,
} from './types';
import { Queue } from './utils';

export interface EncoderOptions extends CodecOptions {
	/** 自定义编解码器快照 */
	snapshot: CodecSnapshot;
}

/** 待展开的容器帧 */
interface ContainerFrame {
	codec: ContainerCodec<unknown, unknown>;
	value: unknown;
}

/** 构造“不支持的类型”错误 */
function unsupported(value: unknown, at: number): TypeError {
	const type = typeof value;
	let detail: string = type;
	if (type === 'object' || type === 'function') {
		const name = (value as { constructor?: { name?: string } })?.constructor
			?.name;
		if (name) detail = `${type} (${name})`;
	}
	return new TypeError(
		`Unsupported type: ${detail} (after ${at} reference(s)); Adding it to \`externalRefs\` might help`,
	);
}

/** 判断内置容器类型并返回对应 codec */
function containerFor(
	value: unknown,
): BuiltinContainerCodec<unknown> | undefined {
	if (Array.isArray(value)) return arrayCodec;
	if (value instanceof Map) return mapCodec;
	if (value instanceof Set) return setCodec;
	// 兜底
	if (typeof value === 'object') return objectCodec;
	return;
}

/**
 * 编码器
 * @description
 * - BFS：先写 Header，子项推迟写
 * - 首次出现时立刻声明/写 Header
 * - 背压：惰性编码
 *
 * [HEADER][...FRAME]
 */
export class Encoder {
	#snapshot: CodecSnapshot;
	/** 外部引用表 */
	#extRefs: Map<unknown, number>;
	/** 引用表：值 -> 引用号 */
	#refs = new Map<unknown, number>();
	/** 待展开的容器队列 */
	#pending = new Queue<ContainerFrame>();
	#writer = new BufferWriter();
	// HACK: 该版本暂时可共用
	#ctx: EncodeContext = { writer: this.#writer };
	constructor({ snapshot, externalRefs }: EncoderOptions) {
		this.#snapshot = snapshot;
		this.#extRefs = new Map(externalRefs?.map((v, i) => [v, i]));
	}
	/**
	 * 编码
	 * @param root 根对象
	 */
	*encode(root: unknown): Generator<Uint8Array, void, void> {
		// 写入文件头
		this.#writeHeader();
		yield* this.#drain();
		// 写入根对象
		this.#emitFrame(root);
		yield* this.#drain();
		// 每弹出一个容器，就连续写它的全部子项
		while (true) {
			const frame = this.#pending.dequeue();
			if (!frame) break;
			frame.codec.forEachChild(frame.value, (child) => this.#emitFrame(child));
			yield* this.#drain();
		}
		// 收尾
		const tail = this.#writer.finish();
		if (tail.length > 0) yield tail;
	}
	/** 把已就绪的分块交给消费者 */
	*#drain(): Generator<Uint8Array, void, void> {
		let chunk = this.#writer.take();
		while (chunk !== undefined) {
			yield chunk;
			chunk = this.#writer.take();
		}
	}
	//#region 文件头
	/**
	 * 写文件头
	 * @description
	 * - `0b10`：v2，无类型表
	 * - `0b11`：v2，有类型表
	 *   [VER][...CODEC: [VARINT][UTF-8]][0]
	 */
	#writeHeader(): void {
		const codecs = this.#snapshot.codecs;
		const hasCustom = codecs.length > 0;
		// 版本
		this.#writer.u8(VERSION | (hasCustom ? CUSTOM_FLAG : 0));
		if (!hasCustom) return;
		// 类型表
		for (const codec of codecs) this.#writer.utf8Prefixed(codec.name);
		// 类型表终止符
		this.#writer.utf8Prefixed('');
	}
	//#endregion
	//#region 帧
	/** 加入引用表 */
	#addRef(value: unknown): void {
		this.#refs.set(value, this.#refs.size);
	}
	/**
	 * 尝试写引用
	 * @returns 若成功写引用则返回 `true`
	 * @description
	 * 外部引用优先于内部引用；
	 * 若成功写引用则无需继续编码。
	 */
	#writeExistingRef(value: unknown): boolean {
		const extIndex = this.#extRefs.get(value);
		if (extIndex !== undefined) {
			this.#writeRef(TAG.EXT_REF, extIndex);
			return true;
		}
		const ref = this.#refs.get(value);
		if (ref !== undefined) {
			this.#writeRef(TAG.POINTER, ref);
			return true;
		}
		return false;
	}
	/**
	 * 写引用
	 * @description
	 * 不应直接使用，应使用 `#writeExistingRef`
	 */
	#writeRef(tag: number, index: number): void {
		this.#writer.u8(tag);
		this.#writer.varint(index);
	}
	/**
	 * 写帧
	 * @description
	 * [ID][PAYLOAD]
	 *
	 * 容器 `[PAYLOAD]` 只包含子元素计数
	 */
	#emitFrame(value: unknown): void {
		// 常规类型
		switch (value) {
			// 优先写数组空洞
			case ARRAY_HOLE:
				this.#writer.u8(TAG.ARRAY_HOLE);
				return;
			case null:
				this.#writer.u8(TAG.NULL);
				return;
			case undefined:
				this.#writer.u8(TAG.UNDEFINED);
				return;
			case true:
				this.#writer.u8(TAG.TRUE);
				return;
			case false:
				this.#writer.u8(TAG.FALSE);
				return;
		}

		// 尝试写引用
		if (this.#writeExistingRef(value)) return;

		// 内置标量
		const scalar = scalarFor(value);
		if (scalar) {
			if (scalar.referable) this.#addRef(value);
			scalar.write(this.#ctx, value);
			return;
		}

		// 自定义 codec
		const custom = this.#snapshot.find(value);
		if (custom) {
			this.#addRef(value);
			this.#writer.varint(this.#snapshot.idOf(custom));
			if (custom.kind === 'referable') custom.write(this.#ctx, value);
			else this.#writeContainer(custom, value);
			return;
		}

		// 内置容器
		const container = containerFor(value);
		if (container) {
			this.#addRef(value);
			this.#writer.u8(container.tag);
			this.#writeContainer(container, value);
			return;
		}

		throw unsupported(value, this.#refs.size);
	}
	/** 写容器计数并入队 */
	#writeContainer(
		codec: ContainerCodec<unknown> | CustomContainerCodec<unknown>,
		value: unknown,
	): void {
		this.#writer.varint(codec.count(value));
		this.#pending.enqueue({ codec, value });
	}
	//#endregion
}
