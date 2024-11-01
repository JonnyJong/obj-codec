import { BINARY_TYPES, concatBuffers, toUint8Array } from 'helper';
import { BaseCodec, BinaryArray } from 'types';

/*
0x00 ArrayBuffer
0x01 Int8Array
0x02 Uint8Array
0x03 Uint8ClampedArray
0x04 Int16Array
0x05 Uint16Array
0x06 Int32Array
0x07 Uint32Array
0x08 Float32Array
0x09 Float64Array
0x10 BigInt64Array
0x11 BigUint64Array
0x12 DataView
*/

export const binaryCodec: BaseCodec<BinaryArray> = {
	encode(data) {
		const binaryType = BINARY_TYPES.findIndex((type) => data instanceof type);
		return concatBuffers(new Uint8Array([binaryType]), toUint8Array(data));
	},
	decode(data) {
		const binaryType = data[0];
		const buffer = data.slice(1).buffer;
		if (binaryType === 0) {
			return buffer;
		}
		// @ts-ignore
		return new BINARY_TYPES[binaryType](buffer);
	},
};
