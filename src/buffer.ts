import { concatBytes, Queue } from './utils';

//#region 通用接口

/**
 * 字节写入器
 * @description
 * 所有多字节整数一律小端序
 */
export interface Writer {
	/** 累计已写入的字节数 */
	readonly bytesWritten: number;
	u8(v: number): void;
	i8(v: number): void;
	u16(v: number): void;
	i16(v: number): void;
	u32(v: number): void;
	i32(v: number): void;
	f32(v: number): void;
	f64(v: number): void;
	/**
	 * LEB128 无符号变长整数
	 * @param v 需为安全非负整数
	 * @example
	 * if (Number.isSafeInteger(v) && v > 0) writer.varint(v)
	 */
	varint(v: number): void;
	/**
	 * EB128 无符号变长整数
	 * @param v 需为非负 BigInt
	 * @example
	 * if (v >= 0) writer.varintBig(v)
	 */
	varintBig(v: bigint): void;
	/** 写入原始字节 */
	bytes(v: Uint8Array): void;
	/**
	 * 直接写入 UTF-8 字符串
	 * @description
	 * 若需要自动处理长度，应使用 {@link utf8Prefixed}
	 */
	utf8(v: string): void;
	/**
	 * `varint` 长度前缀 + UTF-8 字符串
	 * @description
	 * 自动写入长度前缀，无需计算长度
	 */
	utf8Prefixed(v: string): void;
}

/**
 * 字节读取器
 * @description
 * 所有多字节整数一律小端序。
 *
 * 全部方法同步且不阻塞，数据不够时抛 {@link WouldBlock}，
 * 补足数据后可从同一位置重新读取。
 *
 * 所有方法均为原子读取，数据不足时不会消费缓冲区。
 */
export interface Reader {
	u8(): number;
	i8(): number;
	u16(): number;
	i16(): number;
	u32(): number;
	i32(): number;
	f32(): number;
	f64(): number;
	varint(): number;
	varintBig(): bigint;
	/** 读取 `length` 字节的副本 */
	bytes(length: number): Uint8Array;
	/**
	 * 尽力填满目标缓冲区
	 * @returns 本次实际填充的字节数
	 * @description
	 * 该方法会消费实际复制的缓冲区，不会抛出 {@link WouldBlock}
	 */
	fill(target: Uint8Array): number;
	/** 读取 `length` 字节并按 UTF-8 解码 */
	utf8(length: number): string;
	/**
	 * 自动处理长度前缀并读取 UTF-8 字符串
	 * @description
	 * 与 {@link Writer.utf8Prefixed} 对称。
	 */
	utf8Prefixed(): string;
}

/** 可增量推入数据的写入器 */
export interface ChunkWriter extends Writer {
	/** 尚未被取走的字节数 */
	readonly pending: number;
	/**
	 * 取出一个已就绪的分块
	 * @returns 暂时没有返回 `undefined`
	 */
	take(): Uint8Array | undefined;
	/** 结束写入并取走全部剩余字节 */
	finish(): Uint8Array;
	/** 丢弃全部数据 */
	reset(): void;
}

/** 可增量推入数据的读取器 */
export interface ChunkReader extends Reader {
	/** 已消费的绝对字节数 */
	readonly position: number;
	/** 尚未消费的字节数 */
	readonly buffered: number;
	/** 数据源是否已结束 */
	readonly ended: boolean;
	/** 仍被保留的最小绝对位置 */
	readonly front: number;
	/** 推入数据 */
	push(chunk: Uint8Array): void;
	/** 标记数据源结束 */
	end(): void;
	/**
	 * 跳到绝对位置
	 * @description
	 * 只能落在 `[front, position + buffered]` 内
	 */
	seek(position: number): void;
	/** 释放 `position` 之前的字节 */
	discard(position: number): void;
	/** 丢弃全部数据 */
	reset(): void;
}

/** 数据不足，补足后可重试 */
export class WouldBlock {
	/** 还差多少字节 */
	readonly required: number;
	constructor(required: number) {
		this.required = required;
	}
}

/** 数据源已结束，但所需字节仍未到齐 */
export class UnexpectedEnd extends Error {
	/** 还差多少字节 */
	readonly required: number;
	constructor(required: number) {
		super(`Unexpected end: require ${required} more byte(s)`);
		this.name = 'UnexpectedEnd';
		this.required = required;
	}
}

//#endregion

//#region #工具

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder('utf-8', { ignoreBOM: true });

/** 默认分块大小 */
export const DEFAULT_CHUNK_SIZE = 16 * 1024;

/**
 * 小块合并阈值
 * @description
 * 小于此值的分块会被合并，避免碎片过多
 */
const COALESCE_LIMIT = 256;

/** 紧凑阈值 */
const COMPACT_THRESHOLD = 64;

/** 安全整数上限的 BigInt 形式 */
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/** 初始缓冲区容量 */
const INITIAL_CAPACITY = 1024;

//#endregion

//#region #写入器

export class BufferWriter implements ChunkWriter {
	/** 当前缓冲 */
	#buf: Uint8Array;
	#view: DataView;
	/** 当前缓冲已写入的字节数 */
	#offset = 0;
	/** 分块大小 */
	#chunkSize: number;
	/**
	 * 已就绪
	 * @description
	 * 等待取走的分块
	 */
	#ready = new Queue<Uint8Array>();
	/**
	 * `#ready` 中分块的字节总数
	 * @description
	 * 避免为查询而遍历队列
	 */
	#readyBytes = 0;
	#written = 0;
	/**
	 * UTF-8 编码中转区
	 * @description
	 * 编码临时缓冲区，按需扩容不缩容
	 */
	#utf8Scratch = new Uint8Array(0);
	constructor(chunkSize = DEFAULT_CHUNK_SIZE) {
		if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
			throw new RangeError('chunkSize must be a positive safe integer');
		}
		this.#chunkSize = chunkSize;
		this.#buf = new Uint8Array(Math.min(INITIAL_CAPACITY, chunkSize));
		this.#view = new DataView(this.#buf.buffer);
	}
	get bytesWritten(): number {
		return this.#written + this.#offset;
	}
	get pending(): number {
		return this.#readyBytes + this.#offset;
	}
	//#region 缓冲管理
	/** 确保当前缓冲区至少还能写 `n` 字节 */
	#ensure(n: number): void {
		const need = this.#offset + n;
		if (need <= this.#buf.length) return;
		let capacity = this.#buf.length;
		while (capacity < need) capacity *= 2;
		const next = new Uint8Array(capacity);
		next.set(this.#buf.subarray(0, this.#offset));
		this.#buf = next;
		this.#view = new DataView(next.buffer);
	}
	/**
	 * 已写部分的视图
	 * @description
	 * 容量远大于数据时复制一份，否则转出去的视图会一直拴住整块内存。
	 */
	#sliceWritten(): Uint8Array {
		if (this.#offset * 2 < this.#buf.length) {
			return this.#buf.slice(0, this.#offset);
		}
		return this.#buf.subarray(0, this.#offset);
	}
	#resetBuffer(capacity: number): void {
		this.#buf = new Uint8Array(capacity);
		this.#view = new DataView(this.#buf.buffer);
		this.#offset = 0;
	}
	/** 确保 UTF-8 中转区至少有 `n` 字节 */
	#ensureUtf8Scratch(n: number): Uint8Array {
		if (this.#utf8Scratch.length < n) {
			this.#utf8Scratch = new Uint8Array(Math.max(n, n * 2));
		}
		return this.#utf8Scratch;
	}
	/** 把当前已写部分固定成一个分块，再把 `chunk` 作为独立分块追加 */
	#standalone(chunk: Uint8Array): void {
		if (this.#offset > 0) {
			const slice = this.#sliceWritten();
			this.#ready.enqueue(slice);
			this.#readyBytes += slice.length;
			this.#written += this.#offset;
			this.#resetBuffer(this.#chunkSize);
		}
		if (chunk.length > 0) {
			this.#ready.enqueue(chunk);
			this.#readyBytes += chunk.length;
			this.#written += chunk.length;
		}
	}
	//#endregion
	//#region 分块输出
	take(): Uint8Array | undefined {
		const ready = this.#ready.dequeue();
		if (ready) {
			this.#readyBytes -= ready.length;
			return ready;
		}
		if (this.#offset < this.#chunkSize) return undefined;
		const out = this.#sliceWritten();
		this.#written += this.#offset;
		this.#resetBuffer(this.#chunkSize);
		return out;
	}
	finish(): Uint8Array {
		if (this.#offset > 0) {
			const slice = this.#sliceWritten();
			this.#ready.enqueue(slice);
			this.#readyBytes += slice.length;
			this.#written += this.#offset;
		}
		this.#resetBuffer(Math.min(INITIAL_CAPACITY, this.#chunkSize));
		if (this.#ready.done) return new Uint8Array(0);
		// 只有一个分块时直接返回，省掉一次合并
		const first = this.#ready.dequeue();
		if (!first) return new Uint8Array(0);
		this.#readyBytes = 0;
		if (this.#ready.done) return first;
		const parts = [first];
		let next = this.#ready.dequeue();
		while (next !== undefined) {
			parts.push(next);
			next = this.#ready.dequeue();
		}
		return concatBytes(parts);
	}
	reset(): void {
		this.#ready.clear();
		this.#readyBytes = 0;
		this.#written = 0;
		this.#resetBuffer(Math.min(INITIAL_CAPACITY, this.#chunkSize));
	}
	//#endregion
	//#region Writer
	u8(v: number): void {
		this.#ensure(1);
		this.#view.setUint8(this.#offset++, v);
	}
	i8(v: number): void {
		this.#ensure(1);
		this.#view.setInt8(this.#offset++, v);
	}
	u16(v: number): void {
		this.#ensure(2);
		this.#view.setUint16(this.#offset, v, true);
		this.#offset += 2;
	}
	i16(v: number): void {
		this.#ensure(2);
		this.#view.setInt16(this.#offset, v, true);
		this.#offset += 2;
	}
	u32(v: number): void {
		this.#ensure(4);
		this.#view.setUint32(this.#offset, v, true);
		this.#offset += 4;
	}
	i32(v: number): void {
		this.#ensure(4);
		this.#view.setInt32(this.#offset, v, true);
		this.#offset += 4;
	}
	f32(v: number): void {
		this.#ensure(4);
		this.#view.setFloat32(this.#offset, v, true);
		this.#offset += 4;
	}
	f64(v: number): void {
		this.#ensure(8);
		this.#view.setFloat64(this.#offset, v, true);
		this.#offset += 8;
	}
	varint(v: number): void {
		if (!Number.isSafeInteger(v) || v < 0) {
			throw new RangeError('varint: require a non-negative safe integer');
		}
		this.#ensure(8);
		let offset = this.#offset;
		const buf = this.#buf;
		while (v >= 0x80) {
			buf[offset++] = (v % 0x80) | 0x80;
			v = Math.floor(v / 0x80);
		}
		buf[offset++] = v;
		this.#offset = offset;
	}
	varintBig(v: bigint): void {
		if (v < 0n) {
			throw new RangeError('varintBig: require a non-negative bigint');
		}
		// 安全整数直接走 Number 路径
		if (v <= MAX_SAFE_BIGINT) {
			this.varint(Number(v));
			return;
		}
		// 按需精确扩容
		let length = 1;
		for (let rest = v >> 7n; rest > 0n; rest >>= 7n) length++;
		this.#ensure(length);

		let offset = this.#offset;
		const buf = this.#buf;
		while (v >= 0x80n) {
			buf[offset++] = Number(v & 0x7fn) | 0x80;
			v >>= 7n;
		}
		buf[offset++] = Number(v);
		this.#offset = offset;
	}
	bytes(v: Uint8Array): void {
		if (v.length === 0) return;
		// 大块数据直接成为独立分块
		if (v.length >= this.#chunkSize) {
			this.#standalone(v);
		} else {
			this.#ensure(v.length);
			this.#buf.set(v, this.#offset);
			this.#offset += v.length;
		}
	}
	utf8(v: string): void {
		if (v.length === 0) return;
		// 大字符串单独成块
		if (v.length * 3 >= this.#chunkSize) {
			this.#standalone(ENCODER.encode(v));
			return;
		}
		// 每个 UTF-16 码元最多 3 字节，孤立代理会被替换为 3 字节的 U+FFFD
		this.#ensure(v.length * 3);
		const target = this.#buf.subarray(this.#offset);
		const { written } = ENCODER.encodeInto(v, target);
		this.#offset += written;
	}
	utf8Prefixed(v: string): void {
		if (v.length === 0) {
			this.varint(0);
			return;
		}
		// 先编码到中转区，再计算长度并复制
		const scratch = this.#ensureUtf8Scratch(v.length * 3);
		const { written } = ENCODER.encodeInto(v, scratch);
		this.varint(written);
		if (written >= this.#chunkSize) {
			// 中转区复用，必须复制
			this.#standalone(scratch.slice(0, written));
			return;
		}
		this.#ensure(written);
		this.#buf.set(scratch.subarray(0, written), this.#offset);
		this.#offset += written;
	}
	//#endregion
}

//#endregion

//#region #读取器

interface Chunk {
	data: Uint8Array;
	/** 该分块首字节的绝对位置 */
	start: number;
	/** 已释放的前缀长度；不截断 `data`，避免每次 discard 都分配视图 */
	consumed: number;
}

export class BufferReader implements ChunkReader {
	/**
	 * 待消费分块
	 * @description
	 * 按 `start` 递增。
	 *
	 * 逻辑队列，有效区间 `[#head, #list.length)`
	 * 已释放的分块不立即移除，记录索引 {@link #head}，批量移除
	 */
	#list: Chunk[] = [];
	/**
	 * 逻辑队首索引
	 * @description
	 * 索引前条目已释放
	 */
	#head = 0;
	/**
	 * `position` 所在分块的索引
	 * @description
	 * 可能等于 `#list.length`
	 */
	#index = 0;
	/** 已消费的绝对字节数 */
	#position = 0;
	/** 已收到的绝对字节数 */
	#end = 0;
	#ended = false;
	/** 定长读取的中转区，避免跨块时合并分块 */
	#scratch = new Uint8Array(8);
	#scratchView = new DataView(this.#scratch.buffer);
	get position(): number {
		return this.#position;
	}
	get buffered(): number {
		return this.#end - this.#position;
	}
	get ended(): boolean {
		return this.#ended;
	}
	get front(): number {
		if (this.#head >= this.#list.length) return this.#end;
		const head = this.#list[this.#head];
		return head.start + head.consumed;
	}
	push(chunk: Uint8Array): void {
		if (this.#ended) throw new Error('Reader has already ended');
		if (chunk.length === 0) return;
		// 合并小块，避免碎片化；只合并未消费完的尾块，避免索引重定位
		const tail = this.#list.at(this.#list.length - 1);
		if (
			tail &&
			this.#index < this.#list.length &&
			tail.data.length + chunk.length <= COALESCE_LIMIT
		) {
			const merged = new Uint8Array(tail.data.length + chunk.length);
			merged.set(tail.data, 0);
			merged.set(chunk, tail.data.length);
			tail.data = merged;
			this.#end += chunk.length;
			return;
		}
		this.#list.push({ data: chunk, start: this.#end, consumed: 0 });
		this.#end += chunk.length;
	}
	end(): void {
		this.#ended = true;
	}
	seek(position: number): void {
		if (!Number.isSafeInteger(position) || position < 0) {
			throw new RangeError('seek: require a non-negative safe integer');
		}
		if (position > this.#end) {
			throw new RangeError('seek: target is beyond the received data');
		}
		if (position < this.front) {
			throw new RangeError('seek: target has already been dropped');
		}
		this.#position = position;
		this.#relocate();
	}
	discard(position: number): void {
		if (!Number.isSafeInteger(position) || position < 0) {
			throw new RangeError('discard: require a non-negative safe integer');
		}
		// 只能释放已经读过的字节
		if (position > this.#position) {
			throw new RangeError('discard: target is beyond the consumed data');
		}
		// 只丢整块：跨越释放点的分块从中间截断一次即可
		while (this.#head < this.#list.length) {
			const chunk = this.#list[this.#head];
			if (chunk.start + chunk.data.length > position) break;
			this.#head++;
		}
		// 整个列表都释放了：直接清空，让数组缩回复用
		if (this.#head >= this.#list.length) {
			this.#list = [];
			this.#head = 0;
			this.#index = 0;
			return;
		}
		// 避免截断分配新视图（buffer 不因截断提前释放）
		const head = this.#list[this.#head];
		if (head.start + head.consumed < position) {
			head.consumed = position - head.start;
		}
		// 已释放的前缀攒够一定量才真正搬一次
		if (this.#head >= COMPACT_THRESHOLD) {
			this.#list = this.#list.slice(this.#head);
			this.#index = Math.max(0, this.#index - this.#head);
			this.#head = 0;
		}
		// 必须从头重定位：`fill` 会把 `#index` 临时推过所在分块
		this.#relocate();
	}
	reset(): void {
		this.#list = [];
		this.#head = 0;
		this.#index = 0;
		this.#position = 0;
		this.#end = 0;
		this.#ended = false;
	}
	//#region 游标管理
	/**
	 * 从头重新定位 `#index`
	 * @description
	 * 用于 `seek` 和 `push` 后的当前位置修正
	 */
	#relocate(): void {
		let index = this.#head;
		while (index < this.#list.length) {
			const chunk = this.#list[index];
			if (chunk.start + chunk.data.length > this.#position) break;
			index++;
		}
		this.#index = index;
	}
	/**
	 * 推进 `#index`
	 * @description
	 * 跳过已消费完的分块
	 */
	#advance(): void {
		while (this.#index < this.#list.length) {
			const chunk = this.#list[this.#index];
			if (this.#position < chunk.start + chunk.data.length) break;
			this.#index++;
		}
	}
	#need(length: number): void {
		const missing = length - (this.#end - this.#position);
		if (missing <= 0) return;
		this.#blocked(missing);
	}
	/**
	 * 数据不足时抛错
	 * @description
	 * 只读状态，可以放心直接用它中断
	 */
	#blocked(required: number): never {
		if (this.#ended) throw new UnexpectedEnd(required);
		throw new WouldBlock(required);
	}
	/**
	 * 复制 `length` 字节进中转区并推进位置
	 * @param length <= 8
	 * @description
	 * 用于定长整数
	 */
	#fill(length: number): DataView {
		this.#need(length);
		let remaining = length;
		let offset = 0;
		let position = this.#position;
		let index = this.#index;
		while (remaining > 0) {
			const chunk = this.#list[index];
			const at = position - chunk.start;
			const size = Math.min(remaining, chunk.data.length - at);
			this.#scratch.set(chunk.data.subarray(at, at + size), offset);
			offset += size;
			remaining -= size;
			position += size;
			index++;
		}
		this.#position = position;
		this.#advance();
		return this.#scratchView;
	}
	//#endregion
	//#region Reader
	u8(): number {
		this.#need(1);
		const chunk = this.#list[this.#index];
		const value = chunk.data[this.#position - chunk.start];
		this.#position++;
		this.#advance();
		return value;
	}
	i8(): number {
		return this.#fill(1).getInt8(0);
	}
	u16(): number {
		return this.#fill(2).getUint16(0, true);
	}
	i16(): number {
		return this.#fill(2).getInt16(0, true);
	}
	u32(): number {
		return this.#fill(4).getUint32(0, true);
	}
	i32(): number {
		return this.#fill(4).getInt32(0, true);
	}
	f32(): number {
		return this.#fill(4).getFloat32(0, true);
	}
	f64(): number {
		return this.#fill(8).getFloat64(0, true);
	}
	varint(): number {
		let position = this.#position;
		let index = this.#index;
		const list = this.#list;
		let chunk = list[index];
		// 缓存当前分块的末尾绝对位置
		let end = chunk === undefined ? 0 : chunk.start + chunk.data.length;
		let result = 0;
		let factor = 1;
		while (true) {
			if (position >= this.#end) this.#blocked(1);
			while (position >= end) {
				chunk = list[++index];
				end = chunk.start + chunk.data.length;
			}
			const byte = chunk.data[position - chunk.start];
			position++;
			result += (byte & 0x7f) * factor;
			if (byte < 0x80) break;
			factor *= 0x80;
			// 0x80 ** 7
			if (factor > 0x2_00_00_00_00_00_00) {
				throw new RangeError('varint: value is too long');
			}
		}
		if (!Number.isSafeInteger(result)) {
			throw new RangeError('varint: value exceeds safe integer range');
		}
		// 实际消费
		this.#position = position;
		this.#index = index;
		// 只有正好读完当前分块才需要推进游标
		if (position >= end) this.#advance();
		return result;
	}
	varintBig(): bigint {
		let position = this.#position;
		let index = this.#index;
		let result = 0n;
		let shift = 0n;
		while (true) {
			if (position >= this.#end) this.#blocked(1);
			while (position >= this.#list[index].start + this.#list[index].data.length) {
				index++;
			}
			const chunk = this.#list[index];
			const byte = chunk.data[position - chunk.start];
			position++;
			result |= BigInt(byte & 0x7f) << shift;
			if (byte < 0x80) break;
			shift += 7n;
			if (shift > 8192n) throw new RangeError('varintBig: value is too long');
		}
		// 实际消费
		this.#position = position;
		this.#index = index;
		this.#advance();
		return result;
	}
	bytes(length: number): Uint8Array {
		if (!Number.isSafeInteger(length) || length < 0) {
			throw new RangeError('bytes: require a non-negative safe integer');
		}
		if (length === 0) return new Uint8Array(0);
		this.#need(length);
		const chunk = this.#list[this.#index];
		const at = this.#position - chunk.start;
		// 落在一块之内：一次复制即可
		if (chunk.data.length - at >= length) {
			const out = chunk.data.slice(at, at + length);
			this.#position += length;
			this.#advance();
			return out;
		}
		// 跨块：直接拷进目标，避免先拼分块再多复制一次
		const out = new Uint8Array(length);
		let offset = 0;
		let position = this.#position;
		let index = this.#index;
		while (offset < length) {
			const current = this.#list[index];
			const start = position - current.start;
			const size = Math.min(length - offset, current.data.length - start);
			out.set(current.data.subarray(start, start + size), offset);
			offset += size;
			position += size;
			index++;
		}
		this.#position = position;
		this.#advance();
		return out;
	}
	fill(target: Uint8Array): number {
		if (!(target instanceof Uint8Array)) {
			throw new TypeError('fill: require a Uint8Array target');
		}
		if (target.length === 0) return 0;
		let offset = 0;
		let position = this.#position;
		let index = this.#index;
		while (offset < target.length) {
			// 当前分块已读完，往后找下一个
			while (
				index < this.#list.length &&
				position >= this.#list[index].start + this.#list[index].data.length
			) {
				index++;
			}
			// 没有更多数据：返回已填部分，不中断
			if (index >= this.#list.length) break;
			const chunk = this.#list[index];
			const at = position - chunk.start;
			const size = Math.min(target.length - offset, chunk.data.length - at);
			target.set(chunk.data.subarray(at, at + size), offset);
			offset += size;
			position += size;
		}
		// 消费已读
		this.#position = position;
		this.#index = index;
		this.#advance();
		// 释放已读
		this.discard(position);
		return offset;
	}
	utf8(length: number): string {
		if (!Number.isSafeInteger(length) || length < 0) {
			throw new RangeError('utf8: require a non-negative safe integer');
		}
		if (length === 0) return '';
		this.#need(length);
		const chunk = this.#list[this.#index];
		const at = this.#position - chunk.start;
		// 连续时直接解码，节省一次复制
		if (chunk.data.length - at >= length) {
			const text = DECODER.decode(chunk.data.subarray(at, at + length));
			this.#position += length;
			this.#advance();
			return text;
		}
		return DECODER.decode(this.bytes(length));
	}
	utf8Prefixed(): string {
		// 记录进度以便整体回退
		const start = this.#position;
		const startIndex = this.#index;
		const length = this.varint();
		try {
			return this.utf8(length);
		} catch (error) {
			this.#position = start;
			this.#index = startIndex;
			throw error;
		}
	}
	//#endregion
}

//#endregion
