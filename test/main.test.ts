import { ObjCodec } from '../src/index';
import { createReadStream, readFileSync } from 'fs';
import path from 'path';

describe('Main', () => {
	let DATA: any = {
		binary: new Uint16Array([32, 64]),
		number: 42,
		bigint: 32767n,
		string: 'Hello World',
		false: false,
		true: true,
		null: null,
		undefined: undefined,
		subObject: {},
		array: [123, '你好世界'],
		set: new Set([]),
		map: new Map(),
		date: new Date(1730279978508),
		regexp: /.*/g,
		symbol: Symbol('This is a symbol'),
	};
	DATA.subObject.circularReference = DATA;
	DATA.array.push(DATA.subObject);
	DATA.set.add(DATA.symbol);
	DATA.set.add(DATA.set);
	DATA.map.set(DATA.symbol, DATA.date);
	const ENCODED = new Uint8Array(
		readFileSync(path.join(__dirname, 'internal.bin'))
	);

	class TestClassNumber {
		constructor(public value: number) {}
	}
	class TestClassString {
		constructor(public value: string) {}
	}
	class TestClassObject {
		constructor(public value: any) {}
	}
	class TestClassArray {
		constructor(public value: any[]) {}
	}
	let TEST_CLASS_DATA: any = {
		number: new TestClassNumber(123),
		string: new TestClassString('Hello World'),
	};
	TEST_CLASS_DATA.object = new TestClassObject(TEST_CLASS_DATA);
	TEST_CLASS_DATA.array = new TestClassArray([TEST_CLASS_DATA.object]);
	const ENCODER_TEST_CLASS_DATA = new Uint8Array(
		readFileSync(path.join(__dirname, 'custom.bin'))
	);
	const codecWithCustomClass = new ObjCodec();
	codecWithCustomClass.registerCodecs(
		'number',
		{
			encode(data: TestClassNumber) {
				return data.value;
			},
			decode(data: number) {
				return new TestClassNumber(data);
			},
		},
		TestClassNumber
	);
	codecWithCustomClass.registerCodecs(
		'string',
		{
			encode(data: TestClassString) {
				return data.value;
			},
			decode(data: string) {
				return new TestClassString(data);
			},
			dereference(data) {
				data.value = data.value.deRef();
			},
		},
		TestClassString
	);
	codecWithCustomClass.registerCodecs(
		'object',
		{
			encode(data: TestClassObject) {
				return data.value;
			},
			decode(data: any) {
				return new TestClassObject(data);
			},
			dereference(data) {
				data.value = data.value.deRef();
			},
		},
		TestClassObject
	);
	codecWithCustomClass.registerCodecs(
		'array',
		{
			encode(data: TestClassArray) {
				return data.value;
			},
			decode(data: any) {
				return new TestClassArray(data);
			},
			dereference(data) {
				data.value = data.value.deRef();
			},
		},
		TestClassArray
	);

	function internalChecker(data: any) {
		expect(data.binary).toEqual(DATA.binary);
		expect(data.number).toEqual(DATA.number);
		expect(data.bigint.toString()).toEqual(DATA.bigint.toString());
		expect(data.string).toEqual(DATA.string);
		expect(data.false).toEqual(DATA.false);
		expect(data.true).toEqual(DATA.true);
		expect(data.null).toEqual(DATA.null);
		expect(data.undefined).toEqual(DATA.undefined);
		expect(data.subObject.circularReference).toEqual(data);
		expect(data.array[0]).toEqual(DATA.array[0]);
		expect(data.array[1]).toEqual(DATA.array[1]);
		expect(data.set.size).toEqual(DATA.set.size);
		expect(data.map.size).toEqual(DATA.map.size);
		expect(data.map.get(data.symbol)).toStrictEqual(data.date);
		expect(data.date).toEqual(DATA.date);
		expect(data.regexp).toEqual(DATA.regexp);
	}

	function customChecker(data: any) {
		expect(data.number instanceof TestClassNumber).toBeTruthy();
		expect(data.number.value).toEqual(TEST_CLASS_DATA.number.value);
		expect(data.string instanceof TestClassString).toBeTruthy();
		expect(data.string.value).toEqual(TEST_CLASS_DATA.string.value);
		expect(data.object instanceof TestClassObject).toBeTruthy();
		expect(data.object.value === data).toBeTruthy();
		expect(data.array instanceof TestClassArray).toBeTruthy();
		expect(data.array.value[0] === data.object).toBeTruthy();
	}

	//#region Encode

	it('Encode: internal type', () => {
		const encoder = ObjCodec.encode(DATA);
		let encoded = new Uint8Array();
		for (const data of encoder.encode()) {
			let newData = new Uint8Array(encoded.length + data.length);
			newData.set(encoded);
			newData.set(data, encoded.length);
			encoded = newData;
		}
		expect(encoded).toEqual(ENCODED);
	});
	it('Encode: custom class', () => {
		const encoder = codecWithCustomClass.encode(TEST_CLASS_DATA);
		let encoded = new Uint8Array();
		for (const data of encoder.encode()) {
			let newData = new Uint8Array(encoded.length + data.length);
			newData.set(encoded);
			newData.set(data, encoded.length);
			encoded = newData;
		}
		expect(encoded).toEqual(ENCODER_TEST_CLASS_DATA);
	});

	//#region Decode
	it('Decode: internal type', async () => {
		const decoder = ObjCodec.decode();
		decoder.write(ENCODED);
		const data = await decoder.end();
		internalChecker(data);
	});

	it('Decode: custom class', async () => {
		const decoder = codecWithCustomClass.decode();
		decoder.write(ENCODER_TEST_CLASS_DATA);
		const data = await decoder.end();
		customChecker(data);
	});

	//#region Stream Decode
	it('Stream Decode: internal type', () => {
		const decoder = ObjCodec.decode();
		const readStream = createReadStream(path.join(__dirname, 'internal.bin'));
		readStream.on('data', (chunk) => {
			decoder.write(chunk as ArrayBuffer);
		});
		return new Promise((resolve) => {
			readStream.on('end', () => {
				readStream.close();
				resolve(decoder.end());
			});
		}).then(internalChecker);
	});
	it('Stream Decode: custom class', () => {
		const decoder = codecWithCustomClass.decode();
		const readStream = createReadStream(path.join(__dirname, 'custom.bin'));
		readStream.on('data', (chunk) => {
			decoder.write(chunk as ArrayBuffer);
		});
		return new Promise((resolve) => {
			readStream.on('end', () => {
				readStream.close();
				resolve(decoder.end());
			});
		}).then(customChecker);
	});
});
