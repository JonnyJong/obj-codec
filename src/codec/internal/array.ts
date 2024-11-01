import { Pointer } from 'decoder';
import { concatBuffers } from 'helper';
import { BaseCodec } from 'types';

export const arrayCodec: BaseCodec<any[]> = {
	encode(data, encoder) {
		let buffers: Uint8Array[] = [];
		for (const item of data) {
			if (!encoder.isSupported(item)) {
				if (encoder.ignoreUnsupportedTypes) continue;
				throw new Error(`Unsupported type:\n${item}`);
			}
			buffers.push(encoder.serialize(item));
		}
		return concatBuffers(...buffers);
	},
	decode(encoded, decoder) {
		return decoder.deserialize(encoded);
	},
	dereference(data) {
		for (let i = 0; i < data.length; i++) {
			if (!(data[i] instanceof Pointer)) continue;
			data[i] = data[i].deRef();
		}
	},
};
