import { TAG } from '../../protocol';
import type { BuiltinContainerCodec } from '../../types';

type AnyRecord = Record<string, unknown>;

/** 对象 */
export const objectCodec: BuiltinContainerCodec<AnyRecord, string | null> = {
	tag: TAG.OBJECT,
	count: (value) => Object.keys(value).length * 2,
	forEachChild(value, emit) {
		for (const key of Object.keys(value)) {
			emit(key);
			emit(value[key]);
		}
	},
	create: () => ({}),
	initialState: () => null,
	addChild(shell, child, state) {
		// 还没有待配对的键，说明当前子项是键
		if (state === null) return child as string;
		if (state === '__proto__') {
			Object.defineProperty(shell, state, {
				value: child,
				enumerable: true,
				writable: true,
				configurable: true,
			});
		} else {
			shell[state] = child;
		}
		return null;
	},
};
