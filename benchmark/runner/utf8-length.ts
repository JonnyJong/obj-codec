import { Bench } from 'tinybench';
import { BufferWriter } from '../../src/v2/buffer.ts';

/**
 * 字符串「varint 长度前缀 + UTF-8 内容」写入路径对比。
 *
 * - **A** JS 手写扫描取长度 -> `varint` -> `utf8`（`encodeInto` 进写出缓冲）
 * - **B** `TextEncoder.encode` 取长度 -> `varint` -> `bytes`
 * - **C** 复用 scratch + `encodeInto` 取长度 -> `varint` -> `bytes`
 * - **D** 现在 buffer.ts 里的实现：`utf8Prefixed`（复用 scratch + `encodeInto`）
 *
 * A 的扫描函数就是这里内联的旧 `utf8ByteLength`：它已经从 `buffer.ts`
 * 删掉了，基准里保留一份用于对照。
 *
 * 只量编码本身：复用同一个 `BufferWriter`，每轮 `reset()`，
 * 不调用会做复制的 `finish()`。
 */

const encoder = new TextEncoder();

const SAMPLES: Record<string, string> = {
	'ascii-short': 'hello world',
	'ascii-long': 'x'.repeat(4096),
	'cjk-medium': '你好世界，这是一个测试字符串。'.repeat(32),
	emoji: '😀🎉🚀🔥'.repeat(256),
	mixed: 'name: 张三 age: 30 😀 '.repeat(128),
};

/** 旧实现，仅供对照 */
function utf8ByteLength(v: string): number {
	let length = 0;
	for (let i = 0; i < v.length; i++) {
		const code = v.charCodeAt(i);
		if (code < 0x80) {
			length += 1;
		} else if (code < 0x800) {
			length += 2;
		} else if (code >= 0xd800 && code <= 0xdbff && i + 1 < v.length) {
			const next = v.charCodeAt(i + 1);
			if (next >= 0xdc00 && next <= 0xdfff) {
				length += 4;
				i++;
				continue;
			}
			length += 3;
		} else {
			length += 3;
		}
	}
	return length;
}

let writer = new BufferWriter();
const scratch = new Uint8Array(4096 * 3 + 8);

const writers: Record<string, (s: string) => void> = {
	A(s) {
		writer.varint(utf8ByteLength(s));
		writer.utf8(s);
	},
	B(s) {
		const bytes = encoder.encode(s);
		writer.varint(bytes.length);
		writer.bytes(bytes);
	},
	C(s) {
		const { written } = encoder.encodeInto(s, scratch);
		writer.varint(written);
		writer.bytes(scratch.subarray(0, written));
	},
	D(s) {
		writer.utf8Prefixed(s);
	},
};

/** 排空 writer，返回字节数；分块不复制 */
function drain(): number {
	let total = 0;
	let chunk = writer.take();
	while (chunk) {
		total += chunk.length;
		chunk = writer.take();
	}
	total += writer.finish().length;
	return total;
}

function encodeWith(key: string, sample: string): Uint8Array {
	writer = new BufferWriter();
	writers[key](sample);
	return writer.finish();
}

async function main() {
	console.log('node', process.version);
	const rows: Record<string, number | string>[] = [];

	for (const [name, sample] of Object.entries(SAMPLES)) {
		// 产出字节必须完全一致
		const expected = encoder.encode(sample);
		const outputs = new Set(
			Object.keys(writers).map((key) =>
				Array.from(encodeWith(key, sample)).join(','),
			),
		);
		if (outputs.size !== 1) {
			throw new Error(`writers disagree on output for ${name}`);
		}

		writer = new BufferWriter();
		const bench = new Bench({ time: 400, warmupTime: 100 });
		for (const [key, fn] of Object.entries(writers)) {
			bench.add(key, () => {
				writer.reset();
				fn(sample);
				return drain();
			});
		}
		await bench.run();

		const row: Record<string, number | string> = {
			sample: name,
			bytes: expected.length,
		};
		for (const task of bench.tasks) {
			row[task.name] = Number(((task.result?.hz ?? 0) / 1000).toFixed(0));
		}
		rows.push(row);

		console.log(
			`\n== ${name} (${expected.length}B, ${sample.length} code units) ==`,
		);
		console.table(bench.table());
	}

	console.log('\n== 相对速度（A=1.00，越大越快） ==');
	console.table(
		rows.map((row) => {
			const a = row.A as number;
			return {
				sample: row.sample,
				bytes: row.bytes,
				'A 扫描+utf8': 1,
				'B encode': Number(((row.B as number) / a).toFixed(2)),
				'C scratch': Number(((row.C as number) / a).toFixed(2)),
				'D utf8Prefixed': Number(((row.D as number) / a).toFixed(2)),
			};
		}),
	);
}

await main();
