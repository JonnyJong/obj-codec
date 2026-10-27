import { gzipSync } from 'node:zlib';
import { Bench } from 'tinybench';
import { adapterById } from '../adapters/index';
import { datasetById } from '../datasets/index';

export interface CaseConfig {
	lib: string;
	dataset: string;
	seed: number;
	benchTime: number;
	warmupTime: number;
	iterations: number;
	warmupIterations: number;
	/** 'bench' uses tinybench; 'single' times exactly one encode and one decode (S5). */
	mode?: 'bench' | 'single';
}

export interface DirStats {
	meanMs: number;
	p75Ms: number;
	p99Ms: number;
	hz: number;
	rme: number;
	samples: number;
}

export interface CaseResult {
	lib: string;
	dataset: string;
	suite: string;
	status: 'ok' | 'fidelity-fail' | 'error';
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
	note?: string;
	optionsUsed?: object;
}

const cfg: CaseConfig = JSON.parse(process.argv[2] ?? '{}');

const adapter = adapterById.get(cfg.lib);
const dataset = datasetById.get(cfg.dataset);

function emit(result: CaseResult): void {
	process.stdout.write(`\n__RESULT__${JSON.stringify(result)}\n`);
}

function describeOptionValue(value: unknown): unknown {
	if (typeof value === 'symbol') return `Symbol(${value.description ?? ''})`;
	if (typeof value === 'object' && value !== null) {
		if (ArrayBuffer.isView(value))
			return `<${value.constructor.name} ${value.byteLength}B>`;
		return `<${value.constructor?.name ?? 'object'}>`;
	}
	return value;
}

/** Options may hold live objects (globalThis, symbols); keep only what serialises. */
function summariseOptions(
	options: unknown,
): Record<string, unknown> | undefined {
	if (options === null || typeof options !== 'object') return undefined;
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(
		options as Record<string, unknown>,
	)) {
		if (Array.isArray(value)) {
			out[key] = value.map(describeOptionValue);
		} else if (typeof value === 'symbol') {
			out[key] = `Symbol(${value.description ?? ''})`;
		} else {
			out[key] = value;
		}
	}
	return out;
}

function statsOf(task: { result?: Record<string, unknown> }): DirStats {
	const r = task.result as {
		mean: number;
		p75: number;
		p99: number;
		hz: number;
		rme: number;
		samples: number[];
	};
	return {
		meanMs: r.mean,
		p75Ms: r.p75,
		p99Ms: r.p99,
		hz: r.hz,
		rme: r.rme,
		samples: r.samples.length,
	};
}

async function main(): Promise<void> {
	if (!(adapter && dataset)) {
		emit({
			lib: cfg.lib,
			dataset: cfg.dataset,
			suite: '?',
			status: 'error',
			error: adapter
				? `unknown dataset ${cfg.dataset}`
				: `unknown adapter ${cfg.lib}`,
		});
		return;
	}

	const base: CaseResult = {
		lib: adapter.id,
		dataset: dataset.id,
		suite: dataset.suite,
		status: 'ok',
	};

	const value = dataset.build(cfg.seed);
	const options = dataset.options?.[adapter.id] ?? dataset.options?.default;

	if (cfg.mode === 'single') {
		await runSingle(adapter, dataset, value, options, base);
		return;
	}

	// 1. fidelity gate: nothing is timed until the round trip is proven faithful
	let payload: unknown;
	let decodePayload: unknown;
	try {
		const encoded = await adapter.encode(value, options);
		payload = encoded;
		decodePayload = encoded;
		const decoded = await adapter.decode(encoded, options);
		const verdict = dataset.verify(decoded);
		if (!verdict.ok) {
			emit({ ...base, status: 'fidelity-fail', reason: verdict.reason });
			return;
		}
	} catch (error) {
		emit({
			...base,
			status: 'error',
			error: `${(error as Error).name}: ${(error as Error).message}`,
		});
		return;
	}

	// 2. wire size + compressibility (one shot, cheap)
	const payloadBytes = adapter.sizeOf(payload);
	const raw = adapter.bytesOf(payload);
	const gzipBytes = raw ? gzipSync(raw, { level: 9 }).byteLength : undefined;

	// 3. memory pass before the timing runs, so tinybench allocations do not leak into it
	const gc = (globalThis as { gc?: () => void }).gc;
	let memory: CaseResult['memory'];
	try {
		gc?.();
		const baseHeap = process.memoryUsage().heapUsed;
		const memPayload = await adapter.encode(value, options);
		const encodePeakBytes = process.memoryUsage().heapUsed - baseHeap;
		gc?.();
		const beforeDecode = process.memoryUsage().heapUsed;
		const memDecoded = adapter.inMemoryOnly
			? null
			: await adapter.decode(memPayload, options);
		const decodePeakBytes = process.memoryUsage().heapUsed - beforeDecode;
		gc?.();
		const retainedBytes = process.memoryUsage().heapUsed - baseHeap;
		memory = {
			encodePeakBytes,
			decodePeakBytes,
			retainedBytes,
			maxRssBytes: process.resourceUsage().maxRSS * 1024,
		};
		// keep both alive until the numbers are read
		void memDecoded;
	} catch (error) {
		base.note = `memory pass failed: ${(error as Error).message}`;
	}

	// 4. timing
	const bench = new Bench({
		time: cfg.benchTime,
		warmupTime: cfg.warmupTime,
		iterations: cfg.iterations,
		warmupIterations: cfg.warmupIterations,
	});
	bench.add('encode', async () => {
		await adapter.encode(value, options);
	});
	if (!adapter.inMemoryOnly) {
		bench.add('decode', async () => {
			await adapter.decode(decodePayload, options);
		});
	}
	await bench.run();

	const encodeTask = bench.tasks.find((t) => t.name === 'encode')!;
	const decodeTask = bench.tasks.find((t) => t.name === 'decode');

	emit({
		...base,
		optionsUsed: summariseOptions(options),
		payloadBytes: adapter.inMemoryOnly ? undefined : payloadBytes,
		gzipBytes,
		memory,
		encode: statsOf(encodeTask as never),
		decode: decodeTask ? statsOf(decodeTask as never) : undefined,
	});
}

/**
 * S5 mode: the fidelity round trip *is* the measurement. Two operations total,
 * so a case that takes 20s per direction still fits inside the case timeout.
 */
async function runSingle(
	adapter: NonNullable<typeof adapter>,
	dataset: NonNullable<typeof dataset>,
	value: unknown,
	options: unknown,
	base: CaseResult,
): Promise<void> {
	const gc = (globalThis as { gc?: () => void }).gc;
	try {
		gc?.();
		const beforeEncode = process.memoryUsage().heapUsed;
		const t0 = performance.now();
		const payload = await adapter.encode(value, options);
		const encodeMs = performance.now() - t0;
		const encodePeakBytes = process.memoryUsage().heapUsed - beforeEncode;

		const payloadBytes = adapter.sizeOf(payload);
		const raw = adapter.bytesOf(payload);
		const gzipBytes = raw ? gzipSync(raw, { level: 9 }).byteLength : undefined;

		gc?.();
		const beforeDecode = process.memoryUsage().heapUsed;
		const t1 = performance.now();
		const decoded = await adapter.decode(payload, options);
		const decodeMs = performance.now() - t1;
		const decodePeakBytes = process.memoryUsage().heapUsed - beforeDecode;

		const verdict = dataset.verify(decoded);
		if (!verdict.ok) {
			emit({ ...base, status: 'fidelity-fail', reason: verdict.reason });
			return;
		}

		const one = (ms: number): DirStats => ({
			meanMs: ms,
			p75Ms: ms,
			p99Ms: ms,
			hz: ms > 0 ? 1000 / ms : Number.POSITIVE_INFINITY,
			rme: 0,
			samples: 1,
		});

		emit({
			...base,
			optionsUsed: summariseOptions(options),
			payloadBytes,
			gzipBytes,
			encode: one(encodeMs),
			decode: adapter.inMemoryOnly ? undefined : one(decodeMs),
			memory: {
				encodePeakBytes,
				decodePeakBytes,
				retainedBytes: process.memoryUsage().heapUsed - beforeEncode,
				maxRssBytes: process.resourceUsage().maxRSS * 1024,
			},
		});
	} catch (error) {
		emit({
			...base,
			status: 'error',
			error: `${(error as Error).name}: ${(error as Error).message}`,
		});
	}
}

main()
	.catch((error: unknown) => {
		emit({
			lib: cfg.lib,
			dataset: cfg.dataset,
			suite: '?',
			status: 'error',
			error: `${(error as Error).name}: ${(error as Error).message}`,
			reason: (error as Error).stack?.split('\n').slice(0, 6).join(' <- '),
		});
	})
	.finally(() => {
		process.exit(0);
	});
