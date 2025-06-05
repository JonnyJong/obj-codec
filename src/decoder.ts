import { flexUintCodec } from './codec/base/flexible-unsigned-integer';
import { stringCodec } from './codec/base/string';
import {
	CUSTOM_TYPE_ID_BEGIN,
	INTERNAL_CODEC,
	INTERNAL_TYPE_ID,
} from './global';
import {
	AnyCodec,
	BasicType,
	BinaryType,
	CodecMap,
	InternalCodec,
} from './types';
import { Pointer, bufferToUint8Array, concatBuffers, isBinary } from './utils';

export interface DecodeOptions {
	codec: CodecMap;
	uniqueValues?: any[];
	ignoreMissedCodec?: boolean;
	ignoreMissedUniqueValue?: boolean;
	allowIncompleteDecoding?: boolean;
}

type PointerItem = [AnyCodec | InternalCodec<BasicType>, any];

const REFERABLE_TYPE_ID = new Set([
	INTERNAL_TYPE_ID.BINARY,
	INTERNAL_TYPE_ID.STRING,
	INTERNAL_TYPE_ID.OBJECT,
	INTERNAL_TYPE_ID.ARRAY,
	INTERNAL_TYPE_ID.SET,
	INTERNAL_TYPE_ID.MAP,
	INTERNAL_TYPE_ID.DATE,
	INTERNAL_TYPE_ID.REGEXP,
	INTERNAL_TYPE_ID.SYMBOL,
]);

function isReferable(id: number): boolean {
	if (id >= CUSTOM_TYPE_ID_BEGIN) return true;
	return REFERABLE_TYPE_ID.has(id);
}

const UNINITIALIZED = Symbol('uninitialized');

export class Decoder {
	#codec: CodecMap;
	#uniqueValues: any[];
	#ignoreMissedCodec: boolean;
	#ignoreMissedUniqueValue: boolean;
	#allowIncompleteDecoding: boolean;
	#pointers: PointerItem[] = [];
	#buffer: Uint8Array = new Uint8Array();
	#version?: number;
	#codecMapLength?: number;
	#codecMap: AnyCodec[] = [];
	#types: number[] = [];
	#length?: number;
	#root: any = UNINITIALIZED;
	#complete = false;
	constructor({
		codec,
		uniqueValues,
		ignoreMissedCodec,
		ignoreMissedUniqueValue,
		allowIncompleteDecoding,
	}: DecodeOptions) {
		this.#codec = codec;
		this.#uniqueValues = uniqueValues ?? [];
		this.#ignoreMissedCodec = !!ignoreMissedCodec;
		this.#ignoreMissedUniqueValue = !!ignoreMissedUniqueValue;
		this.#allowIncompleteDecoding = !!allowIncompleteDecoding;
	}
	#consume(length: number) {
		this.#buffer = this.#buffer.slice(length);
	}
	#getCodec(id: number) {
		if (id < CUSTOM_TYPE_ID_BEGIN) return INTERNAL_CODEC[id];
		return this.#codecMap[id - CUSTOM_TYPE_ID_BEGIN];
	}
	#deserializeType(box: { buffer: Uint8Array }) {
		let { buffer } = box;
		const types: number[] = [];
		while (!this.#isTypeResolvable(types.at(-1))) {
			const typeBuffer = flexUintCodec.getBuffer(buffer);
			if (!typeBuffer) {
				throw new Error('Failed to deserialize while deserialize types');
			}
			const type = flexUintCodec.decode(typeBuffer);
			this.#assertTypeExists(type);
			types.push(type);
			buffer = buffer.slice(typeBuffer.length);
		}
		box.buffer = buffer;
		return types;
	}
	#deserializeLength(types: number[], box: { buffer: Uint8Array }): number {
		const innerType = types.at(-1)!;
		if (
			innerType === INTERNAL_TYPE_ID.POINTER ||
			innerType === INTERNAL_TYPE_ID.UNIQUE_POINTER
		) {
			const lengthBuffer = flexUintCodec.getBuffer(box.buffer);
			if (!lengthBuffer) throw new Error('Failed to read pointer');
			return lengthBuffer.length;
		}
		let length = INTERNAL_CODEC[innerType].bufferLength;
		if (length !== undefined) return length;
		const lengthBuffer = flexUintCodec.getBuffer(box.buffer);
		if (!lengthBuffer) {
			throw new Error('Failed to deserialize while deserialize length');
		}
		length = flexUintCodec.decode(lengthBuffer);
		box.buffer = box.buffer.slice(lengthBuffer.length);
		return length;
	}
	#deserializeBody(types: number[], buffer: Uint8Array) {
		const innerType = types.pop()!;
		const pointers: PointerItem[] = [];
		let data: any = INTERNAL_CODEC[innerType].decode(buffer, this.#deserialize);
		if (innerType === INTERNAL_TYPE_ID.POINTER) {
			data = new Pointer(data, this.#pointers);
		} else if (innerType === INTERNAL_TYPE_ID.UNIQUE_POINTER) {
			if (data >= this.#uniqueValues.length && !this.#ignoreMissedUniqueValue) {
				throw new Error(`Missing unique value: ${data}`);
			}
			data = this.#uniqueValues[data];
		}
		if (isReferable(innerType)) pointers.push([this.#getCodec(innerType), data]);
		while (true) {
			const type = types.pop();
			if (type === undefined) break;
			const codec = this.#getCodec(type) as AnyCodec;
			if (!codec) throw new Error(`Unknown codec: ${type}`);
			data = codec.decode(data);
			pointers.push([codec, data]);
		}
		this.#pointers.push(...pointers.reverse());
		return data;
	}
	#deserialize = (buffer: Uint8Array): any[] => {
		const data: any[] = [];
		const box = { buffer };
		while (box.buffer.length > 0) {
			const types = this.#deserializeType(box);
			const length = this.#deserializeLength(types, box);
			data.push(this.#deserializeBody(types, box.buffer.slice(0, length)));
			box.buffer = box.buffer.slice(length);
		}
		return data;
	};
	#isTypeResolvable(type = this.#types.at(-1)) {
		return type !== undefined && type < CUSTOM_TYPE_ID_BEGIN;
	}
	#assertTypeExists(id: number) {
		if (id < CUSTOM_TYPE_ID_BEGIN) return;
		if (id - CUSTOM_TYPE_ID_BEGIN >= this.#codecMap.length) {
			throw new Error(`Unknown codec: ${id}`);
		}
	}
	#decodeVersion(): boolean {
		if (this.#version !== undefined) return true;
		if (this.#buffer.length === 0) return false;
		this.#version = this.#buffer[0];
		this.#consume(1);
		if (this.#version === 1) return true;
		throw new Error(`Unsupported version: ${this.#version}`);
	}
	#decodeCodecMap(): boolean {
		// Map Length
		if (this.#codecMapLength === undefined) {
			const lengthBuffer = flexUintCodec.getBuffer(this.#buffer);
			if (!lengthBuffer) return false;
			this.#codecMapLength = flexUintCodec.decode(lengthBuffer);
			this.#consume(lengthBuffer.length);
		}
		while (this.#codecMap.length < this.#codecMapLength) {
			// Name Length
			const lengthBuffer = flexUintCodec.getBuffer(this.#buffer);
			if (!lengthBuffer) return false;
			const length = flexUintCodec.decode(lengthBuffer);
			if (this.#buffer.length < lengthBuffer.length + length) return false;
			this.#consume(lengthBuffer.length);
			// Name
			const name = stringCodec.decode(this.#buffer.slice(0, length));
			const codec = this.#codec.get(name);
			if (codec) {
				this.#codecMap.push(codec);
				this.#consume(length);
				continue;
			}
			if (this.#ignoreMissedCodec) continue;
			throw new Error(`Missing codec: ${name}`);
		}
		return this.#codecMap.length === this.#codecMapLength;
	}
	#decodeType(): boolean {
		while (!this.#isTypeResolvable()) {
			const typeBuffer = flexUintCodec.getBuffer(this.#buffer);
			if (!typeBuffer) return false;
			const type = flexUintCodec.decode(typeBuffer);
			this.#assertTypeExists(type);
			this.#types.push(type);
			this.#consume(typeBuffer.length);
		}
		return true;
	}
	#decodeLength(): boolean {
		if (this.#length !== undefined) return true;
		const innerType = this.#types.at(-1)!;
		if (
			innerType === INTERNAL_TYPE_ID.POINTER ||
			innerType === INTERNAL_TYPE_ID.UNIQUE_POINTER
		) {
			const lengthBuffer = flexUintCodec.getBuffer(this.#buffer);
			if (!lengthBuffer) return false;
			this.#length = lengthBuffer.length;
			return true;
		}
		this.#length = INTERNAL_CODEC[innerType].bufferLength;
		if (this.#length !== undefined) return true;
		const lengthBuffer = flexUintCodec.getBuffer(this.#buffer);
		if (!lengthBuffer) return false;
		this.#length = flexUintCodec.decode(lengthBuffer);
		this.#consume(lengthBuffer.length);
		return true;
	}
	#decodeBody(): boolean {
		if (this.#buffer.length < this.#length!) return false;
		const innerType = this.#types.pop()!;
		const pointers: PointerItem[] = [];
		let data: any = INTERNAL_CODEC[innerType].decode(
			this.#buffer.slice(0, this.#length),
			this.#deserialize,
		);
		this.#consume(this.#length!);
		if (innerType === INTERNAL_TYPE_ID.POINTER) {
			data = new Pointer(data, this.#pointers);
		} else if (innerType === INTERNAL_TYPE_ID.UNIQUE_POINTER) {
			if (data >= this.#uniqueValues.length && !this.#ignoreMissedUniqueValue) {
				throw new Error(`Missing unique value: ${data}`);
			}
			data = this.#uniqueValues[data];
		}
		if (isReferable(innerType)) pointers.push([this.#getCodec(innerType), data]);
		while (true) {
			const type = this.#types.pop();
			if (type === undefined) break;
			const codec = this.#getCodec(type) as AnyCodec;
			if (!codec) throw new Error(`Unknown codec: ${type}`);
			data = codec.decode(data);
			pointers.push([codec, data]);
		}
		pointers.reverse();
		this.#pointers.push(...pointers);
		if (this.#root === UNINITIALIZED) {
			this.#root = pointers.length === 0 ? data : pointers[0][1];
		}
		return true;
	}
	#decode() {
		// Version
		if (!this.#decodeVersion()) return;
		// Custom Class Map
		if (!this.#decodeCodecMap()) return;
		// Data Objects
		while (this.#buffer.length > 0) {
			if (!this.#decodeType()) return;
			if (!this.#decodeLength()) return;
			if (!this.#decodeBody()) return;
			this.#length = undefined;
		}
	}
	decode(buffer: BinaryType) {
		if (this.#complete) return;
		if (!isBinary(buffer))
			throw new Error(`Require a buffer but receive ${typeof buffer}`);
		this.#buffer = concatBuffers(this.#buffer, bufferToUint8Array(buffer));
		this.#decode();
	}
	getResult() {
		if (this.#complete) return this.#root;
		// Check
		if (
			!this.#allowIncompleteDecoding &&
			(this.#types.length > 0 || this.#buffer.length > 0)
		) {
			throw new Error('Failure to decode in full');
		}
		// Dereference
		const customCodecPointers: [AnyCodec, any][] = [];
		for (const [codec, data] of this.#pointers) {
			if (!codec.deref) continue;
			if (!INTERNAL_CODEC.includes(codec)) {
				customCodecPointers.push([codec as AnyCodec, data]);
				continue;
			}
			codec.deref(data);
		}
		for (const [codec, data] of customCodecPointers) {
			codec.deref!(data);
		}
		// Complete
		this.#complete = true;
		return this.#root;
	}
}
