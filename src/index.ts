import { Readable, Writable } from 'node:stream';
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
export class EncodeStream extends Readable {
	#generator: Generator<Uint8Array, void, void>;
	constructor(encoder: Encoder, root: unknown) {
		super({ autoDestroy: true, emitClose: true });
		this.#generator = encoder.encode(root);
	}
	_read(): void {
		try {
			while (true) {
				const { value, done } = this.#generator.next();
				if (done) {
					this.push(null);
					return;
				}
				if (!this.push(value)) return;
			}
		} catch (error) {
			this.destroy(error as Error);
		}
	}
	_destroy(error: Error | null, callback: (error?: Error | null) => void): void {
		this.#generator.return(undefined);
		callback(error);
	}
}

/** 解码流 */
export class DecodeStream extends Writable {
	#decoder: Decoder;
	constructor(decoder: Decoder) {
		super({ autoDestroy: true, emitClose: true });
		this.#decoder = decoder;
	}
	_write(
		chunk: Uint8Array,
		_encoding: BufferEncoding,
		callback: (error?: Error | null) => void,
	): void {
		try {
			this.#decoder.push(chunk);
			callback();
		} catch (error) {
			callback(error as Error);
		}
	}
	_writev(
		chunks: Array<{ chunk: Uint8Array; encoding: BufferEncoding }>,
		callback: (error?: Error | null) => void,
	): void {
		try {
			for (const { chunk } of chunks) this.#decoder.push(chunk);
			callback();
		} catch (error) {
			callback(error as Error);
		}
	}
	_final(callback: (error?: Error | null) => void): void {
		try {
			this.#decoder.end();
			callback();
		} catch (error) {
			callback(error as Error);
		}
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
