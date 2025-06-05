import { describe, expect, it } from 'vitest';
import { numberCodec } from '../../../src/codec/base/number';

describe('Codec(Base): number', () => {
	const POSITIVE_ZERO = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
	const NEGATIVE_ZERO = new Uint8Array([128, 0, 0, 0, 0, 0, 0, 0]);
	const POSITIVE_INTEGER = new Uint8Array([64, 94, 192, 0, 0, 0, 0, 0]);
	const NEGATIVE_INTEGER = new Uint8Array([192, 94, 192, 0, 0, 0, 0, 0]);
	const POSITIVE_FLOAT = new Uint8Array([64, 94, 221, 47, 26, 159, 190, 119]);
	const NEGATIVE_FLOAT = new Uint8Array([192, 94, 221, 47, 26, 159, 190, 119]);
	const MAX_SAFE_INTEGER = new Uint8Array([
		67, 63, 255, 255, 255, 255, 255, 255,
	]);
	const MIN_SAFE_INTEGER = new Uint8Array([
		195, 63, 255, 255, 255, 255, 255, 255,
	]);
	const POSITIVE_MAX_NUMBER = new Uint8Array([
		127, 239, 255, 255, 255, 255, 255, 255,
	]);
	const NEGATIVE_MAX_NUMBER = new Uint8Array([
		255, 239, 255, 255, 255, 255, 255, 255,
	]);
	const POSITIVE_MIN_NUMBER = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]);
	const NEGATIVE_MIN_NUMBER = new Uint8Array([128, 0, 0, 0, 0, 0, 0, 1]);
	const NAN = new Uint8Array([127, 248, 0, 0, 0, 0, 0, 0]);
	const POSITIVE_INFINITY = new Uint8Array([127, 240, 0, 0, 0, 0, 0, 0]);
	const NEGATIVE_INFINITY = new Uint8Array([255, 240, 0, 0, 0, 0, 0, 0]);

	//#region Encode

	it('Encode: positive zero', () => {
		const number = 0;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSITIVE_ZERO);
	});
	it('Encode: negative zero', () => {
		const number = -0;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_ZERO);
	});
	it('Encode: positive integer', () => {
		const number = 123;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSITIVE_INTEGER);
	});
	it('Encode: negative integer', () => {
		const number = -123;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_INTEGER);
	});
	it('Encode: positive float', () => {
		const number = 123.456;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSITIVE_FLOAT);
	});
	it('Encode: negative float', () => {
		const number = -123.456;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_FLOAT);
	});
	it('Encode: max integer', () => {
		const number = Number.MAX_SAFE_INTEGER;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(MAX_SAFE_INTEGER);
	});
	it('Encode: min integer', () => {
		const number = Number.MIN_SAFE_INTEGER;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(MIN_SAFE_INTEGER);
	});
	it('Encode: max positive float', () => {
		const number = Number.MAX_VALUE;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSITIVE_MAX_NUMBER);
	});
	it('Encode: max negative float', () => {
		const number = -Number.MAX_VALUE;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_MAX_NUMBER);
	});
	it('Encode: min positive float', () => {
		const number = Number.MIN_VALUE;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSITIVE_MIN_NUMBER);
	});
	it('Encode: min negative float', () => {
		const number = -Number.MIN_VALUE;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_MIN_NUMBER);
	});
	it('Encode: NaN', () => {
		const number = NaN;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NAN);
	});
	it('Encode: positive Infinity', () => {
		const number = Infinity;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(POSITIVE_INFINITY);
	});
	it('Encode: min negative Infinity', () => {
		const number = -Infinity;
		const encoded = numberCodec.encode(number);
		expect(encoded).toEqual(NEGATIVE_INFINITY);
	});

	//#region Decode

	it('Decode: positive zero', () => {
		const number = numberCodec.decode(POSITIVE_ZERO);
		expect(number).toStrictEqual(0);
	});
	it('Decode: negative zero', () => {
		const number = numberCodec.decode(NEGATIVE_ZERO);
		expect(number).toStrictEqual(-0);
	});
	it('Decode: positive integer', () => {
		const number = numberCodec.decode(POSITIVE_INTEGER);
		expect(number).toStrictEqual(123);
	});
	it('Decode: negative integer', () => {
		const number = numberCodec.decode(NEGATIVE_INTEGER);
		expect(number).toStrictEqual(-123);
	});
	it('Decode: positive float', () => {
		const number = numberCodec.decode(POSITIVE_FLOAT);
		expect(number).toStrictEqual(123.456);
	});
	it('Decode: negative float', () => {
		const number = numberCodec.decode(NEGATIVE_FLOAT);
		expect(number).toStrictEqual(-123.456);
	});
	it('Decode: max integer', () => {
		const number = numberCodec.decode(MAX_SAFE_INTEGER);
		expect(number).toStrictEqual(Number.MAX_SAFE_INTEGER);
	});
	it('Decode: min integer', () => {
		const number = numberCodec.decode(MIN_SAFE_INTEGER);
		expect(number).toStrictEqual(Number.MIN_SAFE_INTEGER);
	});
	it('Decode: max positive float', () => {
		const number = numberCodec.decode(POSITIVE_MAX_NUMBER);
		expect(number).toStrictEqual(Number.MAX_VALUE);
	});
	it('Decode: max negative float', () => {
		const number = numberCodec.decode(NEGATIVE_MAX_NUMBER);
		expect(number).toStrictEqual(-Number.MAX_VALUE);
	});
	it('Decode: min positive float', () => {
		const number = numberCodec.decode(POSITIVE_MIN_NUMBER);
		expect(number).toStrictEqual(Number.MIN_VALUE);
	});
	it('Decode: min negative float', () => {
		const number = numberCodec.decode(NEGATIVE_MIN_NUMBER);
		expect(number).toStrictEqual(-Number.MIN_VALUE);
	});
	it('Decode: NaN', () => {
		const number = numberCodec.decode(NAN);
		expect(number).toStrictEqual(NaN);
	});
	it('Decode: positive Infinity', () => {
		const number = numberCodec.decode(POSITIVE_INFINITY);
		expect(number).toStrictEqual(Infinity);
	});
	it('Decode: min negative Infinity', () => {
		const number = numberCodec.decode(NEGATIVE_INFINITY);
		expect(number).toStrictEqual(-Infinity);
	});
});
