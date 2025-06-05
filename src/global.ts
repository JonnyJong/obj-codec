import { bigintCodec } from './codec/base/bigint';
import { binaryCodec } from './codec/base/binary';
import { falseCodec, trueCodec } from './codec/base/boolean';
import { flexUintCodec } from './codec/base/flexible-unsigned-integer';
import { nullCodec } from './codec/base/null';
import { numberCodec } from './codec/base/number';
import { stringCodec } from './codec/base/string';
import { undefinedCodec } from './codec/base/undefined';
import { arrayCodec } from './codec/internal/array';
import { dateCodec } from './codec/internal/date';
import { mapCodec } from './codec/internal/map';
import { objectCodec } from './codec/internal/object';
import { regexpCodec } from './codec/internal/regexp';
import { setCodec } from './codec/internal/set';
import { symbolCodec } from './codec/internal/symbol';
import {
	AnyCodec,
	BasicType,
	CodecMap,
	InternalCodec,
	InternalTypeName,
	ObjDecoderOptions,
	ObjEncoderOptions,
} from './types';
import { registerCodec } from './utils';

/** 内置编解码器 */
export const INTERNAL_CODEC_MAP: Readonly<
	Record<InternalTypeName, InternalCodec<BasicType>>
> = Object.freeze({
	POINTER: flexUintCodec,
	BINARY: binaryCodec,
	NUMBER: numberCodec,
	BIGINT: bigintCodec,
	STRING: stringCodec,
	FALSE: falseCodec,
	TRUE: trueCodec,
	NULL: nullCodec,
	UNDEFINED: undefinedCodec,
	OBJECT: objectCodec,
	ARRAY: arrayCodec,
	SET: setCodec,
	MAP: mapCodec,
	DATE: dateCodec,
	REGEXP: regexpCodec,
	SYMBOL: symbolCodec,
	UNIQUE_POINTER: flexUintCodec,
});

export const INTERNAL_CODEC: readonly InternalCodec<BasicType>[] =
	Object.freeze([
		flexUintCodec,
		binaryCodec,
		numberCodec,
		bigintCodec,
		stringCodec,
		falseCodec,
		trueCodec,
		nullCodec,
		undefinedCodec,
		objectCodec,
		arrayCodec,
		setCodec,
		mapCodec,
		dateCodec,
		regexpCodec,
		symbolCodec,
		flexUintCodec,
	]);

/** 内置类型 ID */
export const INTERNAL_TYPE_ID: Readonly<Record<InternalTypeName, number>> =
	Object.freeze({
		POINTER: 0,
		BINARY: 1,
		NUMBER: 2,
		BIGINT: 3,
		STRING: 4,
		FALSE: 5,
		TRUE: 6,
		NULL: 7,
		UNDEFINED: 8,
		OBJECT: 9,
		ARRAY: 10,
		SET: 11,
		MAP: 12,
		DATE: 13,
		REGEXP: 14,
		SYMBOL: 15,
		UNIQUE_POINTER: 16,
	});

/** 自定义类型起始 ID */
export const CUSTOM_TYPE_ID_BEGIN = 17;

/** 数据结构版本号 */
export const VERSION = 0x01;

export const globalCodecs: CodecMap = new Map();

export abstract class IObjCodec {
	protected _codecs: CodecMap = new Map();
	/**
	 * 唯一值
	 * @description
	 * 该唯一值数组在该 `ObjCodec` 实例中生效，
	 * 调用 `encode`/`decode` 方法时可覆盖该值。
	 *
	 * 唯一指针指向该数组中指定下标的值，
	 * 需确保编解码时该数组内容和顺序不变。
	 */
	uniqueValues?: any[];
	constructor(uniqueValues?: any[]) {
		this.uniqueValues = uniqueValues;
	}
	/** 注册全局编解码器 */
	static register(codec: AnyCodec) {
		registerCodec(globalCodecs, codec);
	}
	/** 注册编解码器 */
	register(codec: AnyCodec) {
		registerCodec(this._codecs, codec);
	}
	/**
	 * 编码
	 * @param root 编码根对象
	 */
	abstract encode(root: any, options?: ObjEncoderOptions): any;
	/** 解码 */
	abstract decode(options?: ObjDecoderOptions): any;
}
