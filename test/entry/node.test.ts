import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { describe, expect, it } from 'vitest';
import { ObjCodec } from '../../src/index';

const RE_UNEXPECTED_END = /Unexpected end/;
const RE_NOT_COMPLETE = /not complete/;
const RE_MISSING_CODEC = /Missing codec/;

/** 收集可读流的全部字节 */
async function collect(stream: NodeJS.ReadableStream): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	for await (const chunk of stream as AsyncIterable<Uint8Array>) {
		chunks.push(chunk);
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

describe('Node 入口: 一次性', () => {
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
	it('复用同一实例多次编解码', () => {
		const codec = new ObjCodec();
		for (let i = 0; i < 3; i++) {
			expect(codec.decodeSync(codec.encodeSync({ i }))).toEqual({ i });
		}
	});
});

describe('Node 入口: 可读流', () => {
	it('产出多块', async () => {
		const codec = new ObjCodec();
		// 足够大，保证分块不止一个
		const value = { list: Array.from({ length: 5000 }, (_, i) => i) };
		const bytes = await collect(codec.encode(value));
		expect(bytes.length).toBeGreaterThan(0);
		expect(codec.decodeSync(bytes)).toEqual(value);
	});
	it('for await 消费', async () => {
		const codec = new ObjCodec();
		const value = [1, 2, 3];
		let total = 0;
		for await (const chunk of codec.encode(value)) total += chunk.length;
		expect(total).toBeGreaterThan(0);
	});
	it('pipe 到解码流', async () => {
		const codec = new ObjCodec();
		const value = { a: [1, 2], b: 'hello' };
		const decoder = codec.decode();
		await pipeline(codec.encode(value), decoder);
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
		await pipeline(codec.encode(value), decoder);
		const result = decoder.result as typeof value;
		expect(result.items).toHaveLength(2000);
		expect(result.items[1999].name).toBe('name-1999');
	});
	it('销毁时不泄漏', async () => {
		const codec = new ObjCodec();
		const stream = codec.encode({
			list: Array.from({ length: 10000 }, (_, i) => i),
		});
		// 读一块就销毁，确认生成器被释放且不抛错
		await new Promise<void>((resolve, reject) => {
			stream.once('data', () => {
				stream.destroy();
				resolve();
			});
			stream.once('error', reject);
		});
		expect(stream.destroyed).toBe(true);
	});
});

describe('Node 入口: 可写流', () => {
	it('手动 write + end', async () => {
		const codec = new ObjCodec();
		const value = { s: 'hi', n: 42 };
		const bytes = codec.encodeSync(value);
		const decoder = codec.decode();
		const finished = new Promise<void>((resolve) => {
			decoder.once('finish', resolve);
		});
		// 逐字节写入，强制跨块边界
		for (let i = 0; i < bytes.length; i++) {
			decoder.write(bytes.subarray(i, i + 1));
		}
		decoder.end();
		await finished;
		expect(decoder.result).toEqual(value);
	});
	it('从可读流转发', async () => {
		const codec = new ObjCodec();
		const value = { a: 1 };
		const decoder = codec.decode();
		await pipeline(codec.encode(value), decoder);
		expect(decoder.result).toEqual(value);
	});
	it('截断输入会让流报错', async () => {
		const codec = new ObjCodec();
		const bytes = codec.encodeSync({ long: 'x'.repeat(200) });
		const decoder = codec.decode();
		await expect(
			(async () => {
				await pipeline(
					Readable.from([bytes.subarray(0, bytes.length - 10)]),
					decoder,
				);
			})(),
		).rejects.toThrow(RE_UNEXPECTED_END);
	});
	it('result 在未完成时抛错', () => {
		const codec = new ObjCodec();
		const decoder = codec.decode();
		expect(() => decoder.result).toThrow(RE_NOT_COMPLETE);
	});
});

describe('Node 入口: 自定义类型', () => {
	class Point {
		x: number;
		y: number;
		constructor(x: number, y: number) {
			this.x = x;
			this.y = y;
		}
	}
	it('注册并往返', async () => {
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
		const value = [new Point(1, 2), new Point(3, 4)];
		const decoder = codec.decode();
		await pipeline(codec.encode(value), decoder);
		const result = decoder.result as Point[];
		expect(result[0]).toBeInstanceOf(Point);
		expect(result[1].y).toBe(4);
	});
	it('注册后编码会带类型表', () => {
		const codec = new ObjCodec().register({
			kind: 'referable',
			name: 'Point',
			class: Point,
			write: () => undefined,
			read: () => new Point(0, 0),
		});
		const bytes = codec.encodeSync(new Point(1, 2));
		// 首字节低两位为 0b11 表示带类型表
		expect(bytes[0] & 0b01).toBe(0b01);
	});
	it('未注册时缺 codec 报错', () => {
		const source = new ObjCodec().register({
			kind: 'referable',
			name: 'Point',
			class: Point,
			write: () => undefined,
			read: () => new Point(0, 0),
		});
		const bytes = source.encodeSync(new Point(1, 2));
		const target = new ObjCodec();
		expect(() => target.decodeSync(bytes)).toThrow(RE_MISSING_CODEC);
	});
});

describe('Node 入口: 外部引用', () => {
	it('外部引用不编码内容', () => {
		const codec = new ObjCodec();
		const global = { shared: true };
		const value = { g: global, local: 1 };
		const bytes = codec.encodeSync(value, { externalRefs: [global] });
		const result = codec.decodeSync(bytes, { externalRefs: [global] }) as {
			g: unknown;
		};
		expect(result.g).toBe(global);
	});
	it('函数型外部引用不被当作不支持类型', () => {
		// 这正是 `isEncodable` 之前的坑：容器层若预先跳过函数，
		// 这些合法值会被静默丢弃，而不是编码成外部引用
		const codec = new ObjCodec();
		const fn = () => undefined;
		const builtin = Array.isArray;
		const value = { a: fn, b: builtin, c: 1 };
		const bytes = codec.encodeSync(value, { externalRefs: [fn, builtin] });
		const result = codec.decodeSync(bytes, {
			externalRefs: [fn, builtin],
		}) as { a: unknown; b: unknown; c: number };
		expect(result.a).toBe(fn);
		expect(result.b).toBe(builtin);
		expect(result.c).toBe(1);
	});
	it('数组与 Map 里的外部引用函数同样有效', () => {
		const codec = new ObjCodec();
		const fn = () => 1;
		const value = [fn, new Map([['k', fn]])];
		const bytes = codec.encodeSync(value, { externalRefs: [fn] });
		const result = codec.decodeSync(bytes, { externalRefs: [fn] }) as [
			unknown,
			Map<string, unknown>,
		];
		expect(result[0]).toBe(fn);
		expect(result[1].get('k')).toBe(fn);
	});
	it('外部引用比内部引用省字节', () => {
		const codec = new ObjCodec();
		const big = { data: 'x'.repeat(500) };
		const value = { a: big };
		const withExt = codec.encodeSync(value, { externalRefs: [big] });
		const without = codec.encodeSync(value);
		expect(withExt.length).toBeLessThan(without.length);
	});
});

describe('Node 入口: Codec 实例隔离', () => {
	it('不同实例的注册表互不影响', () => {
		class A {}
		const a = new ObjCodec().register({
			kind: 'referable',
			name: 'A',
			class: A,
			write: () => undefined,
			read: () => new A(),
		});
		const b = new ObjCodec();
		const bytes = a.encodeSync(new A());
		expect(() => b.decodeSync(bytes)).toThrow(RE_MISSING_CODEC);
	});
	it('注销后不再编码', () => {
		class A {}
		const codec = new ObjCodec().register({
			kind: 'referable',
			name: 'A',
			class: A,
			write: () => undefined,
			read: () => new A(),
		});
		expect(codec.unregister('A')).toBe(true);
		// 注销后退化为普通对象编码（无自有属性）
		const bytes = codec.encodeSync(new A());
		expect(bytes[0] & 0b01).toBe(0);
	});
});
