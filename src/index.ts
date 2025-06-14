import { Readable, Writable } from 'node:stream';
import { DecodeOptions, Decoder } from './decoder';
import { EncodeOptions, Encoder } from './encoder';
import { IObjCodec, globalCodecs } from './global';
import { BinaryType, ObjDecoderOptions, ObjEncoderOptions } from './types';
import { mergeCodecs } from './utils';

class ObjEncoder extends Readable {
	#encoder: Encoder;
	#generator: Generator<Uint8Array, void, unknown>;
	constructor(options: EncodeOptions) {
		super({
			autoDestroy: true,
			emitClose: true,
		});
		this.#encoder = new Encoder(options);
		this.#generator = this.#encoder.encode();
	}
	/** 启动编码 */
	encode(): Generator<Uint8Array, void, unknown> {
		return this.#generator;
	}
	_read(_size: number): void {
		try {
			let pushed = true;
			while (pushed) {
				const { value, done } = this.#generator.next();
				if (done) {
					this.push(null);
					return;
				}

				pushed = this.push(value);
			}
		} catch (error) {
			this.destroy(error as Error);
		}
	}
}

class ObjDecoder extends Writable {
	#decoder: Decoder;
	constructor(options: DecodeOptions) {
		super({
			autoDestroy: true,
			emitClose: true,
			decodeStrings: true,
		});
		this.#decoder = new Decoder(options);
	}
	/** 解码 */
	decode(buffer: BinaryType): void {
		this.#decoder.decode(buffer);
	}
	/**
	 * 获取结果
	 * @description
	 * 调用此方法将结束解码
	 */
	getResult(): any {
		return this.#decoder.getResult();
	}
	#toUint8Array(
		chunk: Uint8Array | Buffer | string,
		encoding: NodeJS.BufferEncoding = 'utf-8',
	): Uint8Array {
		if (typeof chunk === 'string') {
			return Buffer.from(chunk, encoding);
		}
		return chunk;
	}
	_write(
		chunk: any,
		encoding: NodeJS.BufferEncoding,
		callback: (error?: Error | null) => void,
	): void {
		try {
			const data = this.#toUint8Array(chunk, encoding);
			this.#decoder.decode(data);
			callback();
		} catch (err) {
			callback(err as Error);
		}
	}
	_writev(
		chunks: Array<{ chunk: any; encoding: NodeJS.BufferEncoding }>,
		callback: (error?: Error | null) => void,
	): void {
		try {
			for (const { chunk, encoding } of chunks) {
				const data = this.#toUint8Array(chunk, encoding);
				this.#decoder.decode(data);
			}
			callback();
		} catch (err) {
			callback(err as Error);
		}
	}
	_final(callback: (error?: Error | null) => void): void {
		try {
			this.#decoder.getResult();
			callback();
		} catch (err) {
			callback(err as Error);
		}
	}
}

export class ObjCodec extends IObjCodec {
	/**
	 * 编码
	 * @param root 编码根对象
	 */
	static encode(root: any, options?: ObjEncoderOptions) {
		return new ObjEncoder({
			...options,
			root,
			codec: globalCodecs,
		});
	}
	/** 解码 */
	static decode(options?: ObjDecoderOptions) {
		return new ObjDecoder({
			...options,
			codec: globalCodecs,
		});
	}
	encode(root: any, options?: ObjEncoderOptions) {
		return new ObjEncoder({
			uniqueValues: this.uniqueValues,
			...options,
			root,
			codec: mergeCodecs(globalCodecs, this._codecs),
		});
	}
	decode(options?: ObjDecoderOptions) {
		return new ObjDecoder({
			uniqueValues: this.uniqueValues,
			...options,
			codec: mergeCodecs(globalCodecs, this._codecs),
		});
	}
}

export type {
	BinaryType,
	BaseType,
	InternalType,
	BasicType,
	IClass,
	ICodec,
	InternalTypeName,
	InternalCodec,
} from './types';
export {
	INTERNAL_CODEC_MAP,
	INTERNAL_CODEC,
	INTERNAL_TYPE_ID,
	CUSTOM_TYPE_ID_BEGIN,
	VERSION,
} from './global';
export { Pointer, concatBuffers, bufferToUint8Array, isBinary } from './utils';
