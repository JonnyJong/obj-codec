import { streamAdapterById } from '../adapters/stream';
import { datasetById } from '../datasets/index';

interface StreamConfig {
	stream: string;
	dataset: string;
	chunkSize: number;
	seed: number;
	iterations: number;
}

interface StreamResult {
	stream: string;
	lib: string;
	mode: string;
	dataset: string;
	chunkSize: number;
	chunks?: number;
	payloadBytes?: number;
	status: 'ok' | 'fidelity-fail' | 'error';
	error?: string;
	reason?: string;
	decodeMs?: number;
	peakBytes?: number;
	maxRssBytes?: number;
}

const cfg: StreamConfig = JSON.parse(process.argv[2] ?? '{}');

function emit(result: StreamResult): void {
	process.stdout.write(`\n__RESULT__${JSON.stringify(result)}\n`);
}

const stream = streamAdapterById.get(cfg.stream);
const dataset = datasetById.get(cfg.dataset);

async function main(): Promise<void> {
	if (!(stream && dataset)) {
		emit({
			stream: cfg.stream,
			lib: stream?.lib ?? '?',
			mode: stream?.mode ?? '?',
			dataset: cfg.dataset,
			chunkSize: cfg.chunkSize,
			status: 'error',
			error: stream
				? `unknown dataset ${cfg.dataset}`
				: `unknown stream adapter ${cfg.stream}`,
		});
		return;
	}

	const base: StreamResult = {
		stream: stream.id,
		lib: stream.lib,
		mode: stream.mode,
		dataset: dataset.id,
		chunkSize: cfg.chunkSize,
		status: 'ok',
	};

	const value = dataset.build(cfg.seed);
	const options = dataset.options?.[stream.lib] ?? dataset.options?.default;

	try {
		const payload = await stream.encode(value, options);
		const chunkSize =
			cfg.chunkSize < 0 ? Number.POSITIVE_INFINITY : cfg.chunkSize;
		const chunks = stream.split(payload, chunkSize);
		base.chunks = chunks.length;
		base.payloadBytes = stream.sizeOf(payload);

		const gc = (globalThis as { gc?: () => void }).gc;
		const timings: number[] = [];
		let peakBytes = 0;
		let last: unknown;

		for (let i = 0; i < cfg.iterations; i++) {
			gc?.();
			const before = process.memoryUsage().heapUsed;
			const t0 = performance.now();
			last = await stream.decode(chunks, options);
			timings.push(performance.now() - t0);
			peakBytes = Math.max(peakBytes, process.memoryUsage().heapUsed - before);
		}

		const verdict = dataset.verify(last);
		if (!verdict.ok) {
			emit({ ...base, status: 'fidelity-fail', reason: verdict.reason });
			return;
		}

		timings.sort((a, b) => a - b);
		emit({
			...base,
			decodeMs: timings[Math.floor(timings.length / 2)],
			peakBytes,
			maxRssBytes: process.resourceUsage().maxRSS * 1024,
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
			stream: cfg.stream,
			lib: stream?.lib ?? '?',
			mode: stream?.mode ?? '?',
			dataset: cfg.dataset,
			chunkSize: cfg.chunkSize,
			status: 'error',
			error: `${(error as Error).name}: ${(error as Error).message}`,
		});
	})
	.finally(() => {
		process.exit(0);
	});
