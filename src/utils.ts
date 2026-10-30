/** 合并多个字节序列，空数组直接返回共享的空实例 */
export function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
	if (chunks.length === 0) return new Uint8Array(0);
	if (chunks.length === 1) return chunks[0];
	let total = 0;
	for (const chunk of chunks) total += chunk.length;
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

/** 队列节点 */
interface QueueNode<T> {
	value: T;
	next?: QueueNode<T>;
}

/**
 * 队列
 * @description
 * 链表实现
 */
export class Queue<T> {
	#head?: QueueNode<T>;
	#tail?: QueueNode<T>;
	#size = 0;
	/** 元素个数 */
	get size(): number {
		return this.#size;
	}
	/** 是否为空 */
	get done(): boolean {
		return !this.#head;
	}
	enqueue(value: T): void {
		const node: QueueNode<T> = { value };
		const tail = this.#tail;
		if (this.#head && tail) {
			tail.next = node;
			this.#tail = node;
		} else {
			this.#head = node;
			this.#tail = node;
		}
		this.#size++;
	}
	dequeue(): T | undefined {
		const removed = this.#head;
		if (!removed) return undefined;
		this.#head = removed.next;
		if (!this.#head) this.#tail = undefined;
		this.#size--;
		return removed.value;
	}
	/** 读取队首元素但不移除 */
	peek(): T | undefined {
		return this.#head?.value;
	}
	/** 清空 */
	clear(): void {
		this.#head = undefined;
		this.#tail = undefined;
		this.#size = 0;
	}
}
