import { describe, expect, it } from 'vitest';
import { DecodeStream, EncodeStream, ObjCodec } from '../../src/web';

const RE_UNEXPECTED_END = /Unexpected end/;
const RE_NOT_COMPLETE = /not complete/;

/** 把可读流的全部字节收集起来 */
async function collect(
	stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	const reader = stream.getReader();
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	let total = 0;
	for (const c of chunks) total += c.length;
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.length;
	}
	return out;
}

/** 把字节切块造成 ReadableStream */
function streamOf(bytes: Uint8Array, size: number): ReadableStream<Uint8Array> {
	let offset = 0;
	return new ReadableStream<Uint8Array>({
		pull: (controller) => {
			if (offset >= bytes.length) {
				controller.close();
				return;
			}
			const end = Math.min(offset + size, bytes.length);
			controller.enqueue(bytes.subarray(offset, end));
			offset = end;
		},
	});
}

describe('Web 入口: 一次性', () => {
	it('编解码往返', () => {
		const codec = new ObjCodec();
		const value = { a: 1, b: 'x', c: [1, 2, 3] };
		const bytes = codec.encodeSync(value);
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(codec.decodeSync(bytes)).toEqual(value);
	});
	it('循环引用', () => {
		const codec = new ObjCodec();
		const value: Record<string, unknown> = { n: 1 };
		value.self = value;
		const result = codec.decodeSync(codec.encodeSync(value));
		expect((result as Record<string, unknown>).self).toBe(result);
	});
	it('与 Node 入口产物一致', async () => {
		// 动态导入以对比两个入口；两者是不同模块实例，各有独立注册表
		const node = await import('../../src/index');
		const web = new ObjCodec();
		const nodeCodec = new node.ObjCodec();
		const value = { a: [1, 2], b: 'hello', c: new Uint8Array([1, 2]) };
		expect([...web.encodeSync(value)]).toEqual([...nodeCodec.encodeSync(value)]);
	});
});

describe('Web 入口: 可读流', () => {
	it('产出多块', async () => {
		const codec = new ObjCodec();
		const value = { list: Array.from({ length: 5000 }, (_, i) => i) };
		const bytes = await collect(codec.encode(value));
		expect(bytes.length).toBeGreaterThan(0);
		expect(codec.decodeSync(bytes)).toEqual(value);
	});
	it('getReader 逐块读取', async () => {
		const codec = new ObjCodec();
		const value = [1, 2, 3];
		let total = 0;
		const reader = codec.encode(value).getReader();
		while (true) {
			const { value: chunk, done } = await reader.read();
			if (done) break;
			total += chunk.length;
		}
		expect(total).toBeGreaterThan(0);
	});
	it('pipeTo 解码流', async () => {
		const codec = new ObjCodec();
		const value = { a: [1, 2], b: 'hello' };
		const decoder = codec.decode();
		await codec.encode(value).pipeTo(decoder);
		expect(decoder.result).toEqual(value);
	});
	it('大对象流式往返', async () => {
		const codec = new ObjCodec();
		const value = {
			items: Array.from({ length: 2000 }, (_, i) => ({
				id: i,
				name: `name-${i}`,
				tags: ['a', 'b'],
			})),
		};
		const decoder = codec.decode();
		await codec.encode(value).pipeTo(decoder);
		const result = decoder.result as typeof value;
		expect(result.items).toHaveLength(2000);
		expect(result.items[1999].name).toBe('name-1999');
	});
	it('取消时释放生成器', async () => {
		const codec = new ObjCodec();
		const stream = codec.encode({
			list: Array.from({ length: 10000 }, (_, i) => i),
		});
		const reader = stream.getReader();
		await reader.read();
		// 取消后不应再产出，也不应抛错
		await expect(reader.cancel()).resolves.toBeUndefined();
	});
});

describe('Web 入口: 可写流', () => {
	it('逐块写入', async () => {
		const codec = new ObjCodec();
		const value = { s: 'hi', n: 42 };
		const bytes = codec.encodeSync(value);
		const decoder = codec.decode();
		await streamOf(bytes, 1).pipeTo(decoder);
		expect(decoder.result).toEqual(value);
	});
	it('各种分块大小结果一致', async () => {
		const codec = new ObjCodec();
		const value = { s: '你好世界', n: [1, 2, 3], b: new Uint8Array([1, 2, 3]) };
		const bytes = codec.encodeSync(value);
		for (const size of [1, 2, 5, 13, 64]) {
			const decoder = codec.decode();
			await streamOf(bytes, size).pipeTo(decoder);
			const result = decoder.result as typeof value;
			expect(result.s).toBe('你好世界');
			expect(result.n).toEqual([1, 2, 3]);
			expect([...result.b]).toEqual([1, 2, 3]);
		}
	});
	it('截断输入会 reject', async () => {
		const codec = new ObjCodec();
		const bytes = codec.encodeSync({ long: 'x'.repeat(200) });
		const decoder = codec.decode();
		await expect(
			streamOf(bytes.subarray(0, bytes.length - 10), 8).pipeTo(decoder),
		).rejects.toThrow(RE_UNEXPECTED_END);
	});
	it('result 在未完成时抛错', () => {
		const codec = new ObjCodec();
		expect(() => codec.decode().result).toThrow(RE_NOT_COMPLETE);
	});
});

describe('Web 入口: 自定义类型与外部引用', () => {
	class Point {
		x: number;
		y: number;
		constructor(x: number, y: number) {
			this.x = x;
			this.y = y;
		}
	}
	it('注册并流式往返', async () => {
		const codec = new ObjCodec().register({
			kind: 'referable',
			name: 'Point',
			class: Point,
			write: (ctx, value) => {
				ctx.writer.varint(value.x);
				ctx.writer.varint(value.y);
			},
			read: (ctx) => new Point(ctx.reader.varint(), ctx.reader.varint()),
		});
		const decoder = codec.decode();
		await codec.encode([new Point(1, 2)]).pipeTo(decoder);
		const result = decoder.result as Point[];
		expect(result[0]).toBeInstanceOf(Point);
		expect(result[0].x).toBe(1);
	});
	it('外部引用共享同一对象', () => {
		const codec = new ObjCodec();
		const shared = { k: 1 };
		const bytes = codec.encodeSync([shared], { externalRefs: [shared] });
		const result = codec.decodeSync(bytes, {
			externalRefs: [shared],
		}) as unknown[];
		expect(result[0]).toBe(shared);
	});
});

describe('Web 入口: 流类型', () => {
	it('EncoderStream 是 ReadableStream', () => {
		const codec = new ObjCodec();
		expect(codec.encode(1)).toBeInstanceOf(ReadableStream);
	});
	it('DecoderStream 是 WritableStream', () => {
		const codec = new ObjCodec();
		expect(codec.decode()).toBeInstanceOf(WritableStream);
	});
	it('EncoderStream 可被 for await 消费', async () => {
		const codec = new ObjCodec();
		let total = 0;
		for await (const chunk of codec.encode({
			a: 1,
		}) as AsyncIterable<Uint8Array>) {
			total += chunk.length;
		}
		expect(total).toBeGreaterThan(0);
	});
	it('EncoderStream 类型正确', () => {
		const codec = new ObjCodec();
		expect(codec.encode(1)).toBeInstanceOf(EncodeStream);
		expect(codec.decode()).toBeInstanceOf(DecodeStream);
	});
});
