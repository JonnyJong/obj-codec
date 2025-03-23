import { bigintCodec } from 'codec/base/bigint';
import { binaryCodec } from 'codec/base/binary';
import { falseCodec, trueCodec } from 'codec/base/boolean';
import { flexUintCodec } from 'codec/base/flexable-unsigned-integer';
import { nullCodec } from 'codec/base/null';
import { numberCodec } from 'codec/base/number';
import { stringCodec } from 'codec/base/string';
import { undefinedCodec } from 'codec/base/undefined';
import { arrayCodec } from 'codec/internal/array';
import { objectCodec } from 'codec/internal/object';
import {
	CUSTOM_TYPE_ID_BEGIN,
	INTERNAL_TYPE_ID,
	INTERNAL_TYPES,
	VERSION,
} from 'global';
import { concatBuffers, isBuffer, LinkedQueue } from 'helper';
import { AnyCodec, BaseCodec, CodecMap, IClass } from 'types';

interface ObjEncoderOptions {
	codec: CodecMap;
	root: any;
	ignoreUnsupportedTypes?: boolean;
}

export class ObjEncoder {
	private _codec: [string, [IClass, AnyCodec]][];
	private _ignoreUnsupportedTypes: boolean;
	private _pointerList: any[];
	private _serializeQueue: LinkedQueue<any> = new LinkedQueue();
	constructor({ codec, root, ignoreUnsupportedTypes }: ObjEncoderOptions) {
		this._codec = [...codec];
		this._ignoreUnsupportedTypes = !!ignoreUnsupportedTypes;
		this._pointerList = [root];
		this._serializeQueue.enqueue(root);
	}
	get ignoreUnsupportedTypes(): boolean {
		return this._ignoreUnsupportedTypes;
	}
	// eslint-disable-next-line class-methods-use-this
	isSupported(item: any): boolean {
		const type = typeof item;
		if (type === 'function') return false;
		// TODO: 唯一\非实例类型（各种类、函数）
		return true;
	}
	serialize(item: any): Uint8Array {
		// TODO: 唯一\非实例类型（各种类、函数）
		const buffer = this.serializeBasicType(item);
		if (buffer !== undefined) return buffer;
		return concatBuffers(
			flexUintCodec.encode(INTERNAL_TYPE_ID.pointer),
			flexUintCodec.encode(this.getPointer(item))
		);
	}
	/**
	 * 获取目标对象的指针
	 * @description
	 * 基本类型不应使用该方法获取指针，
	 * 应当直接编码
	 */
	private getPointer(target: any): number {
		const index = this._pointerList.indexOf(target);
		if (index === -1) {
			this._pointerList.push(target);
			this._serializeQueue.enqueue(target);
			return this._pointerList.length - 1;
		}
		return index;
	}
	private getCodecId(name: string) {
		return this._codec.findIndex(([n]) => n === name) + CUSTOM_TYPE_ID_BEGIN;
	}
	private runInternalEncoder<Data>(
		typeId: number,
		data: Data,
		codec: BaseCodec<Data>
	): Uint8Array {
		const type = flexUintCodec.encode(typeId);
		const buffer = codec.encode(data, this);
		if (codec.encodingLength !== undefined) {
			return concatBuffers(type, buffer);
		}
		return concatBuffers(type, flexUintCodec.encode(buffer.length), buffer);
	}
	private serializeBasicType(item: any): Uint8Array | undefined {
		switch (typeof item) {
			case 'number':
				return this.runInternalEncoder(
					INTERNAL_TYPE_ID.number,
					item,
					numberCodec
				);
			case 'bigint':
				return this.runInternalEncoder(
					INTERNAL_TYPE_ID.bigint,
					item,
					bigintCodec
				);
			case 'boolean':
				return this.runInternalEncoder(
					item ? INTERNAL_TYPE_ID.true : INTERNAL_TYPE_ID.false,
					item,
					item ? trueCodec : falseCodec
				);
			case 'undefined':
				return this.runInternalEncoder(
					INTERNAL_TYPE_ID.undefined,
					item,
					undefinedCodec
				);
		}
		if (item === null) {
			return this.runInternalEncoder(INTERNAL_TYPE_ID.null, item, nullCodec);
		}
		return undefined;
	}
	private serializePointerableType(item: any): Uint8Array | undefined {
		switch (typeof item) {
			case 'string':
				return this.runInternalEncoder(
					INTERNAL_TYPE_ID.string,
					item,
					stringCodec
				);
			case 'symbol':
				return this.runInternalEncoder(
					INTERNAL_TYPE_ID.string,
					item.toString(),
					stringCodec
				);
		}
		return undefined;
	}
	private serializeBinaryType(item: any): Uint8Array | undefined {
		if (!isBuffer(item)) return undefined;
		return this.runInternalEncoder(INTERNAL_TYPE_ID.binary, item, binaryCodec);
	}
	private serializeInternalType(item: any): Uint8Array | undefined {
		for (const { type, typeId, codec } of INTERNAL_TYPES) {
			if (item instanceof type) {
				return this.runInternalEncoder(typeId, item, codec);
			}
		}
		return undefined;
	}
	private serializeFallbackType(item: any): Uint8Array {
		if (Array.isArray(item)) {
			return this.runInternalEncoder(INTERNAL_TYPE_ID.array, item, arrayCodec);
		}
		return this.runInternalEncoder(INTERNAL_TYPE_ID.object, item, objectCodec);
	}
	private rootSerialize(item: any): Uint8Array {
		// TODO: 唯一\非实例类型（各种类、函数）
		// Basic Type
		let buffer = this.serializeBasicType(item);
		if (buffer !== undefined) return buffer;
		// Pointerable Type
		buffer = this.serializePointerableType(item);
		if (buffer !== undefined) return buffer;
		// Binary Type
		buffer = this.serializeBinaryType(item);
		if (buffer !== undefined) return buffer;
		// Custom Type
		for (const [name, [type, codec]] of this._codec) {
			if (!(item instanceof type)) continue;
			const inner = codec.encode(item);
			return concatBuffers(
				flexUintCodec.encode(this.getCodecId(name)),
				this.serialize(inner)
			);
			/* buffer = this.serializeBasicType(inner);
			if (buffer === undefined) buffer = this.serializePointerableType(inner);
			if (buffer === undefined) buffer = this.serializeBinaryType(inner);
			if (buffer === undefined) buffer = this.serializeInternalType(inner);
			if (buffer === undefined) buffer = this.serializeFallbackType(inner);
			return concatBuffers(
				flexNumberCodec.encode(this.getCodecId(name)),
				buffer
			); */
		}
		// Internal Type
		buffer = this.serializeInternalType(item);
		if (buffer !== undefined) return buffer;
		// Fallback Type
		return this.serializeFallbackType(item);
	}
	*encode() {
		// Version
		yield new Uint8Array([VERSION]);
		// Custom Class Map
		yield flexUintCodec.encode(this._codec.length);
		for (const [name] of this._codec) {
			const buffer = stringCodec.encode(name, this);
			yield flexUintCodec.encode(buffer.length);
			yield buffer;
		}
		// Objects
		while (!this._serializeQueue.isEmpty) {
			const item = this._serializeQueue.dequeue();
			if (!this.isSupported(item)) {
				if (this._ignoreUnsupportedTypes) continue;
				throw new Error(`Unsupported type:\n${item}`);
			}
			yield this.rootSerialize(item);
		}
	}
	getStream() {
		return new ReadableStream({
			pull: (controller) => {
				for (const chunk of this.encode()) {
					controller.enqueue(chunk);
				}
				controller.close();
			}
		});
	}
	async toBuffer(): Promise<Uint8Array> {
		const chunks = [];
		for (const chunk of this.encode()) {
			chunks.push(chunk);
		}
		return concatBuffers(...chunks);
	}
}
