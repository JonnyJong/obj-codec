import { InternalCodec } from '../../types';

export const stringCodec = {
	encode(data) {
		return new TextEncoder().encode(data);
	},
	decode(encoded) {
		return new TextDecoder().decode(encoded);
	},
} as const satisfies InternalCodec<string>;
