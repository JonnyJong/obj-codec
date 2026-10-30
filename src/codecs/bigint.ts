import { TAG } from '../protocol';
import type { BuiltinScalarCodec } from '../types';

/**
 * `BigInt`
 * @description
 * 使用多个 ID：
 * - `0n`：BIGINT_ZERO
 * - `>0n`：BIGINT
 * - `<0n`：N_BIGINT
 */
export const bigintCodec: BuiltinScalarCodec<bigint> = {
	write({ writer }, value) {
		if (value === 0n) return writer.u8(TAG.BIGINT_ZERO);
		if (value > 0n) {
			writer.u8(TAG.BIGINT);
			writer.varintBig(value);
		} else {
			writer.u8(TAG.N_BIGINT);
			writer.varintBig(-value);
		}
	},
	readers: {
		[TAG.BIGINT_ZERO]: () => 0n,
		[TAG.BIGINT]: (ctx) => ctx.reader.varintBig(),
		[TAG.N_BIGINT]: (ctx) => -ctx.reader.varintBig(),
	},
};
