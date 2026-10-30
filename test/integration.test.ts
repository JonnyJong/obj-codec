import { describe, expect, it } from 'vitest';
import { ObjCodec } from '../src/web';
import { decodeChunked, encode, roundTrip, roundTripBytewise } from './helpers';

/**
 * 整体测试
 *
 * 按类型细分的测试已在 `test/codec/` 里覆盖各自边界，
 * 这里只验证「真实数据混在一起」时的行为：互相嵌套、共享引用、
 * 流式分块、以及自定义 codec 与内置类型的配合。
 */

describe('整体: 真实结构', () => {
	it('多层嵌套的混合数据', () => {
		const value = {
			id: 42,
			name: '张三',
			active: true,
			score: 98.5,
			tags: ['a', 'b'],
			meta: null,
			missing: undefined,
			count: 10n,
			created: new Date('2024-01-02T03:04:05.678Z'),
			pattern: /test/gi,
			bytes: new Uint8Array([1, 2, 3]),
			nested: { set: new Set([1, 2]), map: new Map([['k', 'v']]) },
		};
		const result = roundTrip(value);
		expect(result.id).toBe(42);
		expect(result.name).toBe('张三');
		expect(result.score).toBe(98.5);
		expect(result.tags).toEqual(['a', 'b']);
		expect(result.meta).toBeNull();
		expect(result.missing).toBeUndefined();
		expect(result.count).toBe(10n);
		expect(result.created.getTime()).toBe(value.created.getTime());
		expect(result.pattern.source).toBe('test');
		expect([...result.bytes]).toEqual([1, 2, 3]);
		expect([...result.nested.set]).toEqual([1, 2]);
		expect(result.nested.map.get('k')).toBe('v');
	});

	it('深层嵌套不爆栈', () => {
		let value: Record<string, unknown> = {};
		const root = value;
		for (let i = 0; i < 200; i++) {
			const next: Record<string, unknown> = {};
			value.child = next;
			value = next;
		}
		const result = roundTrip(root);
		let cursor = result as Record<string, unknown>;
		for (let i = 0; i < 200; i++)
			cursor = cursor.child as Record<string, unknown>;
		expect(cursor).toEqual({});
	});

	it('宽对象（大量键）', () => {
		const value: Record<string, number> = {};
		for (let i = 0; i < 500; i++) value[`k${i}`] = i;
		expect(roundTrip(value)).toEqual(value);
	});
});

describe('整体: 引用图', () => {
	it('菱形引用', () => {
		const shared = { v: 1 };
		const value = { left: { s: shared }, right: { s: shared } };
		const result = roundTrip(value);
		expect(result.left.s).toBe(result.right.s);
	});

	it('多处共享的字符串只存一次', () => {
		const shared = 'x'.repeat(200);
		const value = { a: shared, b: shared, c: [shared] };
		const result = roundTrip(value);
		expect(result.a).toBe(shared);
		expect(result.c[0]).toBe(shared);
	});

	it('互引的两个对象', () => {
		const a: Record<string, unknown> = { name: 'a' };
		const b: Record<string, unknown> = { name: 'b', a };
		a.b = b;
		const result = roundTrip(a) as Record<string, unknown>;
		const rb = result.b as Record<string, unknown>;
		expect(rb.a).toBe(result);
	});

	it('容器里的循环引用', () => {
		const arr: unknown[] = [];
		const map = new Map<string, unknown>([['arr', arr]]);
		arr.push(map);
		const result = roundTrip(arr);
		const back = (result[0] as Map<string, unknown>).get('arr');
		expect(back).toBe(result);
	});

	it('同一 Map 作为多个键的值', () => {
		const shared = new Map([['x', 1]]);
		const value = { a: shared, b: shared };
		const result = roundTrip(value);
		expect(result.a).toBe(result.b);
	});
});

describe('整体: 流式', () => {
	const value = {
		items: Array.from({ length: 200 }, (_, i) => ({
			id: i,
			name: `名字-${i}`,
			blob: new Uint8Array([i & 0xff, (i * 2) & 0xff]),
			tags: ['x', 'y'],
		})),
	};

	it('各种分块大小结果一致', () => {
		for (const size of [1, 2, 3, 5, 8, 13, 64, 1024]) {
			const result = decodeChunked(encode(value), size) as typeof value;
			expect(result.items).toHaveLength(200);
			expect(result.items[0].name).toBe('名字-0');
			expect(result.items[199].id).toBe(199);
		}
	});

	it('大二进制跨多个分块', () => {
		const big = {
			data: new Uint8Array(100_000).map((_, i) => i % 251),
			tail: 'done',
		};
		const result = roundTripBytewise(big);
		expect(result.data).toHaveLength(100_000);
		expect(result.data[99_999]).toBe(99_999 % 251);
		expect(result.tail).toBe('done');
	});

	it('字符串跨分块边界', () => {
		const value2 = { s: '你'.repeat(500) };
		for (const size of [1, 2, 3, 7]) {
			const result = decodeChunked(encode(value2), size);
			expect((result as typeof value2).s).toBe(value2.s);
		}
	});
});

describe('整体: 自定义 codec 协作', () => {
	class Point {
		x: number;
		y: number;
		constructor(x: number, y: number) {
			this.x = x;
			this.y = y;
		}
	}

	function makeCodec() {
		return new ObjCodec().register<Point, number>({
			kind: 'referable',
			name: 'Point',
			class: Point,
			write: (ctx, v) => {
				ctx.writer.varint(v.x);
				ctx.writer.varint(v.y);
			},
			read(ctx) {
				ctx.state ??= ctx.reader.varint();
				return new Point(ctx.state, ctx.reader.varint());
			},
		});
	}

	it('自定义类型与内置类型混用', () => {
		const codec = makeCodec();
		const value = {
			points: [new Point(1, 2), new Point(3, 4)],
			meta: { count: 2, tags: ['a'] },
		};
		const result = codec.decodeSync(codec.encodeSync(value)) as typeof value;
		expect(result.points[0]).toBeInstanceOf(Point);
		expect(result.points[1].y).toBe(4);
		expect(result.meta.count).toBe(2);
	});

	it('自定义类型的共享实例保持同一性', () => {
		const codec = makeCodec();
		const p = new Point(1, 2);
		const result = codec.decodeSync(codec.encodeSync([p, p])) as Point[];
		expect(result[0]).toBe(result[1]);
	});

	it('自定义类型可自引用', () => {
		class Node2 {
			self?: Node2;
		}
		const codec = new ObjCodec().register({
			kind: 'container',
			name: 'Node2',
			class: Node2,
			count: (v) => (v.self ? 1 : 0),
			forEachChild: (v, emit) => emit(v.self),
			create: () => new Node2(),
			addChild: (shell, child) => {
				shell.self = child as Node2;
			},
		});
		const value = new Node2();
		value.self = value;
		const result = codec.decodeSync(codec.encodeSync(value)) as Node2;
		expect(result).toBeInstanceOf(Node2);
		expect(result.self).toBe(result);
	});
});
