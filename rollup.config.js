const ts = require('@rollup/plugin-typescript');
const tarser = require('@rollup/plugin-terser');
const { dts } = require('rollup-plugin-dts');

module.exports = [
	{
		input: './src/index.ts',
		output: {
			file: './dist/index.js',
			format: 'cjs',
			sourcemap: true,
		},
		plugins: [ts(), tarser()],
		external: ['@types/node'],
	},
	{
		input: './src/index.ts',
		output: {
			file: './dist/index.esm.js',
			format: 'es',
			sourcemap: true,
		},
		plugins: [ts(), tarser()],
		external: ['@types/node'],
	},
	// HACK: rollup did not compile d.ts file
	{
		input: './src/types.d.ts',
		output: {
			file: './dist/types.d.ts',
			format: 'es',
		},
		plugins: [dts()],
		external: ['@types/node'],
	},
];
