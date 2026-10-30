import { CodecSnapshot, EMPTY_SNAPSHOT } from './snapshot';
import type {
	CustomCodec,
	CustomContainerCodec,
	CustomReferableCodec,
} from './types';

type Method =
	| keyof CustomReferableCodec<unknown>
	| keyof CustomContainerCodec<unknown>;

/** 校验 codec 必须实现的方法 */
function assertMethods(
	codec: CustomCodec,
	kind: string,
	methods: readonly Method[],
): void {
	for (const method of methods) {
		if (typeof (codec as any)[method] !== 'function') {
			throw new TypeError(`${kind} codec requires ${method}()`);
		}
	}
}

/** 校验 codec 的身份信息 */
function validateIdentity(codec: CustomCodec): void {
	if (typeof codec.name !== 'string' || codec.name.length === 0) {
		throw new TypeError('codec.name must be a non-empty string');
	}
	if (typeof codec.class !== 'function') {
		throw new TypeError('codec.class must be a constructor');
	}
}

/** 自定义编解码器注册表 */
export class CodecRegistry {
	/** `name` -> codec */
	#codecs = new Map<string, CustomCodec>();
	/** 当前注册状态的快照 */
	#snapshot: CodecSnapshot | null = null;
	/** 注册编解码器 */
	register<T, S = unknown>(codec: CustomCodec<T, S>): void {
		validateIdentity(codec);
		this.#validate(codec);
		if (this.#codecs.has(codec.name)) {
			throw new Error(`Codec "${codec.name}" is already registered`);
		}
		this.#codecs.set(codec.name, codec);
		this.#invalidate();
	}
	/** 按名称取 codec */
	get(name: string): CustomCodec | undefined {
		return this.#codecs.get(name);
	}
	/**
	 * 注销编解码器
	 * @param name 编码器名称
	 * @returns 是否存在并已移除
	 */
	unregister(name: string): boolean {
		const removed = this.#codecs.delete(name);
		if (removed) this.#invalidate();
		return removed;
	}
	/** 清空全部注册 */
	clear(): void {
		if (this.#codecs.size === 0) return;
		this.#codecs.clear();
		this.#invalidate();
	}
	/** 已注册的 codec 数量 */
	get size(): number {
		return this.#codecs.size;
	}
	/** 当前注册状态的快照 */
	get snapshot(): CodecSnapshot {
		if (this.#codecs.size === 0) return EMPTY_SNAPSHOT;
		this.#snapshot ??= new CodecSnapshot([...this.#codecs.values()]);
		return this.#snapshot;
	}
	/**
	 * 使缓存失效
	 * @description
	 * 丢弃快照缓存
	 */
	#invalidate(): void {
		this.#snapshot = null;
	}
	#validate(codec: CustomCodec): void {
		if (codec.kind === 'referable') {
			assertMethods(codec, 'referable', ['write', 'read']);
			return;
		}
		if (codec.kind === 'container') {
			assertMethods(codec, 'container', [
				'count',
				'forEachChild',
				'create',
				'addChild',
			]);
			return;
		}
		throw new TypeError('codec.kind must be "referable" or "container"');
	}
}
