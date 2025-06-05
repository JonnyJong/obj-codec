import { describe, expect, it } from 'vitest';
import { regexpCodec } from '../../../src/codec/internal/regexp';

describe('Codec(Internal): regexp', () => {
	const WITH_FLAGS = /abc\/123.*/g;
	const WITHOUT_FLAGS = /abc\/123.*/;
	const ENCODED_WITH_FLAGS = new Uint8Array([
		97, 98, 99, 92, 47, 49, 50, 51, 46, 42, 47, 103,
	]);
	const ENCODED_WITHOUT_FLAGS = new Uint8Array([
		97, 98, 99, 92, 47, 49, 50, 51, 46, 42, 47,
	]);

	//#region Encode

	it('Encode: with flags', () => {
		const encoded = regexpCodec.encode(WITH_FLAGS);
		expect(encoded).toEqual(ENCODED_WITH_FLAGS);
	});
	it('Encode: without flags', () => {
		const encoded = regexpCodec.encode(WITHOUT_FLAGS);
		expect(encoded).toEqual(ENCODED_WITHOUT_FLAGS);
	});

	//#region Decode

	it('Decode: with flags', () => {
		const decoded = regexpCodec.decode(ENCODED_WITH_FLAGS);
		expect(decoded).toEqual(WITH_FLAGS);
	});
	it('Decode: without flags', () => {
		const decoded = regexpCodec.decode(ENCODED_WITHOUT_FLAGS);
		expect(decoded).toEqual(WITHOUT_FLAGS);
	});
});
