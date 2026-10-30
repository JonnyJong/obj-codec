import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
	type Bar,
	groupedChart,
	type GroupedRow,
	logLogChart,
	type LogSeries,
	pairedChart,
	rankedChart,
} from './chart.ts';

/** 图表登记表：先占位，渲染完再落盘，前端引用总是稳定的相对路径 */
const charts = new Map<string, () => Promise<string>>();
/** 已用过的文件名，防止覆盖 */
const usedChartNames = new Set<string>();

/**
 * 登记一张图
 * @param name 文件名（不含扩展名），同名会追加序号
 * @param factory 渲染函数
 * @returns Markdown 图片引用
 */
function chart(name: string, factory: () => Promise<string>): string {
	let id = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
	if (usedChartNames.has(id)) {
		let i = 2;
		while (usedChartNames.has(`${id}-${i}`)) i++;
		id = `${id}-${i}`;
	}
	usedChartNames.add(id);
	charts.set(id, factory);
	return `![${id}](charts/${id}.svg)`;
}

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

/**
 * 折叠区块
 * @description
 * 先写 `<summary>`，再把内容塞进 `<details>`。
 * 参数 `start` 是 `out` 里要保留的位置，调用前 `push` 的标题会留在外面。
 */
function pushCollapsed(
	out: string[],
	start: number,
	summary: string,
	body: string[],
): void {
	if (body.length === 0) return;
	out.length = start;
	out.push('<details>');
	out.push(`<summary>${summary}</summary>`);
	out.push('');
	out.push(...body);
	out.push('</details>');
	out.push('');
}

/** `S0` → `0`；非 S 前缀原样返回 */
function suiteNumber(suite: string): string {
	return suite.replace(/^S/i, '').toLowerCase();
}

/** 载荷体积表的固定列序 */
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
	const summaryTable: string[] = [];
	summaryTable.push(
		`| 库 | 编码 ops/s | 解码 ops/s |${hasJson ? ' vs JSON (enc) | vs JSON (dec) |' : ''} 参与数据集 | 失败 |`,
	);
	summaryTable.push(
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

	// 主图：编码 / 解码并排，越靠上越快
	const encBars: Bar[] = summary
		.filter((s) => Number.isFinite(s.enc))
		.map((s) => ({ label: s.lib, value: s.enc }));
	const decBars: Bar[] = summary
		.filter((s) => Number.isFinite(s.dec))
		.map((s) => ({ label: s.lib, value: s.dec }));
	out.push(
		chart(`s${suiteNumber(suite)}-summary`, () =>
			pairedChart({
				leftTitle: '编码 ops/s',
				rightTitle: '解码 ops/s',
				left: { bars: encBars },
				right: { bars: decBars },
			}),
		),
	);
	out.push('');

	for (const s of summary) {
		const ratioCells = hasJson
			? ` ${Number.isNaN(s.encRatio) ? '-' : `${s.encRatio.toFixed(2)}x`} | ${Number.isNaN(s.decRatio) ? '-' : `${s.decRatio.toFixed(2)}x`} |`
			: '';
		summaryTable.push(
			`| ${s.lib} | ${num(s.enc)} | ${num(s.dec)} |${ratioCells} ${s.n} | ${s.f} |`,
		);
	}
	const summaryStart = out.length;
	out.push('');
	pushCollapsed(out, summaryStart, '汇总数值', summaryTable);

	// ---- per dataset throughput boards
	out.push('### 分数据集吞吐');
	out.push('');
	const detailStart = out.length;
	const detail: string[] = [];
	for (const id of datasetIds) {
		const rs = ok
			.filter((r) => r.dataset === id)
			.sort((a, b) => (hz(b.encode) ?? 0) - (hz(a.encode) ?? 0));
		if (rs.length === 0) continue;
		const j = jsonByDataset.get(id);
		const header = `**${datasetHeader(doc, id)}**`;
		detail.push(header);
		detail.push('');
		detail.push(
			chart(`${id}-throughput`, () =>
				pairedChart({
					leftTitle: '编码 ops/s',
					rightTitle: '解码 ops/s',
					left: {
						bars: rs
							.map((r) => ({ label: r.lib, value: hz(r.encode) ?? Number.NaN }))
							.filter((b) => Number.isFinite(b.value)),
					},
					right: {
						bars: rs
							.map((r) => ({ label: r.lib, value: hz(r.decode) ?? Number.NaN }))
							.filter((b) => Number.isFinite(b.value)),
					},
				}),
			),
		);
		detail.push('');
		detail.push(
			`| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |${hasJson ? ' 相对 JSON (enc) |' : ''}`,
		);
		detail.push(
			`| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |${hasJson ? ' ---: |' : ''}`,
		);
		for (const r of rs) {
			const enc = hz(r.encode);
			const dec = hz(r.decode);
			const ratioCell = hasJson
				? ` ${enc && j?.enc ? `${(enc / j.enc).toFixed(2)}x` : '-'} |`
				: '';
			detail.push(
				`| ${r.lib} | ${num(enc)} | ${num(dec)} | ${mbps(r, enc)} | ${mbps(r, dec)} | ${r.encode?.p75Ms.toFixed(3) ?? '-'} | ${r.decode?.p75Ms.toFixed(3) ?? '-'} | ${r.encode?.samples ?? '-'} | ${r.encode?.rme.toFixed(1) ?? '-'}% |${ratioCell}`,
			);
		}
		detail.push('');
	}
	pushCollapsed(
		out,
		detailStart,
		`分数据集明细（${datasetIds.length} 个数据集，各含图表与完整数值）`,
		detail,
	);

	// ---- size board
	out.push('### 载荷体积');
	out.push('');
	const present = libOrder.filter((l) => rows.some((r) => r.lib === l));
	// 主图：每个数据集的冠军（体积最小）对比，越靠上越小
	const sizeBars: Bar[] = datasetIds
		.map((id) => {
			let best: number | undefined;
			for (const lib of present) {
				const r = rows.find((x) => x.dataset === id && x.lib === lib);
				if (r?.payloadBytes === undefined) continue;
				if (best === undefined || r.payloadBytes < best) best = r.payloadBytes;
			}
			return { label: id, value: best ?? Number.NaN };
		})
		.filter((b) => Number.isFinite(b.value));
	const ownBars: Bar[] = datasetIds
		.map((id) => {
			const r = rows.find((x) => x.dataset === id && x.lib === 'obj-codec');
			return { label: id, value: r?.payloadBytes ?? Number.NaN };
		})
		.filter((b) => Number.isFinite(b.value));
	if (sizeBars.length > 0) {
		out.push(
			chart(`s${suiteNumber(suite)}-payload-size`, () =>
				pairedChart({
					leftTitle: '各数据集最小载荷 (KiB)',
					rightTitle: 'obj-codec 载荷 (KiB)',
					left: { bars: sizeBars, better: 'low', divisor: 1024, format: ',.1f' },
					right: { bars: ownBars, better: 'low', divisor: 1024, format: ',.1f' },
				}),
			),
		);
		out.push('');
	}
	const sizeStart = out.length;
	const sizeDetail: string[] = [];
	sizeDetail.push(`| 数据集 | ${present.join(' | ')} |`);
	sizeDetail.push(`| --- | ${present.map(() => '---:').join(' | ')} |`);
	for (const id of datasetIds) {
		const cells = present.map((lib) => {
			const r = rows.find((x) => x.dataset === id && x.lib === lib);
			return r?.payloadBytes === undefined ? '-' : bytes(r.payloadBytes);
		});
		sizeDetail.push(`| ${id} | ${cells.join(' | ')} |`);
	}
	sizeDetail.push('');
	sizeDetail.push('gzip (level 9) 后体积：');
	sizeDetail.push('');
	sizeDetail.push(`| 数据集 | ${present.join(' | ')} |`);
	sizeDetail.push(`| --- | ${present.map(() => '---:').join(' | ')} |`);
	for (const id of datasetIds) {
		const cells = present.map((lib) => {
			const r = rows.find((x) => x.dataset === id && x.lib === lib);
			return r?.gzipBytes === undefined ? '-' : bytes(r.gzipBytes);
		});
		sizeDetail.push(`| ${id} | ${cells.join(' | ')} |`);
	}
	sizeDetail.push('');
	pushCollapsed(out, sizeStart, `全部库的载荷体积（${present.length} 个库）`, sizeDetail);

	// ---- memory board
	out.push('### 内存（子进程，GC 后采样）');
	out.push('');
	const memBars: Bar[] = ok
		.filter((r) => r.memory)
		.map((r) => ({ label: r.lib, value: r.memory!.encodePeakBytes }))
		.reduce<Bar[]>((acc, b) => {
			// 同一库跨数据集取几何均值，避免被数据集规模带偏
			const hit = acc.find((x) => x.label === b.label);
			if (hit) hit.value = geo([hit.value, b.value]) as number;
			else acc.push({ ...b });
			return acc;
		}, []);
	if (memBars.length > 0) {
		out.push(
			chart(`s${suiteNumber(suite)}-memory-encode-peak`, () =>
				rankedChart('编码峰值堆（跨数据集几何均值，KiB）', {
					bars: memBars,
					better: 'low',
					divisor: 1024,
					format: ',.1f',
				}),
			),
		);
		out.push('');
	}
	const memStart = out.length;
	const memDetail: string[] = [];
	memDetail.push('| 数据集 | 库 | 编码峰值堆 | 解码峰值堆 | 结果常驻 | 进程 maxRSS |');
	memDetail.push('| --- | --- | ---: | ---: | ---: | ---: |');
	for (const id of datasetIds) {
		for (const r of ok.filter((x) => x.dataset === id)) {
			if (!r.memory) continue;
			memDetail.push(
				`| ${id} | ${r.lib} | ${bytes(r.memory.encodePeakBytes)} | ${bytes(r.memory.decodePeakBytes)} | ${bytes(r.memory.retainedBytes)} | ${bytes(r.memory.maxRssBytes)} |`,
			);
		}
	}
	memDetail.push('');
	pushCollapsed(out, memStart, '全部内存采样', memDetail);

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
		'单次操作耗时 (ms)，单发模式：每个 case 只测一次编码与一次解码。图为等距双对数坐标，越靠近左下越好；斜率是 log-log 最小二乘拟合，1 表示线性、2 表示平方。',
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
		// 曲线：越靠近左下越好
		const series: LogSeries[] = libs
			.map((lib) => ({
				name: lib,
				points: shapeSizes
					.map((n) => {
						const row = rows.find(
							(r) => r.lib === lib && shapeOf(r) === shape && nOf(r) === n,
						);
						return { n, t: row?.encode?.meanMs ?? Number.NaN };
					})
					.filter((p) => Number.isFinite(p.t)),
			}))
			.filter((s) => s.points.length >= 2);
		if (series.length > 0) {
			out.push(
				chart(`s5-${shape}-encode`, () =>
					logLogChart(`形状 ${shape} · 编码单次耗时`, series),
				),
			);
			out.push('');
		}
		const tableStart = out.length;
		const table: string[] = [];
		table.push(
			`| 库 | 指标 | ${shapeSizes.map((n) => n.toLocaleString('en-US')).join(' | ')} | 斜率 |`,
		);
		table.push(
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
				table.push(
					`| ${lib} | ${metric} | ${cells.join(' | ')} | ${slope === undefined ? '-' : slope.toFixed(2)} |`,
				);
			}
		}
		table.push('');
		pushCollapsed(out, tableStart, `形状 ${shape} · 完整数值与斜率`, table);
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
		'载荷先整体编码一次，再按固定大小切块交给解码器。`incremental` 逐块喂给解码器，`buffered` 先拼接再解码（对照组）。图为解码耗时，越短越好；展开可见各档 chunk 的中位数与采样峰值堆。',
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
		const full = rows.find((r) => r.chunkSize === -1);
		out.push(
			`**${dataset}**${payloadBytes ? ` · 载荷 ${bytes(payloadBytes)}` : ''}${full?.chunks ? ` · 整块 chunk 数 ${full.chunks}` : ''}`,
		);
		out.push('');
		const byStream = [...new Set(rows.map((r) => r.stream))];
		// 曲线：解码耗时随 chunk 大小的变化，越短越好
		const grouped: GroupedRow[] = [];
		for (const s of byStream) {
			for (const [i, label] of chunkSizes.entries()) {
				const row = rows.find(
					(r) => r.stream === s && r.chunkSize === chunkValues[i],
				);
				if (row?.status !== 'ok') continue;
				grouped.push({ label: s, series: label, value: row.decodeMs });
			}
		}
		if (grouped.length > 0) {
			// 纵向顺序：整块耗时从短到长
			const order = byStream
				.map((s) => {
					const row = rows.find((r) => r.stream === s && r.chunkSize === -1);
					return { s, v: row?.status === 'ok' ? row.decodeMs : Number.POSITIVE_INFINITY };
				})
				.sort((a, b) => a.v - b.v)
				.map((x) => x.s);
			out.push(
				chart(`s4-${dataset}-chunks`, () =>
					groupedChart('解码耗时 (ms)', grouped, order, {
						format: '.2f',
						width: 420,
					}),
				),
			);
			out.push('');
		}
		const tableStart = out.length;
		const table: string[] = [];
		table.push(`| 实现 | 模式 | ${chunkSizes.join(' | ')} |`);
		table.push(`| --- | --- | ${chunkSizes.map(() => '---:').join(' | ')} |`);
		for (const s of byStream) {
			const r0 = rows.find((r) => r.stream === s)!;
			const cells = chunkSizes.map((_label, i) => {
				const chunkSize = chunkValues[i];
				const row = rows.find((r) => r.stream === s && r.chunkSize === chunkSize);
				if (!row) return '-';
				if (row.status !== 'ok') return 'x';
				return `${row.decodeMs.toFixed(2)}ms (${bytes(row.peakBytes)})`;
			});
			table.push(`| ${s} | ${r0.mode} | ${cells.join(' | ')} |`);
		}
		table.push('');
		pushCollapsed(out, tableStart, `${dataset} · 各 chunk 大小的耗时与峰值堆`, table);
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
	const rows = [...size.rows]
		.filter((r) => !r.builtin)
		.sort((a, b) => (a.gzipBytes ?? 0) - (b.gzipBytes ?? 0));
	const bars: Bar[] = rows
		.map((r) => ({ label: r.id, value: Number(r.gzipBytes) }))
		.filter((b) => Number.isFinite(b.value));
	if (bars.length > 0) {
		out.push(
			chart('library-gzip-size', () =>
				rankedChart('min+gzip 体积 (KiB)', {
					bars,
					better: 'low',
					divisor: 1024,
					format: ',.1f',
				}),
			),
		);
		out.push('');
	}
	const tableStart = out.length;
	const table: string[] = [];
	table.push(
		'| 库 | min | min+gzip | min+brotli | 运行时依赖 | native addon | 冷启动 import |',
	);
	table.push('| --- | ---: | ---: | ---: | ---: | --- | ---: |');
	for (const r of rows) {
		const deps = Array.isArray(r.dependencies) ? r.dependencies.length : '-';
		table.push(
			`| ${r.id} | ${r.error ? 'bundle 失败' : bytes(r.minBytes)} | ${bytes(r.gzipBytes)} | ${bytes(r.brotliBytes)} | ${deps} | ${r.nativeAddon ?? '-'} | ${Number.isFinite(r.importMs) ? `${r.importMs.toFixed(1)}ms` : '-'} |`,
		);
	}
	table.push('');
	pushCollapsed(out, tableStart, '全部体积与冷启动数据', table);
	return out;
}

async function main(): Promise<void> {
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
	lines.push(
		'图表读法：所有排行图都按「越靠上越好」排序，标签前的数字是名次；`obj-codec` 用橙色标出，其余为蓝色。每节的完整数值收在折叠块里。',
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
	if (!outPath) {
		// 图表只在落盘模式下生成：stdout 模式没有与 md 同级的 charts 目录
		process.stdout.write(
			charts.size > 0
				? `${markdown}\n\n<!-- ${charts.size} 张图未生成：未指定输出路径 -->\n`
				: markdown,
		);
		return;
	}
	const chartDir = join(dirname(outPath), 'charts');
	mkdirSync(chartDir, { recursive: true });
	await Promise.all(
		[...charts].map(async ([id, factory]) => {
			try {
				writeFileSync(join(chartDir, `${id}.svg`), await factory());
			} catch (error) {
				console.error(`[report] chart ${id} failed:`, error);
			}
		}),
	);
	writeFileSync(outPath, markdown);
	console.log(`[report] wrote ${outPath} (${charts.size} charts → ${chartDir})`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
