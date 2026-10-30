import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Decoder } from '../src/decode';
import { ObjCodec } from '../src/index';
import { CodecSnapshot } from '../src/snapshot';
import { describeValue } from './fixture/describe';

/**
 * 快照测试
 *
 * 目的是**锁死字节格式**：每个 `*.bin` 都是某个版本生成的产物，
 * 两个方向都必须成立 ——
 *
 * 1. 现在的编码器对同一份数据，必须**逐字节**产出同样的结果
 * 2. 现在的解码器必须能把这份旧产物还原成同样的值
 *
 * 只验证其中一个方向不够：只验编码，解码器坏了发现不了；只验解码，
 * 编码器悄悄改了格式也不会报警。
 *
 * 若某次改动**有意**改变格式，需要重新生成这些文件，并在提交信息里说明。
 */

const FIXTURE_DIR = path.join(import.meta.dirname, 'fixture');
const codec = new ObjCodec();

function readFixture(name: string): Uint8Array {
	return new Uint8Array(readFileSync(path.join(FIXTURE_DIR, `${name}.bin`)));
}

/** 重建测试数据；必须与生成快照时完全一致 */
const CASES: Record<string, () => unknown> = {
	primitives: () => [
		null,
		undefined,
		true,
		false,
		0,
		-0,
		1,
		-1,
		127,
		128,
		1.5,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		1n,
		-1n,
		2n ** 70n,
		'hello',
		'你好',
		'😀',
	],
	containers: () => ({
		arr: [1, 2, 3],
		obj: { a: 1, b: 'x' },
		set: new Set([1, 2]),
		map: new Map([['k', 'v']]),
	}),
	nested: () => ({ a: { b: { c: [1, [2, [3]]] } } }),
	binary: () => [
		new Uint8Array([1, 2, 3]),
		new Int16Array([1, -1]),
		new Float64Array([1.5]),
	],
	strings: () => ['', 'a'.repeat(128), 'x'.repeat(1000)],
	refs: () => {
		const root: Record<string, unknown> = { a: 1 };
		root.self = root;
		return root;
	},
};

const NAMES = Object.keys(CASES) as (keyof typeof CASES)[];

describe('快照: 编码结果与历史产物逐字节一致', () => {
	for (const name of NAMES) {
		it(`${name}.bin`, () => {
			const expected = readFixture(name);
			const actual = codec.encodeSync(CASES[name]());
			expect(actual).toEqual(expected);
		});
	}
});

describe('快照: 历史产物能被解码还原', () => {
	for (const name of NAMES) {
		it(`${name}.bin`, () => {
			const bytes = readFixture(name);
			const result = codec.decodeSync(bytes);
			// 与「同一份数据编码后解码」的结果对比：两条路径必须一致
			const fresh = codec.decodeSync(codec.encodeSync(CASES[name]()));
			expect(describeValue(result)).toEqual(describeValue(fresh));
		});
	}
});

describe('快照: 分块解码与整体解码等价', () => {
	for (const name of NAMES) {
		it(`${name}.bin（逐字节）`, () => {
			const bytes = readFixture(name);
			const expected = codec.decodeSync(bytes);
			for (const size of [1, 2, 3, 7, 64]) {
				const streamed = readChunked(bytes, size);
				expect(describeValue(streamed)).toEqual(describeValue(expected));
			}
		});
	}
});

/** 按固定块大小喂入并解码 */
function readChunked(bytes: Uint8Array, size: number): unknown {
	const decoder = new Decoder({ snapshot: new CodecSnapshot([]) });
	for (let offset = 0; offset < bytes.length; offset += size) {
		decoder.push(bytes.subarray(offset, offset + size));
	}
	return decoder.end();
}
