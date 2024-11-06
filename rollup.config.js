import { defineConfig } from "rollup";

export default defineConfig({
	input: "src/index.js",
	output: [
		{
			file: "cjs/index.cjs",
			format: "cjs",
		},
        {
			file: "esm/index.mjs",
			format: "es",
		},
	],
});
