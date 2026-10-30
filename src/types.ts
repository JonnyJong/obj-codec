import type { Reader, Writer } from './buffer';

export type Constructor<T> = new (...args: any[]) => T;
export type AnyConstructor = Constructor<unknown>;

export interface EncodeContext {
	writer: Writer;
}

export interface DecodeContext<S = unknown> {
	reader: Reader;
	state?: S;
}

//#region 内置编解码器

/**
 * 内置非容器编解码器
 * @description
 * 单个类型可对应多个，由内置编码器自行写入 ID
 *
 * - `write`：按类型分配
 * - `readers`：按 ID 分配
 */
export interface BuiltinScalarCodec<T, S = unknown> {
	/** 该类型的值是否可引用 */
	referable?: boolean;
	/**
	 * @description
	 * 1. 写 ID
	 * 2. 写负载
	 */
	write(ctx: EncodeContext, value: T): void;
	/**
	 * 读取函数
	 * @description
	 * 仅需处理负载
	 */
	readers: Readonly<Record<number, (ctx: DecodeContext<S>) => T>>;
}

/**
 * 容器编解码器
 * @description
 * 编码顺序：
 * 1. `count`
 * 2. `forEachChild`
 *
 * 解码顺序：
 * 1. `create`、`initialState`
 * 2. `addChild`
 * @template T 容器类型
 * @template S 累加状态
 */
export interface ContainerCodec<T, S = unknown> {
	/**
	 * 子项数量
	 * @description
	 * 编码时写入头部
	 */
	count(value: T): number;
	/**
	 * 依次产出子项
	 * @description
	 * 容器编码器无需关系子项编码
	 */
	forEachChild(value: T, emit: (child: unknown) => void): void;
	/**
	 * 建空壳
	 * @description
	 * 用于解码时引用
	 */
	create(): T;
	/** 累加状态初始状态 */
	initialState?(): S;
	/**
	 * 加入一个子项
	 * @param shell 壳
	 * @param child 子项
	 * @param state 上一轮状态
	 * @returns 本轮新状态
	 */
	addChild(shell: T, child: unknown, state: S): S;
}

/** 内置容器编解码器 */
export interface BuiltinContainerCodec<T, S = unknown>
	extends ContainerCodec<T, S> {
	/** 内置类型标签 */
	tag: number;
}

//#endregion

//#region 自定义编解码器

/** 自定义可引用编解码器 */
export interface CustomReferableCodec<T, S = unknown> {
	kind: 'referable';
	/**
	 * 唯一标识符
	 * @description
	 * 用于解码时还原自定义解码器列表
	 */
	name: string;
	/** 被处理类 */
	class: Constructor<T>;
	/** 写负载 */
	write(ctx: EncodeContext, value: T): void;
	/**
	 * 读负载
	 * @description
	 * 读取顺序应等同于写入顺序；
	 * 中间状态应使用 `ctx.state` 存储
	 * @example
	 * ctx.state ??= ctx.reader.utf8Prefixed();
	 * const flags = ctx.reader.utf8Prefixed();
	 * return new RegExp(ctx.state, flags);
	 */
	read(ctx: DecodeContext<S>): T;
}

/** 自定义容器编解码器 */
export interface CustomContainerCodec<T, S = unknown>
	extends ContainerCodec<T, S> {
	kind: 'container';
	/**
	 * 唯一标识符
	 * @description
	 * 用于解码时还原自定义解码器列表
	 */
	name: string;
	/** 被处理类 */
	class: Constructor<T>;
}

/** 自定义编解码器 */
export type CustomCodec<T = unknown, S = unknown> =
	| CustomReferableCodec<T, S>
	| CustomContainerCodec<T, S>;

//#endregion

//#region 其它

/** 编解码选项 */
export interface CodecOptions {
	/**
	 * 外部引用
	 * @description
	 * 外部引用只编码为引用；
	 * 解码时需提供一致的外部引用
	 */
	externalRefs?: unknown[];
}

//#endregion
