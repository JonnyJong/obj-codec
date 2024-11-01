import { BaseCodec } from 'types';

export const numberCodec: BaseCodec<number> = {
	encodingLength: 8,
	encode(data: number): Uint8Array {
		const buffer = new Uint8Array(8);
		const view = new DataView(buffer.buffer);
		view.setFloat64(0, data);
		return buffer;
	},
	decode(encoded: Uint8Array): number {
		const view = new DataView(encoded.buffer);
		return view.getFloat64(0);
	},
};
