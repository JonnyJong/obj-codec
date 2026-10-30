import { TAG } from '../../protocol';
import type { BuiltinContainerCodec } from '../../types';

/** 稀疏数组空位 */
export const ARRAY_HOLE: unique symbol = Symbol('ARRAY_HOLE');

/** 数组 */
export const arrayCodec: BuiltinContainerCodec<unknown[], void> = {
	tag: TAG.ARRAY,
	count: (value) => value.length,
	forEachChild(value, emit) {
		for (let i = 0; i < value.length; i++) {
			if (i in value) emit(value[i]);
			else emit(ARRAY_HOLE);
		}
	},
	create: () => [],
	addChild(shell, child) {
		if (child === ARRAY_HOLE) shell.length += 1;
		else shell.push(child);
	},
};
