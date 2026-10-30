import { sortCodecs } from './codec-order';
import { CUSTOM_BEGIN } from './protocol';
import type { AnyConstructor, CustomCodec } from './types';

/**
 * 编解码器快照
 * @description
 * 不可变，仅查询
 */
export class CodecSnapshot {
	/**
	 * 已排序的 codec 列表
	 * @description
	 * 索引即 `id - CUSTOM_BEGIN`
	 */
	readonly #codecs: readonly CustomCodec[];
	/** `name` -> codec */
	readonly #byName = new Map<string, CustomCodec>();
	/** `class` -> codec */
	readonly #byClass = new Map<AnyConstructor, CustomCodec>();
	/** codec -> 类型 ID */
	readonly #ids = new Map<CustomCodec, number>();
	constructor(codecs: readonly CustomCodec[]) {
		this.#codecs = sortCodecs(codecs);
		for (const [index, codec] of this.#codecs.entries()) {
			// 拒绝为同一 class 重复注册 codec
			if (this.#byClass.has(codec.class)) {
				throw new Error(
					`Codec class "${codec.class.name}" is registered more than once`,
				);
			}
			this.#byName.set(codec.name, codec);
			this.#byClass.set(codec.class, codec);
			this.#ids.set(codec, CUSTOM_BEGIN + index);
		}
	}
	/** codec 数量 */
	get size(): number {
		return this.#codecs.length;
	}
	/** 已排序的 codec 列表，索引即 `id - CUSTOM_BEGIN` */
	get codecs(): readonly CustomCodec[] {
		return this.#codecs;
	}
	/** 按名称取 codec */
	get(name: string): CustomCodec | undefined {
		return this.#byName.get(name);
	}
	/** 类型 ID -> codec */
	byId(id: number): CustomCodec | undefined {
		if (id < CUSTOM_BEGIN) return undefined;
		return this.#codecs[id - CUSTOM_BEGIN];
	}
	/**
	 * 由 codec 取得其 ID
	 * @returns 包含 {@link CUSTOM_BEGIN} 的 ID
	 */
	idOf(codec: CustomCodec): number {
		const id = this.#ids.get(codec);
		if (id === undefined) {
			throw new Error(`Codec "${codec.name}" is not registered`);
		}
		return id;
	}
	/** 查找能编码该值的 codec */
	find(value: unknown): CustomCodec | undefined {
		if (value === null || typeof value !== 'object') return undefined;
		return this.#findOnPrototype(value);
	}
	/** 沿对象的原型链查找 codec */
	#findOnPrototype(value: object): CustomCodec | undefined {
		let proto = Object.getPrototypeOf(value) as {
			constructor?: AnyConstructor;
		} | null;
		while (proto !== null && proto !== Object.prototype) {
			const ctor = proto.constructor;
			if (ctor) {
				const codec = this.#byClass.get(ctor);
				if (codec) return codec;
			}
			proto = Object.getPrototypeOf(proto);
		}
		return undefined;
	}
}

/**
 * 空快照
 * @description
 * 可共用
 */
export const EMPTY_SNAPSHOT = new CodecSnapshot([]);
