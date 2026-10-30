import { WouldBlock } from '../buffer';
import { TAG } from '../protocol';
import type { BuiltinScalarCodec, EncodeContext } from '../types';

/** 二进制读取的跨中断状态 */
interface BinaryState {
	/** 偏移已读 */
	offset?: number;
	/** 长度已读 */
	length?: number;
	/**
	 * 目标区
	 * @description
	 * 一次性分配，之后每次重试都往同一块里续填
	 */
	target?: Uint8Array;
	/** 已填入的字节数 */
	filled?: number;
}

/** 带偏移与长度的二进制视图 */
interface BinaryView {
	buffer: ArrayBufferLike;
	byteOffset: number;
	byteLength: number;
}

/** 二进制 codec 额外提供「是否接受该值」的判定 */
interface BinaryCodec extends BuiltinScalarCodec<unknown, BinaryState> {
	/** 编码标签 */
	tag: string;
}

/** 取内部标签 */
function tagOf(value: object): string {
	return Object.prototype.toString.call(value).slice(8, -1);
}

/** 判定并取回二进制视图信息 */
function describe(
	value: unknown,
): { tag: string; view: BinaryView } | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const tag = tagOf(value);
	if (tag === 'ArrayBuffer') {
		const buffer = value as ArrayBuffer;
		return {
			tag,
			view: { buffer, byteOffset: 0, byteLength: buffer.byteLength },
		};
	}
	if (tag === 'DataView') {
		const view = value as DataView;
		return { tag, view };
	}
	// 类型化数组：靠 BYTES_PER_ELEMENT 区分是否为已知类型
	const bytesPer = (value as { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT;
	if (typeof bytesPer !== 'number') return undefined;
	const view = value as unknown as BinaryView;
	return { tag, view };
}

/**
 * 造一个二进制 codec
 * @param spec 类型描述
 */
function makeBinaryCodec(spec: BinarySpec): BinaryCodec {
	const { id, tag } = spec;
	return {
		referable: true,
		tag,
		write(ctx: EncodeContext, value) {
			const info = describe(value);
			if (!info) throw new TypeError(`Not a ${tag}`);
			ctx.writer.u8(id);
			ctx.writer.varint(info.view.byteOffset);
			ctx.writer.varint(info.view.byteLength);
			// 只写视图可见的那一段：其余字节属于同一缓冲区的别的数据
			ctx.writer.bytes(
				new Uint8Array(
					info.view.buffer,
					info.view.byteOffset,
					info.view.byteLength,
				),
			);
		},
		readers: {
			[id](ctx) {
				ctx.state ??= {};
				const { state } = ctx;
				state.offset ??= ctx.reader.varint();
				state.length ??= ctx.reader.varint();

				state.target ??= new Uint8Array(state.length);
				state.filled ??= 0;
				const { target, filled } = state;

				// 边收边复制
				const got = ctx.reader.fill(target.subarray(filled));
				state.filled = filled + got;

				// 未读满
				if (state.filled < state.length) {
					throw new WouldBlock(state.length - state.filled);
				}

				return build(spec, target, state.length);
			},
		},
	};
}

/** 由字节重建具体类型 */
function build(
	spec: BinarySpec,
	bytes: Uint8Array,
	byteLength: number,
): unknown {
	switch (spec.kind) {
		case 'buffer':
			return bytes.buffer;
		case 'view':
			return new DataView(bytes.buffer, 0, byteLength);
		default:
			return new spec.ctor(bytes.buffer, 0, byteLength / spec.bytesPerElement);
	}
}

/** 二进制类型的描述；`BINARY_CODECS` 由它展开而来 */
type BinarySpec =
	| { id: number; tag: string; kind: 'buffer' }
	| { id: number; tag: string; kind: 'view' }
	| {
			id: number;
			tag: string;
			kind: 'array';
			/** 类型化数组构造器；签名随元素类型而异 */
			ctor: any;
			bytesPerElement: number;
	  };

/**
 * `Float16Array`
 * @description
 * node 22 无 `Float16Array`
 */
const F16 = (globalThis as any).Float16Array;

/** 造一个类型化数组的描述 */
function arraySpec(id: number, ctor: any, bytesPerElement: number): BinarySpec {
	return { id, tag: ctor.name, kind: 'array', ctor, bytesPerElement };
}

/** 全部二进制类型，按 ID 顺序 */
const SPECS: readonly BinarySpec[] = [
	{ id: TAG.ARRAY_BUFFER, tag: 'ArrayBuffer', kind: 'buffer' },
	arraySpec(TAG.I8_ARRAY, Int8Array, 1),
	arraySpec(TAG.U8_ARRAY, Uint8Array, 1),
	arraySpec(TAG.U8C_ARRAY, Uint8ClampedArray, 1),
	arraySpec(TAG.I16_ARRAY, Int16Array, 2),
	arraySpec(TAG.U16_ARRAY, Uint16Array, 2),
	arraySpec(TAG.I32_ARRAY, Int32Array, 4),
	arraySpec(TAG.U32_ARRAY, Uint32Array, 4),
	...(F16 ? [arraySpec(TAG.F16_ARRAY, F16, 2)] : []),
	arraySpec(TAG.F32_ARRAY, Float32Array, 4),
	arraySpec(TAG.F64_ARRAY, Float64Array, 8),
	arraySpec(TAG.BI64_ARRAY, BigInt64Array, 8),
	arraySpec(TAG.BU64_ARRAY, BigUint64Array, 8),
	{ id: TAG.DATA_VIEW, tag: 'DataView', kind: 'view' },
];

/** 全部二进制 codec，每种类型一个 */
export const BINARY_CODECS: readonly BinaryCodec[] = SPECS.map(makeBinaryCodec);
const CODECS_MAP = new Map(BINARY_CODECS.map((codec) => [codec.tag, codec]));

/**
 * 找出负责该值的二进制 codec
 * @description
 * 使用标签判断以支持跨域
 */
export function binaryCodecFor(value: unknown): BinaryCodec | undefined {
	if (value === null || typeof value !== 'object') return;
	return CODECS_MAP.get(tagOf(value));
}
