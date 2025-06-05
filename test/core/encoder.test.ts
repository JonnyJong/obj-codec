import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { expect } from 'vitest';
import { Encoder } from '../../src/encoder';
import { concatBuffers } from '../../src/utils';
import {
	TEST_DATA,
	TEST_DATA_CIRCULAR_REF,
	TEST_DATA_MIXED,
	TEST_DATA_REPEAT,
} from '../data';

describe('Core(Encoder)', () => {
	const types = [
		['normal', TEST_DATA],
		['repeat', TEST_DATA_REPEAT],
		['ref', TEST_DATA_CIRCULAR_REF],
		['mixed', TEST_DATA_MIXED],
	];
	for (const [type, data] of types) {
		it(`Encode: ${type}`, () => {
			const buffers: Uint8Array[] = [];
			const encoder = new Encoder({
				codec: new Map(),
				uniqueValues: [],
				root: data,
			});
			for (const chunk of encoder.encode()) {
				buffers.push(chunk);
			}
			const buffer = concatBuffers(...buffers);
			const bin = new Uint8Array(
				readFileSync(path.join(import.meta.dirname, `../${type}.bin`)),
			);
			expect(buffer).toEqual(bin);
		});
	}
});
