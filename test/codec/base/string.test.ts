import { stringCodec } from '../../../src/codec/base/string';

describe('Codec(Base): string', () => {
	const EMPTY = new Uint8Array([]);
	const ENGLISH = new Uint8Array([
		104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100,
	]);
	const CHINESE = new Uint8Array([
		228, 189, 160, 229, 165, 189, 228, 184, 150, 231, 149, 140,
	]);

	//#region Encode

	it('Encode: empty', () => {
		// @ts-ignore
		const encoded = stringCodec.encode('');
		expect(encoded).toEqual(EMPTY);
	});
	it('Encode: english', () => {
		// @ts-ignore
		const encoded = stringCodec.encode('hello world');
		expect(encoded).toEqual(ENGLISH);
	});
	it('Encode: chinese', () => {
		// @ts-ignore
		const encoded = stringCodec.encode('你好世界');
		expect(encoded).toEqual(CHINESE);
	});

	//#region Decode

	it('Decode: empty', () => {
		// @ts-ignore
		const decoded = stringCodec.decode(EMPTY);
		expect(decoded).toEqual('');
	});
	it('Decode: english', () => {
		// @ts-ignore
		const decoded = stringCodec.decode(ENGLISH);
		expect(decoded).toEqual('hello world');
	});
	it('Decode: chinese', () => {
		// @ts-ignore
		const decoded = stringCodec.decode(CHINESE);
		expect(decoded).toEqual('你好世界');
	});
});
