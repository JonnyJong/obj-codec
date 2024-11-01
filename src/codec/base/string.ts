import { BaseCodec } from 'types';

export const stringCodec: BaseCodec<string> = {
	encode(data) {
		// eslint-disable-next-line no-undef
		return new TextEncoder().encode(data);
	},
	decode(encoded) {
		// eslint-disable-next-line no-undef
		return new TextDecoder().decode(encoded);
	},
};
