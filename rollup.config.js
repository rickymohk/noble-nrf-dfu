import { defineConfig } from "rollup";

export default defineConfig({
	input: "src/index.js",
	output: [
		{
			file: "cjs/index.js",
			format: "cjs",
		},
        {
			file: "esm/index.js",
			format: "es",
		},
	],
});
