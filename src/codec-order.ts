import type { AnyConstructor, CustomCodec } from './types';

/**
 * 遍历原型链
 * @description
 * 沿原型链向上遍历，直到 `Function.prototype`
 */
function* ancestors(ctor: AnyConstructor): Generator<AnyConstructor> {
	let proto = Object.getPrototypeOf(ctor) as AnyConstructor | null;
	while (proto !== null && proto !== Function.prototype) {
		yield proto;
		proto = Object.getPrototypeOf(proto) as AnyConstructor | null;
	}
}

/**
 * 计算每个 codec 的匹配深度
 * @description
 * 深度：该 codec 在“其它已注册 codec”之上的祖先个数。
 * 深度越大，匹配越靠前。
 */
function computeDepth(
	codecs: readonly CustomCodec[],
): Map<CustomCodec, number> {
	const registered = new Set<AnyConstructor>();
	for (const codec of codecs) registered.add(codec.class);
	const depth = new Map<CustomCodec, number>();
	for (const codec of codecs) {
		const chain = new Set(ancestors(codec.class));
		let count = 0;
		for (const proto of chain) {
			if (registered.has(proto)) count++;
		}
		depth.set(codec, count);
	}
	return depth;
}

/** 按 `name` 的 UTF-16 码元顺序比较 */
function compareName(a: CustomCodec, b: CustomCodec): number {
	if (a.name === b.name) return 0;
	return a.name < b.name ? -1 : 1;
}

/**
 * 排序自定义编解码器
 * @description
 * 返回新数组，不修改入参。
 * 结果稳定，相同的 codec 集合必然得到相同顺序。
 */
export function sortCodecs(
	codecs: readonly CustomCodec[],
): readonly CustomCodec[] {
	const depth = computeDepth(codecs);
	// 先按深度分组，层内按 name 排序；最后按深度拼接
	const layers = new Map<number, CustomCodec[]>();
	for (const codec of codecs) {
		const level = depth.get(codec) ?? 0;
		const bucket = layers.get(level);
		if (bucket) bucket.push(codec);
		else layers.set(level, [codec]);
	}
	const levels = [...layers.keys()].sort((a, b) => b - a);
	const result: CustomCodec[] = [];
	for (const level of levels) {
		const bucket = layers.get(level);
		if (!bucket) continue;
		bucket.sort(compareName);
		for (const codec of bucket) result.push(codec);
	}
	return result;
}
