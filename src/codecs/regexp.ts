import { TAG } from '../protocol';
import type { BuiltinScalarCodec } from '../types';

/**
 * `RegExp`
 * @description
 * 分两段，只保存 `source` 与 `flag`
 */
export const regexpCodec: BuiltinScalarCodec<RegExp, string> = {
	referable: true,
	write(ctx, value) {
		ctx.writer.u8(TAG.REGEX);
		ctx.writer.utf8Prefixed(value.source);
		ctx.writer.utf8Prefixed(value.flags);
	},
	readers: {
		[TAG.REGEX](ctx) {
			ctx.state ??= ctx.reader.utf8Prefixed();
			const flags = ctx.reader.utf8Prefixed();
			return new RegExp(ctx.state, flags);
		},
	},
};
