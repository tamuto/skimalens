import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { TanStackRouterRspack } from "@tanstack/router-plugin/rspack";

export default defineConfig({
	plugins: [pluginReact()],
	source: {
		entry: { index: "./src/main.tsx" },
	},
	html: {
		template: "./index.html",
	},
	output: {
		// The CLI bundle is emitted to dist/cli.js, so the web assets live in
		// their own subdirectory and are served from there.
		distPath: { root: "dist/web" },
	},
	tools: {
		rspack: {
			plugins: [TanStackRouterRspack()],
		},
	},
});
