import { TAG } from '../protocol';
import type { BuiltinScalarCodec } from '../types';

/**
 * `Symbol`
 * @description
 * - 无描述：SYMBOL
 * - 有描述：SYMBOL_DESC
 * - 全局：SYMBOL_GLOBAL
 */
export const symbolCodec: BuiltinScalarCodec<symbol> = {
	referable: true,
	write(ctx, value) {
		const desc = value.description;
		if (desc === undefined) return ctx.writer.u8(TAG.SYMBOL);
		ctx.writer.u8(
			Symbol.keyFor(value) === undefined ? TAG.SYMBOL_DESC : TAG.SYMBOL_GLOBAL,
		);
		ctx.writer.utf8Prefixed(desc);
	},
	readers: {
		[TAG.SYMBOL]: () => Symbol(),
		[TAG.SYMBOL_DESC]: (ctx) => Symbol(ctx.reader.utf8Prefixed()),
		[TAG.SYMBOL_GLOBAL]: (ctx) => Symbol.for(ctx.reader.utf8Prefixed()),
	},
};
