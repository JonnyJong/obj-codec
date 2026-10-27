import type { Dataset } from './types';
import {
	deepEqual,
	defineDataset,
	float,
	intBetween,
	mulberry32,
	sentence,
	word,
} from './util';

/**
 * S0: JSON-safe payloads. Every library can produce a faithful round trip,
 * so this is the only suite where all 15 implementations share a board.
 *
 * Default sizes are set so obj-codec's current O(n^2) path finishes within the
 * per-case timeout; the large sizes live in the S5 scaling suite on purpose.
 */

export const s0: Dataset[] = [
	defineDataset({
		id: 'A01-ints',
		suite: 'S0',
		name: '整数数组 1e4',
		requires: [],
		build: () => new Array(10_000).fill(0).map((_, i) => i % 4096),
		verify: (d) => {
			if (!Array.isArray(d) || d.length !== 10_000) {
				return { ok: false, reason: 'not a 10000-element array' };
			}
			for (let i = 0; i < d.length; i++) {
				if (d[i] !== i % 4096) return { ok: false, reason: `[${i}]` };
			}
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'A02-floats',
		suite: 'S0',
		name: '浮点数组 1e4',
		requires: [],
		build: () => {
			const rand = mulberry32(0xa02);
			return new Array(10_000).fill(0).map(() => float(rand));
		},
		verify: (d) => {
			const rand = mulberry32(0xa02);
			if (!Array.isArray(d) || d.length !== 10_000) {
				return { ok: false, reason: 'not a 10000-element array' };
			}
			for (let i = 0; i < d.length; i++) {
				if (!Object.is(d[i], float(rand))) {
					return { ok: false, reason: `[${i}]` };
				}
			}
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'A03-short-strings',
		suite: 'S0',
		name: '短字符串记录 2e3',
		requires: [],
		build: () => {
			const rand = mulberry32(0xa03);
			return new Array(2_000).fill(0).map((_, i) => ({
				id: i,
				name: `${word(rand)}-${word(rand)}`,
				email: `${word(rand)}${i}@example.com`,
				active: rand() > 0.5,
			}));
		},
		verify: (d) => {
			const rand = mulberry32(0xa03);
			if (!Array.isArray(d) || d.length !== 2_000) {
				return { ok: false, reason: 'not a 2000-element array' };
			}
			for (let i = 0; i < d.length; i++) {
				const expected = {
					id: i,
					name: `${word(rand)}-${word(rand)}`,
					email: `${word(rand)}${i}@example.com`,
					active: rand() > 0.5,
				};
				const r = deepEqual(expected, d[i], `$[${i}]`);
				if (!r.ok) return r;
			}
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'A04-long-text',
		suite: 'S0',
		name: '长文本 1MB',
		requires: [],
		build: () => {
			const rand = mulberry32(0xa04);
			return {
				title: 'long text',
				body: new Array(160_000)
					.fill(0)
					.map(() => word(rand))
					.join(' '),
			};
		},
		verify: (d) => {
			const rand = mulberry32(0xa04);
			const expected = {
				title: 'long text',
				body: new Array(160_000)
					.fill(0)
					.map(() => word(rand))
					.join(' '),
			};
			return deepEqual(expected, d);
		},
	}),

	defineDataset({
		id: 'A05-wide-records',
		suite: 'S0',
		name: '重复 key 宽记录 1e3 x 20 字段',
		requires: [],
		build: () => {
			const rand = mulberry32(0xa05);
			return new Array(1_000).fill(0).map((_, i) => {
				const row: Record<string, unknown> = { id: i };
				for (let f = 0; f < 19; f++) {
					row[`field_${f}`] = rand() > 0.5 ? intBetween(rand, 0, 999) : word(rand);
				}
				return row;
			});
		},
		verify: (d) => {
			const rand = mulberry32(0xa05);
			const expected = new Array(1_000).fill(0).map((_, i) => {
				const row: Record<string, unknown> = { id: i };
				for (let f = 0; f < 19; f++) {
					row[`field_${f}`] = rand() > 0.5 ? intBetween(rand, 0, 999) : word(rand);
				}
				return row;
			});
			return deepEqual(expected, d);
		},
	}),

	defineDataset({
		id: 'A06-api-doc',
		suite: 'S0',
		name: '真实 API 文档（嵌套 5-8 层）',
		requires: [],
		build: () => {
			const rand = mulberry32(0xa06);
			return {
				meta: { requestId: 'req-0a06', page: 1, pageSize: 100 },
				items: new Array(100).fill(0).map((_, i) => ({
					id: i,
					title: sentence(rand, 4),
					tags: [word(rand), word(rand), word(rand)],
					author: {
						name: sentence(rand, 2),
						profile: {
							verified: rand() > 0.5,
							stats: { posts: intBetween(rand, 0, 5000), karma: float(rand) },
							links: { home: 'https://example.com', rss: null },
						},
					},
					comments: new Array(3).fill(0).map(() => ({
						body: sentence(rand, 6),
						score: intBetween(rand, -10, 100),
						replies: [{ body: sentence(rand, 3), deleted: false }],
					})),
				})),
			};
		},
		verify: (d) => {
			const rand = mulberry32(0xa06);
			const expected = {
				meta: { requestId: 'req-0a06', page: 1, pageSize: 100 },
				items: new Array(100).fill(0).map((_, i) => ({
					id: i,
					title: sentence(rand, 4),
					tags: [word(rand), word(rand), word(rand)],
					author: {
						name: sentence(rand, 2),
						profile: {
							verified: rand() > 0.5,
							stats: { posts: intBetween(rand, 0, 5000), karma: float(rand) },
							links: { home: 'https://example.com', rss: null },
						},
					},
					comments: new Array(3).fill(0).map(() => ({
						body: sentence(rand, 6),
						score: intBetween(rand, -10, 100),
						replies: [{ body: sentence(rand, 3), deleted: false }],
					})),
				})),
			};
			return deepEqual(expected, d);
		},
	}),

	defineDataset({
		id: 'A07-deep-chain',
		suite: 'S0',
		name: '深链 1e3',
		requires: [],
		// Both libraries guard recursion at depth 100 by default; raise it so the
		// dataset measures throughput instead of the default safety limit.
		options: {
			seroval: { depthLimit: 5000 },
			msgpack: { maxDepth: 5000 },
		},
		build: () => {
			let node: Record<string, unknown> = { depth: 1_000, leaf: true };
			for (let i = 999; i > 0; i--) node = { depth: i, next: node };
			return node;
		},
		verify: (d) => {
			let node = d as Record<string, any>;
			for (let i = 1; i <= 1_000; i++) {
				if (node?.depth !== i) return { ok: false, reason: `depth ${i}` };
				if (i === 1_000)
					return node.leaf === true ? { ok: true } : { ok: false, reason: 'leaf' };
				node = node.next;
			}
			return { ok: false, reason: 'walked off the end' };
		},
	}),

	defineDataset({
		id: 'A08-wide-object',
		suite: 'S0',
		name: '宽对象 2e3 key',
		requires: [],
		build: () => {
			const rand = mulberry32(0xa08);
			const obj: Record<string, unknown> = {};
			for (let i = 0; i < 2_000; i++)
				obj[`key_${i}`] = rand() > 0.5 ? i : word(rand);
			return obj;
		},
		verify: (d) => {
			const rand = mulberry32(0xa08);
			const obj = d as Record<string, unknown>;
			if (!obj || Object.keys(obj).length !== 2_000) {
				return { ok: false, reason: 'key count' };
			}
			for (let i = 0; i < 2_000; i++) {
				const expected = rand() > 0.5 ? i : word(rand);
				if (obj[`key_${i}`] !== expected) {
					return { ok: false, reason: `key_${i}` };
				}
			}
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'A09-mixed-payload',
		suite: 'S0',
		name: '混合真实 payload 约 1MB',
		requires: [],
		build: () => {
			const rand = mulberry32(0xa09);
			return {
				generatedAt: 1730279978508,
				records: new Array(2_000).fill(0).map((_, i) => ({
					id: i,
					name: sentence(rand, 3),
					score: float(rand),
					ratio: rand(),
					flag: rand() > 0.5,
					tags: [word(rand), word(rand)],
					note: rand() > 0.9 ? sentence(rand, 12) : null,
					metrics: {
						views: intBetween(rand, 0, 100_000),
						clicks: intBetween(rand, 0, 1_000),
						history: new Array(5).fill(0).map(() => float(rand)),
					},
				})),
			};
		},
		verify: (d) => {
			const rand = mulberry32(0xa09);
			const expected = {
				generatedAt: 1730279978508,
				records: new Array(2_000).fill(0).map((_, i) => ({
					id: i,
					name: sentence(rand, 3),
					score: float(rand),
					ratio: rand(),
					flag: rand() > 0.5,
					tags: [word(rand), word(rand)],
					note: rand() > 0.9 ? sentence(rand, 12) : null,
					metrics: {
						views: intBetween(rand, 0, 100_000),
						clicks: intBetween(rand, 0, 1_000),
						history: new Array(5).fill(0).map(() => float(rand)),
					},
				})),
			};
			return deepEqual(expected, d);
		},
	}),

	defineDataset({
		id: 'A10-bool-null',
		suite: 'S0',
		name: '布尔/null 密集 1e4',
		requires: [],
		build: () => new Array(10_000).fill(0).map((_, i) => boolOrNull(i)),
		verify: (d) => {
			if (!Array.isArray(d) || d.length !== 10_000) {
				return { ok: false, reason: 'length' };
			}
			for (let i = 0; i < d.length; i++) {
				if (d[i] !== boolOrNull(i)) return { ok: false, reason: `[${i}]` };
			}
			return { ok: true };
		},
	}),
];

function boolOrNull(i: number): boolean | null {
	const r = i % 3;
	if (r === 0) return true;
	if (r === 1) return false;
	return null;
}
