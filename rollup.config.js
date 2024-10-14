import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default {
    input: 'src/index.js',
    external: ['buffer', 'fs', 'debug'],
    output: {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true,
    },
    plugins: [
        json(),
        resolve({ preferBuiltins: true }),
        commonjs({
            include: 'node_modules/**',
        }),
    ],
};
