import { describe, expect, it } from 'vitest';
import { symbolCodec } from '../../src/codecs/symbol';
import { TAG } from '../../src/protocol';
import {
	readScalar,
	roundTrip,
	roundTripBytewise,
	writeScalar,
} from '../helpers';

describe('Codec: symbol', () => {
	it('无描述用 SYMBOL，零负载', () => {
		const bytes = writeScalar(symbolCodec, Symbol());
		expect(bytes[0]).toBe(TAG.SYMBOL);
		expect(bytes).toHaveLength(1);
		expect(readScalar(symbolCodec, bytes).value.description).toBeUndefined();
	});
	it('有描述用 SYMBOL_DESC', () => {
		const bytes = writeScalar(symbolCodec, Symbol('desc'));
		expect(bytes[0]).toBe(TAG.SYMBOL_DESC);
		expect(readScalar(symbolCodec, bytes).value.description).toBe('desc');
	});
	it('空描述与无描述可区分', () => {
		// `Symbol()` 与 `Symbol('')` 的 description 分别是 undefined 与 ''
		const bare = writeScalar(symbolCodec, Symbol());
		const empty = writeScalar(symbolCodec, Symbol(''));
		expect(bare[0]).not.toBe(empty[0]);
		expect(readScalar(symbolCodec, bare).value.description).toBeUndefined();
		expect(readScalar(symbolCodec, empty).value.description).toBe('');
	});
	it('非 ASCII 描述往返', () => {
		const value = Symbol('你好世界😀');
		expect(
			readScalar(symbolCodec, writeScalar(symbolCodec, value)).value.description,
		).toBe(value.description);
	});
	it('长描述（跨分块）', () => {
		const desc = 'x'.repeat(300);
		expect(
			readScalar(symbolCodec, writeScalar(symbolCodec, Symbol(desc))).value
				.description,
		).toBe(desc);
	});
	it('描述长度按字节计', () => {
		const bytes = writeScalar(symbolCodec, Symbol('你好'));
		// ID + 长度(6) + 6 字节
		expect(bytes[1]).toBe(6);
	});
	it('Symbol.for', () => {
		const global = Symbol.for('shared');
		const result = readScalar(
			symbolCodec,
			writeScalar(symbolCodec, global),
		).value;
		// 描述保留，但不再是注册表中的同一个符号
		expect(result.description).toBe('shared');
		expect(result).toBe(global);
	});

	describe('集成', () => {
		it('容器内往返', () => {
			const values = [Symbol(), Symbol('a'), Symbol('')];
			const result = roundTrip(values);
			for (let i = 0; i < values.length; i++) {
				expect(result[i].description).toBe(values[i].description);
			}
		});
		it('逐字节流式往返', () => {
			const value = [Symbol('你好😀')];
			const result = roundTripBytewise(value);
			expect(result[0].description).toBe('你好😀');
		});
	});
});
