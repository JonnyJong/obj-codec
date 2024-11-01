import { BaseCodec } from 'types';

/*
Boolean codec is a special case,
confirmation by type code.
*/

export const falseCodec: BaseCodec<false> = {
	encodingLength: 0,
	encode: (_data) => new Uint8Array([]),
	decode: (_encoded) => false,
};

export const trueCodec: BaseCodec<true> = {
	encodingLength: 0,
	encode: (_data) => new Uint8Array([]),
	decode: (_encoded) => true,
};
