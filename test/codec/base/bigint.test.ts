import { describe, expect, it } from 'vitest';
import { bigintCodec } from '../../../src/codec/base/bigint';

describe('Codec(Base): bigint', () => {
	const ZERO = new Uint8Array([0]);
	const POSITIVE_ONE = new Uint8Array([1]);
	const NEGATIVE_ONE = new Uint8Array([255]);
	const POSITIVE_BIG_VALUE = new Uint8Array([
		210, 10, 31, 235, 140, 169, 84, 171, 0,
	]);
	const NEGATIVE_BIG_VALUE = new Uint8Array([
		46, 245, 224, 20, 115, 86, 171, 84, 255,
	]);

	//#region Encode

	it('Encode: zero', () => {
		const encoded = bigintCodec.encode(0n);
		expect(encoded).toEqual(ZERO);
	});
	it('Encode: positive one', () => {
		const encoded = bigintCodec.encode(1n);
		expect(encoded).toEqual(POSITIVE_ONE);
	});
	it('Encode: negative one', () => {
		const encoded = bigintCodec.encode(-1n);
		expect(encoded).toEqual(NEGATIVE_ONE);
	});
	it('Encode: positive value', () => {
		const encoded = bigintCodec.encode(12345678901234567890n);
		expect(encoded).toEqual(POSITIVE_BIG_VALUE);
	});
	it('Encode: negative value', () => {
		const encoded = bigintCodec.encode(-12345678901234567890n);
		expect(encoded).toEqual(NEGATIVE_BIG_VALUE);
	});

	//#region Decode

	it('Decode: zero', () => {
		const decoded = bigintCodec.decode(ZERO);
		expect(decoded.toString()).toEqual('0');
	});
	it('Decode: one', () => {
		const decoded = bigintCodec.decode(POSITIVE_ONE);
		expect(decoded.toString()).toEqual('1');
	});
	it('Decode: negative one', () => {
		const decoded = bigintCodec.decode(NEGATIVE_ONE);
		expect(decoded.toString()).toEqual('-1');
	});
	it('Decode: positive value', () => {
		const decoded = bigintCodec.decode(POSITIVE_BIG_VALUE);
		expect(decoded.toString()).toEqual('12345678901234567890');
	});
	it('Decode: negative value', () => {
		const decoded = bigintCodec.decode(NEGATIVE_BIG_VALUE);
		expect(decoded.toString()).toEqual('-12345678901234567890');
	});
});
