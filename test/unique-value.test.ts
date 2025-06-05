import { describe, expect, it } from 'vitest';
import { ObjCodec } from '../src/index';

describe('Unique value', () => {
	it('Encode/Decode', () => {
		const objCodec = new ObjCodec([globalThis, Symbol.iterator]);
		const encoder = objCodec.encode([globalThis, Symbol.iterator]);
		const decoder = objCodec.decode();
		for (const chunk of encoder.encode()) {
			decoder.decode(chunk);
		}
		const result = decoder.getResult();
		expect(result[0]).toBe(globalThis);
		expect(result[1]).toBe(Symbol.iterator);
	});
});
