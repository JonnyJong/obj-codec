import { DomainNode, Point } from './fixtures';
import type { Dataset } from './types';
import { defineDataset } from './util';

/**
 * S3: capabilities only obj-codec has. These produce no cross-library ranking;
 * they characterise obj-codec's absolute cost, with seroval as a single
 * reference point where it can express the same thing.
 */

const SYMBOL_DESCRIPTIONS = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];

export const s3: Dataset[] = [
	defineDataset({
		id: 'D01-symbols',
		suite: 'S3',
		name: 'Symbol 密集 2e3',
		requires: ['symbol'],
		build: () => {
			const shared = Symbol('shared');
			const list = new Array(2_000)
				.fill(0)
				.map((_, i) =>
					Symbol(`${SYMBOL_DESCRIPTIONS[i % SYMBOL_DESCRIPTIONS.length]}-${i}`),
				);
			return { shared, list, map: new Map<symbol, string>([[shared, 'value']]) };
		},
		verify: (d) => {
			const obj = d as Record<string, any>;
			if (typeof obj?.shared !== 'symbol' || obj.shared.description !== 'shared') {
				return { ok: false, reason: 'shared symbol description' };
			}
			if (!Array.isArray(obj.list) || obj.list.length !== 2_000) {
				return { ok: false, reason: 'list length' };
			}
			for (let i = 0; i < obj.list.length; i++) {
				const expected = `${SYMBOL_DESCRIPTIONS[i % SYMBOL_DESCRIPTIONS.length]}-${i}`;
				if (
					typeof obj.list[i] !== 'symbol' ||
					obj.list[i].description !== expected
				) {
					return { ok: false, reason: `list[${i}]` };
				}
			}
			if (!(obj.map instanceof Map) || obj.map.size !== 1) {
				return { ok: false, reason: 'map shape' };
			}
			const key = [...obj.map.keys()][0];
			if (key !== obj.shared) {
				return { ok: false, reason: 'symbol identity through Map key' };
			}
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'D02-unique-pointers',
		suite: 'S3',
		name: 'Unique Pointer（globalThis / 内建 Symbol / 单例）5e3 处引用',
		requires: ['symbol'],
		options: {
			'obj-codec': {
				uniqueValues: [globalThis, Symbol.iterator, Symbol.asyncIterator],
			},
		},
		build: () => {
			const refs = new Array(5_000).fill(0).map((_, i) => ({
				i,
				global: globalThis,
				iterator: Symbol.iterator,
				asyncIterator: Symbol.asyncIterator,
			}));
			return { refs };
		},
		verify: (d) => {
			const obj = d as Record<string, any>;
			if (!Array.isArray(obj?.refs) || obj.refs.length !== 5_000) {
				return { ok: false, reason: 'refs length' };
			}
			for (let i = 0; i < obj.refs.length; i++) {
				const row = obj.refs[i];
				if (row.i !== i) return { ok: false, reason: `refs[${i}].i` };
				if (row.global !== globalThis)
					return { ok: false, reason: `refs[${i}].global identity` };
				if (row.iterator !== Symbol.iterator) {
					return { ok: false, reason: `refs[${i}].iterator identity` };
				}
				if (row.asyncIterator !== Symbol.asyncIterator) {
					return { ok: false, reason: `refs[${i}].asyncIterator identity` };
				}
			}
			return { ok: true };
		},
	}),

	defineDataset({
		id: 'D03-custom-class-primitive',
		suite: 'S3',
		name: '自定义类（primitive payload）5e3 实例',
		requires: ['customClasses'],
		build: () => {
			const points = new Array(5_000).fill(0).map((_, i) => new Point(i * 1.5));
			return { points, root: points[0] };
		},
		verify: (d) => {
			const obj = d as Record<string, any>;
			if (!Array.isArray(obj?.points) || obj.points.length !== 5_000) {
				return { ok: false, reason: 'points length' };
			}
			for (let i = 0; i < obj.points.length; i++) {
				const point = obj.points[i];
				if (!(point instanceof Point)) {
					return { ok: false, reason: `points[${i}] is not a Point` };
				}
				if (point.x !== i * 1.5) return { ok: false, reason: `points[${i}].x` };
			}
			if (obj.root !== obj.points[0])
				return { ok: false, reason: 'root identity' };
			return { ok: true };
		},
	}),

	// Regression target: obj-codec currently mis-numbers pointers when a custom
	// codec's encoded payload contains referable values, so the second instance in
	// a container decodes as its inner representation. Keep this dataset so the
	// fix is measurable (see DESIGN.md 9.5).
	defineDataset({
		id: 'D04-custom-class-container',
		suite: 'S3',
		name: '自定义类（container payload）3e3 节点',
		requires: ['customClasses'],
		build: () => {
			const nodes = new Array(3_000)
				.fill(0)
				.map((_, i) => new DomainNode(i, `node-${i % 100}`, i * 1.5));
			return { nodes, root: nodes[0] };
		},
		verify: (d) => {
			const obj = d as Record<string, any>;
			if (!Array.isArray(obj?.nodes) || obj.nodes.length !== 3_000) {
				return { ok: false, reason: 'nodes length' };
			}
			for (let i = 0; i < obj.nodes.length; i++) {
				const node = obj.nodes[i];
				if (!(node instanceof DomainNode)) {
					return {
						ok: false,
						reason: `nodes[${i}] is ${node?.constructor?.name ?? typeof node}, not DomainNode`,
					};
				}
				if (node.id !== i) return { ok: false, reason: `nodes[${i}].id` };
				if (node.label !== `node-${i % 100}`) {
					return {
						ok: false,
						reason: `nodes[${i}].label is ${node.label?.constructor?.name ?? typeof node.label}, expected a string`,
					};
				}
				if (node.weight !== i * 1.5)
					return { ok: false, reason: `nodes[${i}].weight` };
			}
			if (obj.root !== obj.nodes[0]) {
				return { ok: false, reason: 'root identity' };
			}
			return { ok: true };
		},
	}),
];
