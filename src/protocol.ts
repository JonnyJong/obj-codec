export const VERSION = 0b10;
export const CUSTOM_FLAG = 0b01;

/** 内置类型标签 */
export const TAG = {
	/** 指针 */
	POINTER: 0,
	/** 外部引用 */
	EXT_REF: 1,

	NULL: 2,
	UNDEFINED: 3,
	FALSE: 4,
	TRUE: 5,

	/** `0` */
	ZERO: 6,
	/** `-0` */
	N_ZERO: 7,
	/** 可变整数 */
	VARINT: 8,
	/** 负可变整数 */
	N_VARINT: 9,
	/** 浮点数 */
	F64: 10,

	/** BigInt 0 */
	BIGINT_ZERO: 11,
	/** 正 BigInt */
	BIGINT: 12,
	/** 负 BigInt */
	N_BIGINT: 13,

	/** 字符串 */
	STRING: 14,

	ARRAY_BUFFER: 15,
	I8_ARRAY: 16,
	U8_ARRAY: 17,
	U8C_ARRAY: 18,
	I16_ARRAY: 19,
	U16_ARRAY: 20,
	I32_ARRAY: 21,
	U32_ARRAY: 22,
	F16_ARRAY: 23,
	F32_ARRAY: 24,
	F64_ARRAY: 25,
	BI64_ARRAY: 26,
	BU64_ARRAY: 27,
	DATA_VIEW: 28,

	ARRAY: 29,
	ARRAY_HOLE: 30,
	OBJECT: 31,

	SET: 32,
	MAP: 33,

	DATE: 34,
	REGEX: 35,
	/** 无描述 `Symbol` */
	SYMBOL: 36,
	/** 有描述 `Symbol` */
	SYMBOL_DESC: 37,
	/** 全局 `Symbol` */
	SYMBOL_GLOBAL: 38,
} as const;

/**
 * 自定义类型 ID 起点
 * @description
 * ID 小于此值为内置类型（见 {@link TAG}），否则为自定义类型：
 * `id - CUSTOM_BEGIN` 即该 codec 在排序结果中的索引。
 */
export const CUSTOM_BEGIN = 64;
