import * as vega from 'vega';
import { compile } from 'vega-lite';

/**
 * 报告图表
 * @description
 * 用 vega-lite 声明图形，用 vega 在 Node 侧渲染成 SVG。
 * 所有排行图统一「越靠上越好」：值大的排前面，或值小的排前面，由 `better` 决定。
 * `obj-codec` 用强调色标出，标签前缀是名次。
 */

const SCHEMA = 'https://vega.github.io/schema/vega-lite/v6.json';
/** 强调色：obj-codec */
const HIGHLIGHT = '#e4572e';
const BASE = '#4c78a8';
const MUTED = '#8a8a8a';
const GRID = '#88888840';
/** 需要强调的库 */
const EMPHASIS = 'obj-codec';

export interface Bar {
	label: string;
	value: number;
}

export interface PanelOptions {
	bars: Bar[];
	/** `high`：值越大越好；`low`：值越小越好 */
	better?: 'high' | 'low';
	/** 数值格式（d3-format） */
	format?: string;
	/** 绘图前除以该值（用于把字节换算成 KiB 之类） */
	divisor?: number;
	width?: number;
}

export interface PairedOptions {
	left: PanelOptions;
	right: PanelOptions;
	leftTitle: string;
	rightTitle: string;
	/** 整图标题 */
	title?: string;
}

const AXIS = {
	labelFontSize: 10,
	labelColor: MUTED,
	titleFontSize: 11,
	titleColor: MUTED,
};

/** 渲染 vega-lite 规格为 SVG 文本 */
async function toSvg(spec: unknown): Promise<string> {
	const vg = compile(spec as never).spec;
	const view = new vega.View(vega.parse(vg), { renderer: 'none' });
	try {
		return await view.toSVG();
	} finally {
		view.finalize();
	}
}

/** 排行面板 */
function rankedPanel(options: PanelOptions, title: string): any {
	const better = options.better ?? 'high';
	const divisor = options.divisor ?? 1;
	const sorted = options.bars
		.filter((b) => Number.isFinite(b.value))
		.map((b) => ({ ...b, value: b.value / divisor }))
		.sort((a, b) => (better === 'high' ? b.value - a.value : a.value - b.value));
	const format = options.format ?? ',.0f';
	return {
		title: {
			text: title,
			anchor: 'middle',
			fontSize: 11,
			color: MUTED,
			font: 'sans-serif',
		},
		width: options.width ?? 300,
		height: { step: 20 },
		data: {
			values: sorted.map((b, i) => ({
				label: `${i + 1}. ${b.label}`,
				value: b.value,
				hi: b.label === EMPHASIS,
			})),
		},
		encoding: {
			y: {
				field: 'label',
				type: 'nominal',
				sort: null,
				axis: { title: null, labelFontSize: 10, labelColor: MUTED, labelPadding: 4 },
			},
		},
		layer: [
			{
				// 强调行的背景带
				// 注意：这一层不能 filter，否则 y 轴 domain 只含被强调的那一行，
				// 排序会被它带偏。
				mark: { type: 'rect', x: 0, x2: { expr: 'width' }, color: HIGHLIGHT },
				encoding: {
					opacity: { condition: { test: 'datum.hi', value: 0.13 }, value: 0 },
				},
			},
			{
				mark: { type: 'bar', height: { band: 0.6 } },
				encoding: {
					x: {
						field: 'value',
						type: 'quantitative',
						axis: {
							title: null,
							format,
							labelFontSize: 9,
							labelColor: MUTED,
							grid: true,
							gridColor: GRID,
							tickCount: 4,
							domain: false,
							ticks: false,
						},
					},
					color: {
						condition: { test: 'datum.hi', value: HIGHLIGHT },
						value: BASE,
					},
				},
			},
			{
				// 条尾数值，便于读数
				mark: { type: 'text', align: 'left', dx: 4, fontSize: 9, color: MUTED },
				encoding: {
					x: { field: 'value', type: 'quantitative' },
					text: { field: 'value', type: 'quantitative', format },
				},
			},
		],
	};
}

/** 单张排行图 */
export function rankedChart(title: string, options: PanelOptions): Promise<string> {
	return toSvg({
		$schema: SCHEMA,
		background: 'transparent',
		...rankedPanel(options, title),
		// config: { padding: 5 },
		padding: 5,
	});
}

/** 并排两张排行图（编码 / 解码，或任意两项指标） */
export function pairedChart(options: PairedOptions): Promise<string> {
	const spec: any = {
		$schema: SCHEMA,
		background: 'transparent',
		spacing: 2,
		hconcat: [
			rankedPanel(options.left, options.leftTitle),
			rankedPanel(options.right, options.rightTitle),
		],
		resolve: { scale: { x: 'independent', y: 'independent' } },
		config: { padding: 5 },
	};
	if (options.title) spec.title = { text: options.title, anchor: 'middle', fontSize: 12 };
	return toSvg(spec);
}

export interface GroupedRow {
	/** 纵向分组（实现名） */
	label: string;
	/** 横向比较的系列（如 chunk 大小） */
	series: string;
	value: number;
}

/**
 * 分组排行图
 * @param order 纵向顺序（由上到下）
 * @description
 * 高度必须给数值：与 `yOffset` 同时使用 `{step}` 时，分组带宽和柱子位置会错开。
 */
export function groupedChart(
	title: string,
	rows: GroupedRow[],
	order: string[],
	options: {
		seriesOrder?: string[];
		format?: string;
		width?: number;
		/** 每组的像素高度 */
		bandHeight?: number;
	} = {},
): Promise<string> {
	const seriesOrder =
		options.seriesOrder ?? [...new Set(rows.map((r) => r.series))];
	const band = options.bandHeight ?? 52;
	return toSvg({
		$schema: SCHEMA,
		background: 'transparent',
		title: { text: title, anchor: 'middle', fontSize: 11, color: MUTED },
		width: options.width ?? 360,
		height: Math.max(order.length, 1) * band,
		data: {
			values: rows.map((r) => ({
				label: r.label,
				series: r.series,
				value: r.value,
				isEmphasis:
					r.label === EMPHASIS || r.label.startsWith(`${EMPHASIS}-`),
			})),
		},
		encoding: {
			y: {
				field: 'label',
				type: 'nominal',
				sort: order,
				axis: { title: null, labelFontSize: 10, labelColor: MUTED },
			},
		},
		layer: [
			{
				// 同 rankedPanel：这一层不能 filter，否则只有被强调的行参与 band 计算
				mark: { type: 'rect', x: 0, x2: { expr: 'width' }, color: HIGHLIGHT },
				encoding: {
					opacity: {
						condition: { test: `datum.isEmphasis`, value: 0.12 },
						value: 0,
					},
				},
			},
			{
				mark: { type: 'bar', height: { band: 0.85 } },
				encoding: {
					x: {
						field: 'value',
						type: 'quantitative',
						axis: {
							title: null,
							format: options.format ?? ',.2f',
							labelFontSize: 9,
							labelColor: MUTED,
							grid: true,
							gridColor: GRID,
							domain: false,
							ticks: false,
						},
					},
					yOffset: { field: 'series', type: 'nominal', sort: seriesOrder },
					color: {
						field: 'series',
						type: 'nominal',
						sort: seriesOrder,
						scale: { scheme: 'blues' },
						legend: {
							title: null,
							orient: 'top',
							labelFontSize: 10,
							labelColor: MUTED,
						},
					},
				},
			},
			{
				// 条尾数值：分组图里常有 0.x 的柱子，光看长度读不出来
				mark: {
					type: 'text',
					align: 'left',
					dx: 3,
					fontSize: 8,
					color: MUTED,
				},
				encoding: {
					x: { field: 'value', type: 'quantitative' },
					yOffset: { field: 'series', type: 'nominal', sort: seriesOrder },
					text: {
						field: 'value',
						type: 'quantitative',
						format: options.format ?? ',.2f',
					},
				},
			},
		],
		config: { padding: 5 },
	});
}

export interface LogPoint {
	n: number;
	t: number;
}

export interface LogSeries {
	name: string;
	points: LogPoint[];
}

/**
 * log-log 折线图（伸缩曲线）
 * @description
 * 只有 obj-codec 用强调色加粗，其余统一细灰线，避免 15 条图例互相遮挡。
 */
export function logLogChart(title: string, series: LogSeries[]): Promise<string> {
	const values: Array<{ name: string; n: number; t: number }> = [];
	for (const s of series) {
		for (const p of s.points) {
			if (p.n > 0 && p.t > 0) values.push({ name: s.name, n: p.n, t: p.t });
		}
	}
	return toSvg({
		$schema: SCHEMA,
		background: 'transparent',
		title: { text: title, anchor: 'middle', fontSize: 11, color: MUTED },
		width: 420,
		height: 240,
		data: { values },
		mark: { type: 'line', interpolate: 'monotone' },
		encoding: {
			x: {
				field: 'n',
				type: 'quantitative',
				scale: { type: 'log' },
				axis: { title: '元素数', format: '~g', ...AXIS },
			},
			y: {
				field: 't',
				type: 'quantitative',
				scale: { type: 'log' },
				axis: { title: '单次耗时 (ms)', format: '~g', ...AXIS },
			},
			color: {
				condition: [
					{ test: `datum.name === '${EMPHASIS}'`, value: HIGHLIGHT },
					{ test: "datum.name === 'json'", value: '#6f6f6f' },
				],
				value: '#c8c8c8',
			},
			strokeWidth: {
				condition: [
					{ test: `datum.name === '${EMPHASIS}'`, value: 2.5 },
					{ test: "datum.name === 'json'", value: 1.6 },
				],
				value: 0.8,
			},
			detail: { field: 'name' },
			tooltip: [
				{ field: 'name', type: 'nominal' },
				{ field: 'n', type: 'quantitative' },
				{ field: 't', type: 'quantitative' },
			],
		},
		config: { padding: 5 },
	});
}
