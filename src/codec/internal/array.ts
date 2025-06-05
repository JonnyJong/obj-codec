import { InternalCodec } from '../../types';
import { Pointer, concatBuffers } from '../../utils';

export const arrayCodec: InternalCodec<any[]> = {
	encode(data, serialize) {
		return concatBuffers(...data.map((item) => serialize(item)));
	},
	decode(encoded, deserialize) {
		return deserialize(encoded);
	},
	deref(data) {
		for (let i = 0; i < data.length; i++) {
			const item = data[i];
			if (item instanceof Pointer) {
				data[i] = item.deref();
			}
		}
	},
};
