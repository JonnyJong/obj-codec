import { describe, expect, it } from 'vitest';
import { BufferReader, BufferWriter } from '../../src/buffer';
import { readerOf } from '../../src/builtins';
import { bigintCodec } from '../../src/codecs/bigint';
import { dateCodec } from '../../src/codecs/date';
import { numberCodec } from '../../src/codecs/number';
import { regexpCodec } from '../../src/codecs/regexp';
import { stringCodec } from '../../src/codecs/string';
import { symbolCodec } from '../../src/codecs/symbol';
import { CUSTOM_BEGIN, TAG, VERSION } from '../../src/protocol';
import type { BuiltinScalarCodec, DecodeContext } from '../../src/types';

/** 写一个值，返回字节 */
function write(
	codec: { write(ctx: { writer: BufferWriter }, value: never): void },
	value: unknown,
): Uint8Array {
	const writer = new BufferWriter();
	codec.write({ writer }, value as never);
	return writer.finish();
}

/** 读一个值：先读 ID，再按 ID 查表 */
function read(bytes: Uint8Array): unknown {
	const reader = new BufferReader();
	reader.push(bytes);
	reader.end();
	const id = reader.u8();
	const fn = readerOf(id);
	if (!fn) throw new Error(`no reader for tag ${id}`);
	return fn({ reader } as DecodeContext);
}

/** 往返：写 -> 读 -> 与原值比较 */
function roundTrip<T>(
	codec: BuiltinScalarCodec<T>,
	value: T,
	equals: (a: T, b: T) => boolean = Object.is,
) {
	const bytes = write(codec as never, value);
	const result = read(bytes) as T;
	expect(equals(result, value)).toBe(true);
	return bytes;
}

describe('内置: 数字多 ID', () => {
	it('0 用 ZERO，无负载', () => {
		const bytes = roundTrip(numberCodec, 0);
		expect([...bytes]).toEqual([TAG.ZERO]);
	});
	it('-0 用 N_ZERO 而非 ZERO', () => {
		const bytes = roundTrip(numberCodec, -0);
		expect([...bytes]).toEqual([TAG.N_ZERO]);
		// 必须保留符号：`-0 === 0` 为真，只能用 Object.is 区分
		expect(Object.is(read(bytes), -0)).toBe(true);
		expect(Object.is(read(bytes), 0)).toBe(false);
	});
	it('正安全整数用 VARINT', () => {
		const bytes = roundTrip(numberCodec, 42);
		expect(bytes[0]).toBe(TAG.VARINT);
	});
	it('负安全整数用 N_VARINT', () => {
		const bytes = roundTrip(numberCodec, -42);
		expect(bytes[0]).toBe(TAG.N_VARINT);
	});
	it('非整数用 F64', () => {
		expect(roundTrip(numberCodec, 1.5)[0]).toBe(TAG.F64);
	});
	it('NaN / Infinity 用 F64 无损往返', () => {
		for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -Infinity]) {
			const bytes = roundTrip(numberCodec, value);
			expect(bytes[0]).toBe(TAG.F64);
			expect(read(bytes)).toBe(value);
		}
	});
	it('极限安全整数往返', () => {
		for (const value of [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]) {
			roundTrip(numberCodec, value);
		}
	});
	it('整数比 F64 省字节', () => {
		expect(write(numberCodec, 100).length).toBeLessThan(
			write(numberCodec, 100.5).length,
		);
	});
});

describe('内置: BigInt 多 ID', () => {
	it('0n 用 BIGINT_ZERO，无负载', () => {
		const bytes = roundTrip(bigintCodec, 0n);
		expect([...bytes]).toEqual([TAG.BIGINT_ZERO]);
	});
	it('正负各用自己的 ID', () => {
		expect(write(bigintCodec, 1n)[0]).toBe(TAG.BIGINT);
		expect(write(bigintCodec, -1n)[0]).toBe(TAG.N_BIGINT);
	});
	it('大数往返', () => {
		const values = [1n, -1n, 127n, 128n, 2n ** 64n, -(2n ** 200n)];
		for (const value of values) roundTrip(bigintCodec, value);
	});
});

describe('内置: Symbol 多 ID', () => {
	it('无描述用 SYMBOL，有描述用 SYMBOL_DESC', () => {
		expect(write(symbolCodec, Symbol())[0]).toBe(TAG.SYMBOL);
		expect(write(symbolCodec, Symbol('x'))[0]).toBe(TAG.SYMBOL_DESC);
	});
	it('Symbol() 与 Symbol(空串) 可区分', () => {
		const bare = write(symbolCodec, Symbol());
		const empty = write(symbolCodec, Symbol(''));
		// 两者 ID 不同，读回来描述也不同
		expect(bare[0]).not.toBe(empty[0]);
		expect((read(bare) as symbol).description).toBeUndefined();
		expect((read(empty) as symbol).description).toBe('');
	});
	it('非 ASCII 描述往返', () => {
		const value = Symbol('你好世界😀');
		expect((read(write(symbolCodec, value)) as symbol).description).toBe(
			value.description,
		);
	});
});

describe('内置: 字符串', () => {
	it('往返', () => {
		for (const value of ['', 'abc', '你好世界', '😀', 'x'.repeat(300)]) {
			expect(roundTrip(stringCodec, value)).toBeInstanceOf(Uint8Array);
		}
	});
	it('用 STRING ID', () => {
		expect(write(stringCodec, 'a')[0]).toBe(TAG.STRING);
	});
});

describe('内置: Date / RegExp', () => {
	it('Date 往返', () => {
		const value = new Date('2024-01-02T03:04:05.678Z');
		const result = read(write(dateCodec, value)) as Date;
		expect(result.getTime()).toBe(value.getTime());
	});
	it('Invalid Date 往返', () => {
		const result = read(write(dateCodec, new Date(Number.NaN))) as Date;
		expect(Number.isNaN(result.getTime())).toBe(true);
	});
	it('RegExp 往返（含标志与非 ASCII 源）', () => {
		const value = /你好[a-z]+/giu;
		const result = read(write(regexpCodec, value)) as RegExp;
		expect(result.source).toBe(value.source);
		expect(result.flags).toBe(value.flags);
	});
	it('RegExp 不保留 lastIndex', () => {
		const value = /a/g;
		value.lastIndex = 5;
		expect((read(write(regexpCodec, value)) as RegExp).lastIndex).toBe(0);
	});
});

describe('内置: 读表', () => {
	it('多个 ID 指向同一类型', () => {
		// 数字的 5 个 ID 都应能读出数字
		for (const id of [TAG.ZERO, TAG.N_ZERO, TAG.VARINT, TAG.N_VARINT, TAG.F64]) {
			expect(readerOf(id)).toBeTypeOf('function');
		}
	});
	it('未占用的 ID 返回 undefined', () => {
		expect(readerOf(TAG.POINTER)).toBeUndefined();
		expect(readerOf(TAG.NULL)).toBeUndefined();
	});
	it('自定义 ID 起点在保留范围之外', () => {
		expect(CUSTOM_BEGIN).toBeGreaterThan(TAG.SYMBOL_DESC);
		expect(readerOf(CUSTOM_BEGIN)).toBeUndefined();
	});
	it('版本号与自定义标志位不冲突', () => {
		expect(VERSION).toBe(0b10);
	});
});
