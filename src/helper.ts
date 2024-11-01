import { BinaryArray } from 'types';

export function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
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

export const BINARY_TYPES = [
	ArrayBuffer,
	Int8Array,
	Uint8Array,
	Uint8ClampedArray,
	Int16Array,
	Uint16Array,
	Int32Array,
	Uint32Array,
	Float32Array,
	Float64Array,
	BigInt64Array,
	BigUint64Array,
	DataView,
];

export function isBuffer(item: any): boolean {
	for (const type of BINARY_TYPES) {
		if (item instanceof type) return true;
	}
	return false;
}

interface QueueNode<T> {
	item: T;
	next: QueueNode<T> | null;
}

export class LinkedQueue<T> {
	#head: QueueNode<T> | null = null;
	#tail: QueueNode<T> | null = null;
	#length = 0;
	enqueue(item: T): void {
		const node: QueueNode<T> = { item, next: null };
		if (this.#tail === null) {
			this.#head = node;
		} else {
			this.#tail.next = node;
		}
		this.#tail = node;
		this.#length++;
	}
	dequeue(): T | undefined {
		if (this.#head === null) return undefined;
		const item = this.#head.item;
		this.#head = this.#head.next;
		if (this.#head === null) {
			this.#tail = null;
		}
		this.#length--;
		return item;
	}
	get isEmpty(): boolean {
		return this.#length === 0;
	}
}

export function toUint8Array(buffer: BinaryArray) {
	if (buffer instanceof ArrayBuffer) {
		return new Uint8Array(buffer);
	}
	return new Uint8Array(buffer.buffer);
}
