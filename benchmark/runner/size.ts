import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cpus, hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants, brotliCompressSync, gzipSync } from 'node:zlib';
import { build } from 'esbuild';

/**
 * P4: library footprint. Every library is bundled the way bundlephobia does it
 * (bundle + minify + tree-shake, no externals except node builtins), then
 * measured raw / gzip / brotli. Cold import time is measured in a fresh Node
 * process because module loading is one-time and pollutes a warm process.
 */

const here = dirname(fileURLToPath(import.meta.url));
const benchRoot = join(here, '..');
const require = createRequire(import.meta.url);

interface Entry {
	id: string;
	name: string;
	/** Import specifier used for bundling and for the cold-import probe. */
	specifier: string;
	/** Built-in platform features have no downloadable footprint. */
	builtin?: boolean;
}

const entries: Entry[] = [
	{ id: 'json', name: 'JSON', specifier: '', builtin: true },
	{ id: 'v8', name: 'v8.serialize', specifier: '', builtin: true },
	{
		id: 'structuredClone',
		name: 'structuredClone',
		specifier: '',
		builtin: true,
	},
	{ id: 'superjson', name: 'superjson', specifier: 'superjson' },
	{ id: 'cbor-x', name: 'cbor-x', specifier: 'cbor-x' },
	{ id: 'msgpackr', name: 'msgpackr', specifier: 'msgpackr' },
	{ id: 'msgpack', name: '@msgpack/msgpack', specifier: '@msgpack/msgpack' },
	{ id: 'devalue', name: 'devalue', specifier: 'devalue' },
	{ id: 'seroval', name: 'seroval', specifier: 'seroval' },
	{ id: 'turbo-stream', name: 'turbo-stream', specifier: 'turbo-stream' },
	{ id: 'flatted', name: 'flatted', specifier: 'flatted' },
	{
		id: 'ungap-structured-clone',
		name: '@ungap/structured-clone/json',
		specifier: '@ungap/structured-clone/json',
	},
	{ id: 'bson', name: 'bson', specifier: 'bson' },
	{ id: 'ion-js', name: 'ion-js', specifier: 'ion-js' },
	{ id: 'obj-codec', name: 'obj-codec', specifier: '../dist/index.esm.js' },
];

interface SizeRow {
	id: string;
	name: string;
	builtin: boolean;
	minBytes?: number;
	gzipBytes?: number;
	brotliBytes?: number;
	dependencies?: string[];
	optionalDependencies?: string[];
	nativeAddon?: string | null;
	importMs?: number;
	error?: string;
}

async function bundle(specifier: string): Promise<Uint8Array> {
	const result = await build({
		stdin: {
			contents: `export * from ${JSON.stringify(specifier)};`,
			resolveDir: benchRoot,
			loader: 'ts',
		},
		bundle: true,
		minify: true,
		format: 'esm',
		platform: 'node',
		target: 'es2022',
		external: ['node:*'],
		write: false,
		logLevel: 'silent',
	});
	return result.outputFiles[0].contents;
}

function packageJson(id: string): Record<string, unknown> | null {
	try {
		const path = require.resolve(`${id}/package.json`);
		return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
	} catch {
		return null;
	}
}

const NATIVE_CANDIDATES = ['msgpackr-extract', 'cbor-extract'];

function nativeAddonFor(id: string): string | null {
	for (const candidate of NATIVE_CANDIDATES) {
		const pkg = packageJson(candidate);
		if (!pkg) continue;
		const deps = {
			...(packageJson(id)?.optionalDependencies as
				| Record<string, string>
				| undefined),
			...(packageJson(id)?.dependencies as Record<string, string> | undefined),
		};
		if (candidate in deps) return candidate;
	}
	return null;
}

function coldImportMs(specifier: string): number {
	const url = specifier.startsWith('.')
		? `file://${join(benchRoot, specifier)}`
		: specifier;
	const script = `const t = performance.now(); import(${JSON.stringify(url)}).then(() => { process.stdout.write(String(performance.now() - t)); });`;
	const result = spawnSync(process.execPath, ['-e', script], {
		cwd: benchRoot,
		encoding: 'utf8',
	});
	const value = Number(result.stdout.trim());
	return Number.isFinite(value) ? value : Number.NaN;
}

async function main(): Promise<void> {
	const rows: SizeRow[] = [];
	for (const entry of entries) {
		if (entry.builtin) {
			rows.push({ id: entry.id, name: entry.name, builtin: true });
			continue;
		}
		const row: SizeRow = { id: entry.id, name: entry.name, builtin: false };
		try {
			const content = await bundle(entry.specifier);
			row.minBytes = content.byteLength;
			row.gzipBytes = gzipSync(content, { level: 9 }).byteLength;
			row.brotliBytes = brotliCompressSync(content, {
				params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
			}).byteLength;
		} catch (error) {
			row.error = (error as Error).message.slice(0, 120);
		}
		const pkgId = entry.id === 'obj-codec' ? null : entry.specifier;
		if (pkgId) {
			const pkg = packageJson(pkgId);
			row.dependencies = Object.keys((pkg?.dependencies as object) ?? {});
			row.optionalDependencies = Object.keys(
				(pkg?.optionalDependencies as object) ?? {},
			);
			row.nativeAddon = nativeAddonFor(pkgId);
		}
		row.importMs = coldImportMs(entry.specifier);
		rows.push(row);
		console.log(
			`[size] ${entry.id.padEnd(24)} ${row.minBytes ? `${(row.minBytes / 1024).toFixed(1)}KB min / ${(row.gzipBytes! / 1024).toFixed(1)}KB gz` : (row.error ?? 'builtin')} import=${row.importMs?.toFixed(1)}ms`,
		);
	}

	mkdirSync(join(benchRoot, 'results'), { recursive: true });
	const out = join(benchRoot, 'results', 'library-size.json');
	writeFileSync(
		out,
		JSON.stringify(
			{
				meta: {
					kind: 'library-size',
					startedAt: new Date().toISOString(),
					node: process.version,
					bundler: 'esbuild (bundle, minify, platform=node, esm, node:* external)',
					compression: 'gzip level 9, brotli quality 11',
					cpu: `${cpus()[0]?.model ?? 'unknown'} @ ${hostname()}`,
				},
				rows,
			},
			null,
			2,
		),
	);
	console.log(`[size] wrote ${out}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
