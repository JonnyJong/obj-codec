import { DecodeOptions, Decoder } from './decoder';
import { EncodeOptions, Encoder } from './encoder';
import { IObjCodec, globalCodecs } from './global';
import { BinaryType, ObjDecoderOptions, ObjEncoderOptions } from './types';
import { mergeCodecs } from './utils';

class ObjEncoder extends ReadableStream<Uint8Array> {
	#encoder: Encoder;
	#generator: Generator<Uint8Array, void, unknown>;
	constructor(options: EncodeOptions) {
		super({
			pull: (controller) => {
				try {
					const { value, done } = this.#generator.next();
					if (done) {
						controller.close();
					} else {
						controller.enqueue(value);
					}
				} catch (error) {
					controller.error(error);
				}
			},
			cancel: () => {
				this.#generator.return();
			},
		});
		this.#encoder = new Encoder(options);
		this.#generator = this.#encoder.encode();
	}
	/** 启动编码 */
	encode(): Generator<Uint8Array, void, unknown> {
		return this.#generator;
	}
}

class ObjDecoder extends WritableStream<Uint8Array> {
	#decoder: Decoder;
	constructor(options: DecodeOptions) {
		super({
			write: (chunk, controller) => {
				try {
					this.#decoder.decode(chunk);
				} catch (error) {
					controller.error(error);
				}
			},
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
