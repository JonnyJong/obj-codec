import { randomFillSync } from 'crypto';
import { ObjCodec, ObjEncoder, ObjDecoder } from '../src';

describe('large', () => {
	const DATA = {
		buffer: new Uint8Array(1_000_000)
	};
	randomFillSync(DATA.buffer);

	const compare = (result: any) => {
		if (typeof result !== 'object') return 'Result is not a object';
		const buffer: Uint8Array = result.buffer;
		if (!(buffer instanceof Uint8Array)) return 'Buffer is not a Uint8Array';
		if (buffer.length !== DATA.buffer.length)
		for (let i = 0; i < DATA.buffer.length; i++) {
			if (buffer[i] !== DATA.buffer[i]) return `Diff at ${i}`;
		}
		return true;
	};

	it('Large Buffer', async () => {
		const encoder: ObjEncoder = ObjCodec.encode(DATA);
		const decoder: ObjDecoder = ObjCodec.decode();
		for (const data of encoder.encode()) {
			decoder.write(data);
		}
		const result = await decoder.end();
		expect(compare(result)).toBe(true);
	});
});
