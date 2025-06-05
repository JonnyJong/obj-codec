import { InternalCodec } from '../../types';

export const falseCodec = {
	bufferLength: 0,
	encode: () => new Uint8Array([]),
	decode: () => false,
} as const satisfies InternalCodec<false>;

export const trueCodec = {
	bufferLength: 0,
	encode: () => new Uint8Array([]),
	decode: () => true,
} as const satisfies InternalCodec<true>;
