import { createReadStream } from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { Decoder } from '../../src/decoder';
import {
	TEST_DATA,
	TEST_DATA_CIRCULAR_REF,
	TEST_DATA_MIXED,
	TEST_DATA_REPEAT,
} from '../data';

describe('Core(Decoder)', () => {
	it('Decode: normal', async () => {
		const steam = createReadStream(
			path.join(import.meta.dirname, '../normal.bin'),
		);
		const decoder = new Decoder({
			codec: new Map(),
			uniqueValues: [],
		});
		const data = await new Promise<typeof TEST_DATA>((resolve) => {
			steam.on('data', (chunk) => decoder.decode(chunk));
			steam.on('end', () => {
				resolve(decoder.getResult());
			});
		});
		expect(data.ARRAY_BUFFER).toEqual(TEST_DATA.ARRAY_BUFFER);
		expect(data.INT8ARRAY).toEqual(TEST_DATA.INT8ARRAY);
		expect(data.UINT8ARRAY).toEqual(TEST_DATA.UINT8ARRAY);
		expect(data.UINT8CLAMPED_ARRAY).toEqual(TEST_DATA.UINT8CLAMPED_ARRAY);
		expect(data.INT16ARRAY).toEqual(TEST_DATA.INT16ARRAY);
		expect(data.UINT16ARRAY).toEqual(TEST_DATA.UINT16ARRAY);
		expect(data.INT32ARRAY).toEqual(TEST_DATA.INT32ARRAY);
		expect(data.UINT32ARRAY).toEqual(TEST_DATA.UINT32ARRAY);
		expect(data.FLOAT32ARRAY).toEqual(TEST_DATA.FLOAT32ARRAY);
		expect(data.FLOAT64ARRAY).toEqual(TEST_DATA.FLOAT64ARRAY);
		expect(data.BIG_INT64ARRAY).toEqual(TEST_DATA.BIG_INT64ARRAY);
		expect(data.BIT_UINT64ARRAY).toEqual(TEST_DATA.BIT_UINT64ARRAY);
		expect(data.DATA_VIEW).toEqual(TEST_DATA.DATA_VIEW);
		expect(data.NUMBER).toEqual(TEST_DATA.NUMBER);
		expect(data.BIGINT).toEqual(TEST_DATA.BIGINT);
		expect(data.STRING).toEqual(TEST_DATA.STRING);
		expect(data.FALSE).toEqual(TEST_DATA.FALSE);
		expect(data.TRUE).toEqual(TEST_DATA.TRUE);
		expect(data.NULL).toEqual(TEST_DATA.NULL);
		expect(data.UNDEFINED).toEqual(TEST_DATA.UNDEFINED);
		expect(data.OBJECT).toEqual(TEST_DATA.OBJECT);
		expect(data.ARRAY).toEqual(TEST_DATA.ARRAY);
		expect(data.SET).toEqual(TEST_DATA.SET);
		expect(data.MAP).toEqual(TEST_DATA.MAP);
		expect(data.DATE).toEqual(TEST_DATA.DATE);
		expect(data.REGEXP).toEqual(TEST_DATA.REGEXP);
		expect(data.REGEXP_NO_FLAG).toEqual(TEST_DATA.REGEXP_NO_FLAG);
		expect(data.SYMBOL.description).toEqual(data.SYMBOL.description);
		expect(data.SYMBOL_NO_DESC.description).toEqual(
			data.SYMBOL_NO_DESC.description,
		);
	});
	it('Decode: repeat', async () => {
		const steam = createReadStream(
			path.join(import.meta.dirname, '../repeat.bin'),
		);
		const decoder = new Decoder({
			codec: new Map(),
			uniqueValues: [],
		});
		const data = await new Promise<typeof TEST_DATA_REPEAT>((resolve) => {
			steam.on('data', (chunk) => decoder.decode(chunk));
			steam.on('end', () => {
				resolve(decoder.getResult());
			});
		});
		expect(data.length).toBe(10);
		for (const item of data) {
			expect(item === data[0]).toBe(true);
		}
	});
	it('Decode: ref', async () => {
		const steam = createReadStream(path.join(import.meta.dirname, '../ref.bin'));
		const decoder = new Decoder({
			codec: new Map(),
			uniqueValues: [],
		});
		const data = await new Promise<typeof TEST_DATA_CIRCULAR_REF>((resolve) => {
			steam.on('data', (chunk) => decoder.decode(chunk));
			steam.on('end', () => {
				resolve(decoder.getResult());
			});
		});
		expect(data).toEqual(TEST_DATA_CIRCULAR_REF);
	});
	it('Decode: mixed', async () => {
		const steam = createReadStream(
			path.join(import.meta.dirname, '../mixed.bin'),
		);
		const decoder = new Decoder({
			codec: new Map(),
			uniqueValues: [],
		});
		const data = await new Promise<typeof TEST_DATA_MIXED>((resolve) => {
			steam.on('data', (chunk) => decoder.decode(chunk));
			steam.on('end', () => {
				resolve(decoder.getResult());
			});
		});
		expect(data.TEST_DATA).toEqual(data.TEST_DATA_REPEAT[0]);
		expect(data.TEST_DATA_CIRCULAR_REF).toEqual(
			data.TEST_DATA_CIRCULAR_REF.ARRAY[0],
		);
	});
});
