import { describe, expect, it } from 'vitest';
import { bigintCodec } from '../../src/codecs/bigint';
import { TAG } from '../../src/protocol';
import {
	readScalar,
	roundTrip,
	roundTripBytewise,
	writeScalar,
} from '../helpers';

function check(value: bigint, expectedTag: number) {
	const bytes = writeScalar(bigintCodec, value);
	expect(bytes[0]).toBe(expectedTag);
	expect(readScalar(bigintCodec, bytes).value).toBe(value);
	return bytes;
}

describe('Codec: bigint', () => {
	it('0n 用 BIGINT_ZERO，无负载', () => {
		const bytes = check(0n, TAG.BIGINT_ZERO);
		expect(bytes).toHaveLength(1);
	});
	it('1n 用 BIGINT', () => {
		check(1n, TAG.BIGINT);
	});
	it('127n（varint 单字节上界）', () => {
		const bytes = check(127n, TAG.BIGINT);
		expect(bytes).toHaveLength(2);
	});
	it('128n（varint 跨字节）', () => {
		const bytes = check(128n, TAG.BIGINT);
		expect(bytes).toHaveLength(3);
	});
	it('-1n 用 N_BIGINT', () => {
		check(-1n, TAG.N_BIGINT);
	});
	it('-128n 用 N_BIGINT', () => {
		check(-128n, TAG.N_BIGINT);
	});
	it('2^64（超出 safe integer）', () => {
		check(2n ** 64n, TAG.BIGINT);
	});
	it('-(2^200)（超大负数）', () => {
		check(-(2n ** 200n), TAG.N_BIGINT);
	});
	it('超大数（2^1000）往返', () => {
		check(2n ** 1000n, TAG.BIGINT);
	});
	it('远超固定字节容量的值也能正确扩容', () => {
		// 旧实现按 10 字节预留，超出后会越界
		const huge = 2n ** 500n;
		check(huge, TAG.BIGINT);
	});
	it('BigInt 与 Number 互不影响', () => {
		// 1n 与 1 是不同的值，编码后必须能区分
		const bigint = writeScalar(bigintCodec, 1n);
		expect(bigint[0]).toBe(TAG.BIGINT);
		expect(bigint[0]).not.toBe(TAG.VARINT);
	});

	describe('集成', () => {
		it('容器内往返', () => {
			const values = [0n, 1n, -1n, 2n ** 64n, -(2n ** 64n)];
			expect(roundTrip(values)).toEqual(values);
		});
		it('逐字节流式往返', () => {
			const values = [0n, 127n, 128n, 2n ** 200n];
			expect(roundTripBytewise(values)).toEqual(values);
		});
		it('与其他类型混合', () => {
			const value = { n: 1n, s: 'x', i: 1 };
			const result = roundTrip(value);
			expect(result.n).toBe(1n);
			expect(result.i).toBe(1);
		});
	});
});
