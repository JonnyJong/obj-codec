import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adapters } from '../adapters/index';
import { datasets } from '../datasets/index';
import { requireAll } from '../datasets/util';
import type { CaseResult } from './child';

const here = dirname(fileURLToPath(import.meta.url));
const benchRoot = join(here, '..');
const childPath = join(here, 'child.ts');

interface Args {
	suites: string[];
	libs?: string[];
	datasets?: string[];
	seed: number;
	caseTimeoutMs: number;
	benchTime: number;
	warmupTime: number;
	iterations: number;
	warmupIterations: number;
	out?: string;
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		suites: [],
		seed: 1,
		caseTimeoutMs: 30_000,
		benchTime: 250,
		warmupTime: 100,
		iterations: 2,
		warmupIterations: 1,
	};
	for (const [i, a] of argv.entries()) {
		// values never start with "--", so consumed values fall through harmlessly
		const value = () => argv[i + 1];
		if (a === '--suite') args.suites = value().split(',');
		else if (a === '--libs') args.libs = value().split(',');
		else if (a === '--datasets') args.datasets = value().split(',');
		else if (a === '--seed') args.seed = Number(value());
		else if (a === '--case-timeout') args.caseTimeoutMs = Number(value());
		else if (a === '--time') args.benchTime = Number(value());
		else if (a === '--iterations') args.iterations = Number(value());
		else if (a === '--quick') {
			args.benchTime = 60;
			args.warmupTime = 20;
			args.iterations = 1;
			args.warmupIterations = 0;
		} else if (a === '--out') args.out = value();
	}
	return args;
}

interface RunResult extends CaseResult {
	wallMs: number;
	addon?: unknown;
	metaShape?: string;
	metaN?: number;
}

function runCase(
	libId: string,
	datasetId: string,
	mode: 'bench' | 'single',
	args: Args,
): Promise<RunResult> {
	return new Promise((resolve) => {
		const child = spawn(
			process.execPath,
			[
				'--expose-gc',
				'--import',
				'tsx',
				childPath,
				JSON.stringify({
					lib: libId,
					dataset: datasetId,
					seed: args.seed,
					benchTime: args.benchTime,
					warmupTime: args.warmupTime,
					iterations: args.iterations,
					warmupIterations: args.warmupIterations,
					mode,
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
				lib: libId,
				dataset: datasetId,
				suite: '?',
				status: 'error',
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
				lib: libId,
				dataset: datasetId,
				suite: '?',
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
					lib: libId,
					dataset: datasetId,
					suite: '?',
					status: 'error',
					error: `no result (exit ${code}): ${stderr.trim().split('\n').slice(-2).join(' | ')}`,
					wallMs: Date.now() - started,
				});
				return;
			}
			const line = stdout.slice(marker + '__RESULT__'.length).split('\n')[0];
			try {
				const parsed = JSON.parse(line) as CaseResult;
				resolve({ ...parsed, wallMs: Date.now() - started });
			} catch (error) {
				resolve({
					lib: libId,
					dataset: datasetId,
					suite: '?',
					status: 'error',
					error: `bad result JSON: ${(error as Error).message}`,
					wallMs: Date.now() - started,
				});
			}
		});
	});
}

function gitSha(): string {
	try {
		return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
			cwd: benchRoot,
		})
			.toString()
			.trim();
	} catch {
		return 'unknown';
	}
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const pickedDatasets = datasets.filter(
		(d) =>
			(args.suites.length === 0 || args.suites.includes(d.suite)) &&
			(!args.datasets || args.datasets.includes(d.id)),
	);

	const cases: Array<{ lib: string; dataset: string }> = [];
	for (const dataset of pickedDatasets) {
		for (const adapter of adapters) {
			if (args.libs && !args.libs.includes(adapter.id)) continue;
			if (!requireAll(dataset.requires, adapter.capabilities)) continue;
			cases.push({ lib: adapter.id, dataset: dataset.id });
		}
	}

	console.log(
		`[bench] ${cases.length} cases = ${pickedDatasets.length} datasets x eligible libraries`,
	);

	const results: RunResult[] = [];
	let done = 0;
	for (const c of cases) {
		const suiteMode =
			pickedDatasets.find((d) => d.id === c.dataset)?.suite === 'S5'
				? 'single'
				: 'bench';
		const r = await runCase(c.lib, c.dataset, suiteMode, args);
		const meta = pickedDatasets.find((d) => d.id === c.dataset)?.meta;
		if (meta) {
			r.metaShape = meta.shape as string | undefined;
			r.metaN = meta.n as number | undefined;
		}
		results.push(r);
		done++;
		const enc = r.encode
			? `${(1000 / r.encode.meanMs).toFixed(0)}/s`
			: (r.error ?? r.status);
		const dec = r.decode ? `${(1000 / r.decode.meanMs).toFixed(0)}/s` : '-';
		console.log(
			`[${String(done).padStart(3)}/${cases.length}] ${c.dataset.padEnd(20)} ${c.lib.padEnd(24)} enc=${String(enc).padEnd(14)} dec=${String(dec).padEnd(14)} ${r.wallMs}ms`,
		);
	}

	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const out =
		args.out ?? join(benchRoot, 'results', `${stamp}-${gitSha()}.json`);
	mkdirSync(dirname(out), { recursive: true });

	const doc = {
		meta: {
			startedAt: new Date().toISOString(),
			node: process.version,
			platform: `${platform()} ${release()} ${arch()}`,
			cpu: cpus()[0]?.model ?? 'unknown',
			gitSha: gitSha(),
			seed: args.seed,
			benchTimeMs: args.benchTime,
			warmupTimeMs: args.warmupTime,
			iterations: args.iterations,
			warmupIterations: args.warmupIterations,
			caseTimeoutMs: args.caseTimeoutMs,
			suites: [...new Set(pickedDatasets.map((d) => d.suite))],
			adapters: Object.fromEntries(
				adapters.map((a) => [
					a.id,
					{ version: a.version, wire: a.wire, config: a.config },
				]),
			),
			datasets: pickedDatasets.map((d) => ({
				id: d.id,
				suite: d.suite,
				name: d.name,
				requires: d.requires,
				meta: d.meta,
			})),
		},
		results,
	};

	writeFileSync(out, JSON.stringify(doc, null, 2));
	console.log(`[bench] wrote ${out}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
