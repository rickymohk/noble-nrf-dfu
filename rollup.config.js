const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const readFileSync = require('fs').readFileSync;
const path = require('path');

const pkg = JSON.parse(readFileSync(path.resolve(__dirname,'./package.json') , 'utf8'));

module.exports = {
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
