import { Pointer } from 'decoder';
import { concatBuffers } from 'helper';
import { BaseCodec } from 'types';

export const mapCodec: BaseCodec<Map<any, any>> = {
	encode(data, encoder) {
		let buffers: Uint8Array[] = [];
		for (const [key, value] of data) {
			if (!encoder.isSupported(key)) {
				if (encoder.ignoreUnsupportedTypes) continue;
				throw new Error(`Unsupported type:\n${key}`);
			}
			if (!encoder.isSupported(value)) {
				if (encoder.ignoreUnsupportedTypes) continue;
				throw new Error(`Unsupported type:\n${value}`);
			}
			buffers.push(encoder.serialize(key), encoder.serialize(value));
		}
		return concatBuffers(...buffers);
	},
	decode(encoded, decoder) {
		const deserialized = decoder.deserialize(encoded);
		let map: Map<any, any> = new Map();
		for (let i = 0; i < deserialized.length; i += 2) {
			map.set(deserialized[i], deserialized[i + 1]);
		}
		return map;
	},
	dereference(data) {
		let needRemove: Set<Pointer> = new Set();
		for (const [key, value] of data) {
			if (value instanceof Pointer) {
				data.set(key, value.deRef());
			}
			if (key instanceof Pointer) {
				needRemove.add(key);
			}
		}
		for (const key of needRemove) {
			data.set(key.deRef(), data.get(key));
			data.delete(key);
		}
	},
};
