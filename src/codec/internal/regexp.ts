import { InternalCodec } from '../../types';

export const regexpCodec: InternalCodec<RegExp> = {
	encode(data) {
		return new TextEncoder().encode(data.toString().slice(1));
	},
	decode(encoded) {
		const token = new TextDecoder().decode(encoded);
		const flagsIndex = token.lastIndexOf('/');
		const flags = token.slice(flagsIndex + 1);
		return new RegExp(token.slice(0, flagsIndex), flags);
	},
};
