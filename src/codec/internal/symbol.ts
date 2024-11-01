import { BaseCodec } from 'types';

export const symbolCodec: BaseCodec<symbol> = {
	encode(data) {
		const key = data.description;
		if (key === undefined) return new Uint8Array([0]);
		// eslint-disable-next-line no-undef
		return new TextEncoder().encode(key);
	},
	decode(encoded) {
		if (encoded.length === 1 && encoded[0] === 0) return Symbol();
		// eslint-disable-next-line no-undef
		return Symbol(new TextDecoder().decode(encoded));
	},
};
