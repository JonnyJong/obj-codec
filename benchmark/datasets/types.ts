/**
 * Capability tags used to gate which libraries may enter which dataset.
 * The mapping from tag -> supporting libraries is measured, not assumed:
 * see benchmark/capability/capability.json.
 */
export type Capability =
	| 'bigint'
	| 'date'
	| 'regexp'
	| 'collections' // Map, Set
	| 'undefined'
	| 'nan' // NaN, +/-Infinity, -0
	| 'bytes' // Uint8Array
	| 'typedArrays' // Int32Array, Float64Array
	| 'bigintArrays' // BigInt64Array, BigUint64Array
	| 'arrayBufferViews' // ArrayBuffer, DataView
	| 'references' // circular + shared identity
	| 'sparseArray'
	| 'error'
	| 'symbol'
	| 'customClasses';

export type WireFormat = 'text' | 'binary' | 'js-expression' | 'memory';

export interface Adapter {
	id: string;
	version: string;
	wire: WireFormat;
	/** Capabilities the library preserves faithfully, measured by capability/probe.mjs. */
	capabilities: Capability[];
	/** Recorded into results.json so a ranking is always attributable to a configuration. */
	config: Record<string, unknown>;
	/** structuredClone produces no wire format; excluded from size/streaming boards. */
	inMemoryOnly?: boolean;
	/** Payload produced by encode(); shape is adapter-defined (string | Uint8Array | {chunks}). */
	encode(value: unknown, options?: unknown): unknown | Promise<unknown>;
	decode(payload: unknown, options?: unknown): unknown | Promise<unknown>;
	/** Byte size of a payload as it would cross a wire. */
	sizeOf(payload: unknown): number;
	/** Raw bytes for compression measurement, or null when not a wire format. */
	bytesOf(payload: unknown): Uint8Array | null;
}

export interface Dataset {
	id: string;
	suite: 'S0' | 'S1' | 'S2' | 'S3';
	name: string;
	/** Dataset participates only if every tag is in adapter.capabilities. */
	requires: Capability[];
	/** Deterministic construction; must depend only on seed. */
	build(seed: number): unknown;
	/** Fidelity gate, run before any timing. */
	verify(decoded: unknown): { ok: true } | { ok: false; reason: string };
	/** Per-adapter encode/decode options (unique values, codec registration, ...). */
	options?: Record<string, unknown>;
	/** Extra metadata recorded in results.json (used by the S5 scaling report). */
	meta?: Record<string, unknown>;
}
