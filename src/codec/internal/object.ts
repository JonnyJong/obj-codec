import { Pointer } from 'decoder';
import { concatBuffers } from 'helper';
import { BaseCodec } from 'types';

export const objectCodec: BaseCodec<{
	[x: string | number | symbol]: any;
}> = {
	encode(data, encoder) {
		let buffers: Uint8Array[] = [];
		for (const key in data) {
			if (!Object.hasOwn(data, key)) continue;
			if (!encoder.isSupported(data[key])) {
				if (encoder.ignoreUnsupportedTypes) continue;
				throw new Error(`Unsupported type:\n${data[key]}`);
			}
			buffers.push(encoder.serialize(key), encoder.serialize(data[key]));
		}
		return concatBuffers(...buffers);
	},
	decode(encoded, decoder) {
		/* const deserialized = decoder.deserialize(encoded);
		let data: {
			[x: string | number | symbol]: any;
		} = {};
		for (let i = 0; i < deserialized.length; i += 2) {
			data[deserialized[i] as string | number | symbol] = deserialized[i + 1];
		}
		return data; */
		return {
			__deserialized: decoder.deserialize(encoded),
		};
	},
	dereference(data) {
		/* for (const key in data) {
			if (!Object.hasOwn(data, key)) continue;
			if (!(data[key] instanceof Pointer)) continue;
			data[key] = data[key].deRef();
		} */
		const deserialized = data.__deserialized;
		delete data.__deserialized;
		for (let i = 0; i < deserialized.length; i += 2) {
			let key = deserialized[i];
			if (key instanceof Pointer) key = key.deRef();
			let value = deserialized[i + 1];
			if (value instanceof Pointer) value = value.deRef();
			data[key] = value;
		}
	},
};
