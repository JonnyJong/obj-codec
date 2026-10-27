import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

interface DirStats {
	meanMs: number;
	p75Ms: number;
	p99Ms: number;
	hz: number;
	rme: number;
	samples: number;
}

interface Row {
	lib: string;
	dataset: string;
	suite: string;
	status: string;
	error?: string;
	reason?: string;
	payloadBytes?: number;
	gzipBytes?: number;
	encode?: DirStats;
	decode?: DirStats;
	memory?: {
		encodePeakBytes: number;
		decodePeakBytes: number;
		retainedBytes: number;
		maxRssBytes: number;
	};
	wallMs: number;
	metaShape?: string;
	metaN?: number;
}

interface Doc {
	meta: Record<string, any>;
	results: Row[];
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'];

function bytes(n: number | undefined | null): string {
	if (n === undefined || n === null || Number.isNaN(n)) return '-';
	let v = n;
	let i = 0;
	while (v >= 1024 && i < BYTE_UNITS.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)}${BYTE_UNITS[i]}`;
}

function hz(s: DirStats | undefined): number | undefined {
	if (!s) return undefined;
	const v = 1000 / s.meanMs;
	return Number.isFinite(v) ? v : undefined;
}

function num(n: number | undefined, digits = 0): string {
	if (n === undefined || Number.isNaN(n)) return '-';
	return n.toLocaleString('en-US', {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	});
}

function geo(values: Array<number | undefined>): number {
	const positive = values.filter(
		(v): v is number => typeof v === 'number' && v > 0,
	);
	if (positive.length === 0) return Number.NaN;
	return Math.exp(
		positive.reduce((a, v) => a + Math.log(v), 0) / positive.length,
	);
}

function mbps(r: Row, opsPerSecond: number | undefined): string {
	if (opsPerSecond === undefined || !r.payloadBytes) return '-';
	return ((r.payloadBytes * opsPerSecond) / 1e6).toFixed(2);
}

function datasetHeader(doc: Doc, datasetId: string): string {
	const d = doc.meta.datasets.find((x: any) => x.id === datasetId);
	return d ? `${d.id} — ${d.name}` : datasetId;
}

function renderSuite(doc: Doc, suite: string): string[] {
	const rows = doc.results.filter((r) => r.suite === suite);
	if (rows.length === 0) return [`_套件 ${suite} 无结果。_\n`];
	const out: string[] = [];

	const jsonByDataset = new Map<string, { enc?: number; dec?: number }>();
	for (const r of rows) {
		if (r.lib !== 'json') continue;
		jsonByDataset.set(r.dataset, { enc: hz(r.encode), dec: hz(r.decode) });
	}

	const ok = rows.filter((r) => r.status === 'ok');
	const hasJson = rows.some((r) => r.lib === 'json');
	const failed = rows.filter((r) => r.status !== 'ok');
	const datasetIds = [...new Set(rows.map((r) => r.dataset))];

	// ---- summary: geometric mean across datasets, per library
	out.push('### 汇总（跨数据集几何均值）');
	out.push('');
	out.push(
		`| 库 | 编码 ops/s | 解码 ops/s |${hasJson ? ' vs JSON (enc) | vs JSON (dec) |' : ''} 参与数据集 | 失败 |`,
	);
	out.push(
		`| --- | ---: | ---: |${hasJson ? ' ---: | ---: |' : ''} ---: | ---: |`,
	);
	const libs = [...new Set(rows.map((r) => r.lib))];
	const summary = libs.map((lib) => {
		const rs = ok.filter((r) => r.lib === lib);
		const encRatios: number[] = [];
		const decRatios: number[] = [];
		for (const r of rs) {
			const j = jsonByDataset.get(r.dataset);
			const e = hz(r.encode);
			const d = hz(r.decode);
			if (j?.enc && e) encRatios.push(e / j.enc);
			if (j?.dec && d) decRatios.push(d / j.dec);
		}
		return {
			lib,
			enc: geo(rs.map((r) => hz(r.encode))),
			dec: geo(rs.map((r) => hz(r.decode))),
			encRatio: geo(encRatios),
			decRatio: geo(decRatios),
			n: rs.length,
			f: failed.filter((r) => r.lib === lib).length,
		};
	});
	summary.sort((a, b) => b.enc - a.enc);
	for (const s of summary) {
		const ratioCells = hasJson
			? ` ${Number.isNaN(s.encRatio) ? '-' : `${s.encRatio.toFixed(2)}x`} | ${Number.isNaN(s.decRatio) ? '-' : `${s.decRatio.toFixed(2)}x`} |`
			: '';
		out.push(
			`| ${s.lib} | ${num(s.enc)} | ${num(s.dec)} |${ratioCells} ${s.n} | ${s.f} |`,
		);
	}
	out.push('');

	// ---- per dataset throughput boards
	out.push('### 分数据集吞吐');
	out.push('');
	for (const id of datasetIds) {
		const rs = ok
			.filter((r) => r.dataset === id)
			.sort((a, b) => (hz(b.encode) ?? 0) - (hz(a.encode) ?? 0));
		if (rs.length === 0) continue;
		const j = jsonByDataset.get(id);
		out.push(`**${datasetHeader(doc, id)}**`);
		out.push('');
		out.push(
			`| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |${hasJson ? ' 相对 JSON (enc) |' : ''}`,
		);
		out.push(
			`| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |${hasJson ? ' ---: |' : ''}`,
		);
		for (const r of rs) {
			const enc = hz(r.encode);
			const dec = hz(r.decode);
			const ratioCell = hasJson
				? ` ${enc && j?.enc ? `${(enc / j.enc).toFixed(2)}x` : '-'} |`
				: '';
			out.push(
				`| ${r.lib} | ${num(enc)} | ${num(dec)} | ${mbps(r, enc)} | ${mbps(r, dec)} | ${r.encode?.p75Ms.toFixed(3) ?? '-'} | ${r.decode?.p75Ms.toFixed(3) ?? '-'} | ${r.encode?.samples ?? '-'} | ${r.encode?.rme.toFixed(1) ?? '-'}% |${ratioCell}`,
			);
		}
		out.push('');
	}

	// ---- size board
	out.push('### 载荷体积');
	out.push('');
	const libOrder = [
		'json',
		'v8',
		'cbor-x',
		'msgpack',
		'msgpackr',
		'superjson',
		'devalue',
		'seroval',
		'turbo-stream',
		'flatted',
		'ungap-structured-clone',
		'bson',
		'ion-js',
		'obj-codec',
	];
	const present = libOrder.filter((l) => rows.some((r) => r.lib === l));
	out.push(`| 数据集 | ${present.join(' | ')} |`);
	out.push(`| --- | ${present.map(() => '---:').join(' | ')} |`);
	for (const id of datasetIds) {
		const cells = present.map((lib) => {
			const r = rows.find((x) => x.dataset === id && x.lib === lib);
			return r?.payloadBytes === undefined ? '-' : bytes(r.payloadBytes);
		});
		out.push(`| ${id} | ${cells.join(' | ')} |`);
	}
	out.push('');
	out.push('gzip (level 9) 后体积：');
	out.push('');
	out.push(`| 数据集 | ${present.join(' | ')} |`);
	out.push(`| --- | ${present.map(() => '---:').join(' | ')} |`);
	for (const id of datasetIds) {
		const cells = present.map((lib) => {
			const r = rows.find((x) => x.dataset === id && x.lib === lib);
			return r?.gzipBytes === undefined ? '-' : bytes(r.gzipBytes);
		});
		out.push(`| ${id} | ${cells.join(' | ')} |`);
	}
	out.push('');

	// ---- memory board
	out.push('### 内存（子进程，GC 后采样）');
	out.push('');
	out.push('| 数据集 | 库 | 编码峰值堆 | 解码峰值堆 | 结果常驻 | 进程 maxRSS |');
	out.push('| --- | --- | ---: | ---: | ---: | ---: |');
	for (const id of datasetIds) {
		for (const r of ok.filter((x) => x.dataset === id)) {
			if (!r.memory) continue;
			out.push(
				`| ${id} | ${r.lib} | ${bytes(r.memory.encodePeakBytes)} | ${bytes(r.memory.decodePeakBytes)} | ${bytes(r.memory.retainedBytes)} | ${bytes(r.memory.maxRssBytes)} |`,
			);
		}
	}
	out.push('');

	if (failed.length > 0) {
		out.push('### 失败与不保真');
		out.push('');
		out.push('| 数据集 | 库 | 状态 | 说明 |');
		out.push('| --- | --- | --- | --- |');
		for (const r of failed) {
			out.push(
				`| ${r.dataset} | ${r.lib} | ${r.status} | ${(r.error ?? r.reason ?? '').slice(0, 160).replace(/\|/g, '/')} |`,
			);
		}
		out.push('');
	}

	return out;
}

function logLogSlope(
	points: Array<{ n: number; t: number }>,
): number | undefined {
	const usable = points.filter((p) => p.n > 0 && p.t > 0);
	if (usable.length < 2) return undefined;
	const xs = usable.map((p) => Math.log(p.n));
	const ys = usable.map((p) => Math.log(p.t));
	const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
	const my = ys.reduce((a, b) => a + b, 0) / ys.length;
	let num = 0;
	let den = 0;
	for (let i = 0; i < xs.length; i++) {
		num += (xs[i] - mx) * (ys[i] - my);
		den += (xs[i] - mx) ** 2;
	}
	return den === 0 ? undefined : num / den;
}

function renderScaling(doc: Doc): string[] {
	const out: string[] = [];
	const rows = doc.results.filter((r) => r.suite === 'S5');
	if (rows.length === 0) return out;
	// S5 rows predate the per-row meta fields; fall back to the dataset registry
	// captured in meta.datasets.
	const datasetMeta = new Map<string, { shape?: string; n?: number }>();
	for (const d of (doc.meta.datasets ?? []) as Array<{
		id: string;
		meta?: { shape?: string; n?: number };
	}>) {
		if (d.meta) datasetMeta.set(d.id, d.meta);
	}
	const shapeOf = (r: Row) =>
		String(r.metaShape ?? datasetMeta.get(r.dataset)?.shape ?? '?');
	const nOf = (r: Row) => Number(r.metaN ?? datasetMeta.get(r.dataset)?.n ?? 0);
	const sizes = [...new Set(rows.map(nOf))].sort((a, b) => a - b);
	const shapes = [...new Set(rows.map(shapeOf))];

	out.push('### 伸缩曲线 (S5)');
	out.push('');
	out.push(
		'单次操作耗时 (ms)，单发模式：每个 case 只测一次编码与一次解码。斜率是 log-log 最小二乘拟合，1 表示线性、2 表示平方。',
	);
	out.push('');
	const libs = [...new Set(rows.map((r) => r.lib))];
	for (const shape of shapes) {
		const shapeSizes = sizes.filter((n) =>
			rows.some((r) => shapeOf(r) === shape && nOf(r) === n),
		);
		if (shapeSizes.length === 0) continue;
		out.push(`**形状 ${shape}**`);
		out.push('');
		out.push(
			`| 库 | 指标 | ${shapeSizes.map((n) => n.toLocaleString('en-US')).join(' | ')} | 斜率 |`,
		);
		out.push(
			`| --- | --- | ${shapeSizes.map(() => '---:').join(' | ')} | ---: |`,
		);
		for (const lib of libs) {
			for (const metric of ['encode', 'decode'] as const) {
				const cells: string[] = [];
				const points: Array<{ n: number; t: number }> = [];
				for (const n of shapeSizes) {
					const row = rows.find(
						(r) => r.lib === lib && shapeOf(r) === shape && nOf(r) === n,
					);
					const stat = row?.[metric];
					if (stat) {
						points.push({ n, t: stat.meanMs });
						cells.push(
							stat.meanMs >= 1000
								? `${(stat.meanMs / 1000).toFixed(1)}s`
								: stat.meanMs.toFixed(2),
						);
					} else {
						const reason =
							row?.status === 'ok' ? 'n/a' : (row?.error ?? row?.status ?? 'n/a');
						cells.push(String(reason).startsWith('TIMEOUT') ? 'timeout' : 'x');
					}
				}
				const slope = logLogSlope(points);
				out.push(
					`| ${lib} | ${metric} | ${cells.join(' | ')} | ${slope === undefined ? '-' : slope.toFixed(2)} |`,
				);
			}
		}
		out.push('');
	}
	const failures = rows.filter((r) => r.status !== 'ok');
	if (failures.length > 0) {
		out.push('| 库 | 形状 | 规模 | 状态 | 说明 |');
		out.push('| --- | --- | ---: | --- | --- |');
		for (const r of failures) {
			out.push(
				`| ${r.lib} | ${shapeOf(r)} | ${nOf(r).toLocaleString('en-US')} | ${r.status} | ${(r.error ?? r.reason ?? '').slice(0, 100).replace(/\|/g, '/')} |`,
			);
		}
		out.push('');
	}
	return out;
}

interface StreamDoc {
	meta: Record<string, any>;
	results: Record<string, any>[];
}

function renderStreaming(stream: StreamDoc): string[] {
	const out: string[] = [];
	out.push('## 套件 S4 · 分块传输');
	out.push('');
	out.push(
		'载荷先整体编码一次，再按固定大小切块交给解码器。`incremental` 逐块喂给解码器，`buffered` 先拼接再解码（对照组）。表内为解码耗时中位数，括号内为该 chunk 下采样峰值堆。',
	);
	out.push('');
	const chunkSizes = stream.meta.chunkSizes as string[];
	// -1 is the "one chunk" sentinel the runner uses (Infinity cannot be JSON-encoded)
	const chunkValues = chunkSizes.map((label) =>
		label === 'full' ? -1 : Number.parseFloat(label) * 1024,
	);
	const datasets = [...new Set(stream.results.map((r) => r.dataset))];
	for (const dataset of datasets) {
		const rows = stream.results.filter((r) => r.dataset === dataset);
		if (rows.length === 0) continue;
		const payloadBytes = rows.find((r) => r.payloadBytes)?.payloadBytes;
		const full = rows.find((r) => r.chunkSize === Number.POSITIVE_INFINITY);
		out.push(
			`**${dataset}**${payloadBytes ? ` · 载荷 ${bytes(payloadBytes)}` : ''}${full?.chunks ? ` · 整块 chunk 数 ${full.chunks}` : ''}`,
		);
		out.push('');
		out.push(`| 实现 | 模式 | ${chunkSizes.join(' | ')} |`);
		out.push(`| --- | --- | ${chunkSizes.map(() => '---:').join(' | ')} |`);
		const byStream = [...new Set(rows.map((r) => r.stream))];
		for (const s of byStream) {
			const r0 = rows.find((r) => r.stream === s)!;
			const cells = chunkSizes.map((_label, i) => {
				const chunkSize = chunkValues[i];
				const row = rows.find((r) => r.stream === s && r.chunkSize === chunkSize);
				if (!row) return '-';
				if (row.status !== 'ok') return 'x';
				return `${row.decodeMs.toFixed(2)}ms (${bytes(row.peakBytes)})`;
			});
			out.push(`| ${s} | ${r0.mode} | ${cells.join(' | ')} |`);
		}
		out.push('');
	}
	const failures = stream.results.filter((r) => r.status !== 'ok');
	if (failures.length > 0) {
		out.push('| 实现 | 数据集 | chunk | 状态 | 说明 |');
		out.push('| --- | --- | ---: | --- | --- |');
		for (const r of failures) {
			out.push(
				`| ${r.stream} | ${r.dataset} | ${Number.isFinite(r.chunkSize) ? r.chunkSize : 'full'} | ${r.status} | ${(r.error ?? r.reason ?? '').slice(0, 100)} |`,
			);
		}
		out.push('');
	}
	return out;
}

interface SizeDoc {
	meta: Record<string, any>;
	rows: Record<string, any>[];
}

function renderLibrarySize(size: SizeDoc): string[] {
	const out: string[] = [];
	out.push('## 库自身体积');
	out.push('');
	out.push(
		`口径：${size.meta.bundler}；压缩为 ${size.meta.compression}。平台内建（JSON / v8 / structuredClone）不参与。`,
	);
	out.push('');
	out.push(
		'| 库 | min | min+gzip | min+brotli | 运行时依赖 | native addon | 冷启动 import |',
	);
	out.push('| --- | ---: | ---: | ---: | ---: | --- | ---: |');
	const rows = [...size.rows]
		.filter((r) => !r.builtin)
		.sort((a, b) => (a.gzipBytes ?? 0) - (b.gzipBytes ?? 0));
	for (const r of rows) {
		const deps = Array.isArray(r.dependencies) ? r.dependencies.length : '-';
		out.push(
			`| ${r.id} | ${r.error ? 'bundle 失败' : bytes(r.minBytes)} | ${bytes(r.gzipBytes)} | ${bytes(r.brotliBytes)} | ${deps} | ${r.nativeAddon ?? '-'} | ${Number.isFinite(r.importMs) ? `${r.importMs.toFixed(1)}ms` : '-'} |`,
		);
	}
	out.push('');
	return out;
}

function main(): void {
	const argv = process.argv.slice(2);
	const positional: string[] = [];
	let streamPath: string | undefined;
	let sizePath: string | undefined;
	let scalingPath: string | undefined;
	for (const [i, a] of argv.entries()) {
		if (a === '--stream') streamPath = argv[i + 1];
		else if (a === '--sizes') sizePath = argv[i + 1];
		else if (a === '--scaling') scalingPath = argv[i + 1];
		else if (!argv[i - 1]?.startsWith('--')) positional.push(a);
	}
	const input = positional[0];
	if (!input) {
		console.error(
			'usage: tsx report/render.ts <results.json> [out.md] [--scaling s5.json] [--stream stream.json] [--sizes size.json]',
		);
		process.exit(1);
	}
	const doc = JSON.parse(readFileSync(input, 'utf8')) as Doc;
	const lines: string[] = [];
	lines.push('# obj-codec benchmark report');
	lines.push('');
	lines.push(`来源: \`${basename(input)}\``);
	lines.push('');
	lines.push('| | |');
	lines.push('| --- | --- |');
	lines.push(`| 时间 | ${doc.meta.startedAt} |`);
	lines.push(`| Node | ${doc.meta.node} |`);
	lines.push(`| 平台 | ${doc.meta.platform} |`);
	lines.push(`| CPU | ${doc.meta.cpu} |`);
	lines.push(`| git | ${doc.meta.gitSha} |`);
	lines.push(
		`| 参数 | seed=${doc.meta.seed} time=${doc.meta.benchTimeMs}ms warmup=${doc.meta.warmupTimeMs}ms iterations=${doc.meta.iterations} timeout=${doc.meta.caseTimeoutMs}ms |`,
	);
	lines.push('');
	lines.push(
		'口径：`ops/s` 来自 tinybench 的平均单次耗时（`1000/mean`），`MB/s` 用编码载荷字节数折算；`structuredClone` 不产生线格式，体积与解码列为空。S5 使用单发模式（每个 case 一次编码、一次解码），其 `ops/s` 是单次采样的倒数。',
	);
	lines.push('');

	const suites = [...new Set(doc.results.map((r) => r.suite))].sort();
	for (const suite of suites) {
		lines.push(`## 套件 ${suite}`);
		lines.push('');
		if (suite === 'S5') {
			lines.push(...renderScaling(doc));
		} else {
			lines.push(...renderSuite(doc, suite));
		}
	}

	if (scalingPath) {
		const scaling = JSON.parse(readFileSync(scalingPath, 'utf8')) as Doc;
		lines.push('## 套件 S5 · 伸缩');
		lines.push('');
		lines.push(...renderScaling(scaling));
	}
	if (streamPath) {
		lines.push(
			...renderStreaming(
				JSON.parse(readFileSync(streamPath, 'utf8')) as StreamDoc,
			),
		);
	}
	if (sizePath) {
		lines.push(
			...renderLibrarySize(JSON.parse(readFileSync(sizePath, 'utf8')) as SizeDoc),
		);
	}

	lines.push('## 库配置');
	lines.push('');
	lines.push('| 库 | 版本 | 线格式 | 配置 |');
	lines.push('| --- | --- | --- | --- |');
	for (const [id, a] of Object.entries(
		doc.meta.adapters as Record<string, any>,
	)) {
		lines.push(
			`| ${id} | ${a.version} | ${a.wire} | \`${JSON.stringify(a.config)}\` |`,
		);
	}
	lines.push('');

	const markdown = lines.join('\n');
	const outPath = positional[1];
	if (outPath) {
		writeFileSync(outPath, markdown);
		console.log(`[report] wrote ${outPath}`);
	} else {
		process.stdout.write(markdown);
	}
}

main();
