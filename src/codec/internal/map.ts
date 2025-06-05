import { InternalCodec } from '../../types';
import { Pointer, concatBuffers } from '../../utils';

export const mapCodec: InternalCodec<Map<any, any>> = {
	encode(data, serialize) {
		return concatBuffers(
			...[...data].flatMap(([k, v]) => [serialize(k), serialize(v)]),
		);
	},
	decode(encoded, deserialize) {
		const pairs = deserialize(encoded);
		const map = new Map();
		for (let i = 0; i < pairs.length; i += 2) {
			map.set(pairs[i], pairs[i + 1]);
		}
		return map;
	},
	deref(data) {
		for (let [key, value] of [...data]) {
			if (key instanceof Pointer) {
				data.delete(key);
				key = key.deref();
			}
			if (value instanceof Pointer) {
				value = value.deref();
			}
			data.set(key, value);
		}
	},
};
