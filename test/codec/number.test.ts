import { describe, expect, it } from 'vitest';
import { numberCodec } from '../../src/codecs/number';
import { TAG } from '../../src/protocol';
import {
	readScalar,
	roundTrip,
	roundTripBytewise,
	writeScalar,
} from '../helpers';

/** 断言：写出的类型 ID 与读回的值 */
function check<T>(value: T, expectedTag: number) {
	const bytes = writeScalar(numberCodec, value as number);
	expect(bytes[0]).toBe(expectedTag);
	const { value: result } = readScalar(numberCodec, bytes);
	expect(Object.is(result, value)).toBe(true);
	return bytes;
}

describe('Codec: number', () => {
	//#region 0 与 -0
	it('0 用 ZERO，无负载', () => {
		const bytes = check(0, TAG.ZERO);
		expect(bytes).toHaveLength(1);
	});
	it('-0 用 N_ZERO，且保留符号', () => {
		const bytes = check(-0, TAG.N_ZERO);
		expect(bytes).toHaveLength(1);
		// `-0 === 0` 为真，只能用 Object.is 区分
		const { value } = readScalar(numberCodec, bytes);
		expect(Object.is(value, -0)).toBe(true);
		expect(Object.is(value, 0)).toBe(false);
	});
	//#endregion
	//#region 整数
	it('1 用 VARINT', () => {
		check(1, TAG.VARINT);
	});
	it('127（varint 单字节上界）', () => {
		const bytes = check(127, TAG.VARINT);
		expect(bytes).toHaveLength(2);
	});
	it('128（varint 跨字节）', () => {
		const bytes = check(128, TAG.VARINT);
		expect(bytes).toHaveLength(3);
	});
	it('-1 用 N_VARINT', () => {
		check(-1, TAG.N_VARINT);
	});
	it('-128 用 N_VARINT', () => {
		check(-128, TAG.N_VARINT);
	});
	it('MAX_SAFE_INTEGER', () => {
		check(Number.MAX_SAFE_INTEGER, TAG.VARINT);
	});
	it('MIN_SAFE_INTEGER', () => {
		check(Number.MIN_SAFE_INTEGER, TAG.N_VARINT);
	});
	//#endregion
	//#region 浮点与特殊值
	it('非整数用 F64', () => {
		check(1.5, TAG.F64);
	});
	it('-0.5（负小数）用 F64', () => {
		check(-0.5, TAG.F64);
	});
	it('NaN 用 F64 且往返保持 NaN', () => {
		const bytes = writeScalar(numberCodec, Number.NaN);
		expect(bytes[0]).toBe(TAG.F64);
		expect(readScalar(numberCodec, bytes).value).toBeNaN();
	});
	it('Infinity 用 F64', () => {
		check(Number.POSITIVE_INFINITY, TAG.F64);
	});
	it('-Infinity 用 F64', () => {
		check(Number.NEGATIVE_INFINITY, TAG.F64);
	});
	it('超出安全整数的值用 F64', () => {
		check(Number.MAX_SAFE_INTEGER + 1, TAG.F64);
	});
	it('极小值用 F64', () => {
		check(Number.MIN_VALUE, TAG.F64);
	});
	it('F64 能精确承载 0.1 + 0.2', () => {
		check(0.1 + 0.2, TAG.F64);
	});
	//#endregion
	//#region 编码效率
	it('整数比等值浮点省字节', () => {
		const int = writeScalar(numberCodec, 100);
		const float = writeScalar(numberCodec, 100.5);
		expect(int.length).toBeLessThan(float.length);
	});
	it('零比任何其他值省字节', () => {
		const zero = writeScalar(numberCodec, 0);
		for (const value of [1, -1, 1.5, Number.MAX_SAFE_INTEGER]) {
			expect(zero.length).toBeLessThanOrEqual(
				writeScalar(numberCodec, value).length,
			);
		}
	});
	//#endregion
	//#region 集成
	it('容器内往返', () => {
		const values = [0, -0, 1, -1, 127, 128, 1.5, Number.NaN, Infinity];
		const result = roundTrip(values);
		for (let i = 0; i < values.length; i++) {
			expect(Object.is(result[i], values[i])).toBe(true);
		}
	});
	it('逐字节流式往返', () => {
		const values = [0, -0, 1, -1, 1.5, Number.MAX_SAFE_INTEGER];
		const result = roundTripBytewise(values);
		for (let i = 0; i < values.length; i++) {
			expect(Object.is(result[i], values[i])).toBe(true);
		}
	});
	it('作为对象键值往返', () => {
		const value = { a: -0, b: 1.5 };
		const result = roundTrip(value);
		expect(Object.is(result.a, -0)).toBe(true);
		expect(result.b).toBe(1.5);
	});
	//#endregion
});
