import { AnyCodec, BinaryType, CodecMap } from './types';

interface QueueNode<T> {
	value: T;
	next?: QueueNode<T>;
}

export class Queue<T> {
	#head?: QueueNode<T>;
	#tail?: QueueNode<T>;
	#size = 0;
	get size() {
		return this.#size;
	}
	enqueue(value: T) {
		const node: QueueNode<T> = { value };
		if (this.#head) {
			this.#tail!.next = node;
			this.#tail = node;
		} else {
			this.#head = node;
			this.#tail = node;
		}
		this.#size++;
		return this.#size;
	}
	dequeue() {
		if (!this.#head) return;
		const removed = this.#head;
		this.#head = this.#head.next;
		if (!this.#head) this.#tail = undefined;
		this.#size--;
		return removed.value;
	}
	*iter(): Generator<T, void, T> {
		while (true) {
			const value = this.dequeue();
			if (value === undefined) return;
			yield value;
		}
	}
}

/** 合并缓冲区 */
export function concatBuffers(
	...buffers: (Uint8Array | number[])[]
): Uint8Array {
	let totalLength = 0;
	for (const buffer of buffers) {
		totalLength += buffer.length;
	}
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const buffer of buffers) {
		result.set(buffer, offset);
		offset += buffer.length;
	}
	return result;
}

/** 转 Uint8Array */
export function bufferToUint8Array(buffer: BinaryType) {
	if (buffer instanceof ArrayBuffer) {
		return new Uint8Array(buffer);
	}
	return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export const BINARY_TYPES = [
	globalThis.ArrayBuffer,
	globalThis.Int8Array,
	globalThis.Uint8Array,
	globalThis.Uint8ClampedArray,
	globalThis.Int16Array,
	globalThis.Uint16Array,
	globalThis.Int32Array,
	globalThis.Uint32Array,
	globalThis.Float16Array,
	globalThis.Float32Array,
	globalThis.Float64Array,
	globalThis.BigInt64Array,
	globalThis.BigUint64Array,
	globalThis.DataView,
];

export function getBinaryTypeId(data: any) {
	return BINARY_TYPES.findIndex(
		(type) => typeof type === 'function' && data instanceof type,
	);
}

export function isBinary(data: any) {
	for (const type of BINARY_TYPES) {
		if (typeof type !== 'function') continue;
		if (data instanceof type) return true;
	}
	return false;
}

export class Pointer {
	#id: number;
	#pointers: [AnyCodec, any][];
	constructor(id: number, pointers: any[]) {
		this.#id = id;
		this.#pointers = pointers;
	}
	/** 解引用 */
	deref() {
		if (this.#id >= this.#pointers.length) {
			throw new Error(`Unknown pointer: ${this.#id}`);
		}
		return this.#pointers[this.#id][1];
	}
}

export function registerCodec(scope: CodecMap, codec: AnyCodec) {
	// Check types
	if (typeof codec !== 'object') {
		throw new TypeError('codec must be an object');
	}
	if (typeof codec.name !== 'string') {
		throw new TypeError('codec.name must be a string');
	}
	if (typeof codec.decode !== 'function') {
		throw new TypeError('codec.decode must be a function');
	}
	if (typeof codec.encode !== 'function') {
		throw new TypeError('codec.encode must be a function');
	}
	if (typeof codec.class !== 'function') {
		throw new TypeError('codec.class must be a function');
	}
	if (codec.parentClasses) {
		if (!Array.isArray(codec.parentClasses)) {
			throw new TypeError('codec.parentClasses must be a array');
		}
		for (const p of codec.parentClasses) {
			if (typeof p !== 'function') {
				throw new TypeError('parentClasses must be a function');
			}
		}
	}
	// Register codec
	if (scope.has(codec.name)) {
		console.warn(`Codec ${codec.name} already exists, overwriting`);
	}
	scope.set(codec.name, codec);
}

export function mergeCodecs(...codecsList: CodecMap[]): CodecMap {
	const result: CodecMap = new Map();
	for (const codecs of codecsList) {
		for (const [k, v] of codecs) {
			result.set(k, v);
		}
	}
	return result;
}
