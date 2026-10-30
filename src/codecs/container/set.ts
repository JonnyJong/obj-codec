import { TAG } from '../../protocol';
import type { BuiltinContainerCodec } from '../../types';

/** 集合 */
export const setCodec: BuiltinContainerCodec<Set<unknown>, void> = {
	tag: TAG.SET,
	count: (value) => value.size,
	forEachChild(value, emit) {
		for (const item of value) emit(item);
	},
	create: () => new Set(),
	addChild(shell, child) {
		shell.add(child);
	},
};
