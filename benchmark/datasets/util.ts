import type { Capability, Dataset } from './types';

/** Deterministic PRNG so datasets are reproducible across machines and runs. */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const WORDS = [
	'alpha',
	'bravo',
	'charlie',
	'delta',
	'echo',
	'foxtrot',
	'golf',
	'hotel',
	'india',
	'juliet',
	'kilo',
	'lima',
];

export function pick<T>(rand: () => number, items: readonly T[]): T {
	return items[Math.floor(rand() * items.length)];
}

export function word(rand: () => number): string {
	return pick(rand, WORDS);
}

export function sentence(rand: () => number, words = 8): string {
	return new Array(words)
		.fill(0)
		.map(() => word(rand))
		.join(' ');
}

export function intBetween(
	rand: () => number,
	min: number,
	max: number,
): number {
	return Math.floor(rand() * (max - min + 1)) + min;
}

export function float(rand: () => number): number {
	return rand() * 1000 - 500;
}

/**
 * Structural equality used by the fidelity gate.
 * Handles the extended types the S1 suite exercises, and is cycle-safe so it can
 * also sanity-check reference graphs. Reports a path so a failing case explains
 * itself instead of just going red.
 */
export type Verdict = { ok: true } | { ok: false; reason: string };

export function deepEqual(a: unknown, b: unknown): Verdict {
	return compare(a, b, '$', new WeakMap());
}

function compare(
	a: unknown,
	b: unknown,
	path: string,
	seen: WeakMap<object, object>,
): Verdict {
	if (Object.is(a, b)) return { ok: true };
	if (typeof a !== typeof b) {
		return { ok: false, reason: `${path}: typeof ${typeof a} != ${typeof b}` };
	}
	if (a === null || b === null) {
		return { ok: false, reason: `${path}: ${String(a)} != ${String(b)}` };
	}
	if (typeof a !== 'object') {
		return { ok: false, reason: `${path}: ${describe(a)} != ${describe(b)}` };
	}
	const ao = a as object;
	const bo = b as object;
	if (seen.get(ao) === bo) return { ok: true };
	seen.set(ao, bo);

	if (a instanceof Date || b instanceof Date) {
		if (!(a instanceof Date && b instanceof Date)) {
			return { ok: false, reason: `${path}: Date mismatch` };
		}
		return a.getTime() === b.getTime()
			? { ok: true }
			: { ok: false, reason: `${path}: Date ${a.getTime()} != ${b.getTime()}` };
	}
	if (a instanceof RegExp || b instanceof RegExp) {
		if (!(a instanceof RegExp && b instanceof RegExp)) {
			return { ok: false, reason: `${path}: RegExp mismatch` };
		}
		return a.source === b.source && a.flags === b.flags
			? { ok: true }
			: { ok: false, reason: `${path}: /${a.source}/${a.flags}` };
	}
	if (a instanceof Map || b instanceof Map) {
		if (!(a instanceof Map && b instanceof Map)) {
			return { ok: false, reason: `${path}: Map mismatch` };
		}
		if (a.size !== b.size) {
			return { ok: false, reason: `${path}: Map size ${a.size} != ${b.size}` };
		}
		let i = 0;
		for (const [k, v] of a) {
			const entries = [...b];
			const pair = entries[i++];
			if (!pair) return { ok: false, reason: `${path}: Map entry ${i} missing` };
			const kr = compare(k, pair[0], `${path}.key<${i}>`, seen);
			if (!kr.ok) return kr;
			const vr = compare(v, pair[1], `${path}.value<${i}>`, seen);
			if (!vr.ok) return vr;
		}
		return { ok: true };
	}
	if (a instanceof Set || b instanceof Set) {
		if (!(a instanceof Set && b instanceof Set)) {
			return { ok: false, reason: `${path}: Set mismatch` };
		}
		if (a.size !== b.size) {
			return { ok: false, reason: `${path}: Set size ${a.size} != ${b.size}` };
		}
		const remaining = [...b];
		let i = 0;
		for (const v of a) {
			i++;
			const index = remaining.findIndex((c) => compare(v, c, path, seen).ok);
			if (index === -1) {
				return { ok: false, reason: `${path}: Set value ${i} not found` };
			}
			remaining.splice(index, 1);
		}
		return { ok: true };
	}
	if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
		if (!(ArrayBuffer.isView(a) && ArrayBuffer.isView(b))) {
			return { ok: false, reason: `${path}: view mismatch` };
		}
		const av = a as unknown as { constructor: { name: string }; length?: number };
		const bv = b as unknown as { constructor: { name: string }; length?: number };
		if (av.constructor.name !== bv.constructor.name) {
			return {
				ok: false,
				reason: `${path}: ${av.constructor.name} != ${bv.constructor.name}`,
			};
		}
		const au = bytesOfView(a);
		const bu = bytesOfView(b);
		if (au.length !== bu.length) {
			return {
				ok: false,
				reason: `${path}: byteLength ${au.length} != ${bu.length}`,
			};
		}
		for (let i = 0; i < au.length; i++) {
			if (au[i] !== bu[i]) return { ok: false, reason: `${path}: byte ${i}` };
		}
		return { ok: true };
	}
	if (a instanceof ArrayBuffer || b instanceof ArrayBuffer) {
		if (!(a instanceof ArrayBuffer && b instanceof ArrayBuffer)) {
			return { ok: false, reason: `${path}: ArrayBuffer mismatch` };
		}
		return compare(new Uint8Array(a), new Uint8Array(b), path, seen);
	}
	if (Array.isArray(a) !== Array.isArray(b)) {
		return { ok: false, reason: `${path}: array/object mismatch` };
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) {
			return { ok: false, reason: `${path}: length ${a.length} != ${b.length}` };
		}
		for (let i = 0; i < a.length; i++) {
			const r = compare(a[i], b[i], `${path}[${i}]`, seen);
			if (!r.ok) return r;
		}
		return { ok: true };
	}
	const aObj = a as Record<string, unknown>;
	const bObj = b as Record<string, unknown>;
	const ak = Object.keys(aObj);
	const bk = Object.keys(bObj);
	if (ak.length !== bk.length) {
		return {
			ok: false,
			reason: `${path}: key count ${ak.length} != ${bk.length}`,
		};
	}
	for (const k of ak) {
		if (!Object.hasOwn(bObj, k)) {
			return { ok: false, reason: `${path}: missing key "${k}"` };
		}
		const r = compare(aObj[k], bObj[k], `${path}.${k}`, seen);
		if (!r.ok) return r;
	}
	return { ok: true };
}

function bytesOfView(v: unknown): Uint8Array {
	const view = v as ArrayBufferView;
	return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

function toBytes(v: unknown): Uint8Array | null {
	if (v instanceof ArrayBuffer) return new Uint8Array(v);
	if (ArrayBuffer.isView(v)) return bytesOfView(v);
	return null;
}

function describe(v: unknown): string {
	if (typeof v === 'number') {
		if (Object.is(v, -0)) return '-0';
		return String(v);
	}
	if (typeof v === 'bigint') return `${v}n`;
	if (typeof v === 'string') return JSON.stringify(v);
	return String(v);
}

/** Byte-for-byte comparison of a typed array or an ArrayBuffer. */
export function equalBytes(a: unknown, b: Uint8Array): Verdict {
	const av = toBytes(a);
	if (!av) return { ok: false, reason: 'not a typed array or ArrayBuffer' };
	if (av.length !== b.length) {
		return { ok: false, reason: `byteLength ${av.length} != ${b.length}` };
	}
	for (let i = 0; i < av.length; i++) {
		if (av[i] !== b[i]) return { ok: false, reason: `byte ${i}` };
	}
	return { ok: true };
}

/** Typed-array check: constructor name, length and contents. */
export function equalTypedArray(
	a: unknown,
	ctorName: string,
	expected: ArrayLike<number | bigint>,
): Verdict {
	if (!ArrayBuffer.isView(a)) return { ok: false, reason: 'not a typed array' };
	const name = (a as { constructor: { name: string } }).constructor.name;
	if (name !== ctorName) return { ok: false, reason: `${name} != ${ctorName}` };
	const len = (a as unknown as ArrayLike<number | bigint>).length;
	if (len !== expected.length) {
		return { ok: false, reason: `length ${len} != ${expected.length}` };
	}
	for (let i = 0; i < len; i++) {
		const got = (a as unknown as ArrayLike<number | bigint>)[i];
		if (got !== expected[i])
			return { ok: false, reason: `[${i}] ${String(got)}` };
	}
	return { ok: true };
}

export function defineDataset(d: Dataset): Dataset {
	return d;
}

export function requireAll(
	requires: Capability[],
	caps: Capability[],
): boolean {
	return requires.every((r) => caps.includes(r));
}

export function megabytes(n: number): number {
	return n * 1024 * 1024;
}
