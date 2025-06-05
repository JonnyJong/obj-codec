import { InternalCodec } from '../../types';

export const nullCodec = {
	bufferLength: 0,
	encode: () => new Uint8Array([]),
	decode: () => null,
} as const satisfies InternalCodec<null>;
