// Bundles the CLI (bin/cli.ts) into a single self-contained CommonJS file.
// The published package therefore needs no runtime dependencies and no ts-node.
import { build } from 'esbuild';
import { chmod, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(rootDir, 'dist', 'cli.js');

await mkdir(path.dirname(outfile), { recursive: true });

await build({
	entryPoints: [path.join(rootDir, 'bin', 'cli.ts')],
	outfile,
	bundle: true,
	platform: 'node',
	target: 'node18',
	format: 'cjs',
	alias: { '@': path.join(rootDir, 'src') },
	banner: { js: '#!/usr/bin/env node' },
	legalComments: 'eof',
	logLevel: 'info',
});

// npm restores the executable bit from the tarball, but keep local runs working too.
await chmod(outfile, 0o755);
