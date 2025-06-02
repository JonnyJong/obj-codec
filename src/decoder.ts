import { flexUintCodec } from 'codec/base/flexable-unsigned-integer';
import { stringCodec } from 'codec/base/string';
import { CUSTOM_TYPE_ID_BEGIN, INTERNAL_CODEC } from 'global';
import { concatBuffers, toUint8Array } from 'helper';
import { BaseCodec, BinaryArray, CodecMap, ICodec } from 'types';

interface ObjDecoderOptions {
	codec: CodecMap;
	allowIncompleteDecoding?: boolean;
}

export class Pointer {
	#decoder: ObjDecoder;
	#id: number;
	constructor(decoder: ObjDecoder, id: number) {
		if (!(decoder instanceof ObjDecoder)) {
			throw new Error('Instance creation is not allowed');
		}
		this.#decoder = decoder;
		this.#id = id;
	}
	deRef() {
		return this.#decoder.deRef(this.#id);
	}
}

export class ObjDecoder {
	private _codec: CodecMap;
	private _codecMapLength?: number;
	private _codecMap: ICodec<any, any, any>[] = [];
	private _allowIncompleteDecoding: boolean;
	private _pointerList: [ICodec<any, any, any>, any][] = [];
	private _pointers: Pointer[] = [];
	private _buffer: Uint8Array = new Uint8Array();
	private _version?: number;
	private _currentTypeId?: number;
	private _expectedLength?: number;
	private _currentCodec?: ICodec<any, any, any>;
	private _needInnerCodec = false;
	private _innerCodec?: BaseCodec<any>;
	// TODO: 唯一\非实例类型（各种类、函数）
	private _innerCodecIsPointer = false;
	private _decodePromise: Promise<null> | null = null;
	private _decodeError?: Error;
	constructor({ codec, allowIncompleteDecoding }: ObjDecoderOptions) {
		this._codec = codec;
		this._allowIncompleteDecoding = !!allowIncompleteDecoding;
	}
	deserialize(buffer: Uint8Array) {
		let datas = [];
		let i = 0;
		while (i < buffer.length) {
			const typeBuffer = flexUintCodec.getBuffer(buffer.slice(i));
			if (!typeBuffer) {
				throw new Error('Deserialization failure: unable to get type');
			}
			i += typeBuffer.length;
			const type = flexUintCodec.decode(typeBuffer);
			// Pointer
			if (type === 0) {
				const idBuffer = flexUintCodec.getBuffer(buffer.slice(i));
				if (!idBuffer) {
					throw new Error('Deserialization failure: unable to get pointer id');
				}
				i += idBuffer.length;
				const id = flexUintCodec.decode(idBuffer);
				datas.push(this.getRef(id));
				continue;
			}
			// Basic
			const codec = INTERNAL_CODEC[type - 1];
			let length = codec.encodingLength;
			if (length === undefined) {
				const lengthBuffer = flexUintCodec.getBuffer(buffer.slice(i));
				if (!lengthBuffer) {
					throw new Error('Deserialization failure: unable to get length');
				}
				i += lengthBuffer.length;
				length = flexUintCodec.decode(lengthBuffer);
			}
			datas.push(codec.decode(buffer.slice(i, i + length), this));
			i += length;
		}
		return datas;
	}
	deRef(id: number) {
		return this._pointerList[id][1];
	}
	private getRef(id: number): Pointer {
		if (this._pointers[id]) return this._pointers[id];
		const pointer = new Pointer(this, id);
		this._pointers[id] = pointer;
		return pointer;
	}
	private _resetCodec() {
		this._currentTypeId = undefined;
		this._expectedLength = undefined;
		this._currentCodec = undefined;
		this._innerCodec = undefined;
		this._needInnerCodec = false;
		this._innerCodecIsPointer = false;
	}
	private _setupCodec() {
		if (this._currentTypeId === undefined) return;
		this._currentCodec = INTERNAL_CODEC[this._currentTypeId - 1] as ICodec<
			any,
			any,
			any
		>;
		if (this._currentCodec) {
			this._expectedLength = (
				this._currentCodec as BaseCodec<any>
			).encodingLength;
			return;
		}
		// 自定义编解码器
		this._needInnerCodec = true;
		if (!this._codecMap) return;
		this._currentCodec =
			this._codecMap[this._currentTypeId - CUSTOM_TYPE_ID_BEGIN];
	}
	private _concat(buffer: Uint8Array) {
		this._buffer = concatBuffers(this._buffer, buffer);
	}
	private _consume(length: number) {
		this._buffer = this._buffer.slice(length);
	}
	private async _decode() {
		const end = () => (this._decodePromise = null);
		// Version
		if (this._version === undefined) {
			this._version = this._buffer[0];
			this._consume(1);
		}
		// Custom Class Map
		if (this._codecMapLength === undefined) {
			const lengthBuffer = flexUintCodec.getBuffer(this._buffer);
			if (!lengthBuffer) return end();
			this._consume(lengthBuffer.length);
			this._codecMapLength = flexUintCodec.decode(lengthBuffer);
		}
		while (this._codecMap.length !== this._codecMapLength) {
			const lengthBuffer = flexUintCodec.getBuffer(this._buffer);
			if (!lengthBuffer) return end();
			const length = flexUintCodec.decode(lengthBuffer);
			if (this._buffer.length < length + lengthBuffer.length) return end();
			this._consume(lengthBuffer.length);
			const name = stringCodec.decode(this._buffer.slice(0, length), this);
			const codec = this._codec.get(name);
			if (!codec) {
				this._decodeError = new Error(`Codec not found: ${name}`);
				return end();
			}
			this._codecMap.push(codec[1]);
			this._consume(length);
		}
		while (this._buffer.length > 0) {
			// Objects: Codec Type
			if (this._currentTypeId === undefined) {
				const typeBuffer = flexUintCodec.getBuffer(this._buffer);
				if (!typeBuffer) return end();
				this._consume(typeBuffer.length);
				this._currentTypeId = flexUintCodec.decode(typeBuffer);
				this._setupCodec();
				if (!this._currentCodec) {
					this._decodeError = new Error(
						`Unknown codec: ${this._currentTypeId}`
					);
					return end();
				}
			}
			// Objects: Inner Codec Type
			if (this._needInnerCodec && this._innerCodec === undefined) {
				const typeBuffer = flexUintCodec.getBuffer(this._buffer);
				if (!typeBuffer) return end();
				this._consume(typeBuffer.length);
				const type = flexUintCodec.decode(typeBuffer);
				if (type === 0) {
					this._innerCodecIsPointer = true;
				} else {
					this._innerCodec = INTERNAL_CODEC[type - 1];
					this._expectedLength = this._innerCodec.encodingLength;
				}
			}
			// Objects: Length
			if (!this._innerCodecIsPointer && this._expectedLength === undefined) {
				const lengthBuffer = flexUintCodec.getBuffer(this._buffer);
				if (!lengthBuffer) return end();
				this._consume(lengthBuffer.length);
				this._expectedLength = flexUintCodec.decode(lengthBuffer);
			}
			// Objects: Decode Data
			let data: any;
			// Objects: Custom Pointer Type
			if (this._innerCodecIsPointer) {
				const idBuffer = flexUintCodec.getBuffer(this._buffer);
				if (!idBuffer) return end();
				this._consume(idBuffer.length);
				const id = flexUintCodec.decode(idBuffer);
				data = this._currentCodec!.decode(this.getRef(id));
				this._pointerList.push([this._currentCodec!, data]);
				this._resetCodec();
				continue;
			}
			if (this._buffer.length < (this._expectedLength as number)) return end();
			// Objects: Custom Non-Pointer Type
			if (this._innerCodec) {
				const innerData = this._innerCodec.decode(
					this._buffer.slice(0, this._expectedLength),
					this
				);
				data = this._currentCodec!.decode(innerData);
			} else {
				// Objects: Internal Type
				data = (this._currentCodec as BaseCodec<any>).decode(
					this._buffer.slice(0, this._expectedLength),
					this
				);
			}
			this._pointerList.push([this._currentCodec!, data]);
			this._consume(this._expectedLength as number);
			this._resetCodec();
		}
		return end();
	}
	write(buffer: BinaryArray) {
		if (this._decodeError) throw this._decodeError;
		this._concat(toUint8Array(buffer));
		if (this._decodePromise) return;
		this._decodePromise = this._decode();
	}
	async end() {
		if (this._decodeError) throw this._decodeError;
		if (this._decodePromise) await this._decodePromise;
		if (this._buffer.length > 0) await this._decode();
		// Check Incomplete Decoding
		if (
			(this._currentTypeId !== undefined || this._buffer.length > 0) &&
			!this._allowIncompleteDecoding
		) {
			throw new Error('Failure to decode in full');
		}
		// Dereference
		const laterDeferences = [];
		for (const [codec, data] of this._pointerList) {
			if (!codec.dereference) continue;
			if (!INTERNAL_CODEC.includes(codec)) {
				laterDeferences.push([codec, data]);
				continue;
			}
			codec.dereference(data);
		}
		for (const [codec, data] of laterDeferences) {
			codec.dereference(data);
		}
		// Complete
		return this._pointerList[0][1];
	}
	async decode(data: BinaryArray): Promise<any> {
		this.write(data);
		return this.end();
	}
}
