import { describe, expect, it } from 'vitest';
import { binaryCodec } from '../../../src/codec/base/binary';

describe('Codec(Base): binary', () => {
	const ARRAY_BUFFER = new ArrayBuffer(8);
	const INT8_ARRAY = new Int8Array(ARRAY_BUFFER);
	const UINT8_ARRAY = new Uint8Array(ARRAY_BUFFER);
	const UINT8_CLAMPED_ARRAY = new Uint8ClampedArray(ARRAY_BUFFER);
	const INT16_ARRAY = new Int16Array(ARRAY_BUFFER);
	const UINT16_ARRAY = new Uint16Array(ARRAY_BUFFER);
	const INT32_ARRAY = new Int32Array(ARRAY_BUFFER);
	const UINT32_ARRAY = new Uint32Array(ARRAY_BUFFER);
	// TODO: Add Float16Array unit test
	const FLOAT32_ARRAY = new Float32Array(ARRAY_BUFFER);
	const FLOAT64_ARRAY = new Float64Array(ARRAY_BUFFER);
	const BIGINT64_ARRAY = new BigInt64Array(ARRAY_BUFFER);
	const BIGUINT64_ARRAY = new BigUint64Array(ARRAY_BUFFER);
	const DATA_VIEW = new DataView(ARRAY_BUFFER);
	UINT8_ARRAY.set([1, 2, 3, 4, 5, 6, 7, 8]);
	const ENCODED_BUFFER = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8]);

	//#region Encode

	it('Encode: ArrayBuffer', () => {
		ENCODED_BUFFER[0] = 0;
		expect(binaryCodec.encode(ARRAY_BUFFER)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: Int8Array', () => {
		ENCODED_BUFFER[0] = 1;
		expect(binaryCodec.encode(INT8_ARRAY)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: Uint8Array', () => {
		ENCODED_BUFFER[0] = 2;
		expect(binaryCodec.encode(UINT8_ARRAY)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: Uint8ClampedArray', () => {
		ENCODED_BUFFER[0] = 3;
		expect(binaryCodec.encode(UINT8_CLAMPED_ARRAY)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: Int16Array', () => {
		ENCODED_BUFFER[0] = 4;
		expect(binaryCodec.encode(INT16_ARRAY)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: Uint16Array', () => {
		ENCODED_BUFFER[0] = 5;
		expect(binaryCodec.encode(UINT16_ARRAY)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: Int32Array', () => {
		ENCODED_BUFFER[0] = 6;
		expect(binaryCodec.encode(INT32_ARRAY)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: Uint32Array', () => {
		ENCODED_BUFFER[0] = 7;
		expect(binaryCodec.encode(UINT32_ARRAY)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: Float32Array', () => {
		ENCODED_BUFFER[0] = 9;
		expect(binaryCodec.encode(FLOAT32_ARRAY)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: Float64Array', () => {
		ENCODED_BUFFER[0] = 10;
		expect(binaryCodec.encode(FLOAT64_ARRAY)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: BigInt64Array', () => {
		ENCODED_BUFFER[0] = 11;
		expect(binaryCodec.encode(BIGINT64_ARRAY)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: BigUint64Array', () => {
		ENCODED_BUFFER[0] = 12;
		expect(binaryCodec.encode(BIGUINT64_ARRAY)).toEqual(ENCODED_BUFFER);
	});
	it('Encode: DataView', () => {
		ENCODED_BUFFER[0] = 13;
		expect(binaryCodec.encode(DATA_VIEW)).toEqual(ENCODED_BUFFER);
	});

	//#region Decode

	it('Decode: ArrayBuffer', () => {
		ENCODED_BUFFER[0] = 0;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(ARRAY_BUFFER);
	});
	it('Decode: Int8Array', () => {
		ENCODED_BUFFER[0] = 1;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(INT8_ARRAY);
	});
	it('Decode: Uint8Array', () => {
		ENCODED_BUFFER[0] = 2;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(UINT8_ARRAY);
	});
	it('Decode: Uint8ClampedArray', () => {
		ENCODED_BUFFER[0] = 3;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(UINT8_CLAMPED_ARRAY);
	});
	it('Decode: Int16Array', () => {
		ENCODED_BUFFER[0] = 4;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(INT16_ARRAY);
	});
	it('Decode: Uint16Array', () => {
		ENCODED_BUFFER[0] = 5;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(UINT16_ARRAY);
	});
	it('Decode: Int32Array', () => {
		ENCODED_BUFFER[0] = 6;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(INT32_ARRAY);
	});
	it('Decode: Uint32Array', () => {
		ENCODED_BUFFER[0] = 7;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(UINT32_ARRAY);
	});
	it('Decode: Float32Array', () => {
		ENCODED_BUFFER[0] = 9;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(FLOAT32_ARRAY);
	});
	it('Decode: Float64Array', () => {
		ENCODED_BUFFER[0] = 10;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(FLOAT64_ARRAY);
	});
	it('Decode: BigInt64Array', () => {
		ENCODED_BUFFER[0] = 11;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(BIGINT64_ARRAY);
	});
	it('Decode: BigUint64Array', () => {
		ENCODED_BUFFER[0] = 12;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(BIGUINT64_ARRAY);
	});
	it('Decode: DataView', () => {
		ENCODED_BUFFER[0] = 13;
		expect(binaryCodec.decode(ENCODED_BUFFER)).toEqual(DATA_VIEW);
	});
});
