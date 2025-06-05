import { describe, expect, it } from 'vitest';
import { ObjCodec } from '../../src/index';
import { TEST_DATA } from '../data';

describe('API(Node)', () => {
	it('Encode/Decode', async () => {
		const result = await new Promise((resolve, reject) => {
			const decoder = ObjCodec.encode(TEST_DATA)
				.pipe(ObjCodec.decode())
				.on('finish', () => {
					resolve(decoder.getResult());
				})
				.on('error', (err) => {
					reject(err);
				});
		});
		expect(Object.keys(result as object)).toEqual(Object.keys(TEST_DATA));
	});
});
