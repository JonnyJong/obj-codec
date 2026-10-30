import { describe, expect, it } from 'vitest';
import { roundTrip } from '../helpers';

/** 测试用的正则字面量；提到顶层以满足 lint 规则 */
const RE_ABC = /abc/;
const RE_FLAGS = /abc/gimsuy;
const RE_CJK = /你好[a-z]+/g;
const RE_SLASH = /a\/b/;
const RE_EMPTY = /(?:)/;
const RE_STATE = /a/g;
const RE_MATCH = /^hello (\w+)$/i;

describe('Codec: regexp', () => {
	it('基本源与标志', () => {
		const value = RE_ABC;
		const result = roundTrip(value);
		expect(result.source).toBe('abc');
		expect(result.flags).toBe('');
	});
	it('多个标志', () => {
		const value = RE_FLAGS;
		const result = roundTrip(value);
		expect(result.flags).toBe('gimsuy');
	});
	it('非 ASCII 源', () => {
		const value = RE_CJK;
		const result = roundTrip(value);
		expect(result.source).toBe(value.source);
		expect(result.flags).toBe('g');
	});
	it('源里含斜杠', () => {
		const value = RE_SLASH;
		expect(roundTrip(value).source).toBe('a\\/b');
	});
	it('空源', () => {
		const value = RE_EMPTY;
		const result = roundTrip(value);
		expect(result.source).toBe(value.source);
	});
	it('不保留 lastIndex', () => {
		const value = RE_STATE;
		value.lastIndex = 5;
		expect(roundTrip(value).lastIndex).toBe(0);
	});
	it('可正常用于匹配', () => {
		const result = roundTrip(RE_MATCH);
		expect(result.test('Hello World')).toBe(true);
	});
	it('重复引用同一正则保持同一性', () => {
		const shared = RE_CJK;
		const result = roundTrip([shared, shared]);
		expect(result[0]).toBe(result[1]);
	});
});
