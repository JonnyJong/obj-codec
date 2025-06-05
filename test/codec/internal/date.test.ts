import { describe, expect, it } from 'vitest';
import { dateCodec } from '../../../src/codec/internal/date';

describe('Codec(Internal): date', () => {
	const DATE = new Date(1730279978508);
	const ENCODED = new Uint8Array([66, 121, 45, 203, 147, 96, 192, 0]);

	//#region Encode

	it('Encode', () => {
		const encoded = dateCodec.encode(DATE);
		expect(encoded).toEqual(ENCODED);
	});

	//#region Decode

	it('Decode', () => {
		const decoded = dateCodec.decode(ENCODED);
		expect(decoded).toEqual(DATE);
	});
});
