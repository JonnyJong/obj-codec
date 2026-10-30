import { Decoder } from './decode';
import { Encoder } from './encode';
import { CodecRegistry } from './registry';
import type { CustomCodec } from './types';

export class CodecBase {
	#registry = new CodecRegistry();
	/** 外部引用 */
	externalRefs?: unknown[];
	constructor(externalRefs?: unknown[]) {
		this.externalRefs = externalRefs;
	}
	/** 注册自定义编解码器 */
	register<T, S = unknown>(codec: CustomCodec<T, S>): this {
		this.#registry.register(codec);
		return this;
	}
	/**
	 * 注销编解码器
	 * @param name 编码器名称
	 * @returns 是否存在并已移除
	 */
	unregister(name: string): boolean {
		return this.#registry.unregister(name);
	}
	/** 创建编码器 */
	protected createEncoder(externalRefs?: unknown[]): Encoder {
		return new Encoder(this.#codecOptions(externalRefs));
	}
	/** 创建解码器 */
	protected createDecoder(externalRefs?: unknown[]): Decoder {
		return new Decoder(this.#codecOptions(externalRefs));
	}
	#codecOptions(extRefs?: unknown[]) {
		return {
			snapshot: this.#registry.snapshot,
			externalRefs: extRefs ?? this.externalRefs,
		};
	}
}

/** 拼接分块 */
export function concatChunks(chunks: Iterable<Uint8Array>): Uint8Array {
	const list = [...chunks];
	let total = 0;
	for (const chunk of list) total += chunk.length;
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of list) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}
