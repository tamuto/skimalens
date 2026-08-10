import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(rootDir, 'src'),
		},
	},
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		// The end-to-end suite builds the package and starts servers.
		testTimeout: 120_000,
		hookTimeout: 180_000,
	},
});
