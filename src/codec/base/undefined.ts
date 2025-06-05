import { InternalCodec } from '../../types';

export const undefinedCodec = {
	bufferLength: 0,
	encode: () => new Uint8Array([]),
	decode: () => undefined,
} as const satisfies InternalCodec<undefined>;
