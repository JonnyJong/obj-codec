import { numberCodec } from '../../../src/codec/base/number';

describe('Codec(Base): number', () => {
	const POSTIVE_ZERO = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
	const NEGATIVE_ZERO = new Uint8Array([128, 0, 0, 0, 0, 0, 0, 0]);
	const POSTIVE_INTEGERE = new Uint8Array([64, 94, 192, 0, 0, 0, 0, 0]);
	const NEGATIVE_INTEGERE = new Uint8Array([192, 94, 192, 0, 0, 0, 0, 0]);
	const POSTIVE_FLOAT = new Uint8Array([64, 94, 221, 47, 26, 159, 190, 119]);
	const NEGATIVE_FLOAT = new Uint8Array([192, 94, 221, 47, 26, 159, 190, 119]);
	const MAX_SAFE_INTEGER = new Uint8Array([
		67, 63, 255, 255, 255, 255, 255, 255,
	]);
	const MIN_SAFE_INTEGER = new Uint8Array([
		195, 63, 255, 255, 255, 255, 255, 255,
	]);
	const POSTIVE_MAX_NUMBER = new Uint8Array([
		127, 239, 255, 255, 255, 255, 255, 255,
	]);
	const NEGATIVE_MAX_NUMBER = new Uint8Array([
		255, 239, 255, 255, 255, 255, 255, 255,
	]);
	const POSTIVE_MIN_NUMBER = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]);
	const NEGATIVE_MIN_NUMBER = new Uint8Array([128, 0, 0, 0, 0, 0, 0, 1]);
	const NAN = new Uint8Array([127, 248, 0, 0, 0, 0, 0, 0]);
	const POSTIVE_INFINITY = new Uint8Array([127, 240, 0, 0, 0, 0, 0, 0]);
	const NEGATIVE_INFINITY = new Uint8Array([255, 240, 0, 0, 0, 0, 0, 0]);

	//#region Encode

	it('Encode: positive zero', () => {
		const number = 0;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSTIVE_ZERO);
	});
	it('Encode: negative zero', () => {
		const number = -0;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_ZERO);
	});
	it('Encode: positive integer', () => {
		const number = 123;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSTIVE_INTEGERE);
	});
	it('Encode: negative integer', () => {
		const number = -123;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_INTEGERE);
	});
	it('Encode: positive float', () => {
		const number = 123.456;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSTIVE_FLOAT);
	});
	it('Encode: negative float', () => {
		const number = -123.456;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_FLOAT);
	});
	it('Encode: max integer', () => {
		const number = Number.MAX_SAFE_INTEGER;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(MAX_SAFE_INTEGER);
	});
	it('Encode: min integer', () => {
		const number = Number.MIN_SAFE_INTEGER;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(MIN_SAFE_INTEGER);
	});
	it('Encode: max positive float', () => {
		const number = Number.MAX_VALUE;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSTIVE_MAX_NUMBER);
	});
	it('Encode: max negative float', () => {
		const number = -Number.MAX_VALUE;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_MAX_NUMBER);
	});
	it('Encode: min positive float', () => {
		const number = Number.MIN_VALUE;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSTIVE_MIN_NUMBER);
	});
	it('Encode: min negative float', () => {
		const number = -Number.MIN_VALUE;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_MIN_NUMBER);
	});
	it('Encode: NaN', () => {
		const number = NaN;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NAN);
	});
	it('Encode: positive Infinity', () => {
		const number = Infinity;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSTIVE_INFINITY);
	});
	it('Encode: min negative Infinity', () => {
		const number = -Infinity;
		// @ts-ignore
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_INFINITY);
	});

	//#region Decode

	it('Decode: positive zero', () => {
		// @ts-ignore
		const number = numberCodec.decode(POSTIVE_ZERO);
		expect(number).toStrictEqual(0);
	});
	it('Decode: negative zero', () => {
		// @ts-ignore
		const number = numberCodec.decode(NEGATIVE_ZERO);
		expect(number).toStrictEqual(-0);
	});
	it('Decode: positive integer', () => {
		// @ts-ignore
		const number = numberCodec.decode(POSTIVE_INTEGERE);
		expect(number).toStrictEqual(123);
	});
	it('Decode: negative integer', () => {
		// @ts-ignore
		const number = numberCodec.decode(NEGATIVE_INTEGERE);
		expect(number).toStrictEqual(-123);
	});
	it('Decode: positive float', () => {
		// @ts-ignore
		const number = numberCodec.decode(POSTIVE_FLOAT);
		expect(number).toStrictEqual(123.456);
	});
	it('Decode: negative float', () => {
		// @ts-ignore
		const number = numberCodec.decode(NEGATIVE_FLOAT);
		expect(number).toStrictEqual(-123.456);
	});
	it('Decode: max integer', () => {
		// @ts-ignore
		const number = numberCodec.decode(MAX_SAFE_INTEGER);
		expect(number).toStrictEqual(Number.MAX_SAFE_INTEGER);
	});
	it('Decode: min integer', () => {
		// @ts-ignore
		const number = numberCodec.decode(MIN_SAFE_INTEGER);
		expect(number).toStrictEqual(Number.MIN_SAFE_INTEGER);
	});
	it('Decode: max positive float', () => {
		// @ts-ignore
		const number = numberCodec.decode(POSTIVE_MAX_NUMBER);
		expect(number).toStrictEqual(Number.MAX_VALUE);
	});
	it('Decode: max negative float', () => {
		// @ts-ignore
		const number = numberCodec.decode(NEGATIVE_MAX_NUMBER);
		expect(number).toStrictEqual(-Number.MAX_VALUE);
	});
	it('Decode: min positive float', () => {
		// @ts-ignore
		const number = numberCodec.decode(POSTIVE_MIN_NUMBER);
		expect(number).toStrictEqual(Number.MIN_VALUE);
	});
	it('Decode: min negative float', () => {
		// @ts-ignore
		const number = numberCodec.decode(NEGATIVE_MIN_NUMBER);
		expect(number).toStrictEqual(-Number.MIN_VALUE);
	});
	it('Decode: NaN', () => {
		// @ts-ignore
		const number = numberCodec.decode(NAN);
		expect(number).toStrictEqual(NaN);
	});
	it('Decode: positive Infinity', () => {
		// @ts-ignore
		const number = numberCodec.decode(POSTIVE_INFINITY);
		expect(number).toStrictEqual(Infinity);
	});
	it('Decode: min negative Infinity', () => {
		// @ts-ignore
		const number = numberCodec.decode(NEGATIVE_INFINITY);
		expect(number).toStrictEqual(-Infinity);
	});
});
