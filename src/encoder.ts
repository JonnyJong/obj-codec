import { flexUintCodec } from './codec/base/flexible-unsigned-integer';
import { stringCodec } from './codec/base/string';
import {
	CUSTOM_TYPE_ID_BEGIN,
	INTERNAL_CODEC_MAP,
	INTERNAL_TYPE_ID,
	VERSION,
} from './global';
import { CodecMap, InternalTypeName } from './types';
import { Queue, concatBuffers, isBinary } from './utils';

export interface EncodeOptions {
	codec: CodecMap;
	root: any;
	uniqueValues?: any[];
	ignoreUnsupportedTypes?: boolean;
}

type FlatCodec = CodecMap extends Map<infer K, infer V> ? [K, V] : never;

const INTERNAL_TYPES = [
	[RegExp, 'REGEXP'],
	[Date, 'DATE'],
	[Map, 'MAP'],
	[Set, 'SET'],
] as const;

export class Encoder {
	#codec: FlatCodec[];
	#uniqueValues: any[];
	#ignoreUnsupportedTypes: boolean;
	#queue = new Queue();
	#pointers: any[] = [];
	/** 自定义值 → 内部表示；`codec.encode` 对每个值只调用一次 */
	#customPayloads = new Map<any, any>();
	constructor({
		codec,
		uniqueValues,
		ignoreUnsupportedTypes,
		root,
	}: EncodeOptions) {
		this.#codec = [...codec.entries()];
		this.#uniqueValues = uniqueValues ?? [];
		this.#ignoreUnsupportedTypes = !!ignoreUnsupportedTypes;
		this.#queue.enqueue(root);
	}
	/** 登记指针并返回其下标；自定义值会顺带为内部表示占号 */
	#reservePointer(data: any): number {
		const index = this.#pointers.length;
		this.#pointers.push(data);
		this.#reserveCustomPayload(data);
		return index;
	}
	/**
	 * 为自定义值的内部表示预留指针下标
	 * @description
	 * 解码器在同一个数据对象内连续登记「包装值 + 内部表示」，
	 * 所以内部表示必须紧跟在包装值之后占号，
	 * 否则后续兄弟节点的编号会整体错位。
	 */
	#reserveCustomPayload(data: any): void {
		for (const [_, codec] of this.#codec) {
			if (!(data instanceof codec.class)) continue;
			if (this.#customPayloads.has(data)) return;
			const payload = codec.encode(data);
			this.#customPayloads.set(data, payload);
			if (!this.#isReferablePayload(payload)) return;
			if (this.#pointers.indexOf(payload) !== -1) return;
			this.#pointers.push(payload);
			return;
		}
	}
	/**
	 * 内部表示是否会被解码器登记为独立指针
	 * @description
	 * 与 `isReferable` 保持一致：字符串、Symbol、二进制与各类容器都会占号。
	 */
	#isReferablePayload(payload: any): boolean {
		if (this.#uniqueValues.includes(payload)) return false;
		switch (typeof payload) {
			case 'string':
			case 'symbol':
				return true;
			case 'object':
				return payload !== null;
		}
		return false;
	}
	#assertSupported(data: any) {
		if (this.#ignoreUnsupportedTypes) return;
		if (typeof data !== 'function') return;
		if (this.#uniqueValues.includes(data)) return;
		throw new Error(`Unsupported type:\n${data}`);
	}
	#innerSerialize = (data: any): Uint8Array => {
		let index = this.#uniqueValues.indexOf(data);
		if (index !== -1) {
			return concatBuffers(
				[INTERNAL_TYPE_ID.UNIQUE_POINTER],
				flexUintCodec.encode(index),
			);
		}
		const buffer = this.#serializeBasicValue(data);
		if (buffer) return buffer;
		index = this.#pointers.indexOf(data);
		if (index === -1) {
			index = this.#reservePointer(data);
			this.#queue.enqueue(data);
		}
		return concatBuffers([INTERNAL_TYPE_ID.POINTER], flexUintCodec.encode(index));
	};
	#runInternalCodec(type: InternalTypeName, data: any): Uint8Array {
		const head = [INTERNAL_TYPE_ID[type]];
		const body = INTERNAL_CODEC_MAP[type].encode(data, this.#innerSerialize);
		if (typeof INTERNAL_CODEC_MAP[type].bufferLength === 'number') {
			return concatBuffers(head, body);
		}
		return concatBuffers(head, flexUintCodec.encode(body.length), body);
	}
	#serializeUniqueValue(data: any): Uint8Array | null {
		const index = this.#uniqueValues.indexOf(data);
		if (index === -1) return null;
		return concatBuffers(
			[INTERNAL_TYPE_ID.UNIQUE_POINTER],
			flexUintCodec.encode(index),
		);
	}
	#serializeBasicValue(data: any): Uint8Array | null {
		const type = (typeof data).toUpperCase();
		switch (type) {
			case 'NUMBER':
			case 'BIGINT':
			case 'UNDEFINED':
				return this.#runInternalCodec(type, data);
			case 'BOOLEAN':
				return this.#runInternalCodec(data ? 'TRUE' : 'FALSE', data);
		}
		if (data !== null) return null;
		return this.#runInternalCodec('NULL', data);
	}
	#serializeReferableValue(data: any, atRoot?: boolean): Uint8Array | null {
		const index = this.#pointers.indexOf(data);
		if (index === -1) {
			this.#reservePointer(data);
		} else if (!atRoot) {
			return concatBuffers(
				[INTERNAL_TYPE_ID.POINTER],
				flexUintCodec.encode(index),
			);
		}

		const type = (typeof data).toUpperCase();
		switch (type) {
			case 'STRING':
			case 'SYMBOL': {
				return this.#runInternalCodec(type, data);
			}
		}
		return null;
	}
	#serializeBinaryValue(data: any): Uint8Array | null {
		if (!isBinary(data)) return null;
		return this.#runInternalCodec('BINARY', data);
	}
	#serializeCustomValue(data: any): Uint8Array | null {
		for (const [id, [_, codec]] of this.#codec.entries()) {
			if (!(data instanceof codec.class)) continue;
			const payload = this.#customPayloads.get(data) ?? codec.encode(data);
			// 内部表示的指针下标已在 `#reserveCustomPayload` 中预留，
			// 这里必须内联展开，不能退化成指针。
			const body = this.#serialize(payload, true);
			return concatBuffers(flexUintCodec.encode(id + CUSTOM_TYPE_ID_BEGIN), body);
		}
		return null;
	}
	#serializeInternalValue(data: any): Uint8Array | null {
		for (const [type, name] of INTERNAL_TYPES) {
			if (!(data instanceof type)) continue;
			return this.#runInternalCodec(name, data);
		}
		return null;
	}
	#serializeFallbackValue(data: any): Uint8Array {
		if (Array.isArray(data)) {
			return this.#runInternalCodec('ARRAY', data);
		}
		return this.#runInternalCodec('OBJECT', data);
	}
	#serialize(data: any, atRoot?: boolean): Uint8Array {
		this.#assertSupported(data);
		// Unique
		let buffer = this.#serializeUniqueValue(data);
		if (buffer) return buffer;
		// Basic
		buffer = this.#serializeBasicValue(data);
		if (buffer) return buffer;
		// Referable
		buffer = this.#serializeReferableValue(data, atRoot);
		if (buffer) return buffer;
		// Binary
		buffer = this.#serializeBinaryValue(data);
		if (buffer) return buffer;
		// Custom
		buffer = this.#serializeCustomValue(data);
		if (buffer) return buffer;
		// Internal
		buffer = this.#serializeInternalValue(data);
		if (buffer) return buffer;
		// Fallback
		return this.#serializeFallbackValue(data);
	}
	*encode() {
		// Version
		yield new Uint8Array([VERSION]);
		// Custom Class Map
		this.#codec.sort(([_, a], [__, b]) =>
			(a.parentClasses ?? []).includes(b.class) ? -1 : 1,
		);
		yield flexUintCodec.encode(this.#codec.length);
		for (const [name] of this.#codec) {
			const buffer = stringCodec.encode(name);
			yield flexUintCodec.encode(buffer.length);
			yield buffer;
		}
		// Objects
		for (const data of this.#queue.iter()) {
			yield this.#serialize(data, true);
		}
	}
}
