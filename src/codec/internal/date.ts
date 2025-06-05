import { InternalCodec } from '../../types';

export const dateCodec: InternalCodec<Date> = {
	bufferLength: 8,
	encode(data) {
		const buffer = new Uint8Array(8);
		const view = new DataView(buffer.buffer);
		view.setFloat64(0, data.getTime());
		return buffer;
	},
	decode(encoded) {
		const view = new DataView(encoded.buffer);
		return new Date(view.getFloat64(0));
	},
};
