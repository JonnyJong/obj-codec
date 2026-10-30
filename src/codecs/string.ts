import { TAG } from '../protocol';
import type { BuiltinScalarCodec } from '../types';

/** 字符串 */
export const stringCodec: BuiltinScalarCodec<string> = {
	referable: true,
	write(ctx, value) {
		ctx.writer.u8(TAG.STRING);
		ctx.writer.utf8Prefixed(value);
	},
	readers: {
		[TAG.STRING]: (ctx) => ctx.reader.utf8Prefixed(),
	},
};
