/**
 * 把值展开成可比较的结构化描述
 *
 * 直接 `toEqual` 对 `Set`/`Map`/循环引用不够精确，也无法区分 `-0` 与 `0`、
 * 空位与 `undefined`。这里统一转成纯数据，供快照测试与生成脚本共用 ——
 * 两边用同一套描述，才能保证「期望」与「实际」的比对有意义。
 */

/** 描述结果；字段含义见各分支 */
export type Description =
	| { t: 'null' }
	| { t: 'undefined' }
	| { t: 'number'; v: string }
	| { t: 'bigint'; v: string }
	| { t: 'string'; v: string }
	| { t: 'boolean'; v: boolean }
	| { t: 'skipped' }
	| { t: 'ref'; id: number }
	| { t: 'view'; ctor: string; v: number[]; id?: number }
	| { t: 'arraybuffer'; v: number[]; id?: number }
	| { t: 'map'; v: [Description, Description][]; id?: number }
	| { t: 'set'; v: Description[]; id?: number }
	| { t: 'array'; v: Description[]; id?: number }
	| { t: 'hole' }
	| { t: 'object'; v: [string, Description][]; id?: number };

/**
 * 描述一个值
 * @param value 待描述的值
 * @param seen 环检测表；内部递归使用
 */
export function describeValue(
	value: unknown,
	seen: Map<object, number> = new Map(),
): Description {
	// 原始类型：直接内联
	const primitive = describePrimitive(value);
	if (primitive) return primitive;
	const object = value as object;
	// 环引用：用编号指回已描述过的对象
	const existing = seen.get(object);
	if (existing !== undefined) return { t: 'ref', id: existing };
	const id = seen.size;
	seen.set(object, id);
	try {
		return { ...describeContainer(object, seen), id };
	} finally {
		seen.delete(object);
	}
}

/** 描述原始类型；不是原始类型时返回 `undefined` */
function describePrimitive(value: unknown): Description | undefined {
	if (value === null) return { t: 'null' };
	if (value === undefined) return { t: 'undefined' };
	switch (typeof value) {
		case 'number':
			// `-0 === 0` 为真，只能用 `Object.is` 区分
			return { t: 'number', v: Object.is(value, -0) ? '-0' : String(value) };
		case 'bigint':
			return { t: 'bigint', v: String(value) };
		case 'string':
			return { t: 'string', v: value };
		case 'boolean':
			return { t: 'boolean', v: value };
		case 'function':
			// 编码时被跳过，描述里也标注出来
			return { t: 'skipped' };
		default:
			return undefined;
	}
}

/** 描述容器类型（含二进制视图） */
function describeContainer(
	value: object,
	seen: Map<object, number>,
): Description {
	if (ArrayBuffer.isView(value)) {
		return {
			t: 'view',
			ctor: value.constructor.name,
			v: [...new Uint8Array(value.buffer, value.byteOffset, value.byteLength)],
		};
	}
	if (value instanceof ArrayBuffer) {
		return { t: 'arraybuffer', v: [...new Uint8Array(value)] };
	}
	if (value instanceof Map) {
		return {
			t: 'map',
			v: [...value.entries()].map(([key, item]) => [
				describeValue(key, seen),
				describeValue(item, seen),
			]),
		};
	}
	if (value instanceof Set) {
		return { t: 'set', v: [...value].map((item) => describeValue(item, seen)) };
	}
	if (Array.isArray(value)) {
		return {
			t: 'array',
			// 空位与 `undefined` 必须区分
			v: value.map((item, i) =>
				i in value ? describeValue(item, seen) : { t: 'hole' },
			),
		};
	}
	return {
		t: 'object',
		v: Object.entries(value).map(([key, item]) => [
			key,
			describeValue(item, seen),
		]),
	};
}
