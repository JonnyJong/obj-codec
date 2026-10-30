import { describe, expect, it } from 'vitest';
import { dateCodec } from '../../src/codecs/date';
import { roundTrip, writeScalar } from '../helpers';

describe('Codec: date', () => {
	it('时间戳往返', () => {
		const value = new Date('2024-01-02T03:04:05.678Z');
		const result = roundTrip(value);
		expect(result.getTime()).toBe(value.getTime());
	});
	it('纪元 0', () => {
		expect(roundTrip(new Date(0)).getTime()).toBe(0);
	});
	it('负时间戳（1970 之前）', () => {
		const value = new Date(-1);
		expect(roundTrip(value).getTime()).toBe(-1);
	});
	it('Invalid Date 往返保持无效', () => {
		expect(Number.isNaN(roundTrip(new Date(Number.NaN)).getTime())).toBe(true);
	});
	it('极大时间戳', () => {
		const value = new Date(8.64e15);
		expect(roundTrip(value).getTime()).toBe(8.64e15);
	});
	it('编码为 8 字节 f64', () => {
		// ID + 8 字节时间戳
		expect(writeScalar(dateCodec, new Date(0))).toHaveLength(9);
	});
	it('不保留自定义属性', () => {
		const value = new Date(0);
		(value as unknown as Record<string, unknown>).extra = 1;
		const result = roundTrip(value) as unknown as Record<string, unknown>;
		expect(result.extra).toBeUndefined();
	});
	it('同一时间的不同实例解出不同对象', () => {
		const a = new Date(0);
		const b = new Date(0);
		const result = roundTrip([a, b]);
		// 与 JS 的 === 语义一致：不同实例就是不同值
		expect(result[0]).not.toBe(result[1]);
		expect(result[0].getTime()).toBe(result[1].getTime());
	});
});
