import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adapterById } from '../adapters/index';
import { streamAdapters } from '../adapters/stream';
import { datasets } from '../datasets/index';

/**
 * S4: chunked transport. The payload is encoded once and then handed to the
 * decoder in fixed-size chunks, so the sweep answers "what does chunking cost"
 * per chunk size, and how peak memory behaves as chunks get small.
 */

const here = dirname(fileURLToPath(import.meta.url));
const benchRoot = join(here, '..');
const childPath = join(here, 'stream-child.ts');

/** Overridable with --datasets; a spread of text, binary and mixed payloads. */
const DEFAULT_DATASETS = [
	'A03-short-strings',
	'A04-long-text',
	'A09-mixed-payload',
	'B04-binary',
	'B07-everything',
];

/** -1 means "one chunk"; Infinity cannot survive the JSON config round trip. */
const FULL_CHUNK = -1;
const CHUNK_SIZES = [1024, 16 * 1024, 256 * 1024, FULL_CHUNK];

interface Args {
	datasets: string[];
	streams?: string[];
	seed: number;
	iterations: number;
	caseTimeoutMs: number;
	out?: string;
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		datasets: DEFAULT_DATASETS,
		seed: 1,
		iterations: 3,
		caseTimeoutMs: 60_000,
	};
	for (const [i, a] of argv.entries()) {
		const value = () => argv[i + 1];
		if (a === '--datasets') args.datasets = value().split(',');
		else if (a === '--streams') args.streams = value().split(',');
		else if (a === '--seed') args.seed = Number(value());
		else if (a === '--iterations') args.iterations = Number(value());
		else if (a === '--case-timeout') args.caseTimeoutMs = Number(value());
		else if (a === '--out') args.out = value();
	}
	return args;
}

interface StreamResult {
	stream: string;
	lib: string;
	mode: string;
	dataset: string;
	chunkSize: number;
	chunks?: number;
	payloadBytes?: number;
	status: string;
	error?: string;
	reason?: string;
	decodeMs?: number;
	peakBytes?: number;
	maxRssBytes?: number;
	wallMs?: number;
}

function runCase(
	streamId: string,
	datasetId: string,
	chunkSize: number,
	args: Args,
): Promise<StreamResult> {
	return new Promise((resolve) => {
		const child = spawn(
			process.execPath,
			[
				'--expose-gc',
				'--import',
				'tsx',
				childPath,
				JSON.stringify({
					stream: streamId,
					dataset: datasetId,
					chunkSize,
					seed: args.seed,
					iterations: args.iterations,
				}),
			],
			{ cwd: benchRoot, stdio: ['ignore', 'pipe', 'pipe'] },
		);

		let stdout = '';
		let stderr = '';
		let settled = false;
		const started = Date.now();
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill('SIGKILL');
			resolve({
				stream: streamId,
				lib: '?',
				mode: '?',
				dataset: datasetId,
				chunkSize,
				status: 'timeout',
				error: `TIMEOUT(>${args.caseTimeoutMs}ms)`,
				wallMs: Date.now() - started,
			});
		}, args.caseTimeoutMs);

		child.stdout.on('data', (d) => {
			stdout += d.toString();
		});
		child.stderr.on('data', (d) => {
			stderr += d.toString();
		});
		child.on('error', (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve({
				stream: streamId,
				lib: '?',
				mode: '?',
				dataset: datasetId,
				chunkSize,
				status: 'error',
				error: error.message,
				wallMs: Date.now() - started,
			});
		});
		child.on('close', (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			const marker = stdout.lastIndexOf('__RESULT__');
			if (marker === -1) {
				resolve({
					stream: streamId,
					lib: '?',
					mode: '?',
					dataset: datasetId,
					chunkSize,
					status: 'error',
					error: `no result (exit ${code}): ${stderr.trim().split('\n').slice(-2).join(' | ')}`,
					wallMs: Date.now() - started,
				});
				return;
			}
			const line = stdout.slice(marker + '__RESULT__'.length).split('\n')[0];
			try {
				resolve({
					...(JSON.parse(line) as StreamResult),
					wallMs: Date.now() - started,
				});
			} catch (error) {
				resolve({
					stream: streamId,
					lib: '?',
					mode: '?',
					dataset: datasetId,
					chunkSize,
					status: 'error',
					error: `bad result JSON: ${(error as Error).message}`,
					wallMs: Date.now() - started,
				});
			}
		});
	});
}

function label(chunkSize: number): string {
	return chunkSize === FULL_CHUNK ? 'full' : `${chunkSize / 1024}KB`;
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const picked = datasets.filter((d) => args.datasets.includes(d.id));
	const streams = streamAdapters.filter(
		(s) => !args.streams || args.streams.includes(s.id),
	);

	const cases: Array<{ stream: string; dataset: string; chunkSize: number }> =
		[];
	for (const dataset of picked) {
		for (const stream of streams) {
			if (!dataset.requires.every((r) => streamRequiresSatisfied(r, stream.lib)))
				continue;
			for (const chunkSize of CHUNK_SIZES) {
				cases.push({ stream: stream.id, dataset: dataset.id, chunkSize });
			}
		}
	}

	console.log(`[stream] ${cases.length} cases`);
	const results: StreamResult[] = [];
	let done = 0;
	for (const c of cases) {
		const r = await runCase(c.stream, c.dataset, c.chunkSize, args);
		results.push(r);
		done++;
		console.log(
			`[${String(done).padStart(3)}/${cases.length}] ${c.dataset.padEnd(18)} ${c.stream.padEnd(20)} chunk=${label(c.chunkSize).padEnd(6)} ${r.status === 'ok' ? `${r.decodeMs?.toFixed(2)}ms` : (r.error ?? r.status)}`,
		);
	}

	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const out = args.out ?? join(benchRoot, 'results', `stream-${stamp}.json`);
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(
		out,
		JSON.stringify(
			{
				meta: {
					kind: 'stream',
					startedAt: new Date().toISOString(),
					node: process.version,
					platform: `${platform()} ${release()} ${arch()}`,
					cpu: cpus()[0]?.model ?? 'unknown',
					seed: args.seed,
					iterations: args.iterations,
					caseTimeoutMs: args.caseTimeoutMs,
					chunkSizes: CHUNK_SIZES.map(label),
					streams: streams.map((s) => ({ id: s.id, lib: s.lib, mode: s.mode })),
					datasets: picked.map((d) => ({
						id: d.id,
						name: d.name,
						requires: d.requires,
					})),
				},
				results,
			},
			null,
			2,
		),
	);
	console.log(`[stream] wrote ${out}`);
}

/** The capability gate reuses the base library's measured support. */
function streamRequiresSatisfied(requires: string, lib: string): boolean {
	const adapter = adapterById.get(lib);
	return !!adapter && (adapter.capabilities as string[]).includes(requires);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
