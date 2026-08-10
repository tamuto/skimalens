import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { chatgptConversation, claudeConversation } from './fixtures';

const rootDir = path.resolve(__dirname, '..');
const cliPath = path.join(rootDir, 'dist', 'cli.js');
const webIndex = path.join(rootDir, 'dist', 'web', 'index.html');

let workDir: string;
const running: ChildProcessWithoutNullStreams[] = [];

/** Absolute path to a file inside the throwaway working directory. */
function fixturePath(name: string): string {
	return path.join(workDir, name);
}

/*
 * Child processes run with the repository as their working directory, never
 * workDir: Windows refuses to remove a directory that a running process holds
 * open as its cwd, which made the cleanup in afterAll fail with EBUSY. File
 * arguments are therefore passed as absolute paths.
 */

/** Run the built CLI to completion and capture its output. */
function runCli(args: string[]) {
	const result = spawnSync(process.execPath, [cliPath, ...args], {
		encoding: 'utf-8',
		cwd: rootDir,
	});
	return {
		status: result.status,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
		output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
	};
}

/**
 * Start the viewer and resolve once it reports the port it bound to.
 */
function startServer(args: string[]): Promise<{ port: number; child: ChildProcessWithoutNullStreams }> {
	const child = spawn(process.execPath, [cliPath, ...args], {
		cwd: rootDir,
		// Suppresses the browser launch, which would otherwise open a window on
		// developer machines running the suite locally.
		env: { ...process.env, TERM_PROGRAM: 'vscode' },
	});
	running.push(child);

	return new Promise((resolve, reject) => {
		let buffered = '';
		const timer = setTimeout(() => reject(new Error(`server did not start: ${buffered}`)), 30_000);

		child.stdout.on('data', (chunk: Buffer) => {
			buffered += chunk.toString();
			const match = buffered.match(/server started at http:\/\/localhost:(\d+)/);
			if (match) {
				clearTimeout(timer);
				resolve({ port: Number(match[1]), child });
			}
		});
		child.on('error', reject);
		child.on('exit', (code) => {
			clearTimeout(timer);
			reject(new Error(`server exited with ${code}: ${buffered}`));
		});
	});
}

beforeAll(() => {
	if (!fs.existsSync(webIndex)) {
		throw new Error(
			'dist/web/index.html is required for the end-to-end tests. Run "pnpm run build" first.',
		);
	}

	// The CLI bundle is the code under test, so it is rebuilt every run rather
	// than trusting whatever dist/cli.js happens to be lying around.
	const built = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'build-cli.mjs')], {
		cwd: rootDir,
		encoding: 'utf-8',
	});
	if (built.status !== 0) {
		throw new Error(`failed to build the CLI bundle: ${built.stderr}`);
	}

	workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skimalens-e2e-'));

	fs.writeFileSync(
		path.join(workDir, '会話ログ.json'),
		JSON.stringify([claudeConversation('日本語タイトル', 'a'), claudeConversation('second', 'b')]),
		'utf-8',
	);
	fs.writeFileSync(
		path.join(workDir, 'chatgpt.json'),
		JSON.stringify([chatgptConversation('GPT会話', 'gpt-1')]),
		'utf-8',
	);
	// Same payload, re-saved the way a Windows editor would.
	fs.writeFileSync(
		path.join(workDir, 'bom.json'),
		'﻿' + JSON.stringify([claudeConversation('BOM付き', 'c')]),
		'utf-8',
	);
	fs.writeFileSync(path.join(workDir, 'notes.txt'), 'not a conversation', 'utf-8');
});

afterAll(async () => {
	// Wait for each server to actually exit. kill() only signals, and on Windows
	// the files a live process still holds cannot be removed.
	await Promise.all(
		running.map(
			(child) =>
				new Promise<void>((resolve) => {
					if (child.exitCode !== null || child.signalCode !== null) {
						resolve();
						return;
					}
					child.once('exit', () => resolve());
					child.kill();
				}),
		),
	);

	if (workDir) {
		// Windows can still report EBUSY briefly after a process exits.
		fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
	}
});

describe('command line handling', () => {
	it('prints help and exits successfully', () => {
		const result = runCli(['--help']);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('USAGE:');
		expect(result.stdout).toContain('--export');
		expect(result.stdout).toContain('--port');
	});

	it('rejects an unknown option', () => {
		const result = runCli(['--nope']);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('Unknown option');
	});

	it('rejects a missing file', () => {
		const result = runCli(['does-not-exist.json']);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('File not found');
	});

	it('rejects an unsupported extension', () => {
		const result = runCli([fixturePath('notes.txt')]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('Unsupported file type');
	});

	it('rejects an out-of-range port', () => {
		const result = runCli(['--port', '99999', fixturePath('会話ログ.json')]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('--port must be an integer');
	});

	it('requires a file when exporting', () => {
		const result = runCli(['--export', fixturePath('out-unused')]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('File path is required');
	});
});

describe('export', () => {
	it('writes one file per conversation', () => {
		const outDir = fixturePath('out-markdown');
		const result = runCli(['--export', outDir, fixturePath('会話ログ.json')]);

		expect(result.status).toBe(0);
		expect(fs.readdirSync(outDir).sort()).toEqual(['second.md', '日本語タイトル.md']);
	});

	it('reads a file saved with a UTF-8 BOM', () => {
		const outDir = fixturePath('out-bom');
		const result = runCli(['--export', outDir, fixturePath('bom.json')]);

		expect(result.status).toBe(0);
		expect(fs.readdirSync(outDir)).toEqual(['BOM付き.md']);
	});

	it('exports ChatGPT conversations as YAML with id filenames', () => {
		const outDir = fixturePath('out-yaml');
		const result = runCli([
			'--export',
			outDir,
			'--export-format',
			'yaml',
			'--filename-format',
			'id',
			fixturePath('chatgpt.json'),
		]);

		expect(result.status).toBe(0);
		expect(fs.readdirSync(outDir)).toEqual(['gpt-1.yaml']);
	});

	it('refuses a data type it cannot export', () => {
		fs.writeFileSync(fixturePath('plain.json'), JSON.stringify({ hello: 'world' }), 'utf-8');
		const result = runCli(['--export', fixturePath('out-plain'), fixturePath('plain.json')]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain('Unsupported data type for export');
	});
});

describe('viewer server', () => {
	let port: number;

	beforeAll(async () => {
		({ port } = await startServer([fixturePath('会話ログ.json')]));
	});

	it('serves the application shell', async () => {
		const response = await fetch(`http://127.0.0.1:${port}/`);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
	});

	it('does not send CORS headers', async () => {
		const response = await fetch(`http://127.0.0.1:${port}/`, {
			headers: { Origin: 'https://example.invalid' },
		});
		expect(response.headers.get('access-control-allow-origin')).toBeNull();
	});

	it('does not serve files outside the web root', async () => {
		// dist/cli.js sits one level above the web root; its shebang is a marker
		// that would only appear if traversal succeeded.
		for (const attempt of ['/../cli.js', '/..%2fcli.js', '/static/../../cli.js', '/%2e%2e/cli.js']) {
			const response = await fetch(`http://127.0.0.1:${port}${attempt}`);
			const body = await response.text();
			expect(body).not.toContain('#!/usr/bin/env node');
		}
	});

	it('returns 404 for a missing build asset', async () => {
		const response = await fetch(`http://127.0.0.1:${port}/static/js/missing.js`);
		expect(response.status).toBe(404);
	});

	it('falls back to the shell for client-side routes', async () => {
		const response = await fetch(`http://127.0.0.1:${port}/about`);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
	});

	it('serves the conversation file verbatim with a percent-encoded name', async () => {
		const response = await fetch(`http://127.0.0.1:${port}/api/file`);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');

		const encodedName = response.headers.get('x-filename');
		expect(encodedName).not.toBeNull();
		expect(decodeURIComponent(encodedName as string)).toBe('会話ログ.json');

		const body = await response.text();
		expect(body).toBe(fs.readFileSync(fixturePath('会話ログ.json'), 'utf-8'));
		expect(JSON.parse(body)).toHaveLength(2);
	});
});

describe('port selection', () => {
	it('moves to the next free port when the default is taken', async () => {
		const first = await startServer(['--port', '8555', fixturePath('会話ログ.json')]);
		expect(first.port).toBe(8555);

		// Without --port the CLI probes upwards from its default; starting from an
		// occupied explicit port is not possible, so a second default-port server
		// is used to prove the probing works.
		const second = await startServer([fixturePath('会話ログ.json')]);
		const third = await startServer([fixturePath('会話ログ.json')]);
		expect(third.port).toBeGreaterThan(second.port);
	});

	it('fails with a clear message when an explicit port is taken', async () => {
		const server = await startServer(['--port', '8556', fixturePath('会話ログ.json')]);
		expect(server.port).toBe(8556);

		const result = runCli(['--port', '8556', fixturePath('会話ログ.json')]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('Port 8556 is already in use');
	});
});

describe('published package', () => {
	const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));

	it('declares no runtime dependencies', () => {
		// Everything the CLI needs is bundled into dist/cli.js.
		expect(pkg.dependencies ?? {}).toEqual({});
	});

	it('points bin at the built bundle', () => {
		expect(pkg.bin.skimalens).toBe('dist/cli.js');
		expect(fs.existsSync(path.join(rootDir, pkg.bin.skimalens))).toBe(true);
	});

	it('ships the web assets the server needs', () => {
		expect(pkg.files).toContain('dist/**/*');
	});
});
