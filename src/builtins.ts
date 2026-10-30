import { bigintCodec } from './codecs/bigint';
import { BINARY_CODECS, binaryCodecFor } from './codecs/binary';
import { arrayCodec } from './codecs/container/array';
import { mapCodec } from './codecs/container/map';
import { objectCodec } from './codecs/container/object';
import { setCodec } from './codecs/container/set';
import { dateCodec } from './codecs/date';
import { numberCodec } from './codecs/number';
import { regexpCodec } from './codecs/regexp';
import { stringCodec } from './codecs/string';
import { symbolCodec } from './codecs/symbol';
import { TAG } from './protocol';
import type {
	BuiltinContainerCodec,
	DecodeContext,
	EncodeContext,
} from './types';

/** 读取函数签名 */
type ReadFn = (ctx: DecodeContext<any>) => unknown;

/** 各标量 codec 的统一视图 */
type AnyScalar = {
	referable?: boolean;
	write(ctx: EncodeContext, value: unknown): void;
	readers: Readonly<Record<number, ReadFn>>;
};

//#region 建表

/** 容器 codec */
const CONTAINERS: Readonly<
	Partial<Record<number, BuiltinContainerCodec<unknown, unknown>>>
> = {
	[TAG.ARRAY]: arrayCodec as BuiltinContainerCodec<unknown, unknown>,
	[TAG.OBJECT]: objectCodec as BuiltinContainerCodec<unknown, unknown>,
	[TAG.SET]: setCodec as BuiltinContainerCodec<unknown, unknown>,
	[TAG.MAP]: mapCodec as BuiltinContainerCodec<unknown, unknown>,
};

/**
 * 解码器函数表
 * @description
 * 空洞或 `undefined` 为环境不支持或保留的 ID
 */
const READERS: (ReadFn | undefined)[] = [];

for (const { readers } of [
	numberCodec,
	bigintCodec,
	...BINARY_CODECS,
	stringCodec,
	dateCodec,
	regexpCodec,
	symbolCodec,
]) {
	// 构建读取函数表
	for (const [id, read] of Object.entries(readers)) {
		const index = Number(id);
		if (READERS[index]) {
			throw new Error(`Duplicate reader for builtin tag ${index}`);
		}
		READERS[index] = read;
	}
}

//#endregion
//#region 工具

/** 是否为容器 ID */
export function isContainerTag(id: number): boolean {
	return CONTAINERS[id] !== undefined;
}

/** 取容器 codec */
export function containerOf(
	id: number,
): BuiltinContainerCodec<unknown> | undefined {
	return CONTAINERS[id];
}

/** 取解码器函数 */
export function readerOf(id: number): ReadFn | undefined {
	return READERS[id];
}

/**
 * 该 ID 是否需要登记引用  */
export function isReferableTag(id: number): boolean {
	// HACK：`ARRAY_HOLE` 不可达，故直接比较
	return id >= TAG.STRING;
}

/**
 * 查找可引用标量 Codec */
export function scalarFor(value: unknown): AnyScalar | undefined {
	switch (typeof value) {
		case 'string':
			return stringCodec;
		case 'symbol':
			return symbolCodec;
		case 'object': {
			if (value instanceof Date) return dateCodec;
			if (value instanceof RegExp) return regexpCodec;
			return binaryCodecFor(value);
		}
	}
	return undefined;
}

//#endregion
