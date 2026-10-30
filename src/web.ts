import { CodecBase, concatChunks } from './codec-base';
import type { Decoder } from './decode';
import type { Encoder } from './encode';
import type { CodecOptions } from './types';

export type {
	CodecOptions,
	CustomCodec,
	CustomContainerCodec,
	CustomReferableCodec,
} from './types';

/** 编码流 */
export class EncodeStream extends ReadableStream<Uint8Array> {
	constructor(encoder: Encoder, root: unknown) {
		const generator = encoder.encode(root);
		super({
			pull: (controller) => {
				try {
					const { value, done } = generator.next();
					if (done) {
						controller.close();
						return;
					}
					controller.enqueue(value);
				} catch (error) {
					controller.error(error);
				}
			},
			cancel: () => {
				// 释放生成器
				generator.return(undefined);
			},
		});
	}
}

/** 解码流 */
export class DecodeStream extends WritableStream<Uint8Array> {
	#decoder: Decoder;
	constructor(decoder: Decoder) {
		super({
			write: (chunk) => {
				decoder.push(chunk);
			},
			close: () => {
				decoder.end();
			},
		});
		this.#decoder = decoder;
	}
	/** 解码结果；未完成时抛错 */
	get result(): unknown {
		return this.#decoder.result;
	}
	/** 是否已解完 */
	get done(): boolean {
		return this.#decoder.done;
	}
}

/** 编解码器 */
export class ObjCodec extends CodecBase {
	/** 创建编码可读流 */
	encode(root: unknown, options?: CodecOptions): EncodeStream {
		return new EncodeStream(this.createEncoder(options?.externalRefs), root);
	}
	/** 创建解码可写流 */
	decode(options?: CodecOptions): DecodeStream {
		return new DecodeStream(this.createDecoder(options?.externalRefs));
	}
	/**
	 * 一次性编码
	 * @description
	 * 直接获取完整编码结果
	 */
	encodeSync(root: unknown, options?: CodecOptions): Uint8Array {
		return concatChunks(this.createEncoder(options?.externalRefs).encode(root));
	}
	/**
	 * 一次性解码
	 * @description
	 * 直接从完整数据解码
	 */
	decodeSync(bytes: Uint8Array, options?: CodecOptions): unknown {
		const decoder = this.createDecoder(options?.externalRefs);
		decoder.push(bytes);
		return decoder.end();
	}
}
