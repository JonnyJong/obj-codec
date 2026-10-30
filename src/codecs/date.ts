import { TAG } from '../protocol';
import type { BuiltinScalarCodec } from '../types';

/**
 * `Date`
 * @description
 * 使用 `f64` 存储时间戳
 */
export const dateCodec: BuiltinScalarCodec<Date> = {
	referable: true,
	write(ctx, value) {
		ctx.writer.u8(TAG.DATE);
		ctx.writer.f64(value.getTime());
	},
	readers: {
		[TAG.DATE]: (ctx) => new Date(ctx.reader.f64()),
	},
};
