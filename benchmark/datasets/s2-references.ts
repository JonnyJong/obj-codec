import type { Dataset } from './types';
import { deepEqual, defineDataset, intBetween, mulberry32, word } from './util';

/**
 * S2: reference graphs. These datasets need identity preservation, so the
 * verifiers check `===` on shared nodes instead of only structural equality.
 * JSON, cbor-x, @msgpack/msgpack, bson and ion-js are excluded by the filter.
 */

export const s2: Dataset[] = [
	defineDataset({
		id: 'C01-cycle-simple',
		suite: 'S2',
		name: '简单自引用（对象/数组/Map/Set 环）',
		requires: ['references'],
		build: () => {
			const node: Record<string, unknown> = { name: 'root', value: 1 };
			node.self = node;
			const arr: unknown[] = [];
			arr.push(arr);
			const map = new Map<string, unknown>();
			map.set('self', map);
			const set = new Set<unknown>();
			set.add(set);
			return { node, arr, map, set };
		},
		verify: (d) => {
			const obj = d as Record<string, any>;
			if (obj?.node?.name !== 'root' || obj.node.value !== 1) {
				return { ok: false, reason: 'node payload' };
			}
			if (obj.node.self !== obj.node)
				return { ok: false, reason: 'node.self identity' };
			if (!Array.isArray(obj.arr) || obj.arr[0] !== obj.arr) {
				return { ok: false, reason: 'arr cycle identity' };
			}
			if (!(obj.map instanceof Map) || obj.map.get('self') !== obj.map) {
				return { ok: false, reason: 'map cycle identity' };
			}
			if (!(obj.set instanceof Set)) return { ok: false, reason: 'set type' };
			const first = [...obj.set][0];
			if (first !== obj.set) return { ok: false, reason: 'set cycle identity' };
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'C02-dag-fanin',
		suite: 'S2',
		name: '高扇入 DAG（同一节点被 1e4 处引用）',
		requires: ['references'],
		build: () => {
			const rand = mulberry32(0xc02);
			const shared = {
				id: 'shared',
				label: word(rand),
				payload: { a: 1, b: 'two', c: [1, 2, 3] },
			};
			const users = new Array(10_000).fill(0).map((_, i) => ({ i, ref: shared }));
			return { shared, users };
		},
		verify: (d) => {
			const rand = mulberry32(0xc02);
			const obj = d as Record<string, any>;
			if (obj?.shared?.id !== 'shared' || obj.shared.label !== word(rand)) {
				return { ok: false, reason: 'shared payload' };
			}
			if (!Array.isArray(obj.users) || obj.users.length !== 10_000) {
				return { ok: false, reason: 'users length' };
			}
			for (let i = 0; i < obj.users.length; i++) {
				if (obj.users[i].i !== i) return { ok: false, reason: `users[${i}].i` };
				if (obj.users[i].ref !== obj.shared) {
					return { ok: false, reason: `users[${i}].ref lost identity` };
				}
			}
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'C03-graph-entities',
		suite: 'S2',
		name: 'ORM 风格实体图（2e3 父 × 5 子，双向引用）',
		requires: ['references'],
		build: () => {
			const rand = mulberry32(0xc03);
			const parents = new Array(2_000).fill(0).map((_, i) => {
				const parent: Record<string, unknown> = {
					id: i,
					name: `${word(rand)}-${i}`,
					children: [],
				};
				const children = new Array(5).fill(0).map((_, j) => ({
					id: i * 10 + j,
					parent,
					score: intBetween(rand, 0, 1000),
				}));
				parent.children = children;
				return parent;
			});
			return { parents };
		},
		verify: (d) => {
			const rand = mulberry32(0xc03);
			const obj = d as Record<string, any>;
			if (!Array.isArray(obj?.parents) || obj.parents.length !== 2_000) {
				return { ok: false, reason: 'parents length' };
			}
			for (let i = 0; i < obj.parents.length; i++) {
				const parent = obj.parents[i];
				const name = `${word(rand)}-${i}`;
				if (parent.name !== name)
					return { ok: false, reason: `parents[${i}].name` };
				if (!Array.isArray(parent.children) || parent.children.length !== 5) {
					return { ok: false, reason: `parents[${i}].children length` };
				}
				for (let j = 0; j < 5; j++) {
					const child = parent.children[j];
					if (child.parent !== parent) {
						return {
							ok: false,
							reason: `parents[${i}].children[${j}].parent identity`,
						};
					}
					if (child.score !== intBetween(rand, 0, 1000)) {
						return { ok: false, reason: `parents[${i}].children[${j}].score` };
					}
				}
			}
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'C04-refs-mixed',
		suite: 'S2',
		name: '环 + 共享 + 深嵌套混合',
		requires: ['references'],
		build: () => buildMixedGraph(0xc04),
		verify: (d) => {
			const expected = buildMixedGraph(0xc04) as Record<string, any>;
			const obj = d as Record<string, any>;
			// structural part (cycle-safe deepEqual)
			const structural = deepEqual(
				expected.flat.map((r: any) => ({ id: r.id, name: r.name, tags: r.tags })),
				obj.flat.map((r: any) => ({ id: r.id, name: r.name, tags: r.tags })),
			);
			if (!structural.ok) return structural;
			// identity part
			if (obj.registry.self !== obj.registry)
				return { ok: false, reason: 'registry self' };
			if (obj.root.link !== obj.registry)
				return { ok: false, reason: 'root.link identity' };
			for (let i = 0; i < obj.flat.length; i++) {
				if (obj.flat[i].registry !== obj.registry) {
					return { ok: false, reason: `flat[${i}].registry identity` };
				}
			}
			let cursor = obj.deep;
			for (let i = 1; i < 200; i++) cursor = cursor.next;
			if (cursor.leaf !== true) return { ok: false, reason: 'deep chain' };
			return { ok: true };
		},
	}),
];

function buildMixedGraph(seed: number): unknown {
	const rand = mulberry32(seed);
	const registry: Record<string, unknown> = { name: 'registry', version: 1 };
	registry.self = registry;
	const root = { id: 'root', link: registry };
	const flat = new Array(5_000).fill(0).map((_, i) => ({
		id: i,
		name: `${word(rand)}-${i}`,
		tags: [word(rand), word(rand)],
		registry,
	}));
	let deep: Record<string, unknown> = { leaf: true };
	for (let i = 199; i > 0; i--) deep = { i, next: deep };
	return { root, registry, flat, deep };
}
