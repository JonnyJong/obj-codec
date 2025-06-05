import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ObjCodec } from '../src/index';
import { BasicType } from '../src/types';

function generateLargeTestData(): BasicType {
	// Binary
	const largeBinary = new Uint8Array(randomBytes(500 * 1024));
	// Large string
	const largeString = 'x'.repeat(300 * 1024);
	// Create complex nested objects with all types
	const complexData = {
		// Binary types
		arrayBuffer: largeBinary.buffer,
		uint8Array: largeBinary,
		int8Array: new Int8Array(largeBinary.buffer),
		uint16Array: new Uint16Array(largeBinary.buffer),
		int16Array: new Int16Array(largeBinary.buffer),
		uint32Array: new Uint32Array(largeBinary.buffer),
		int32Array: new Int32Array(largeBinary.buffer),
		float32Array: new Float32Array(largeBinary.buffer),
		float64Array: new Float64Array(largeBinary.buffer),
		bigInt64Array: new BigInt64Array(largeBinary.buffer),
		bigUint64Array: new BigUint64Array(largeBinary.buffer),
		dataView: new DataView(largeBinary.buffer),
		// Primitive types
		number: 123.456,
		bigint: 12345678901234567890n,
		string: largeString,
		booleanTrue: true,
		booleanFalse: false,
		nullValue: null,
		undefinedValue: undefined,
		// Collection types
		array: [
			1,
			'text',
			true,
			null,
			{
				nested: 'object',
				with: ['different', 'types'],
			},
		],
		set: new Set([1, 2, 3, 'a', 'b', 'c']),
		map: new Map<any, any>([
			['key1', 'value1'],
			[2, 'value2'],
			[true, 'value3'],
		]),
		// Special objects
		date: new Date(),
		regexp: /test-pattern/gi,
		// Global Symbol
		globalSymbol: Symbol.iterator,
		// Circular reference
		circularRef: {} as Record<string, unknown>,

		// Large nested structures
		largeNestedArray: new Array(1000).fill(null).map((_, i) => ({
			id: i,
			data: `item-${i}`,
			subItems: new Array(10).fill(null).map((_, j) => ({
				subId: j,
				value: Math.random(),
			})),
		})),
		// Deeply nested object
		deepObject: (() => {
			const obj: Record<string, any> = {};
			let current = obj;
			for (let i = 0; i < 50; i++) {
				current[`level${i}`] = { next: {} };
				current = current[`level${i}`].next;
			}
			current.final = 'deep value';
			return obj;
		})(),
	};
	// Create circular reference
	complexData.circularRef.self = complexData.circularRef;
	return complexData;
}

describe('Large', () => {
	it('Encode/Decode', () => {
		const data = generateLargeTestData();
		console.time('Large buffer encode/decode');
		const encoder = ObjCodec.encode(data, { uniqueValues: [Symbol.iterator] });
		const decoder = ObjCodec.decode({ uniqueValues: [Symbol.iterator] });

		let size = 0;
		for (const chunk of encoder.encode()) {
			size += chunk.length;
			decoder.decode(chunk);
		}
		const result = decoder.getResult();
		console.timeEnd('Large buffer encode/decode');

		console.log(`Size: ${size}B`);
		expect(result).toEqual(data);
	});
});
