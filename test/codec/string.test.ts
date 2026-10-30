import { describe, expect, it } from 'vitest';
import { stringCodec } from '../../src/codecs/string';
import { TAG } from '../../src/protocol';
import {
	readScalar,
	roundTrip,
	roundTripBytewise,
	writeScalar,
} from '../helpers';

function check(value: string) {
	const bytes = writeScalar(stringCodec, value);
	expect(bytes[0]).toBe(TAG.STRING);
	expect(readScalar(stringCodec, bytes).value).toBe(value);
	return bytes;
}

describe('Codec: string', () => {
	//#region 基本内容
	it('空字符串', () => {
		const bytes = check('');
		// ID + 长度前缀 0
		expect(bytes).toHaveLength(2);
	});
	it('ASCII', () => {
		check('hello world');
	});
	it('中文（3 字节 / 字）', () => {
		check('你好世界');
	});
	it('emoji（4 字节，代理对）', () => {
		check('😀🎉🚀');
	});
	it('混合内容', () => {
		check('name: 张三 age: 30 😀');
	});
	it('含 NUL 字符', () => {
		check('\u0000\u0000');
	});
	it('含换行与制表符', () => {
		check('a\nb\tc\r\nd');
	});
	//#endregion
	//#region 长度前缀按字节计
	it('长度前缀是字节数而非字符数', () => {
		const value = '你好';
		const bytes = writeScalar(stringCodec, value);
		// ID + 长度(6 字节) + 6 字节内容
		expect(bytes[1]).toBe(6);
		expect(bytes).toHaveLength(8);
		// 而 JS 的 length 是 2
		expect(value.length).toBe(2);
	});
	it('emoji 的长度按 4 字节计', () => {
		const bytes = writeScalar(stringCodec, '😀');
		expect(bytes[1]).toBe(4);
	});
	//#endregion
	//#region 边界
	it('单字符', () => {
		check('a');
	});
	it('长字符串（跨分块）', () => {
		check('x'.repeat(5000));
	});
	it('长度跨 varint 边界（128 字节）', () => {
		const value = 'x'.repeat(128);
		const bytes = writeScalar(stringCodec, value);
		// 长度 128 需要两字节 varint
		expect(bytes[1] & 0x80).toBeTruthy();
		expect(readScalar(stringCodec, bytes).value).toBe(value);
	});
	it('孤立代理按替换字符编码', () => {
		const bytes = writeScalar(stringCodec, '\ud800');
		// 解码得到 U+FFFD，而不是原始孤立代理
		expect(readScalar(stringCodec, bytes).value).toBe('\ufffd');
	});
	//#endregion
	//#region 集成
	it('容器内重复字符串被引用复用', () => {
		const long = 'x'.repeat(100);
		const value = { a: long, b: long };
		const result = roundTrip(value);
		expect(result.a).toBe(long);
		expect(result.b).toBe(long);
	});
	it('容器内往返', () => {
		const values = ['', 'a', '你好', '😀'];
		expect(roundTrip(values)).toEqual(values);
	});
	it('逐字节流式往返（含多字节字符）', () => {
		const values = ['你好😀世界', 'x'.repeat(200)];
		expect(roundTripBytewise(values)).toEqual(values);
	});
	it('对象键名也走同一编码', () => {
		const value = { 你好: 1, '😀': 2 };
		expect(roundTrip(value)).toEqual(value);
	});
	//#endregion
});
