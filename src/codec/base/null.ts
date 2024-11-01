import { BaseCodec } from 'types';

export const nullCodec: BaseCodec<null> = {
	encodingLength: 0,
	encode: (_data) => new Uint8Array([]),
	decode: (_encoded) => null,
};
