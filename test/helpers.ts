import { BufferReader, BufferWriter } from '../src/buffer';
import { Decoder } from '../src/decode';
import { Encoder } from '../src/encode';
import { EMPTY_SNAPSHOT } from '../src/snapshot';
import type { BuiltinScalarCodec, DecodeContext } from '../src/types';

/** 单独用某个标量 codec 写一个值，返回字节（含类型 ID） */
export function writeScalar<T>(
	codec: BuiltinScalarCodec<T>,
	value: T,
): Uint8Array {
	const writer = new BufferWriter();
	// 标量 codec 的 write 会自己写 ID
	(codec.write as (ctx: { writer: BufferWriter }, v: T) => void)(
		{ writer },
		value,
	);
	return writer.finish();
}

/** 从字节里读出 ID 与值：ID 走一次查表，模拟解码器的分派 */
export function readScalar<T>(
	codec: BuiltinScalarCodec<T>,
	bytes: Uint8Array,
): { id: number; value: T } {
	const reader = new BufferReader();
	reader.push(bytes);
	reader.end();
	const id = reader.u8();
	const read = codec.readers[id];
	if (!read) throw new Error(`codec has no reader for tag ${id}`);
	return { id, value: read({ reader, state: undefined } as DecodeContext) as T };
}

/** 拼接分块 */
export function concat(chunks: Iterable<Uint8Array>): Uint8Array {
	const list = [...chunks];
	let total = 0;
	for (const chunk of list) total += chunk.length;
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of list) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

/** 一次性编码 */
export function encode(root: unknown, snapshot = EMPTY_SNAPSHOT): Uint8Array {
	return concat(new Encoder({ snapshot }).encode(root));
}

/** 一次性解码 */
export function decode(bytes: Uint8Array, snapshot = EMPTY_SNAPSHOT): unknown {
	const decoder = new Decoder({ snapshot });
	decoder.push(bytes);
	return decoder.end();
}

/** 按固定块大小解码，模拟流式到达 */
export function decodeChunked(
	bytes: Uint8Array,
	size: number,
	snapshot = EMPTY_SNAPSHOT,
): unknown {
	const decoder = new Decoder({ snapshot });
	for (let offset = 0; offset < bytes.length; offset += size) {
		decoder.push(bytes.subarray(offset, offset + size));
	}
	return decoder.end();
}

/** 往返一次 */
export function roundTrip<T>(value: T, snapshot = EMPTY_SNAPSHOT): T {
	return decode(encode(value, snapshot), snapshot) as T;
}

/** 逐字节往返，用于暴露跨块边界的错误 */
export function roundTripBytewise<T>(value: T, snapshot = EMPTY_SNAPSHOT): T {
	return decodeChunked(encode(value, snapshot), 1, snapshot) as T;
}
