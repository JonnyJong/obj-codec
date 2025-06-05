export const TEST_DATA = {
	ARRAY_BUFFER: new ArrayBuffer(8),
	INT8ARRAY: new Int8Array([-128, 0, 127]),
	UINT8ARRAY: new Uint8Array([0, 128, 255]),
	UINT8CLAMPED_ARRAY: new Uint8ClampedArray([0, 128, 255]),
	INT16ARRAY: new Int16Array([-32768, 0, 32767]),
	UINT16ARRAY: new Uint16Array([0, 32768, 65535]),
	INT32ARRAY: new Int32Array([-2147483648, 0, 2147483647]),
	UINT32ARRAY: new Uint32Array([0, 2147483648, 4294967295]),
	FLOAT32ARRAY: new Float32Array([-3.4e38, 0, 3.4e38]),
	// biome-ignore lint/correctness/noPrecisionLoss: Test only
	FLOAT64ARRAY: new Float64Array([-1.8e308, 0, 1.8e308]),
	BIG_INT64ARRAY: new BigInt64Array([
		-9223372036854775808n,
		0n,
		9223372036854775807n,
	]),
	BIT_UINT64ARRAY: new BigUint64Array([
		0n,
		9223372036854775808n,
		18446744073709551615n,
	]),
	DATA_VIEW: new DataView(new ArrayBuffer(16)),
	NUMBER: 42,
	BIGINT: 9007199254740991n,
	STRING: 'Hello, world!',
	FALSE: false,
	TRUE: true,
	NULL: null,
	UNDEFINED: undefined,
	OBJECT: { key: 'value', 1: 'number key' },
	ARRAY: [1, 'two', true, null],
	SET: new Set<any>([1, 'tow', true]),
	MAP: new Map<any, any>([
		[1, 'one'],
		['tow', 2],
	]),
	DATE: new Date(1730279978508),
	REGEXP: /test/gi,
	REGEXP_NO_FLAG: /test/,
	SYMBOL: Symbol('description'),
	SYMBOL_NO_DESC: Symbol(),
};

export const TEST_DATA_REPEAT = new Array(10).fill(TEST_DATA);

export const TEST_DATA_CIRCULAR_REF = {
	OBJECT: {},
	ARRAY: [] as any[],
	MAP: new Map(),
	SET: new Set(),
};

TEST_DATA_CIRCULAR_REF.OBJECT = { TEST_DATA_CIRCULAR_REF };
TEST_DATA_CIRCULAR_REF.ARRAY.push(TEST_DATA_CIRCULAR_REF);
TEST_DATA_CIRCULAR_REF.MAP.set(TEST_DATA_CIRCULAR_REF, TEST_DATA_CIRCULAR_REF);
TEST_DATA_CIRCULAR_REF.SET.add(TEST_DATA_CIRCULAR_REF);

export const TEST_DATA_MIXED = {
	TEST_DATA,
	TEST_DATA_REPEAT,
	TEST_DATA_CIRCULAR_REF,
};
