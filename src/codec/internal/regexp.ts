import { BaseCodec } from 'types';

export const regexpCodec: BaseCodec<RegExp> = {
	encode(data) {
		// eslint-disable-next-line no-undef
		return new TextEncoder().encode(data.toString().slice(1));
	},
	decode(encoded) {
		// eslint-disable-next-line no-undef
		const token = new TextDecoder().decode(encoded);
		const flagsIndex = token.lastIndexOf('/');
		const flags = token.slice(flagsIndex + 1);
		return new RegExp(token.slice(0, flagsIndex), flags);
	},
};
