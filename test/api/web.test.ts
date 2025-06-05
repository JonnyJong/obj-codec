import { describe, expect, it } from 'vitest';
import { ObjCodec } from '../../src/web';
import { TEST_DATA } from '../data';

describe('API(Node)', () => {
	it('Encode/Decode', async () => {
		const encoder = ObjCodec.encode(TEST_DATA);
		const decoder = ObjCodec.decode();
		await encoder.pipeTo(decoder);
		expect(Object.keys(decoder.getResult())).toEqual(Object.keys(TEST_DATA));
	});
});
