import { BinaryType, InternalCodec } from '../../types';
import {
	BINARY_TYPES,
	bufferToUint8Array,
	concatBuffers,
	getBinaryTypeId,
} from '../../utils';

export const binaryCodec = {
	encode(data) {
		return concatBuffers([getBinaryTypeId(data)], bufferToUint8Array(data));
	},
	decode(encoded): BinaryType {
		const binaryType = encoded[0];
		const buffer = encoded.slice(1).buffer;
		if (binaryType === 0) return buffer;
		return new (BINARY_TYPES[binaryType] as any)(buffer);
	},
} as const satisfies InternalCodec<BinaryType>;
