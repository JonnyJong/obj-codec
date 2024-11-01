import { bigintCodec } from '../../../src/codec/base/bigint';

describe('Codec(Base): bigint', () => {
	const ZERO = new Uint8Array([0]);
	const POSTIVE_ONE = new Uint8Array([1]);
	const NEGATIVE_ONE = new Uint8Array([255]);
	const POSTIVE_BIG_VALUE = new Uint8Array([
		210, 10, 31, 235, 140, 169, 84, 171, 0,
	]);
	const NEGATIVE_BIG_VALUE = new Uint8Array([
		46, 245, 224, 20, 115, 86, 171, 84, 255,
	]);

	//#region Encode

	it('Encode: zero', () => {
		// @ts-ignore
		const encoded = bigintCodec.encode(0n);
		expect(encoded).toEqual(ZERO);
	});
	it('Encode: positive one', () => {
		// @ts-ignore
		const encoded = bigintCodec.encode(1n);
		expect(encoded).toEqual(POSTIVE_ONE);
	});
	it('Encode: negative one', () => {
		// @ts-ignore
		const encoded = bigintCodec.encode(-1n);
		expect(encoded).toEqual(NEGATIVE_ONE);
	});
	it('Encode: positive value', () => {
		// @ts-ignore
		const encoded = bigintCodec.encode(12345678901234567890n);
		expect(encoded).toEqual(POSTIVE_BIG_VALUE);
	});
	it('Encode: negative value', () => {
		// @ts-ignore
		const encoded = bigintCodec.encode(-12345678901234567890n);
		expect(encoded).toEqual(NEGATIVE_BIG_VALUE);
	});

	//#region Decode

	it('Decode: zero', () => {
		// @ts-ignore
		const decoded = bigintCodec.decode(ZERO);
		expect(decoded.toString()).toEqual('0');
	});
	it('Decode: one', () => {
		// @ts-ignore
		const decoded = bigintCodec.decode(POSTIVE_ONE);
		expect(decoded.toString()).toEqual('1');
	});
	it('Decode: negative one', () => {
		// @ts-ignore
		const decoded = bigintCodec.decode(NEGATIVE_ONE);
		expect(decoded.toString()).toEqual('-1');
	});
	it('Decode: positive value', () => {
		// @ts-ignore
		const decoded = bigintCodec.decode(POSTIVE_BIG_VALUE);
		expect(decoded.toString()).toEqual('12345678901234567890');
	});
	it('Decode: negative value', () => {
		// @ts-ignore
		const decoded = bigintCodec.decode(NEGATIVE_BIG_VALUE);
		expect(decoded.toString()).toEqual('-12345678901234567890');
	});
});
