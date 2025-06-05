import { InternalCodec } from '../../types';

export const symbolCodec: InternalCodec<symbol> = {
	encode(data) {
		const key = data.description;
		if (key === undefined) return new Uint8Array([0]);
		return new TextEncoder().encode(key);
	},
	decode(encoded) {
		if (encoded.length === 1 && encoded[0] === 0) return Symbol();
		return Symbol(new TextDecoder().decode(encoded));
	},
};
