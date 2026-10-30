import { TAG } from '../../protocol';
import type { BuiltinContainerCodec } from '../../types';

const NON = Symbol();

/** 图 */
export const mapCodec: BuiltinContainerCodec<Map<unknown, unknown>, unknown> = {
	tag: TAG.MAP,
	count: (value) => value.size * 2,
	forEachChild(value, emit) {
		for (const [key, item] of value) {
			emit(key);
			emit(item);
		}
	},
	create: () => new Map(),
	initialState: () => NON,
	addChild(shell, child, state) {
		if (state === NON) return child;
		shell.set(state, child);
		return NON;
	},
};
