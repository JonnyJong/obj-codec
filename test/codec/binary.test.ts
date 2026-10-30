import { describe, expect, it } from 'vitest';
import { TAG } from '../../src/protocol';
import { decodeChunked, encode, roundTrip } from '../helpers';

/** 数组内容的浅比较；用 `Object.is` 以区分 -0 与 0 */
function expectSameArray(a: ArrayLike<unknown>, b: ArrayLike<unknown>) {
	expect(a.length).toBe(b.length);
	for (let i = 0; i < a.length; i++) {
		expect(Object.is(a[i], b[i])).toBe(true);
	}
}

/** 按给定分块大小往返，覆盖跨块边界 */
function roundTripChunked<T>(value: T, size: number): T {
	return decodeChunked(encode(value), size) as T;
}

/** `Float16Array` 可能不在 TS lib 中声明，这里按运行时能力取用 */
const FLOAT16 = (
	globalThis as {
		Float16Array?: new (
			values: number[],
		) => {
			length: number;
			[i: number]: number;
		};
	}
).Float16Array;
const HAS_FLOAT16 = typeof FLOAT16 === 'function';

describe('Binary: 往返', () => {
	it('ArrayBuffer', () => {
		const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
		const result = roundTrip(buffer);
		expect(result).toBeInstanceOf(ArrayBuffer);
		expectSameArray(new Uint8Array(result), new Uint8Array(buffer));
	});
	it('空 ArrayBuffer', () => {
		const result = roundTrip(new ArrayBuffer(0));
		expect(result.byteLength).toBe(0);
	});

	const typedCases: [string, (n: number) => ArrayLike<unknown>][] = [
		['Int8Array', (n) => new Int8Array([-128, -1, 0, 1, 127].slice(0, n))],
		['Uint8Array', (n) => new Uint8Array([0, 1, 128, 255].slice(0, n))],
		['Uint8ClampedArray', (n) => new Uint8ClampedArray([0, 1, 255].slice(0, n))],
		['Int16Array', (n) => new Int16Array([-32768, 0, 32767].slice(0, n))],
		['Uint16Array', (n) => new Uint16Array([0, 65535].slice(0, n))],
		['Int32Array', (n) => new Int32Array([-2147483648, 2147483647].slice(0, n))],
		['Uint32Array', (n) => new Uint32Array([0, 4294967295].slice(0, n))],
		['Float32Array', (n) => new Float32Array([-1.5, 0, 3.25].slice(0, n))],
		['Float64Array', (n) => new Float64Array([-1.1, 0, Math.PI].slice(0, n))],
	];

	for (const [name, make] of typedCases) {
		for (const count of [0, 1, 3]) {
			it(`${name} (${count} 个元素)`, () => {
				const value = make(count);
				const result = roundTrip(value);
				expect(result.constructor.name).toBe(name);
				expectSameArray(result as ArrayLike<unknown>, value);
			});
		}
	}

	it('BigInt64Array', () => {
		const value = new BigInt64Array([-1n, 0n, 2n ** 62n]);
		const result = roundTrip(value);
		expect(result.constructor.name).toBe('BigInt64Array');
		expectSameArray(result, value);
	});
	it('BigUint64Array', () => {
		const value = new BigUint64Array([0n, 2n ** 63n, 2n ** 64n - 1n]);
		expectSameArray(roundTrip(value), value);
	});
	it('DataView', () => {
		const buffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
		const value = new DataView(buffer);
		const result = roundTrip(value);
		expect(result).toBeInstanceOf(DataView);
		expect(result.byteLength).toBe(5);
		expect(result.getUint8(0)).toBe(1);
		expect(result.getUint8(4)).toBe(5);
	});

	if (HAS_FLOAT16 && FLOAT16) {
		it('Float16Array', () => {
			const value = new FLOAT16([-1.5, 0, 2.5]);
			const result = roundTrip(value);
			expect(result.constructor.name).toBe('Float16Array');
			expectSameArray(result, value);
		});
	}
});

describe('Binary: 偏移与切片', () => {
	it('Uint8Array 保留偏移语义', () => {
		const buffer = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]).buffer;
		// offset=2, length=3 -> [2,3,4]
		const view = new Uint8Array(buffer, 2, 3);
		const result = roundTrip(view);
		expectSameArray(result, [2, 3, 4]);
		// 解码结果从 0 开始，不保留原缓冲区的偏移
		expect(result.byteOffset).toBe(0);
	});
	it('Uint16Array 按元素计偏移', () => {
		const buffer = new ArrayBuffer(16);
		new Uint16Array(buffer, 0, 4).set([1, 2, 3, 4]);
		// 元素偏移 2 -> [3,4]
		const view = new Uint16Array(buffer, 4, 2);
		expectSameArray(roundTrip(view), [3, 4]);
	});
	it('DataView 保留切片', () => {
		const buffer = new Uint8Array([9, 8, 7, 6, 5]).buffer;
		const view = new DataView(buffer, 1, 3);
		const result = roundTrip(view);
		expect(result.byteLength).toBe(3);
		expect(result.getUint8(0)).toBe(8);
		expect(result.getUint8(2)).toBe(6);
	});
	it('只编码视图可见的部分', () => {
		const buffer = new Uint8Array([1, 2, 3, 100, 100, 100]).buffer;
		const view = new Uint8Array(buffer, 0, 3);
		const bytes = encode(view);
		// 最后三个 100 不应出现在输出里
		expect([...bytes].includes(100)).toBe(false);
	});
});

describe('Binary: ID 与引用', () => {
	it('每种类型用独立 ID', () => {
		const expects: [unknown, number][] = [
			[new ArrayBuffer(1), TAG.ARRAY_BUFFER],
			[new Int8Array(1), TAG.I8_ARRAY],
			[new Uint8Array(1), TAG.U8_ARRAY],
			[new Uint8ClampedArray(1), TAG.U8C_ARRAY],
			[new Int16Array(1), TAG.I16_ARRAY],
			[new Uint16Array(1), TAG.U16_ARRAY],
			[new Int32Array(1), TAG.I32_ARRAY],
			[new Uint32Array(1), TAG.U32_ARRAY],
			[new Float32Array(1), TAG.F32_ARRAY],
			[new Float64Array(1), TAG.F64_ARRAY],
			[new BigInt64Array(1), TAG.BI64_ARRAY],
			[new BigUint64Array(1), TAG.BU64_ARRAY],
			[new DataView(new ArrayBuffer(1)), TAG.DATA_VIEW],
		];
		for (const [value, tag] of expects) {
			// 首字节是版本，第二字节是类型 ID
			expect(encode(value)[1]).toBe(tag);
		}
	});
	it('二进制可被引用', () => {
		const shared = new Uint8Array([1, 2, 3]);
		const result = roundTrip([shared, shared]);
		expect(result[0]).toBe(result[1]);
	});
	it('相同内容的不同实例不合并', () => {
		// 与 JS 的 === 语义一致：不同实例就是不同值
		const a = new Uint8Array([1, 2]);
		const b = new Uint8Array([1, 2]);
		const result = roundTrip([a, b]);
		expect(result[0]).not.toBe(result[1]);
		expectSameArray(result[0], [1, 2]);
	});
	it('二进制不会被当成普通对象', () => {
		// Uint8Array 没有可枚举自有属性，若误判为对象会编码成空对象
		const result = roundTrip(new Uint8Array([1, 2, 3]));
		expect(result).toBeInstanceOf(Uint8Array);
	});
});

describe('Binary: 流式', () => {
	it('大内容逐字节解码', () => {
		const value = new Uint8Array(500);
		for (let i = 0; i < value.length; i++) value[i] = i % 256;
		expectSameArray(roundTripChunked(value, 1), value);
	});
	it('各种分块大小一致', () => {
		const value = new Float64Array([1.5, -2.5, 3.5]);
		for (const size of [1, 2, 3, 5, 8, 17]) {
			expectSameArray(roundTripChunked(value, size), value);
		}
	});
	it('嵌套在容器里', () => {
		const value = { data: new Uint8Array([1, 2]), list: [new Int16Array([3])] };
		const result = roundTripChunked(value, 2);
		expectSameArray(result.data, [1, 2]);
		expectSameArray(result.list[0], [3]);
	});
});

describe('Binary: 子类', () => {
	it('子类按基类往返', () => {
		class MyBytes extends Uint8Array {}
		const value = new MyBytes([1, 2, 3]);
		const result = roundTrip(value);
		// 与 structuredClone 一致：子类身份不保留
		expect(result.constructor).toBe(Uint8Array);
		expectSameArray(result, [1, 2, 3]);
	});
});

describe('Binary: 流式复制', () => {
	it('大块二进制按小块喂入能完整还原', () => {
		const size = 200_000;
		const value = new Uint8Array(size);
		for (let i = 0; i < size; i++) value[i] = i % 251;
		const bytes = encode(value);
		// 用大小不整除的块，制造跨越多个分块的填充
		const step = 7777;
		const result = decodeChunked(bytes, step) as Uint8Array;
		expect(result.length).toBe(size);
		// 抽样校验，避免逐字节比较拖慢测试
		for (let i = 0; i < size; i += 997) expect(result[i]).toBe(value[i]);
		expect(result[size - 1]).toBe(value[size - 1]);
	});
	it('分段填充不会重复写入', () => {
		// 若填充进度记录有误，会出现字节错位或重复
		const value = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
		const bytes = encode(value);
		for (const step of [1, 2, 3, 5]) {
			expectSameArray(decodeChunked(bytes, step) as Uint8Array, value);
		}
	});
	it('同一流中的多个二进制各自独立', () => {
		const a = new Uint8Array([1, 1, 1]);
		const b = new Int16Array([2, 2]);
		const value = { a, b, c: new Uint8Array([3, 3]) };
		const bytes = encode(value);
		const result = decodeChunked(bytes, 2) as typeof value;
		expectSameArray(result.a, a);
		expectSameArray(result.b, b);
		expectSameArray(result.c, [3, 3]);
	});
});
