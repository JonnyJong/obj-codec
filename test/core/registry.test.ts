import { describe, expect, it } from 'vitest';
import { sortCodecs } from '../../src/codec-order';
import { CUSTOM_BEGIN } from '../../src/protocol';
import { CodecRegistry } from '../../src/registry';
import { CodecSnapshot } from '../../src/snapshot';
import type { CustomCodec, CustomReferableCodec } from '../../src/types';

/** 造一个最小的可引用 codec */
function makeCodec(
	name: string,
	ctor: new () => unknown,
): CustomReferableCodec<unknown> {
	return {
		kind: 'referable',
		name,
		class: ctor as unknown as new () => unknown,
		write: () => undefined,
		read: () => new ctor(),
	};
}

const names = (codecs: readonly CustomCodec[]) => codecs.map((c) => c.name);

describe('Codec 排序', () => {
	class A {}
	class B {}
	class C {}

	it('输入顺序不同，结果一致', () => {
		const codecs = [
			makeCodec('alpha', A),
			makeCodec('beta', B),
			makeCodec('gamma', C),
		];
		const permutations = [
			[codecs[0], codecs[1], codecs[2]],
			[codecs[2], codecs[0], codecs[1]],
			[codecs[1], codecs[2], codecs[0]],
			[codecs[2], codecs[1], codecs[0]],
		];
		const results = permutations.map((p) => names(sortCodecs(p)).join(','));
		expect(new Set(results).size).toBe(1);
		expect(results[0]).toBe('alpha,beta,gamma');
	});

	it('全排列都得到同一顺序（含继承层级）', () => {
		class Base {}
		class Mid extends Base {}
		class Leaf extends Mid {}
		const codecs = [
			makeCodec('base', Base),
			makeCodec('mid', Mid),
			makeCodec('leaf', Leaf),
		];
		// 3 个元素的全部 6 种排列
		const permutations: CustomCodec[][] = [];
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 3; j++) {
				for (let k = 0; k < 3; k++) {
					if (i === j || j === k || i === k) continue;
					permutations.push([codecs[i], codecs[j], codecs[k]]);
				}
			}
		}
		expect(permutations).toHaveLength(6);
		const results = new Set(
			permutations.map((p) => names(sortCodecs(p)).join(',')),
		);
		expect([...results]).toEqual(['leaf,mid,base']);
	});

	it('子类排在父类之前', () => {
		class Parent {}
		class Child extends Parent {}
		const codecs = [makeCodec('parent', Parent), makeCodec('child', Child)];
		// 两种注册顺序都必须得到 child 在前
		expect(names(sortCodecs(codecs))).toEqual(['child', 'parent']);
		expect(names(sortCodecs([...codecs].reverse()))).toEqual(['child', 'parent']);
	});

	it('多层继承按深度排序', () => {
		class Base {}
		class Middle extends Base {}
		class Leaf extends Middle {}
		const codecs = [
			makeCodec('base', Base),
			makeCodec('middle', Middle),
			makeCodec('leaf', Leaf),
		];
		expect(names(sortCodecs(codecs))).toEqual(['leaf', 'middle', 'base']);
		expect(names(sortCodecs([...codecs].reverse()))).toEqual([
			'leaf',
			'middle',
			'base',
		]);
	});

	it('同深度按 name 排序，与注册顺序无关', () => {
		class X {}
		class Y {}
		class Z {}
		const a = makeCodec('zebra', X);
		const b = makeCodec('apple', Y);
		const c = makeCodec('mango', Z);
		expect(names(sortCodecs([a, b, c]))).toEqual(['apple', 'mango', 'zebra']);
		expect(names(sortCodecs([c, b, a]))).toEqual(['apple', 'mango', 'zebra']);
	});

	it('父类未注册时不影响子类排序', () => {
		class Orphan {}
		class ChildOfOrphan extends Orphan {}
		const unknown = class {};
		// 只注册子类；父类没有 codec，不产生冲突
		const codecs = [
			makeCodec('child', ChildOfOrphan),
			makeCodec('other', unknown),
		];
		const result = names(sortCodecs(codecs));
		expect(result).toEqual(['child', 'other']);
	});

	it('不修改入参', () => {
		class P {}
		class Q {}
		const input = [makeCodec('q', Q), makeCodec('p', P)];
		const before = names(input);
		sortCodecs(input);
		expect(names(input)).toEqual(before);
	});

	it('空集合', () => {
		expect(sortCodecs([])).toEqual([]);
	});
});

describe('CodecRegistry', () => {
	class A {}
	class B {}

	it('注册、查询与注销', () => {
		const registry = new CodecRegistry();
		const a = makeCodec('a', A);
		registry.register(a);
		expect(registry.size).toBe(1);
		expect(registry.get('a')).toBe(a);
		expect(registry.get('b')).toBeUndefined();
		expect(registry.unregister('a')).toBe(true);
		expect(registry.unregister('a')).toBe(false);
		expect(registry.size).toBe(0);
	});

	it('clear 清空全部注册', () => {
		const registry = new CodecRegistry();
		registry.register(makeCodec('a', A));
		registry.register(makeCodec('b', B));
		registry.clear();
		expect(registry.size).toBe(0);
		expect(registry.get('a')).toBeUndefined();
	});

	it('没有修改时复用同一份快照', () => {
		const registry = new CodecRegistry();
		registry.register(makeCodec('a', A));
		expect(registry.snapshot).toBe(registry.snapshot);
	});

	it('注册后重建快照', () => {
		const registry = new CodecRegistry();
		registry.register(makeCodec('a', A));
		const first = registry.snapshot;
		registry.register(makeCodec('b', B));
		const second = registry.snapshot;
		expect(second).not.toBe(first);
		expect(names(second.codecs)).toEqual(['a', 'b']);
	});

	it('注销后重建快照', () => {
		const registry = new CodecRegistry();
		registry.register(makeCodec('a', A));
		registry.register(makeCodec('b', B));
		const first = registry.snapshot;
		registry.unregister('a');
		const second = registry.snapshot;
		expect(second).not.toBe(first);
		expect(names(second.codecs)).toEqual(['b']);
	});

	it('重复 name 报错', () => {
		const registry = new CodecRegistry();
		registry.register(makeCodec('a', A));
		expect(() => registry.register(makeCodec('a', B))).toThrow(
			'Codec "a" is already registered',
		);
	});

	it('校验 codec 结构', () => {
		const registry = new CodecRegistry();
		expect(() =>
			registry.register({ kind: 'referable', name: 'x' } as never),
		).toThrow(TypeError);
		expect(() =>
			registry.register({ ...makeCodec('y', A), name: '' } as never),
		).toThrow(TypeError);
	});
});

describe('CodecSnapshot', () => {
	class A {}
	class B {}

	it('空快照', () => {
		const registry = new CodecRegistry();
		expect(registry.snapshot.size).toBe(0);
		expect(registry.snapshot.codecs).toEqual([]);
	});

	it('按排序顺序分配 ID', () => {
		const snapshot = new CodecSnapshot([makeCodec('b', B), makeCodec('a', A)]);
		expect(names(snapshot.codecs)).toEqual(['a', 'b']);
	});

	it('按 ID 取回 codec', () => {
		const snapshot = new CodecSnapshot([makeCodec('a', A), makeCodec('b', B)]);
		expect(snapshot.byId(CUSTOM_BEGIN)?.name).toBe('a');
		expect(snapshot.byId(CUSTOM_BEGIN + 1)?.name).toBe('b');
		expect(snapshot.byId(CUSTOM_BEGIN + 2)).toBeUndefined();
		// 内置 ID 不属于自定义范围
		expect(snapshot.byId(0)).toBeUndefined();
	});

	it('idOf 与 byId 互为逆运算', () => {
		const a = makeCodec('a', A);
		const b = makeCodec('b', B);
		const snapshot = new CodecSnapshot([a, b]);
		for (const codec of [a, b]) {
			expect(snapshot.byId(snapshot.idOf(codec))).toBe(codec);
		}
	});

	it('idOf 对未注册的 codec 报错', () => {
		class C {}
		const snapshot = new CodecSnapshot([makeCodec('a', A)]);
		expect(() => snapshot.idOf(makeCodec('c', C))).toThrow('is not registered');
	});

	it('按名称取回 codec', () => {
		const a = makeCodec('a', A);
		const snapshot = new CodecSnapshot([a]);
		expect(snapshot.get('a')).toBe(a);
		expect(snapshot.get('b')).toBeUndefined();
	});

	it('find 命中子类而非父类', () => {
		class Parent {}
		class Child extends Parent {}
		const snapshot = new CodecSnapshot([
			makeCodec('parent', Parent),
			makeCodec('child', Child),
		]);
		expect(snapshot.find(new Child())?.name).toBe('child');
		expect(snapshot.find(new Parent())?.name).toBe('parent');
		expect(snapshot.find({})).toBeUndefined();
	});

	it('find 沿原型链命中未直接注册的中间层', () => {
		class Base {}
		class Mid extends Base {}
		class Leaf extends Mid {}
		// 只注册 Base，Leaf 实例应回退到 Base 的 codec
		const snapshot = new CodecSnapshot([makeCodec('base', Base)]);
		expect(snapshot.find(new Leaf())?.name).toBe('base');
		expect(snapshot.find(new Mid())?.name).toBe('base');
	});

	it('find 对深层继承取最近的 codec', () => {
		class Base {}
		class Mid extends Base {}
		class Leaf extends Mid {}
		const snapshot = new CodecSnapshot([
			makeCodec('base', Base),
			makeCodec('mid', Mid),
			makeCodec('leaf', Leaf),
		]);
		expect(snapshot.find(new Leaf())?.name).toBe('leaf');
		expect(snapshot.find(new Mid())?.name).toBe('mid');
		expect(snapshot.find(new Base())?.name).toBe('base');
	});

	it('find 忽略非对象值', () => {
		const snapshot = new CodecSnapshot([makeCodec('a', A)]);
		expect(snapshot.find(null)).toBeUndefined();
		expect(snapshot.find(1)).toBeUndefined();
		expect(snapshot.find('x')).toBeUndefined();
	});

	it('同一 class 注册两份报错', () => {
		expect(
			() => new CodecSnapshot([makeCodec('a', A), makeCodec('b', A)]),
		).toThrow('is registered more than once');
	});

	it('创建后不受注册表变化影响', () => {
		const registry = new CodecRegistry();
		registry.register(makeCodec('a', A));
		const snapshot = registry.snapshot;
		registry.register(makeCodec('b', B));
		registry.unregister('a');
		expect(names(snapshot.codecs)).toEqual(['a']);
		expect(snapshot.get('b')).toBeUndefined();
	});
});
