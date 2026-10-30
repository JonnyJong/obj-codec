import { ObjCodec } from 'obj-codec';
import { ObjCodec as WebCodec } from 'obj-codec/web';
import * as turbo from 'turbo-stream';
import type { Capability } from '../datasets/types';
import { adapters } from './index';
import { registerCodecFixtures } from './register-fixtures';

/**
 * S4 participants. `incremental` decoders consume chunks as they arrive;
 * `buffered` decoders concatenate first, which is the baseline that says
 * whether a chunked path buys anything.
 */
export interface StreamAdapter {
	id: string;
	lib: string;
	mode: 'incremental' | 'buffered';
	requires: Capability[];
	/** Split an already-encoded payload into transport chunks of ~chunkSize. */
	split(payload: unknown, chunkSize: number): unknown[];
	/** Decode from the chunk sequence. */
	decode(chunks: unknown[], options?: unknown): unknown | Promise<unknown>;
	encode(value: unknown, options?: unknown): unknown | Promise<unknown>;
	sizeOf(payload: unknown): number;
}

// Node 与 Web 入口是两份独立的模块实例，注册表也各有一份。
const nodeCodec = new ObjCodec();
const webCodec = new WebCodec();
registerCodecFixtures(nodeCodec);
registerCodecFixtures(webCodec);

/**
 * 把数据集里的 v1 风格选项换成 v2 选项
 * @description
 * 数据集写着 v1 的 `uniqueValues`；v2 用 `externalRefs` 承担同一职责
 * （同样「不编码内容，只写引用号」），因此这里做一次翻译。
 */
function objCodecOptions(
	options: unknown,
): { externalRefs?: unknown[] } | undefined {
	if (!options || typeof options !== 'object') return undefined;
	const raw = options as { uniqueValues?: unknown[]; externalRefs?: unknown[] };
	const externalRefs = raw.externalRefs ?? raw.uniqueValues;
	return externalRefs ? { externalRefs } : undefined;
}

const base = new Map(adapters.map((a) => [a.id, a]));

function baseAdapter(id: string) {
	const a = base.get(id);
	if (!a) throw new Error(`unknown base adapter: ${id}`);
	return a;
}

function splitBytes(bytes: Uint8Array, chunkSize: number): Uint8Array[] {
	if (!Number.isFinite(chunkSize) || chunkSize >= bytes.byteLength)
		return [bytes];
	const chunks: Uint8Array[] = [];
	for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
		chunks.push(
			bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)),
		);
	}
	return chunks;
}

function splitString(text: string, chunkSize: number): string[] {
	if (!Number.isFinite(chunkSize) || chunkSize >= text.length) return [text];
	const chunks: string[] = [];
	for (let offset = 0; offset < text.length; offset += chunkSize) {
		chunks.push(text.slice(offset, offset + chunkSize));
	}
	return chunks;
}

function concatBytes(chunks: unknown[]): Uint8Array {
	let total = 0;
	for (const c of chunks) total += (c as Uint8Array).byteLength;
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c as Uint8Array, offset);
		offset += (c as Uint8Array).byteLength;
	}
	return out;
}

function streamOf<T>(items: T[]): ReadableStream<T> {
	return new ReadableStream<T>({
		start(controller) {
			for (const item of items) controller.enqueue(item);
			controller.close();
		},
	});
}

export const streamAdapters: StreamAdapter[] = [
	{
		id: 'obj-codec-node',
		lib: 'obj-codec',
		mode: 'incremental',
		requires: [],
		encode: (value, options) => baseAdapter('obj-codec').encode(value, options),
		sizeOf: (payload) => baseAdapter('obj-codec').sizeOf(payload),
		split: (payload, chunkSize) => splitBytes(payload as Uint8Array, chunkSize),
		decode: (chunks, options) =>
			new Promise((resolve, reject) => {
				// v2 的解码器是增量的：逐块 write 即可，无需自己拼缓冲
				const decoder = nodeCodec.decode(objCodecOptions(options));
				decoder.on('error', reject);
				for (const chunk of chunks) decoder.write(chunk as Uint8Array);
				decoder.end();
				try {
					resolve(decoder.result);
				} catch (error) {
					reject(error);
				}
			}),
	},
	{
		id: 'obj-codec-web',
		lib: 'obj-codec',
		mode: 'incremental',
		requires: [],
		encode: (value, options) => baseAdapter('obj-codec').encode(value, options),
		sizeOf: (payload) => baseAdapter('obj-codec').sizeOf(payload),
		split: (payload, chunkSize) => splitBytes(payload as Uint8Array, chunkSize),
		decode: async (chunks, options) => {
			const decoder = webCodec.decode(objCodecOptions(options));
			await streamOf(chunks as Uint8Array[]).pipeTo(decoder);
			return decoder.result;
		},
	},
	{
		id: 'turbo-stream',
		lib: 'turbo-stream',
		mode: 'incremental',
		requires: [],
		encode: (value, options) =>
			baseAdapter('turbo-stream').encode(value, options),
		sizeOf: (payload) => baseAdapter('turbo-stream').sizeOf(payload),
		split: (payload, chunkSize) =>
			splitString((payload as { chunks: string[] }).chunks.join(''), chunkSize),
		decode: async (chunks) => await turbo.decode(streamOf(chunks as string[])),
	},
	{
		id: 'cbor-x-buffered',
		lib: 'cbor-x',
		mode: 'buffered',
		requires: [],
		encode: (value, options) => baseAdapter('cbor-x').encode(value, options),
		sizeOf: (payload) => baseAdapter('cbor-x').sizeOf(payload),
		split: (payload, chunkSize) => splitBytes(payload as Uint8Array, chunkSize),
		decode: (chunks, options) =>
			baseAdapter('cbor-x').decode(concatBytes(chunks), options),
	},
	{
		id: 'msgpackr-buffered',
		lib: 'msgpackr',
		mode: 'buffered',
		requires: [],
		encode: (value, options) => baseAdapter('msgpackr').encode(value, options),
		sizeOf: (payload) => baseAdapter('msgpackr').sizeOf(payload),
		split: (payload, chunkSize) => splitBytes(payload as Uint8Array, chunkSize),
		decode: (chunks, options) =>
			baseAdapter('msgpackr').decode(concatBytes(chunks), options),
	},
	{
		id: 'json-buffered',
		lib: 'json',
		mode: 'buffered',
		requires: [],
		encode: (value, options) => baseAdapter('json').encode(value, options),
		sizeOf: (payload) => baseAdapter('json').sizeOf(payload),
		split: (payload, chunkSize) => splitString(payload as string, chunkSize),
		decode: (chunks) => JSON.parse((chunks as string[]).join('')),
	},
];

export const streamAdapterById = new Map(streamAdapters.map((a) => [a.id, a]));
