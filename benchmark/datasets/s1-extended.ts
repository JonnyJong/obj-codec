import type { Dataset } from './types';
import {
	deepEqual,
	defineDataset,
	equalBytes,
	equalTypedArray,
	float,
	intBetween,
	mulberry32,
	word,
} from './util';

/**
 * S1: payloads that use types JSON cannot represent faithfully.
 * JSON is excluded by the capability filter; @msgpack/msgpack, bson and ion-js
 * drop out of most of these too. See DESIGN.md 4.4.
 */

const MB = 1024 * 1024;

export const BIGINTS: bigint[] = [
	0n,
	1n,
	-1n,
	9007199254740993n, // 2^53 + 1, beyond Number
	-9007199254740993n,
	9223372036854775807n, // int64 max
	-9223372036854775808n, // int64 min
	18446744073709551615n, // uint64 max
	123456789012345678901234567890n,
	-123456789012345678901234567890n,
];

export const s1: Dataset[] = [
	defineDataset({
		id: 'B01-bigint',
		suite: 'S1',
		name: 'BigInt 数组（含 >64bit）3e3',
		requires: ['bigint'],
		build: () => {
			const rand = mulberry32(0xb01);
			return new Array(3_000)
				.fill(0)
				.map(
					(_, i) => BIGINTS[i % BIGINTS.length] + BigInt(intBetween(rand, 0, 7)),
				);
		},
		verify: (d) => {
			const rand = mulberry32(0xb01);
			if (!Array.isArray(d) || d.length !== 3_000) {
				return { ok: false, reason: 'not a 3000-element array' };
			}
			for (let i = 0; i < d.length; i++) {
				const expected =
					BIGINTS[i % BIGINTS.length] + BigInt(intBetween(rand, 0, 7));
				if (typeof d[i] !== 'bigint' || d[i] !== expected) {
					return {
						ok: false,
						reason: `[${i}]: ${typeof d[i]} ${String(d[i])} != bigint ${expected}`,
					};
				}
			}
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'B02-date',
		suite: 'S1',
		name: 'Date 密集 3e3',
		requires: ['date'],
		build: () => {
			const rand = mulberry32(0xb02);
			return new Array(3_000).fill(0).map(() => ({
				createdAt: new Date(1_730_279_978_508 - intBetween(rand, 0, 1e9)),
				updatedAt: new Date(1_730_279_978_508 + intBetween(rand, 0, 1e9)),
				epoch: new Date(0),
				label: word(rand),
			}));
		},
		verify: (d) => {
			const rand = mulberry32(0xb02);
			if (!Array.isArray(d) || d.length !== 3_000) {
				return { ok: false, reason: 'not a 3000-element array' };
			}
			for (let i = 0; i < d.length; i++) {
				const createdAt = new Date(1_730_279_978_508 - intBetween(rand, 0, 1e9));
				const updatedAt = new Date(1_730_279_978_508 + intBetween(rand, 0, 1e9));
				const label = word(rand);
				const row = d[i] as Record<string, unknown>;
				if (
					!(row.createdAt instanceof Date) ||
					row.createdAt.getTime() !== createdAt.getTime()
				) {
					return { ok: false, reason: `[${i}].createdAt` };
				}
				if (
					!(row.updatedAt instanceof Date) ||
					row.updatedAt.getTime() !== updatedAt.getTime()
				) {
					return { ok: false, reason: `[${i}].updatedAt` };
				}
				if (row.label !== label) return { ok: false, reason: `[${i}].label` };
			}
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'B03-collections',
		suite: 'S1',
		name: 'Map/Set 密集 2e3 项',
		requires: ['collections'],
		build: () => {
			const rand = mulberry32(0xb03);
			const map = new Map<number, string>();
			const stringKeyed = new Map<string, number>();
			const set = new Set<string>();
			for (let i = 0; i < 2_000; i++) {
				map.set(i, `${word(rand)}-${i}`);
				stringKeyed.set(`k${i}`, intBetween(rand, 0, 1e6));
				set.add(`${word(rand)}-${i}`);
			}
			return { map, stringKeyed, set };
		},
		verify: (d) => {
			const rand = mulberry32(0xb03);
			const rebuilt = {
				map: new Map<number, string>(),
				stringKeyed: new Map<string, number>(),
				set: new Set<string>(),
			};
			for (let i = 0; i < 2_000; i++) {
				rebuilt.map.set(i, `${word(rand)}-${i}`);
				rebuilt.stringKeyed.set(`k${i}`, intBetween(rand, 0, 1e6));
				rebuilt.set.add(`${word(rand)}-${i}`);
			}
			const obj = d as Record<string, unknown>;
			if (
				!(
					obj.map instanceof Map &&
					obj.stringKeyed instanceof Map &&
					obj.set instanceof Set
				)
			) {
				return { ok: false, reason: 'Map/Set instances not preserved' };
			}
			if (obj.map.size !== rebuilt.map.size) {
				return { ok: false, reason: `map size ${obj.map.size}` };
			}
			for (const [k, v] of rebuilt.map) {
				if ((obj.map as Map<number, string>).get(k) !== v) {
					return { ok: false, reason: `map[${k}]` };
				}
			}
			for (const [k, v] of rebuilt.stringKeyed) {
				if ((obj.stringKeyed as Map<string, number>).get(k) !== v) {
					return { ok: false, reason: `stringKeyed[${k}]` };
				}
			}
			if (obj.set.size !== rebuilt.set.size)
				return { ok: false, reason: 'set size' };
			for (const v of rebuilt.set) {
				if (!(obj.set as Set<string>).has(v))
					return { ok: false, reason: `set value ${v}` };
			}
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'B04-binary',
		suite: 'S1',
		name: '二进制载荷 1MB Uint8Array',
		requires: ['bytes'],
		build: () => {
			const rand = mulberry32(0xb04);
			const bytes = new Uint8Array(MB);
			for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(rand() * 256);
			return { name: 'blob', body: bytes };
		},
		verify: (d) => {
			const rand = mulberry32(0xb04);
			const expected = new Uint8Array(MB);
			for (let i = 0; i < expected.length; i++)
				expected[i] = Math.floor(rand() * 256);
			const obj = d as Record<string, unknown>;
			if (obj.name !== 'blob') return { ok: false, reason: 'name' };
			return equalBytes(obj.body, expected);
		},
	}),

	defineDataset({
		id: 'B05-typed-arrays',
		suite: 'S1',
		name: 'TypedArray / ArrayBuffer / DataView 混合',
		requires: ['typedArrays', 'bigintArrays', 'arrayBufferViews', 'bytes'],
		build: () => {
			const rand = mulberry32(0xb05);
			const int32 = new Int32Array(20_000);
			const float64 = new Float64Array(20_000);
			const bigint64 = new BigInt64Array(5_000);
			for (let i = 0; i < 20_000; i++) {
				int32[i] = intBetween(rand, -2_147_483_648, 2_147_483_647);
				float64[i] = float(rand);
			}
			for (let i = 0; i < 5_000; i++) {
				bigint64[i] = BigInt(intBetween(rand, -1e9, 1e9));
			}
			const buffer = new ArrayBuffer(1024);
			const view = new DataView(buffer);
			for (let i = 0; i < 128; i++) view.setFloat64(i * 8, float(rand));
			return {
				int32,
				float64,
				bigint64,
				uint8: new Uint8Array([0, 1, 255]),
				buffer,
				view,
			};
		},
		verify: (d) => {
			const rand = mulberry32(0xb05);
			const int32 = new Int32Array(20_000);
			const float64 = new Float64Array(20_000);
			const bigint64 = new BigInt64Array(5_000);
			for (let i = 0; i < 20_000; i++) {
				int32[i] = intBetween(rand, -2_147_483_648, 2_147_483_647);
				float64[i] = float(rand);
			}
			for (let i = 0; i < 5_000; i++)
				bigint64[i] = BigInt(intBetween(rand, -1e9, 1e9));
			const expected = new ArrayBuffer(1024);
			const expectedView = new DataView(expected);
			for (let i = 0; i < 128; i++) expectedView.setFloat64(i * 8, float(rand));

			const obj = d as Record<string, unknown>;
			const checks: [
				string,
				() => ReturnType<typeof equalTypedArray> | ReturnType<typeof equalBytes>,
			][] = [
				['int32', () => equalTypedArray(obj.int32, 'Int32Array', int32)],
				['float64', () => equalTypedArray(obj.float64, 'Float64Array', float64)],
				[
					'bigint64',
					() => equalTypedArray(obj.bigint64, 'BigInt64Array', bigint64),
				],
				['uint8', () => equalTypedArray(obj.uint8, 'Uint8Array', [0, 1, 255])],
				['buffer', () => equalBytes(obj.buffer, new Uint8Array(expected))],
			];
			for (const [name, check] of checks) {
				const r = check();
				if (!r.ok) return { ok: false, reason: `${name}: ${r.reason}` };
			}
			if (!(obj.view instanceof DataView)) {
				return { ok: false, reason: 'view is not a DataView' };
			}
			const viewBytes = new Uint8Array(
				(obj.view as DataView).buffer,
				(obj.view as DataView).byteOffset,
				(obj.view as DataView).byteLength,
			);
			const r = equalBytes(viewBytes, new Uint8Array(expected));
			return r.ok ? { ok: true } : { ok: false, reason: `view: ${r.reason}` };
		},
	}),

	defineDataset({
		id: 'B06-edge-values',
		suite: 'S1',
		name: '边界值 undefined / NaN / ±Inf / -0',
		requires: ['undefined', 'nan'],
		build: () => {
			const rows = new Array(1_000).fill(0).map((_, i) => ({
				i,
				missing: undefined,
				nan: Number.NaN,
				posInf: Number.POSITIVE_INFINITY,
				negInf: Number.NEGATIVE_INFINITY,
				minusZero: -0,
				nothing: null,
			}));
			return {
				rows,
				list: [undefined, Number.NaN, -0, Number.POSITIVE_INFINITY, null],
			};
		},
		verify: (d) => {
			const rows = new Array(1_000).fill(0).map((_, i) => ({
				i,
				missing: undefined,
				nan: Number.NaN,
				posInf: Number.POSITIVE_INFINITY,
				negInf: Number.NEGATIVE_INFINITY,
				minusZero: -0,
				nothing: null,
			}));
			return deepEqual(
				{ rows, list: [undefined, Number.NaN, -0, Number.POSITIVE_INFINITY, null] },
				d,
			);
		},
	}),

	defineDataset({
		id: 'B07-everything',
		suite: 'S1',
		name: '全类型混合（扩展版 A06）',
		requires: [
			'bigint',
			'date',
			'regexp',
			'collections',
			'undefined',
			'nan',
			'bytes',
			'typedArrays',
			'arrayBufferViews',
		],
		build: () => buildEverything(0xb07),
		verify: (d) => deepEqual(buildEverything(0xb07), d),
	}),
];

function buildEverything(seed: number): unknown {
	const rand = mulberry32(seed);
	return {
		meta: {
			id: 'b07',
			generatedAt: new Date(1_730_279_978_508),
			pattern: /^b07-\d+$/gi,
		},
		bigints: BIGINTS.slice(0, 5),
		missing: undefined,
		nan: Number.NaN,
		negZero: -0,
		map: new Map<number, string>([
			[1, 'one'],
			[2, 'two'],
		]),
		set: new Set<string>(['a', 'b', 'c']),
		blob: new Uint8Array([0, 128, 255, 7]),
		typed: {
			int32: new Int32Array([-1, 0, 1]),
			float64: new Float64Array([1.5, -2.25]),
		},
		records: new Array(500).fill(0).map((_, i) => ({
			id: i,
			name: `${word(rand)}-${i}`,
			score: float(rand),
			when: new Date(1_730_279_978_508 + i),
			tags: new Set([word(rand), word(rand)]),
			attrs: new Map([[word(rand), intBetween(rand, 0, 100)]]),
			payload: new Uint8Array([i % 256, (i * 7) % 256]),
			big: BigInt(i) * 1_000_000_007n,
			flag: rand() > 0.5,
			note: null,
		})),
	};
}
