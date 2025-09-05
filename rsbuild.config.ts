import { defineConfig } from "@rsbuild/core";

const config = defineConfig({
	environments: {
		node: {
			source: {
				entry: {
					index: "./src/index.ts",
					exampleUsage: "./src/exampleUsage.ts",
				},
			},
			output: {
				minify: false,
				target: "node",
				sourceMap: true,
				distPath: {
					root: "./dist",
				},
			},
		},
	},
	tools: {
		rspack: {
			module: {
				rules: [
					{
						type: "asset/source",
						resourceQuery: /raw$/,
					},
				],
			},
		},
	},
});

export default config;
