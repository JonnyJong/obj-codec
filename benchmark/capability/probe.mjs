// Definitive capability probe, each library in its richest supported mode.
import * as v8 from 'node:v8';
import { writeFileSync } from 'node:fs';
import superjson from 'superjson';
import * as cborx from 'cbor-x';
import { Packr } from 'msgpackr';
import * as msgpack from '@msgpack/msgpack';
import * as devalue from 'devalue';
import { serialize as serovalSerialize, deserialize as serovalDeserialize, createPlugin } from 'seroval';
import * as turbo from 'turbo-stream';
import * as flatted from 'flatted';
import { serialize as uscSerialize, deserialize as uscDeserialize } from '@ungap/structured-clone';
import * as bson from 'bson';
import * as ion from 'ion-js';
import { ObjCodec } from 'obj-codec';


const packr = new Packr({ structuredClone: true });

class Foo {
	constructor(v) { this.v = v; }
}
globalThis.Foo = Foo;
const fooPlugin = createPlugin({
	tag: 'Foo',
	test: (v) => v instanceof Foo,
	parse: { sync: (v) => ({ v: v.v }) },
	serialize: (node) => `new Foo(${node.v})`,
	deserialize: (node) => new Foo(node.v),
});

// obj-codec: 每个 Codec 实例自带注册表，所以探测用的实例只管自己。
// `write` 只写负载（类型 ID 由编码器负责），`read` 直接返回值。
const objCodec = new ObjCodec();
objCodec.register({
	kind: 'referable',
	name: 'Foo',
	class: Foo,
	write: (ctx, value) => {
		ctx.writer.varint(value.v);
	},
	read: (ctx) => new Foo(ctx.reader.varint()),
});

const objEncode = (v, opts) => objCodec.encodeSync(v, opts);
const objDecode = (b, opts) => objCodec.decodeSync(b, opts);

const mk = (name, encode, decode, extra = {}) => ({ name, encode, decode, ...extra });

const libs = [
	mk('JSON', (v) => JSON.stringify(v), (s) => JSON.parse(s)),
	mk('v8', (v) => v8.serialize(v), (b) => v8.deserialize(b), { wire: 'binary' }),
	mk('structuredClone', (v) => structuredClone(v), (v) => v, { wire: null, inMemory: true }),
	mk('superjson', (v) => superjson.stringify(v), (s) => superjson.parse(s), { wire: 'json' }),
	mk('cbor-x', (v) => cborx.encode(v), (b) => cborx.decode(b), { wire: 'binary' }),
	mk('msgpackr(sc)', (v) => packr.pack(v), (b) => packr.unpack(b), { wire: 'binary' }),
	mk('@msgpack/msgpack', (v) => msgpack.encode(v, { useBigInt64: true }), (b) => msgpack.decode(b, { useBigInt64: true }), { wire: 'binary' }),
	mk('devalue', (v) => devalue.stringify(v), (s) => devalue.parse(s), { wire: 'js' }),
	mk('seroval', (v) => serovalSerialize(v, { plugins: [fooPlugin] }), (s) => serovalDeserialize(s, { plugins: [fooPlugin] }), { wire: 'js' }),
	mk('turbo-stream', async (v) => { const chunks = []; for await (const c of turbo.encode(v)) chunks.push(c); return { chunks, toStream: () => new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(x); c.close(); } }) }; }, async (p) => await turbo.decode(p.toStream()), { wire: 'binary', async: true }),
	mk('flatted', (v) => flatted.stringify(v), (s) => flatted.parse(s), { wire: 'json' }),
	mk('@ungap/sc', (v) => uscSerialize(v), (b) => uscDeserialize(b), { wire: 'binary' }),
	mk('bson', (v) => bson.serialize({ v }), (b) => bson.deserialize(b).v, { wire: 'binary' }),
	mk('ion-js', (v) => ion.dumpBinary(v), (b) => ion.load(b), { wire: 'binary' }),
	mk('obj-codec', (v) => objEncode(v), (b) => objDecode(b), { wire: 'binary' }),
];

const features = [];
const feat = (name, build, verify) => features.push({ name, build, verify });

feat('undefined value', () => ({ a: undefined }), (r) => 'a' in r && r.a === undefined);
feat('bigint', () => 9007199254740993n, (r) => typeof r === 'bigint' && r === 9007199254740993n);
feat('bigint (>64bit)', () => 123456789012345678901234567890n, (r) => typeof r === 'bigint' && r === 123456789012345678901234567890n);
feat('NaN', () => NaN, (r) => Number.isNaN(r));
feat('+/-Infinity', () => [-Infinity, Infinity], (r) => r[0] === -Infinity && r[1] === Infinity);
feat('-0', () => -0, (r) => Object.is(r, -0));
feat('Date', () => new Date(1730279978508), (r) => r instanceof Date && r.getTime() === 1730279978508);
feat('RegExp', () => /ab+c/gi, (r) => r instanceof RegExp && r.source === 'ab+c' && r.flags === 'gi');
feat('Map', () => new Map([[1, 'a'], ['b', 2]]), (r) => r instanceof Map && r.get(1) === 'a' && r.get('b') === 2);
feat('Set', () => new Set([1, 'a']), (r) => r instanceof Set && r.has(1) && r.has('a'));
feat('Uint8Array', () => new Uint8Array([0, 128, 255]), (r) => r instanceof Uint8Array && r[1] === 128 && r.length === 3);
feat('Int32Array', () => new Int32Array([-2147483648, 2147483647]), (r) => r instanceof Int32Array && r[0] === -2147483648);
feat('Float64Array', () => new Float64Array([1.5, -2.25]), (r) => r instanceof Float64Array && r[1] === -2.25);
feat('BigInt64Array', () => new BigInt64Array([-9223372036854775808n, 9223372036854775807n]), (r) => r instanceof BigInt64Array && r[0] === -9223372036854775808n);
feat('ArrayBuffer', () => new ArrayBuffer(8), (r) => r instanceof ArrayBuffer && r.byteLength === 8);
feat('DataView', () => new DataView(new ArrayBuffer(16)), (r) => r instanceof DataView && r.byteLength === 16);
feat('Symbol', () => Symbol('desc'), (r) => typeof r === 'symbol' && r.description === 'desc');
feat('undefined in array', () => [undefined, 1], (r) => Array.isArray(r) && 0 in r && r[0] === undefined);
feat('sparse array', () => { const a = [1, 2, 3]; delete a[1]; return a; }, (r) => Array.isArray(r) && !(1 in r));
feat('numeric object key', () => ({ 1: 'one' }), (r) => r['1'] === 'one' && Object.keys(r).length === 1);
feat('circular ref', () => { const o = { name: 'x' }; o.self = o; return o; }, (r) => r.self === r && r.name === 'x');
feat('circular via array', () => { const a = []; a.push(a); return { a }; }, (r) => r.a[0] === r.a);
feat('shared ref identity', () => { const s = { x: 1 }; return { a: s, b: s }; }, (r) => r.a === r.b);
feat('shared ref in Map/Set', () => { const s = { x: 1 }; return { m: new Map([['k', s]]), s }; }, (r) => r.m.get('k') === r.s);
feat('custom class instance', () => new Foo(7), (r) => r instanceof Foo && r.v === 7);
feat('Error', () => new Error('boom'), (r) => r instanceof Error && r.message === 'boom');
feat('unicode string', () => '汉字 😀 \uD83D\uDE00', (r) => r === '汉字 😀 \uD83D\uDE00');
feat('lone surrogate', () => '\uDE00', (r) => r === '\uDE00');
feat('deep nesting (1000)', () => { let o = { end: true }; for (let i = 0; i < 1000; i++) o = { o }; return o; }, (r) => { let c = r; for (let i = 0; i < 1000; i++) c = c.o; return c.end === true; });
feat('null prototype obj', () => Object.assign(Object.create(null), { a: 1 }), (r) => r.a === 1);
feat('huge string 1MB', () => 'x'.repeat(1024 * 1024), (r) => r.length === 1024 * 1024);
feat('1e6 element array', () => new Array(1e6).fill(1), (r) => Array.isArray(r) && r.length === 1e6 && r[999999] === 1);

const out = {};
for (const lib of libs) {
	out[lib.name] = {};
	for (const f of features) {
		let res;
		try {
			const value = f.build();
			const payload = await lib.encode(value);
			const decoded = await lib.decode(payload);
			res = f.verify(decoded) ? 'yes' : 'no';
		} catch (e) {
			res = 'throws';
		}
		out[lib.name][f.name] = res;
	}
}

const names = features.map((f) => f.name);
const pad = (s, n) => String(s).padEnd(n);
// 表头与数据行同时写进 matrix.txt，避免手工抄 stdout 抄出偏差
const lines = [];
lines.push(pad('feature', 24) + libs.map((l) => pad(l.name, 18)).join(''));
for (const n of names) lines.push(pad(n, 24) + libs.map((l) => pad(out[l.name][n], 18)).join(''));

lines.push('');
lines.push('--- sizes on a mixed sample ---');
const sample = { id: 12345, name: 'hello', active: true, tags: ['a', 'b'], when: new Date(0), n: 42, nested: { x: 1.5 }, arr: [1, 2, 3, 4, 5] };
for (const lib of libs) {
	let len;
	try {
		const p = await lib.encode(sample);
		if (typeof p === 'string') len = Buffer.byteLength(p);
		else if (p instanceof Uint8Array || p instanceof ArrayBuffer) len = p.byteLength;
		else if (p && p.chunks) len = p.chunks.reduce((n, c) => n + (typeof c === 'string' ? Buffer.byteLength(c) : c.byteLength), 0);
		else if (Array.isArray(p)) len = JSON.stringify(p).length;
		else len = undefined;
	} catch (e) {
		len = `throws: ${e.message.slice(0, 50)}`;
	}
	lines.push(`${pad(lib.name, 18)} ${len}`);
}

const report = lines.join('\n');
console.log(report);

writeFileSync(new URL('./capability.json', import.meta.url), JSON.stringify(out, null, 2));
writeFileSync(new URL('./matrix.txt', import.meta.url), `${report}\n`);
