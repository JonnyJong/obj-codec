import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

export default defineConfig([
	{
		input: 'src/index.ts',
		output: [
			{
				file: 'dist/index.esm.js',
				format: 'esm',
				sourcemap: true,
			},
			{
				file: 'dist/index.js',
				format: 'commonjs',
				sourcemap: true,
			},
		],
		external: (id) => id.startsWith('node:'),
	},
	{
		input: 'src/web.ts',
		output: [
			{
				file: 'dist/web.esm.js',
				format: 'esm',
				sourcemap: true,
			},
			{
				file: 'dist/web.js',
				format: 'commonjs',
				sourcemap: true,
			},
		],
	},
	{
		input: ['src/index.ts', 'src/web.ts'],
		plugins: [dts()],
		external: (id) => id.startsWith('node:'),
	},
]);
