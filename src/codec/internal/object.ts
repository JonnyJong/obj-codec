import { InternalCodec } from '../../types';
import { Pointer, concatBuffers } from '../../utils';

export const objectCodec: InternalCodec<Record<any, any>> = {
	encode(data, serialize) {
		const buffers: Uint8Array[] = [];
		for (const key in data) {
			if (!Object.hasOwn(data, key)) continue;
			buffers.push(serialize(key), serialize(data[key]));
		}
		return concatBuffers(...buffers);
	},
	decode(encoded, deserialize) {
		return {
			_pairs: deserialize(encoded),
		};
	},
	deref(data) {
		const pairs = data._pairs;
		/*
			biome-ignore lint/performance/noDelete:
				必须完全删除临时属性 `_pairs`，
				避免被 for-in 或 Object.keys() 枚举
		*/
		delete data._pairs;
		for (let i = 0; i < pairs.length; i += 2) {
			let key = pairs[i];
			let value = pairs[i + 1];
			if (key instanceof Pointer) key = key.deref();
			if (value instanceof Pointer) value = value.deref();
			data[key] = value;
		}
	},
};
