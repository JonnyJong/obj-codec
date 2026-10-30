import { TAG } from '../protocol';
import type { BuiltinScalarCodec } from '../types';

/**
 * 数字
 * @description
 * 使用多个 ID
 * - `0`：ZERO
 * - `-0`：N_ZERO
 * - 安全正整数：VARINT
 * - 安全负整数：N_VARINT
 * - 其它：F64
 */
export const numberCodec: BuiltinScalarCodec<number> = {
	write({ writer }, value) {
		if (Object.is(value, -0)) return writer.u8(TAG.N_ZERO);
		if (value === 0) return writer.u8(TAG.ZERO);
		if (Number.isSafeInteger(value)) {
			if (value > 0) {
				writer.u8(TAG.VARINT);
				writer.varint(value);
			} else {
				writer.u8(TAG.N_VARINT);
				writer.varint(-value);
			}
		} else {
			writer.u8(TAG.F64);
			writer.f64(value);
		}
	},
	readers: {
		[TAG.ZERO]: () => 0,
		[TAG.N_ZERO]: () => -0,
		[TAG.VARINT]: (ctx) => ctx.reader.varint(),
		[TAG.N_VARINT]: (ctx) => -ctx.reader.varint(),
		[TAG.F64]: (ctx) => ctx.reader.f64(),
	},
};
