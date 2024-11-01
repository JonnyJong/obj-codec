import { BaseCodec } from 'types';

export const undefinedCodec: BaseCodec<undefined> = {
	encodingLength: 0,
	encode: (_data) => new Uint8Array([]),
	decode: (_encoded) => undefined,
};
