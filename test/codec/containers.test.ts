import { describe, expect, it } from 'vitest';
import {
	decodeChunked,
	encode,
	roundTrip,
	roundTripBytewise,
} from '../helpers';

describe('Codec: array', () => {
	//#region 基本
	it('空数组', () => {
		expect(roundTrip([])).toEqual([]);
	});
	it('单元素', () => {
		expect(roundTrip([1])).toEqual([1]);
	});
	it('混合类型', () => {
		const value = [1, 'a', true, null, undefined, 1n];
		const result = roundTrip(value);
		expect(result).toEqual(value);
	});
	it('嵌套数组', () => {
		const value = [[1, [2, [3]]]];
		expect(roundTrip(value)).toEqual(value);
	});
	it('长数组', () => {
		const value = Array.from({ length: 1000 }, (_, i) => i);
		expect(roundTrip(value)).toEqual(value);
	});
	//#endregion
	//#region 稀疏数组
	it('保留中间空位', () => {
		// biome-ignore lint/suspicious/noSparseArray: 就是要测稀疏数组
		const value = [1, , 3];
		const result = roundTrip(value);
		expect(result).toHaveLength(3);
		expect(1 in result).toBe(false);
		expect(result[0]).toBe(1);
		expect(result[2]).toBe(3);
	});
	it('保留尾部空位', () => {
		// biome-ignore lint/suspicious/noSparseArray: 就是要测稀疏数组
		const value = [1, ,];
		const result = roundTrip(value);
		expect(result).toHaveLength(2);
		expect(1 in result).toBe(false);
	});
	it('全空数组', () => {
		const value = new Array(3);
		const result = roundTrip(value);
		expect(result).toHaveLength(3);
		expect(0 in result).toBe(false);
		expect(1 in result).toBe(false);
		expect(2 in result).toBe(false);
	});
	it('空位与 undefined 可区分', () => {
		// biome-ignore lint/suspicious/noSparseArray: 就是要测稀疏数组
		const value = [undefined, , undefined];
		const result = roundTrip(value);
		expect(0 in result).toBe(true);
		expect(1 in result).toBe(false);
		expect(2 in result).toBe(true);
		expect(result[0]).toBeUndefined();
	});
	it('空位记作 undefined 会丢失区别（反例）', () => {
		const result = roundTrip([1, undefined, 3]);
		// 这种写法没有空位，`1 in result` 为 true
		expect(1 in result).toBe(true);
	});
	//#endregion
	//#region 引用
	it('自引用', () => {
		const value: unknown[] = [];
		value.push(value);
		const result = roundTrip(value);
		expect(result[0]).toBe(result);
	});
	it('共享子数组', () => {
		const shared = [1, 2];
		const result = roundTrip([shared, shared, [shared]]);
		expect(result[0]).toBe(result[1]);
		expect(result[2][0]).toBe(result[0]);
	});
	//#endregion
	//#region 流式
	it('逐字节往返', () => {
		const value = [1, 'a', [2, 3], { x: 1 }];
		expect(roundTripBytewise(value)).toEqual(value);
	});
	it('大数组各种分块', () => {
		const value = Array.from({ length: 100 }, (_, i) => ({ i }));
		for (const size of [1, 3, 17]) {
			const result = decodeChunked(encode(value), size) as typeof value;
			expect(result).toHaveLength(100);
			expect(result[99]).toEqual({ i: 99 });
		}
	});
	//#endregion
});

describe('Codec: object', () => {
	it('空对象', () => {
		expect(roundTrip({})).toEqual({});
	});
	it('基本键值', () => {
		expect(roundTrip({ a: 1, b: 'x' })).toEqual({ a: 1, b: 'x' });
	});
	it('保持键顺序', () => {
		const value = { z: 1, a: 2, m: 3 };
		expect(Object.keys(roundTrip(value))).toEqual(['z', 'a', 'm']);
	});
	it('数字键转为字符串', () => {
		const result = roundTrip({ 1: 'a', 2: 'b' });
		expect(result['1']).toBe('a');
		expect(Object.keys(result)).toEqual(['1', '2']);
	});
	it('空字符串键', () => {
		expect(roundTrip({ '': 1 })['']).toBe(1);
	});
	it('嵌套对象', () => {
		const value = { a: { b: { c: 1 } } };
		expect(roundTrip(value)).toEqual(value);
	});
	it('含数组与 Map/Set', () => {
		const value = { arr: [1], set: new Set([1]), map: new Map([['k', 1]]) };
		const result = roundTrip(value);
		expect(result.arr).toEqual([1]);
		expect([...result.set]).toEqual([1]);
		expect(result.map.get('k')).toBe(1);
	});
	//#region __proto__
	it('__proto__ 作为自有属性', () => {
		const value = JSON.parse('{"__proto__": {"x": 1}}');
		const result = roundTrip(value) as Record<string, unknown>;
		expect(Object.hasOwn(result, '__proto__')).toBe(true);
		// 不能改写原型
		expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
	});
	it('构造器键名正常保留', () => {
		const value = { constructor: 1 };
		expect(roundTrip(value).constructor).toBe(1);
	});
	//#endregion
	//#region 引用
	it('自引用', () => {
		const value: Record<string, unknown> = { a: 1 };
		value.self = value;
		const result = roundTrip(value);
		expect(result.self).toBe(result);
	});
	it('循环引用 A→B→A', () => {
		const a: Record<string, unknown> = {};
		const b: Record<string, unknown> = { a };
		a.b = b;
		const result = roundTrip(a) as Record<string, unknown>;
		expect((result.b as Record<string, unknown>).a).toBe(result);
	});
	//#endregion
	//#region 不可编码内容被丢弃
	it('函数属性由编码器统一报错', () => {
		const value = { fn: () => undefined, ok: 1 };
		expect(() => roundTrip(value)).toThrow('Unsupported type: function');
	});
	it('嵌套对象里的函数也会报错', () => {
		const value = { nested: { fn: () => 1, keep: 2 } };
		expect(() => roundTrip(value)).toThrow('Unsupported type: function');
	});
	it('数组里的函数会报错', () => {
		expect(() => roundTrip([1, () => 1, 3])).toThrow(
			'Unsupported type: function',
		);
	});
	it('Set 里的函数会报错', () => {
		expect(() => roundTrip(new Set([1, () => 1]))).toThrow(
			'Unsupported type: function',
		);
	});
	it('Map 的键或值是函数都会报错', () => {
		expect(() => roundTrip(new Map([['k', () => 1]]))).toThrow(
			'Unsupported type: function',
		);
		expect(() => roundTrip(new Map<unknown, unknown>([[() => 1, 'v']]))).toThrow(
			'Unsupported type: function',
		);
	});
	it('原型链上的属性不编码', () => {
		// 注意：类字段（`inherited = 1`）会创建自有属性，
		// 只有定义在 prototype 上、或通过 class 方法添加的才是原型属性
		class Base {}
		Base.prototype.inherited = 1;
		const instance = new Base();
		instance.own = 2;
		const result = roundTrip(instance);
		expect(result.own).toBe(2);
		expect(result.inherited).toBeUndefined();
	});
	it('不可枚举属性不编码', () => {
		const value: Record<string, unknown> = { visible: 1 };
		Object.defineProperty(value, 'hidden', {
			value: 2,
			enumerable: false,
		});
		expect(roundTrip(value)).toEqual({ visible: 1 });
	});
	//#endregion
});

describe('Codec: set', () => {
	it('空 Set', () => {
		expect([...roundTrip(new Set())]).toEqual([]);
	});
	it('基本成员', () => {
		expect([...roundTrip(new Set([1, 2, 3]))]).toEqual([1, 2, 3]);
	});
	it('插入顺序保持', () => {
		const value = new Set(['c', 'a', 'b']);
		expect([...roundTrip(value)]).toEqual(['c', 'a', 'b']);
	});
	it('混合类型', () => {
		const value = new Set<unknown>([1, 'a', null, undefined]);
		const result = roundTrip(value);
		expect(result.size).toBe(4);
		expect(result.has(1)).toBe(true);
		expect(result.has('a')).toBe(true);
		expect(result.has(null)).toBe(true);
		expect(result.has(undefined)).toBe(true);
	});
	it('嵌套 Set', () => {
		const result = roundTrip(new Set([new Set([1])]));
		const inner = [...result][0] as Set<number>;
		expect([...inner]).toEqual([1]);
	});
	it('对象成员保持同一性', () => {
		const shared = { x: 1 };
		const result = roundTrip(new Set([shared]));
		expect([...result][0]).toEqual(shared);
	});
});

describe('Codec: map', () => {
	it('空 Map', () => {
		expect(roundTrip(new Map()).size).toBe(0);
	});
	it('基本键值', () => {
		const value = new Map([['a', 1]]);
		expect(roundTrip(value).get('a')).toBe(1);
	});
	it('插入顺序保持', () => {
		const value = new Map([
			['c', 3],
			['a', 1],
		]);
		expect([...roundTrip(value).keys()]).toEqual(['c', 'a']);
	});
	it('非字符串键', () => {
		const objKey = { id: 1 };
		const value = new Map<unknown, unknown>([
			[1, 'num'],
			[objKey, 'obj'],
			[null, 'null'],
		]);
		const result = roundTrip(value);
		expect(result.get(1)).toBe('num');
		expect(result.get(null)).toBe('null');
		// 对象键是重建的，不是原实例，但内容相同
		const keys = [...result.keys()];
		expect(keys[1]).toEqual({ id: 1 });
	});
	it('嵌套 Map', () => {
		const result = roundTrip(new Map([['inner', new Map([['x', 1]])]]));
		const inner = result.get('inner') as Map<string, number>;
		expect(inner.get('x')).toBe(1);
	});
	it('自引用', () => {
		const value = new Map<unknown, unknown>();
		value.set('self', value);
		const result = roundTrip(value);
		expect(result.get('self')).toBe(result);
	});
	it('重复值被引用复用', () => {
		const shared = [1, 2];
		const result = roundTrip(
			new Map<unknown, unknown>([
				['a', shared],
				['b', shared],
			]),
		);
		expect(result.get('a')).toBe(result.get('b'));
	});
});
