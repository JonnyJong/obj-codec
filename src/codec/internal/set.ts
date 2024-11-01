import { Pointer } from 'decoder';
import { concatBuffers } from 'helper';
import { BaseCodec } from 'types';

export const setCodec: BaseCodec<Set<any>> = {
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
		return new Set(decoder.deserialize(encoded));
	},
	dereference(data) {
		let pointers: Set<Pointer> = new Set();
		for (const item of data) {
			if (!(item instanceof Pointer)) continue;
			pointers.add(item);
		}
		for (const pointer of pointers) {
			data.delete(pointer);
			data.add(pointer.deRef());
		}
	},
};
