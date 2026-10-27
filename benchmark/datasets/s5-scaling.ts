import type { Dataset } from './types';
import { defineDataset } from './util';

/**
 * S5: scaling sweep. Same three shapes at five sizes, so the report can fit a
 * log-log slope per library and separate O(n) from O(n^2).
 *
 * These run in the runner's single-shot mode (one encode, one decode) because a
 * 30s-per-operation case cannot afford tinybench's warmup and iteration floor.
 * Sizes stop at 1e5 for records/objects: obj-codec already needs minutes there.
 */

export const SCALE_SIZES = [1_000, 10_000, 30_000, 100_000] as const;

interface Shape {
	key: string;
	name: string;
	build(n: number): unknown;
	verify(
		decoded: unknown,
		n: number,
	): { ok: true } | { ok: false; reason: string };
}

const shapes: Shape[] = [
	{
		key: 'ints',
		name: '整数数组',
		build: (n) => new Array(n).fill(0).map((_, i) => i % 4096),
		verify: (d, n) => {
			if (!Array.isArray(d) || d.length !== n) {
				return { ok: false, reason: `length ${(d as unknown[])?.length} != ${n}` };
			}
			for (let i = 0; i < n; i++) {
				if (d[i] !== i % 4096) return { ok: false, reason: `[${i}]` };
			}
			return { ok: true };
		},
	},
	{
		key: 'records',
		name: '短字符串记录数组',
		build: (n) =>
			new Array(n).fill(0).map((_, i) => ({
				id: i,
				name: `item-${i}`,
				kind: 'widget',
				flag: i % 2 === 0,
			})),
		verify: (d, n) => {
			if (!Array.isArray(d) || d.length !== n) {
				return { ok: false, reason: `length ${(d as unknown[])?.length} != ${n}` };
			}
			for (let i = 0; i < n; i++) {
				const row = d[i] as Record<string, unknown>;
				if (row?.id !== i) return { ok: false, reason: `[${i}].id` };
				if (row.name !== `item-${i}`) return { ok: false, reason: `[${i}].name` };
				if (row.kind !== 'widget') return { ok: false, reason: `[${i}].kind` };
				if (row.flag !== (i % 2 === 0)) return { ok: false, reason: `[${i}].flag` };
			}
			return { ok: true };
		},
	},
	{
		key: 'objects',
		name: '简单对象数组',
		build: (n) => new Array(n).fill(0).map((_, i) => ({ id: i, v: i * 1.5 })),
		verify: (d, n) => {
			if (!Array.isArray(d) || d.length !== n) {
				return { ok: false, reason: `length ${(d as unknown[])?.length} != ${n}` };
			}
			for (let i = 0; i < n; i++) {
				const row = d[i] as Record<string, unknown>;
				if (row?.id !== i || row.v !== i * 1.5) {
					return { ok: false, reason: `[${i}]` };
				}
			}
			return { ok: true };
		},
	},
];

function makeDataset(shape: Shape, n: number, extra = false): Dataset {
	return defineDataset({
		id: `S5-${shape.key}-${extra ? '1e6' : formatSize(n)}`,
		suite: 'S5',
		name: `${shape.name} ${extra ? '1e6' : n.toLocaleString('en-US')}`,
		requires: [],
		meta: { shape: shape.key, n: extra ? 1_000_000 : n },
		build: () => shape.build(extra ? 1_000_000 : n),
		verify: (d) => shape.verify(d, extra ? 1_000_000 : n),
	});
}

function formatSize(n: number): string {
	if (n >= 1_000_000) return '1e6';
	if (n >= 1_000) return `${n / 1000}e3`;
	return String(n);
}

export const s5: Dataset[] = [
	...SCALE_SIZES.flatMap((n) => shapes.map((shape) => makeDataset(shape, n))),
	// Boundary probe: obj-codec's concatBuffers(...array) blows the call stack here.
	makeDataset(shapes[0], 1_000_000, true),
];

export const S5_SHAPES = shapes.map((s) => s.key);
