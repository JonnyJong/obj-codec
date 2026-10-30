import { describe, expect, it } from 'vitest';
import {
	BufferReader,
	BufferWriter,
	UnexpectedEnd,
	WouldBlock,
} from '../../src/buffer';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** 把字节序列按 `size` 切片，用于模拟任意分块 */
function slice(bytes: Uint8Array, size: number): Uint8Array[] {
	const chunks: Uint8Array[] = [];
	for (let offset = 0; offset < bytes.length; offset += size) {
		chunks.push(bytes.subarray(offset, offset + size));
	}
	return chunks;
}

/** 一次性写入 */
function write(fn: (writer: BufferWriter) => void, chunkSize?: number) {
	const writer = new BufferWriter(chunkSize);
	fn(writer);
	return writer.finish();
}

/**
 * 造一个「读不够就按 `size` 步进喂数据」的执行器
 * @description
 * 模拟真实的分块解码：读失败（{@link WouldBlock}）时补数据再重试，
 * 喂完则 `end()`，之后读取不足会变成 {@link UnexpectedEnd}。
 */
function createFeeder(
	reader: BufferReader,
	bytes: Uint8Array,
	size = 1,
): <T>(fn: () => T) => T {
	let index = 0;
	return <T>(fn: () => T): T => {
		while (true) {
			try {
				return fn();
			} catch (error) {
				if (!(error instanceof WouldBlock)) throw error;
				if (index >= bytes.length) {
					reader.end();
					continue;
				}
				reader.push(bytes.subarray(index, index + size));
				index += size;
			}
		}
	};
}

describe('Buffer: 整数', () => {
	it('写入小端序', () => {
		const bytes = write((w) => {
			w.u16(0x1234);
			w.i16(-2);
			w.u32(0x12345678);
			w.i32(-2);
			w.f32(1.5);
			w.f64(-1.5);
		});
		expect([...bytes.slice(0, 2)]).toEqual([0x34, 0x12]);
		expect(new DataView(bytes.buffer, bytes.byteOffset).getUint16(0, true)).toBe(
			0x1234,
		);
	});
	it('往返', () => {
		const bytes = write((w) => {
			w.u8(0xff);
			w.i8(-0x80);
			w.u16(0xffff);
			w.i16(-0x8000);
			w.u32(0xffffffff);
			w.i32(-0x80000000);
			w.f32(-0.1);
			w.f64(-0.1);
		});
		const reader = new BufferReader();
		reader.push(bytes);
		reader.end();
		expect(reader.u8()).toBe(0xff);
		expect(reader.i8()).toBe(-0x80);
		expect(reader.u16()).toBe(0xffff);
		expect(reader.i16()).toBe(-0x8000);
		expect(reader.u32()).toBe(0xffffffff);
		expect(reader.i32()).toBe(-0x80000000);
		expect(reader.f32()).toBe(Math.fround(-0.1));
		expect(reader.f64()).toBe(-0.1);
	});
	it('跨分块读取', () => {
		const bytes = write((w) => {
			w.u32(0x11223344);
			w.f64(1.5);
		});
		// 逐字节喂入，强制每次都跨块
		const reader = new BufferReader();
		const feed = createFeeder(reader, bytes, 1);
		expect(feed(() => reader.u32())).toBe(0x11223344);
		expect(feed(() => reader.f64())).toBe(1.5);
	});
});

describe('Buffer: varint', () => {
	it('边界值往返', () => {
		const values = [
			0,
			1,
			0x7f,
			0x80,
			0x3fff,
			0x4000,
			0x1fffff,
			2 ** 32,
			Number.MAX_SAFE_INTEGER,
		];
		for (const value of values) {
			const bytes = write((w) => w.varint(value));
			const reader = new BufferReader();
			reader.push(bytes);
			reader.end();
			expect(reader.varint()).toBe(value);
			// 读完后不应有残留
			expect(reader.buffered).toBe(0);
		}
	});
	it('编码长度随数值增长', () => {
		expect(write((w) => w.varint(0x7f)).length).toBe(1);
		expect(write((w) => w.varint(0x80)).length).toBe(2);
		expect(write((w) => w.varint(0x4000)).length).toBe(3);
	});
	it('拒绝负数与非安全整数', () => {
		const writer = new BufferWriter();
		expect(() => writer.varint(-1)).toThrow(RangeError);
		expect(() => writer.varint(1.5)).toThrow(RangeError);
		expect(() => writer.varint(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
		expect(() => writer.varintBig(-1n)).toThrow(RangeError);
	});
	it('varintBig 往返', () => {
		const values = [0n, 1n, 127n, 128n, 2n ** 64n, 2n ** 200n + 12345n];
		for (const value of values) {
			const bytes = write((w) => w.varintBig(value));
			const reader = new BufferReader();
			reader.push(bytes);
			reader.end();
			expect(reader.varintBig()).toBe(value);
		}
	});
	it('varint 跨分块读取', () => {
		const bytes = write((w) => w.varint(Number.MAX_SAFE_INTEGER));
		const reader = new BufferReader();
		for (const chunk of slice(bytes, 1)) reader.push(chunk);
		reader.end();
		expect(reader.varint()).toBe(Number.MAX_SAFE_INTEGER);
	});
});

describe('Buffer: UTF-8', () => {
	it('往返', () => {
		const samples = ['', 'hello world', '你好世界', '😀 emoji', 'a'.repeat(100)];
		for (const sample of samples) {
			const bytes = write((w) => w.utf8(sample));
			expect(decoder.decode(bytes)).toBe(sample);
			const reader = new BufferReader();
			reader.push(bytes);
			reader.end();
			expect(reader.utf8(bytes.length)).toBe(sample);
		}
	});
	it('跨分块读取（按字节切开多字节字符）', () => {
		const sample = '你好😀世界';
		const bytes = write((w) => w.utf8(sample));
		const reader = new BufferReader();
		// 切成 2 字节一片，必然把一个字符劈开
		for (const chunk of slice(bytes, 2)) reader.push(chunk);
		reader.end();
		expect(reader.utf8(bytes.length)).toBe(sample);
	});
	it('大字符串单独成块', () => {
		const sample = 'x'.repeat(1000);
		const writer = new BufferWriter(16);
		writer.utf8(sample);
		// 不应一次性塞进内部缓冲，而是产生独立分块
		expect(writer.take()).toBeInstanceOf(Uint8Array);
		expect(writer.finish().length).toBe(0);
	});
	it('孤立代理按替换字符编码', () => {
		const sample = '\ud800';
		const bytes = write((w) => w.utf8Prefixed(sample));
		const reader = new BufferReader();
		reader.push(bytes);
		reader.end();
		expect(reader.utf8Prefixed()).toBe('\ufffd');
	});
});

describe('Buffer: utf8Prefixed', () => {
	it('往返，并带上长度前缀', () => {
		const samples = [
			'',
			'a',
			'hello world',
			'你好世界',
			'😀 emoji',
			'x'.repeat(500),
		];
		for (const sample of samples) {
			const bytes = write((w) => w.utf8Prefixed(sample));
			const expected = encoder.encode(sample);
			const reader = new BufferReader();
			reader.push(bytes);
			reader.end();
			// 首字节即长度前缀
			expect(reader.varint()).toBe(expected.length);
			expect(reader.bytes(expected.length)).toEqual(expected);
		}
	});
	it('内容与 utf8 + 前缀一致', () => {
		const samples = ['', 'hello', '你好世界', '😀🎉'];
		for (const sample of samples) {
			const prefixed = write((w) => w.utf8Prefixed(sample));
			const plain = write((w) => w.utf8(sample));
			const reader = new BufferReader();
			reader.push(prefixed);
			reader.end();
			const length = reader.varint();
			expect(reader.bytes(length)).toEqual(plain);
		}
	});
	it('跨分块读取', () => {
		const sample = '你好😀世界'.repeat(20);
		const bytes = write((w) => w.utf8Prefixed(sample));
		const reader = new BufferReader();
		for (const chunk of slice(bytes, 3)) reader.push(chunk);
		reader.end();
		expect(reader.utf8Prefixed()).toBe(sample);
	});
	it('大内容单独成块且不被中转区复用污染', () => {
		const writer = new BufferWriter(16);
		const first = 'a'.repeat(100);
		const second = 'b'.repeat(100);
		writer.utf8Prefixed(first);
		const chunks: Uint8Array[] = [];
		let chunk = writer.take();
		while (chunk) {
			chunks.push(chunk);
			chunk = writer.take();
		}
		// 再写一次，复用中转区
		writer.utf8Prefixed(second);
		chunk = writer.take();
		while (chunk) {
			chunks.push(chunk);
			chunk = writer.take();
		}
		chunks.push(writer.finish());
		const total = chunks.reduce((sum, c) => sum + c.length, 0);
		const merged = new Uint8Array(total);
		let offset = 0;
		for (const c of chunks) {
			merged.set(c, offset);
			offset += c.length;
		}
		const reader = new BufferReader();
		reader.push(merged);
		reader.end();
		// 第一段必须是 first，若被中转区复用覆盖就会变成 second
		expect(reader.utf8Prefixed()).toBe(first);
		expect(reader.utf8Prefixed()).toBe(second);
	});
});

describe('Buffer: fill', () => {
	it('数据齐全时一次填满', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2, 3, 4]));
		const target = new Uint8Array(4);
		expect(reader.fill(target)).toBe(4);
		expect([...target]).toEqual([1, 2, 3, 4]);
		expect(reader.buffered).toBe(0);
	});
	it('数据不足时填多少算多少，不报错', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2]));
		const target = new Uint8Array(5);
		expect(reader.fill(target)).toBe(2);
		expect([...target.subarray(0, 2)]).toEqual([1, 2]);
		// 已消费的 2 字节不会被退回
		expect(reader.buffered).toBe(0);
	});
	it('多次调用可续填同一目标区', () => {
		const reader = new BufferReader();
		const target = new Uint8Array(6);
		reader.push(new Uint8Array([1, 2]));
		const first = reader.fill(target);
		reader.push(new Uint8Array([3, 4]));
		const second = reader.fill(target.subarray(first));
		reader.push(new Uint8Array([5, 6]));
		const third = reader.fill(target.subarray(first + second));
		expect(first + second + third).toBe(6);
		expect([...target]).toEqual([1, 2, 3, 4, 5, 6]);
	});
	it('没有数据时返回 0', () => {
		const reader = new BufferReader();
		expect(reader.fill(new Uint8Array(4))).toBe(0);
	});
	it('释放已复制的字节', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array(100));
		const before = reader.front;
		reader.fill(new Uint8Array(60));
		// 复制出去的 60 字节应当已被释放
		expect(reader.front).toBe(before + 60);
		expect(reader.buffered).toBe(40);
	});
	it('拒绝非 Uint8Array 目标', () => {
		const reader = new BufferReader();
		expect(() => reader.fill([] as never)).toThrow(TypeError);
	});
	it('空目标返回 0 且不推进', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1]));
		expect(reader.fill(new Uint8Array(0))).toBe(0);
		expect(reader.position).toBe(0);
	});
});

describe('Buffer: 读取原子性', () => {
	// 多字节 varint：0x4000 编码为 3 字节
	const VARINT_3 = write((w) => w.varint(0x4000));
	// 0n 以外的多字节 BigInt
	const VARINT_BIG_3 = write((w) => w.varintBig(2n ** 64n));

	it('varint 中途不足时不消费任何字节', () => {
		const reader = new BufferReader();
		// 只给前 2 字节，第 3 字节缺失
		reader.push(VARINT_3.subarray(0, 2));
		expect(() => reader.varint()).toThrow(WouldBlock);
		expect(reader.position).toBe(0);
		// 补齐后可从头完整读出，说明前 2 字节没有被吞掉
		reader.push(VARINT_3.subarray(2));
		expect(reader.varint()).toBe(0x4000);
		expect(reader.buffered).toBe(0);
	});

	it('varint 中断后可按缺口字节数补数据', () => {
		const reader = new BufferReader();
		reader.push(VARINT_3.subarray(0, 1));
		let required = 0;
		try {
			reader.varint();
		} catch (error) {
			required = (error as WouldBlock).required;
		}
		expect(required).toBe(1);
		expect(reader.position).toBe(0);
	});

	it('varintBig 中途不足时不消费任何字节', () => {
		const reader = new BufferReader();
		reader.push(VARINT_BIG_3.subarray(0, 2));
		expect(() => reader.varintBig()).toThrow(WouldBlock);
		expect(reader.position).toBe(0);
		reader.push(VARINT_BIG_3.subarray(2));
		expect(reader.varintBig()).toBe(2n ** 64n);
	});

	it('varint 逐字节喂入也能读全', () => {
		const reader = new BufferReader();
		const feed = createFeeder(
			reader,
			write((w) => w.varint(Number.MAX_SAFE_INTEGER)),
			1,
		);
		expect(feed(() => reader.varint())).toBe(Number.MAX_SAFE_INTEGER);
	});

	it('varint 超长时抛错且不消费', () => {
		const reader = new BufferReader();
		// 9 个 0xff：超过安全整数的承载能力
		reader.push(new Uint8Array(9).fill(0xff));
		expect(() => reader.varint()).toThrow(RangeError);
		expect(reader.position).toBe(0);
	});

	it('utf8Prefixed 内容不足时前缀也一并回退', () => {
		const sample = '你好世界';
		const bytes = write((w) => w.utf8Prefixed(sample));
		const reader = new BufferReader();
		// 只给到「前缀 + 部分内容」
		reader.push(bytes.subarray(0, 3));
		expect(() => reader.utf8Prefixed()).toThrow(WouldBlock);
		expect(reader.position).toBe(0);
		// 补齐后前缀没有被重复消费
		reader.push(bytes.subarray(3));
		expect(reader.utf8Prefixed()).toBe(sample);
	});

	it('utf8Prefixed 前缀本身不足时也不推进', () => {
		const bytes = write((w) => w.utf8Prefixed('x'.repeat(200)));
		const reader = new BufferReader();
		reader.push(bytes.subarray(0, 1));
		expect(() => reader.utf8Prefixed()).toThrow(WouldBlock);
		expect(reader.position).toBe(0);
	});

	it('bytes 失败时不推进位置', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2]));
		expect(() => reader.bytes(4)).toThrow(WouldBlock);
		expect(reader.position).toBe(0);
	});

	it('utf8 失败时不推进位置', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2]));
		expect(() => reader.utf8(4)).toThrow(WouldBlock);
		expect(reader.position).toBe(0);
	});

	it('bytes/utf8 拒绝非法长度且不推进', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2, 3]));
		expect(() => reader.bytes(-1)).toThrow(RangeError);
		expect(() => reader.utf8(1.5)).toThrow(RangeError);
		expect(reader.position).toBe(0);
	});
});

describe('Buffer: bytes', () => {
	it('往返', () => {
		const source = new Uint8Array([1, 2, 3, 4, 5]);
		const bytes = write((w) => w.bytes(source));
		expect(bytes).toEqual(source);
		const reader = new BufferReader();
		reader.push(bytes);
		reader.end();
		expect(reader.bytes(5)).toEqual(source);
	});
	it('返回独立副本', () => {
		const bytes = write((w) => w.bytes(new Uint8Array([1, 2, 3])));
		const reader = new BufferReader();
		reader.push(bytes);
		reader.end();
		const first = reader.bytes(3);
		reader.seek(0);
		const second = reader.bytes(3);
		expect(first).toEqual(second);
		expect(first.buffer).not.toBe(second.buffer);
		first[0] = 9;
		expect(second[0]).toBe(1);
	});
	it('大块数据不复制进内部缓冲', () => {
		const source = new Uint8Array(1000).fill(7);
		const writer = new BufferWriter(16);
		writer.bytes(source);
		// 直接引用同一块内存
		expect(writer.take()).toBe(source);
	});
	it('跨分块读取', () => {
		const source = new Uint8Array(100).map((_, i) => i);
		const reader = new BufferReader();
		for (const chunk of slice(source, 7)) reader.push(chunk);
		reader.end();
		expect(reader.bytes(100)).toEqual(source);
	});
});

describe('Buffer: 写入器分块', () => {
	it('未满一块时不产出分块', () => {
		const writer = new BufferWriter(8);
		writer.u8(1);
		expect(writer.take()).toBeUndefined();
		writer.u8(2);
		expect(writer.finish()).toEqual(new Uint8Array([1, 2]));
	});
	it('写满一块后可取出', () => {
		const writer = new BufferWriter(4);
		writer.bytes(new Uint8Array([1, 2, 3, 4]));
		expect(writer.take()).toEqual(new Uint8Array([1, 2, 3, 4]));
		expect(writer.take()).toBeUndefined();
	});
	it('分块内容拼起来等于整体', () => {
		const writer = new BufferWriter(5);
		const values = Array.from({ length: 20 }, (_, i) => i % 256);
		for (const value of values) writer.u8(value);
		const chunks: Uint8Array[] = [];
		let chunk = writer.take();
		while (chunk) {
			chunks.push(chunk);
			chunk = writer.take();
		}
		chunks.push(writer.finish());
		const total = chunks.reduce((sum, c) => sum + c.length, 0);
		const merged = new Uint8Array(total);
		let offset = 0;
		for (const c of chunks) {
			merged.set(c, offset);
			offset += c.length;
		}
		expect(merged).toEqual(new Uint8Array(values));
	});
	it('bytesWritten 统计全部写入量', () => {
		const writer = new BufferWriter(4);
		writer.u8(1);
		writer.bytes(new Uint8Array([2, 3]));
		expect(writer.bytesWritten).toBe(3);
		writer.take();
		expect(writer.bytesWritten).toBe(3);
		writer.bytes(new Uint8Array(100));
		expect(writer.bytesWritten).toBe(103);
	});
	it('reset 后可复用', () => {
		const writer = new BufferWriter(4);
		writer.u8(1);
		writer.u8(2);
		writer.take();
		writer.reset();
		expect(writer.bytesWritten).toBe(0);
		expect(writer.finish().length).toBe(0);
		writer.u8(9);
		expect(writer.finish()).toEqual(new Uint8Array([9]));
	});
	it('拒绝非法分块大小', () => {
		expect(() => new BufferWriter(0)).toThrow(RangeError);
		expect(() => new BufferWriter(1.5)).toThrow(RangeError);
	});
});

describe('Buffer: 读取器', () => {
	it('数据不足抛 WouldBlock 并带上缺口', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1]));
		expect(() => reader.u8()).not.toThrow();
		expect(() => reader.u32()).toThrow(WouldBlock);
		try {
			reader.u32();
		} catch (error) {
			expect((error as WouldBlock).required).toBe(4);
		}
	});
	it('结束后数据不足抛 UnexpectedEnd', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2]));
		reader.end();
		expect(() => reader.bytes(3)).toThrow(UnexpectedEnd);
	});
	it('失败读取不推进位置', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2]));
		expect(() => reader.u32()).toThrow(WouldBlock);
		expect(reader.position).toBe(0);
		reader.push(new Uint8Array([3, 4]));
		expect(reader.u32()).toBe(0x04030201);
	});
	it('seek 可回退重读', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2, 3]));
		reader.end();
		const mark = reader.position;
		expect(reader.u8()).toBe(1);
		reader.seek(mark);
		expect(reader.u8()).toBe(1);
	});
	it('seek 越界或已释放时报错', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2, 3]));
		expect(() => reader.seek(4)).toThrow(RangeError);
		expect(() => reader.seek(-1)).toThrow(RangeError);
		reader.u8();
		reader.discard(1);
		expect(() => reader.seek(0)).toThrow(RangeError);
	});
	it('discard 释放已消费字节', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2, 3, 4]));
		reader.u8();
		reader.u8();
		reader.discard(2);
		expect(reader.front).toBe(2);
		expect(reader.buffered).toBe(2);
		expect(reader.u8()).toBe(3);
	});
	it('discard 可落在分块中间', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2, 3]));
		reader.push(new Uint8Array([4, 5, 6]));
		expect(reader.bytes(4)).toEqual(new Uint8Array([1, 2, 3, 4]));
		reader.discard(4);
		expect(reader.front).toBe(4);
		expect(reader.buffered).toBe(2);
		expect(reader.u8()).toBe(5);
	});
	it('discard 不能越过已消费位置', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2, 3]));
		expect(() => reader.discard(2)).toThrow(RangeError);
	});
	it('逐字节喂入不丢数据', () => {
		const source = new Uint8Array(50).map((_, i) => i);
		const reader = new BufferReader();
		for (let i = 0; i < source.length; i++)
			reader.push(source.subarray(i, i + 1));
		reader.end();
		expect(reader.bytes(50)).toEqual(source);
	});
	it('结束后不可再推入数据', () => {
		const reader = new BufferReader();
		reader.end();
		expect(() => reader.push(new Uint8Array([1]))).toThrow(Error);
	});
	it('reset 后可复用', () => {
		const reader = new BufferReader();
		reader.push(new Uint8Array([1, 2, 3]));
		reader.u8();
		reader.reset();
		expect(reader.position).toBe(0);
		expect(reader.buffered).toBe(0);
		expect(reader.ended).toBe(false);
		reader.push(new Uint8Array([9]));
		reader.end();
		expect(reader.u8()).toBe(9);
	});
});
