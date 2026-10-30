import { createRequire } from 'node:module';
import {
	deserialize as v8Deserialize,
	serialize as v8Serialize,
} from 'node:v8';
import * as msgpack from '@msgpack/msgpack';
import {
	parse as uscParse,
	stringify as uscStringify,
} from '@ungap/structured-clone/json';
import * as bson from 'bson';
import * as cborx from 'cbor-x';
import * as devalue from 'devalue';
import * as flatted from 'flatted';
import * as ion from 'ion-js';
import { Packr } from 'msgpackr';
import { ObjCodec } from 'obj-codec';
import {
	createPlugin,
	deserialize as serovalDeserialize,
	serialize as serovalSerialize,
} from 'seroval';
import superjson from 'superjson';
import * as turbo from 'turbo-stream';
import { DomainNode, Point } from '../datasets/fixtures';
import type { Adapter, Capability } from '../datasets/types';
import { registerCodecFixtures } from './register-fixtures';

const require = createRequire(import.meta.url);

function pkgVersion(name: string): string {
	try {
		return require(`${name}/package.json`).version as string;
	} catch {
		try {
			return (
				require(`../node_modules/${name}/package.json`) as { version: string }
			).version;
		} catch {
			return 'unknown';
		}
	}
}

const objCodecVersion = (require('../../package.json') as { version: string })
	.version;

function bytesOfBinary(payload: unknown): Uint8Array {
	if (payload instanceof Uint8Array) return payload;
	if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
	return new Uint8Array(0);
}

function concat(chunks: Uint8Array[]): Uint8Array {
	let total = 0;
	for (const c of chunks) total += c.byteLength;
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.byteLength;
	}
	return out;
}

/** ion-js returns dom.Value wrappers for containers; convert them to plain JS. */
function ionToJs(value: unknown): unknown {
	if (value === null || typeof value !== 'object') return value;
	const v = value as { getType?: () => { name: string } };
	if (typeof v.getType !== 'function') return value;
	const type = v.getType().name;
	const anyValue = value as any;
	switch (type) {
		case 'null':
			return null;
		case 'bool':
			return anyValue.booleanValue();
		case 'int': {
			const n = anyValue.numberValue();
			return Number.isSafeInteger(n) ? n : anyValue.bigIntValue();
		}
		case 'float':
			return anyValue.numberValue();
		case 'decimal':
			return anyValue.decimalValue();
		case 'timestamp':
			return anyValue.dateValue();
		case 'string':
		case 'symbol':
			return anyValue.stringValue();
		case 'blob':
		case 'clob':
			return anyValue.uInt8ArrayValue();
		case 'list':
		case 'sexp': {
			const out: unknown[] = [];
			for (const element of anyValue.elements()) out.push(ionToJs(element));
			return out;
		}
		case 'struct': {
			const out: Record<string, unknown> = {};
			for (const [key, fieldValue] of anyValue.fields())
				out[key] = ionToJs(fieldValue);
			return out;
		}
		default:
			return value;
	}
}

let msgpackrAddon = false;
try {
	require('msgpackr-extract');
	msgpackrAddon = true;
} catch {
	msgpackrAddon = false;
}

const packr = new Packr({ structuredClone: true });

const objCodecCapabilities: Capability[] = [
	'bigint',
	'date',
	'regexp',
	'collections',
	'undefined',
	'nan',
	'bytes',
	'typedArrays',
	'bigintArrays',
	'arrayBufferViews',
	'references',
	'symbol',
	'customClasses',
];

// S3 fixtures: obj-codec registers codecs, seroval declares plugins.
// 注册表在 `Codec` 实例上，所以这里为基准测试建一个专用实例。
const objCodec = new ObjCodec();
registerCodecFixtures(objCodec);

const domainNodePlugin = createPlugin({
	tag: 'DomainNode',
	test: (value) => value instanceof DomainNode,
	skipPlainObjects: true,
	parse: {
		sync: (value: DomainNode) => ({
			id: value.id,
			label: value.label,
			weight: value.weight,
		}),
	},
	serialize: (node) =>
		`new DomainNode(${node.id},${JSON.stringify(node.label)},${node.weight})`,
	deserialize: (node) => new DomainNode(node.id, node.label, node.weight),
});

const pointPlugin = createPlugin({
	tag: 'Point',
	test: (value) => value instanceof Point,
	skipPlainObjects: true,
	parse: { sync: (value: Point) => ({ x: value.x }) },
	serialize: (node) => `new Point(${node.x})`,
	deserialize: (node) => new Point(node.x),
});

export const adapters: Adapter[] = [
	{
		id: 'json',
		version: process.version,
		wire: 'text',
		config: { api: 'JSON.stringify/parse' },
		capabilities: [],
		encode: (v) => JSON.stringify(v),
		decode: (p) => JSON.parse(p as string),
		sizeOf: (p) => Buffer.byteLength(p as string),
		bytesOf: (p) => Buffer.from(p as string, 'utf8'),
	},
	{
		id: 'v8',
		version: process.version,
		wire: 'binary',
		config: { api: 'v8.serialize/deserialize', nodeOnly: true },
		capabilities: [
			'bigint',
			'date',
			'regexp',
			'collections',
			'undefined',
			'nan',
			'bytes',
			'typedArrays',
			'bigintArrays',
			'arrayBufferViews',
			'references',
			'sparseArray',
			'error',
		],
		encode: (v) => v8Serialize(v),
		decode: (p) => v8Deserialize(bytesOfBinary(p)),
		sizeOf: (p) => (p as Uint8Array).byteLength,
		bytesOf: bytesOfBinary,
	},
	{
		id: 'structuredClone',
		version: process.version,
		wire: 'memory',
		config: { api: 'structuredClone', inMemoryOnly: true },
		inMemoryOnly: true,
		capabilities: [
			'bigint',
			'date',
			'regexp',
			'collections',
			'undefined',
			'nan',
			'bytes',
			'typedArrays',
			'bigintArrays',
			'arrayBufferViews',
			'references',
			'sparseArray',
			'error',
		],
		encode: (v) => structuredClone(v),
		decode: (p) => p,
		sizeOf: () => 0,
		bytesOf: () => null,
	},
	{
		id: 'superjson',
		version: pkgVersion('superjson'),
		wire: 'text',
		config: {},
		capabilities: [
			'bigint',
			'date',
			'regexp',
			'collections',
			'undefined',
			'nan',
			'bytes',
			'typedArrays',
			'references',
			'error',
		],
		encode: (v) => superjson.stringify(v),
		decode: (p) => superjson.parse(p as string),
		sizeOf: (p) => Buffer.byteLength(p as string),
		bytesOf: (p) => Buffer.from(p as string, 'utf8'),
	},
	{
		id: 'cbor-x',
		version: pkgVersion('cbor-x'),
		wire: 'binary',
		config: { useRecords: 'default (true)' },
		capabilities: [
			'bigint',
			'date',
			'regexp',
			'collections',
			'undefined',
			'nan',
			'bytes',
			'typedArrays',
			'bigintArrays',
			'error',
		],
		encode: (v) => cborx.encode(v),
		decode: (p) => cborx.decode(bytesOfBinary(p)),
		sizeOf: (p) => (p as Uint8Array).byteLength,
		bytesOf: bytesOfBinary,
	},
	{
		id: 'msgpackr',
		version: pkgVersion('msgpackr'),
		wire: 'binary',
		config: { structuredClone: true, nativeAddon: msgpackrAddon },
		capabilities: [
			'bigint',
			'date',
			'regexp',
			'collections',
			'undefined',
			'bytes',
			'typedArrays',
			'bigintArrays',
			'arrayBufferViews',
			'references',
			'error',
		],
		encode: (v) => packr.pack(v),
		decode: (p) => packr.unpack(bytesOfBinary(p)),
		sizeOf: (p) => (p as Uint8Array).byteLength,
		bytesOf: bytesOfBinary,
	},
	{
		id: 'msgpack',
		version: pkgVersion('@msgpack/msgpack'),
		wire: 'binary',
		config: { useBigInt64: true, spec: 'MessagePack' },
		capabilities: ['bigint', 'date', 'nan', 'bytes'],
		encode: (v, options) =>
			msgpack.encode(v as never, { useBigInt64: true, ...(options as object) }),
		decode: (p, options) =>
			msgpack.decode(bytesOfBinary(p), {
				useBigInt64: true,
				...(options as object),
			}),
		sizeOf: (p) => (p as Uint8Array).byteLength,
		bytesOf: bytesOfBinary,
	},
	{
		id: 'devalue',
		version: pkgVersion('devalue'),
		wire: 'js-expression',
		config: {},
		capabilities: [
			'bigint',
			'date',
			'regexp',
			'collections',
			'undefined',
			'nan',
			'bytes',
			'typedArrays',
			'bigintArrays',
			'arrayBufferViews',
			'references',
			'sparseArray',
		],
		encode: (v) => devalue.stringify(v),
		decode: (p) => devalue.parse(p as string),
		sizeOf: (p) => Buffer.byteLength(p as string),
		bytesOf: (p) => Buffer.from(p as string, 'utf8'),
	},
	{
		id: 'seroval',
		version: pkgVersion('seroval'),
		wire: 'js-expression',
		config: {
			note:
				'serialize() refuses typed arrays above ~1e6 bytes (DEFAULT_MAX_BASE64_LENGTH); the encode side is not configurable',
		},
		capabilities: [
			'bigint',
			'date',
			'regexp',
			'collections',
			'undefined',
			'nan',
			'bytes',
			'typedArrays',
			'bigintArrays',
			'arrayBufferViews',
			'references',
			'sparseArray',
			'error',
			'customClasses',
		],
		encode: (v, options) =>
			serovalSerialize(v, {
				plugins: [domainNodePlugin, pointPlugin],
				...(options as object),
			}),
		decode: (p, options) =>
			serovalDeserialize(p as string, {
				plugins: [domainNodePlugin, pointPlugin],
				...(options as object),
			}),
		sizeOf: (p) => Buffer.byteLength(p as string),
		bytesOf: (p) => Buffer.from(p as string, 'utf8'),
	},
	{
		id: 'turbo-stream',
		version: pkgVersion('turbo-stream'),
		wire: 'text',
		config: {
			transport: 'ReadableStream of string chunks',
			symbolSupport: false,
		},
		capabilities: [
			'bigint',
			'date',
			'regexp',
			'collections',
			'undefined',
			'nan',
			'bytes',
			'typedArrays',
			'bigintArrays',
			'arrayBufferViews',
			'references',
		],
		// turbo-stream yields string chunks, not bytes: its wire format is text.
		encode: async (v) => {
			const chunks: string[] = [];
			for await (const c of turbo.encode(v) as AsyncIterable<string>) {
				chunks.push(String(c));
			}
			return {
				chunks,
				toStream: () =>
					new ReadableStream<string>({
						start(controller) {
							for (const c of chunks) controller.enqueue(c);
							controller.close();
						},
					}),
			};
		},
		decode: async (p) =>
			await turbo.decode((p as { toStream(): ReadableStream<string> }).toStream()),
		sizeOf: (p) =>
			(p as { chunks: string[] }).chunks.reduce(
				(n, c) => n + Buffer.byteLength(c),
				0,
			),
		bytesOf: (p) =>
			Buffer.from((p as { chunks: string[] }).chunks.join(''), 'utf8'),
	},
	{
		id: 'flatted',
		version: pkgVersion('flatted'),
		wire: 'text',
		config: {},
		capabilities: ['references'],
		encode: (v) => flatted.stringify(v),
		decode: (p) => flatted.parse(p as string),
		sizeOf: (p) => Buffer.byteLength(p as string),
		bytesOf: (p) => Buffer.from(p as string, 'utf8'),
	},
	{
		id: 'ungap-structured-clone',
		version: pkgVersion('@ungap/structured-clone'),
		wire: 'text',
		config: {
			entry: '@ungap/structured-clone/json',
			note:
				'the base entry returns a JS structure, not a wire format; the /json entry is the transport form, and it maps NaN/Infinity to null',
		},
		capabilities: [
			'bigint',
			'date',
			'regexp',
			'collections',
			'undefined',
			'bytes',
			'typedArrays',
			'arrayBufferViews',
			'references',
			'error',
		],
		encode: (v) => uscStringify(v),
		decode: (p) => uscParse(p as string),
		sizeOf: (p) => Buffer.byteLength(p as string),
		bytesOf: (p) => Buffer.from(p as string, 'utf8'),
	},
	{
		id: 'bson',
		version: pkgVersion('bson'),
		wire: 'binary',
		config: { api: 'bson.serialize({v})', spec: 'BSON' },
		capabilities: ['date', 'regexp', 'nan'],
		encode: (v) => bson.serialize({ v }),
		decode: (p) => bson.deserialize(bytesOfBinary(p)).v,
		sizeOf: (p) => (p as Uint8Array).byteLength,
		bytesOf: bytesOfBinary,
	},
	{
		id: 'ion-js',
		version: pkgVersion('ion-js'),
		wire: 'binary',
		config: { spec: 'Ion binary' },
		capabilities: ['date', 'bytes'],
		encode: (v) => ion.dumpBinary(v),
		decode: (p) => ionToJs(ion.load(bytesOfBinary(p))),
		sizeOf: (p) => (p as Uint8Array).byteLength,
		bytesOf: bytesOfBinary,
	},
	{
		id: 'obj-codec',
		version: objCodecVersion,
		wire: 'binary',
		config: { api: 'Codec.encodeSync/decodeSync', build: 'dist/index.esm.js' },
		capabilities: objCodecCapabilities,
		encode: (v, options) => objCodec.encodeSync(v, objCodecOptions(options)),
		decode: (p, options) =>
			objCodec.decodeSync(bytesOfBinary(p), objCodecOptions(options)),
		sizeOf: (p) => (p as Uint8Array).byteLength,
		bytesOf: bytesOfBinary,
	},
];

/**
 * 把数据集里的 v1 风格选项换成 v2 选项
 * @description
 * 数据集是跨库共用的，它们写着 v1 的 `uniqueValues`。
 * v2 用 `externalRefs` 承担同一职责：同样「不编码内容，只写引用号」，
 * 因此这里做一次翻译，数据集本身不必区分版本。
 */
function objCodecOptions(
	options: unknown,
): { externalRefs?: unknown[] } | undefined {
	if (!options || typeof options !== 'object') return undefined;
	const raw = options as { uniqueValues?: unknown[]; externalRefs?: unknown[] };
	const externalRefs = raw.externalRefs ?? raw.uniqueValues;
	return externalRefs ? { externalRefs } : undefined;
}

export const adapterById = new Map(adapters.map((a) => [a.id, a]));
