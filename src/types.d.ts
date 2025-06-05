/** 二进制数据类型 */
export type BinaryType =
	| ArrayBuffer
	| Int8Array
	| Uint8Array
	| Uint8ClampedArray
	| Int16Array
	| Uint16Array
	| Int32Array
	| Uint32Array
	| globalThis.Float16Array
	| Float32Array
	| Float64Array
	| BigInt64Array
	| BigUint64Array
	| DataView;
/** 基本数据类型 */
export type BaseType =
	| BinaryType
	| number
	| bigint
	| string
	| false
	| true
	| null
	| undefined;
/** 内置数据类型 */
export type InternalType =
	| { [x: string | number | symbol]: BasicType }
	| BasicType[]
	| Set<BasicType>
	| Map<BasicType, BasicType>
	| Date
	| RegExp
	| Symbol;
/** 基础数据类型 */
export type BasicType = BaseType | InternalType;

/** 构造方法 */
export type IClass = new (...args: any[]) => any;

/**
 * 编解码器
 * @template Type 数据类型
 * @template EncodeResult 编码类型
 * @template DecodeMiddle 解码中间类型
 */
export interface ICodec<
	Type extends object,
	EncodeResult,
	DecodeMiddle extends Type = Type,
> {
	/**
	 * 编解码器名称
	 * @description
	 * 通过编解码器名称确定编解码器，
	 * 请确保编解码器名称唯一
	 */
	name: string;
	/** 编解码目标类 */
	class: new (
		...args: any[]
	) => Type;
	/**
	 * 编解码目标类父类
	 * @description
	 * 用于确定匹配顺序
	 * @example
	 * [ParentClass, GrandClass, GrandGrandClass]
	 */
	parentClasses?: IClass[];
	/**
	 * 编码
	 * @param data 数据
	 */
	encode(data: Type): EncodeResult;
	/**
	 * 解码
	 * @param encoded 已编码数据
	 */
	decode(encoded: EncodeResult): DecodeMiddle;
	/**
	 * 解引用
	 * @param data 解码中间数据
	 */
	deref?(data: DecodeMiddle): void;
}

/** 任意编解码器 */
export type AnyCodec = ICodec<any, any, any>;

/** 编解码器图 */
export type CodecMap = Map<string, AnyCodec>;

/**
 * 内置编解码器
 * @template Type 数据类型
 * @template DecodeMiddle 解码中间类型
 * @template EncodeResult 编码类型
 */
export interface InternalCodec<
	Type,
	DecodeMiddle extends Type = Type,
	EncodeResult extends Uint8Array = Uint8Array,
> {
	/** 编码后长度 */
	bufferLength?: number;
	/**
	 * 编码
	 * @param data 数据
	 * @param serialize 序列化
	 */
	encode(data: Type, serialize: (data: any) => Uint8Array): EncodeResult;
	/**
	 * 解码
	 * @param encoded 已编码数据
	 * @param deserialize 反序列化
	 */
	decode(
		encoded: EncodeResult,
		deserialize: (buffer: Uint8Array) => any[],
	): DecodeMiddle;
	/**
	 * 解引用
	 * @param data 解码中间数据
	 */
	deref?(data: DecodeMiddle): void;
}

export type InternalTypeName =
	| 'POINTER'
	| 'BINARY'
	| 'NUMBER'
	| 'BIGINT'
	| 'STRING'
	| 'FALSE'
	| 'TRUE'
	| 'NULL'
	| 'UNDEFINED'
	| 'OBJECT'
	| 'ARRAY'
	| 'SET'
	| 'MAP'
	| 'DATE'
	| 'REGEXP'
	| 'SYMBOL'
	| 'UNIQUE_POINTER';

export interface ObjEncoderOptions {
	/**
	 * 唯一值
	 * @description
	 * 唯一指针指向该数组中指定下标的值，
	 * 需确保编解码时该数组内容和顺序不变
	 */
	uniqueValues?: any[];
	/** 忽略不支持的类型 */
	ignoreUnsupportedTypes?: boolean;
}

export interface ObjDecoderOptions {
	/**
	 * 唯一值
	 * @description
	 * 唯一指针指向该数组中指定下标的值，
	 * 需确保编解码时该数组内容和顺序不变
	 */
	uniqueValues?: any[];
	/** 忽略缺少的编解码器 */
	ignoreMissedCodec?: boolean;
	/** 忽略缺少的唯一值 */
	ignoreMissedUniqueValue?: boolean;
	/** 允许不完全解码 */
	allowIncompleteDecoding?: boolean;
}
