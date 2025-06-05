import { describe, expect, it } from 'vitest';
import { flexUintCodec } from '../../../src/codec/base/flexible-unsigned-integer';

describe('Codec(Base): flexible-number', () => {
	const ZERO = 0;
	const ENCODED_ZERO = new Uint8Array([0]);
	const TWO_BYTES = 0b0010_0000_0000_1010;
	const ENCODED_TWO_BYTES = new Uint8Array([0b1100_0000, 0b0000_1010]);
	const ENCODED_BUFFER = new Uint8Array([0b1100_0000, 0b0000_1010, 0b0000_0000]);
	const INCOMPLETE_BUFFER = new Uint8Array([0b1100_0000]);

	//#region Encode
	it('Encode: zero', () => {
		const encoded = flexUintCodec.encode(ZERO);
		expect(encoded).toEqual(ENCODED_ZERO);
	});
	it('Encode: two bytes', () => {
		const encoded = flexUintCodec.encode(TWO_BYTES);
		expect(encoded).toEqual(ENCODED_TWO_BYTES);
	});

	//#region Decode
	it('Decode: zero', () => {
		const decoded = flexUintCodec.decode(ENCODED_ZERO);
		expect(decoded).toEqual(ZERO);
	});
	it('Decode: two bytes', () => {
		const decoded = flexUintCodec.decode(ENCODED_TWO_BYTES);
		expect(decoded).toEqual(TWO_BYTES);
	});

	//#region GetPointer
	it('GetPointer: zero', () => {
		const buffer = flexUintCodec.getBuffer(ENCODED_ZERO);
		expect(buffer).toEqual(ENCODED_ZERO);
	});
	it('GetPointer: two bytes', () => {
		const buffer = flexUintCodec.getBuffer(ENCODED_BUFFER);
		expect(buffer).toEqual(ENCODED_TWO_BYTES);
	});
	it('Decode: incomplete buffer', () => {
		const buffer = flexUintCodec.getBuffer(INCOMPLETE_BUFFER);
		expect(buffer).toBeNull();
	});
});
