import { InternalCodec } from '../../types';
import { Pointer, concatBuffers } from '../../utils';

export const setCodec: InternalCodec<Set<any>> = {
	encode(data, serialize) {
		return concatBuffers(...[...data].map((item) => serialize(item)));
	},
	decode(encoded, deserialize) {
		return new Set(deserialize(encoded));
	},
	deref(data) {
		const items = [...data];
		data.clear();
		for (const item of items) {
			if (item instanceof Pointer) {
				data.add(item.deref());
			} else {
				data.add(item);
			}
		}
	},
};
