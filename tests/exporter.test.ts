import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { ConversationExporter, type ExportFormat, type FilenameFormat } from '../bin/exporter';
import { chatgptConversation, claudeConversation } from './fixtures';

let outputDir: string;

beforeEach(() => {
	outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skimalens-export-'));
	// The exporter narrates progress; keep the test output readable.
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	fs.rmSync(outputDir, { recursive: true, force: true });
	vi.restoreAllMocks();
});

function exporterFor(
	exportFormat: ExportFormat = 'markdown',
	filenameFormat: FilenameFormat = 'title',
) {
	// Most filename tests exercise the sanitiser, which is easiest to read with
	// titles; the "id" default of the CLI is covered separately below.
	return new ConversationExporter({ outputDir, filenameFormat, exportFormat });
}

function writtenFiles(): string[] {
	return fs.readdirSync(outputDir).sort();
}

describe('filename generation', () => {
	it('appends a counter instead of overwriting conversations with the same title', async () => {
		const data = [
			claudeConversation('同じタイトル', 'a'),
			claudeConversation('同じタイトル', 'b'),
			claudeConversation('同じタイトル', 'c'),
		];

		const result = await exporterFor().export(data, 'claude-conversation');

		expect(result.exported).toBe(3);
		expect(result.failed).toEqual([]);
		expect(writtenFiles()).toEqual(['同じタイトル-2.md', '同じタイトル-3.md', '同じタイトル.md']);
	});

	it('treats names differing only in case as colliding', async () => {
		const data = [claudeConversation('Report', 'a'), claudeConversation('report', 'b')];

		await exporterFor().export(data, 'claude-conversation');

		expect(writtenFiles()).toEqual(['Report.md', 'report-2.md']);
	});

	it('truncates long multi-byte titles within both the character and byte budget', async () => {
		const title = 'あ'.repeat(250);

		const result = await exporterFor().export(
			[claudeConversation(title, 'a')],
			'claude-conversation',
		);

		expect(result.failed).toEqual([]);
		const [written] = writtenFiles();
		const stem = written.replace(/\.md$/, '');
		expect(Array.from(stem).length).toBeLessThanOrEqual(80);
		// 255 bytes is the per-name limit on ext4/APFS/NTFS.
		expect(Buffer.byteLength(written, 'utf-8')).toBeLessThanOrEqual(255);
		expect(stem.startsWith('あああ')).toBe(true);
	});

	it('truncates long ASCII titles at the character budget', async () => {
		const title = 'a'.repeat(250);

		await exporterFor().export([claudeConversation(title, 'a')], 'claude-conversation');

		const [written] = writtenFiles();
		expect(written).toBe(`${'a'.repeat(80)}.md`);
	});

	it('escapes Windows reserved device names', async () => {
		const data = [
			claudeConversation('CON', 'a'),
			claudeConversation('aux', 'b'),
			claudeConversation('COM1', 'c'),
			claudeConversation('NUL', 'd'),
		];

		await exporterFor().export(data, 'claude-conversation');

		expect(writtenFiles()).toEqual(['_aux.md', '_COM1.md', '_CON.md', '_NUL.md'].sort());
	});

	it('leaves names that merely start with a reserved word alone', async () => {
		await exporterFor().export([claudeConversation('CONFIG', 'a')], 'claude-conversation');
		expect(writtenFiles()).toEqual(['CONFIG.md']);
	});

	it('strips characters that are invalid on Windows', async () => {
		await exporterFor().export(
			[claudeConversation('a/b\\c:d*e?f"g<h>i|j', 'a')],
			'claude-conversation',
		);

		const [written] = writtenFiles();
		expect(written).toBe('a-b-c-d-e-f-g-h-i-j.md');
	});

	it('removes trailing dots and spaces that Windows would drop', async () => {
		await exporterFor().export([claudeConversation('report. ', 'a')], 'claude-conversation');
		expect(writtenFiles()).toEqual(['report.md']);
	});

	it('falls back to the conversation id when the title is empty', async () => {
		// Deleted Claude conversations keep an empty name.
		const data = [claudeConversation('', 'uuid-1'), claudeConversation('---', 'uuid-2')];

		await exporterFor().export(data, 'claude-conversation');

		expect(writtenFiles()).toEqual(['uuid-1.md', 'uuid-2.md']);
	});

	it('falls back to untitled when neither title nor id is usable', async () => {
		await exporterFor().export([claudeConversation('', '')], 'claude-conversation');
		expect(writtenFiles()).toEqual(['untitled.md']);
	});

	it('falls back to the title when the conversation has no id', async () => {
		const conversation = chatgptConversation('タイトルのみ', '');

		await exporterFor('markdown', 'id').export([conversation], 'chatgpt-conversation');

		expect(writtenFiles()).toEqual(['タイトルのみ.md']);
	});

	it('uses the conversation id when filenameFormat is id', async () => {
		await exporterFor('markdown', 'id').export(
			[claudeConversation('タイトル', 'uuid-1234')],
			'claude-conversation',
		);

		expect(writtenFiles()).toEqual(['uuid-1234.md']);
	});

	it('keeps ids of different conversations apart even when titles collide', async () => {
		const data = [
			claudeConversation('設計メモ', 'uuid-jan'),
			claudeConversation('設計メモ', 'uuid-feb'),
		];

		await exporterFor('markdown', 'id').export(data, 'claude-conversation');

		expect(writtenFiles()).toEqual(['uuid-feb.md', 'uuid-jan.md']);
	});
});

describe('export formats', () => {
	it('writes markdown containing the conversation and its messages', async () => {
		const conversation = claudeConversation('会話', 'a', [
			{ text: 'こんにちは', sender: 'human' },
			{ text: 'どうも', sender: 'assistant' },
		]);

		await exporterFor('markdown').export([conversation], 'claude-conversation');

		const content = fs.readFileSync(path.join(outputDir, '会話.md'), 'utf-8');
		expect(content).toContain('# 会話');
		expect(content).toContain('**ID:** a');
		expect(content).toContain('## Human');
		expect(content).toContain('こんにちは');
		expect(content).toContain('## Assistant');
		expect(content).toContain('どうも');
	});

	it('writes parseable JSON', async () => {
		await exporterFor('json').export(
			[claudeConversation('データ', 'a')],
			'claude-conversation',
		);

		const parsed = JSON.parse(fs.readFileSync(path.join(outputDir, 'データ.json'), 'utf-8'));
		expect(parsed.uuid).toBe('a');
		expect(parsed.name).toBe('データ');
	});

	it('writes parseable YAML', async () => {
		await exporterFor('yaml').export(
			[claudeConversation('データ', 'a')],
			'claude-conversation',
		);

		const parsed = yamlLoad(
			fs.readFileSync(path.join(outputDir, 'データ.yaml'), 'utf-8'),
		) as Record<string, unknown>;
		expect(parsed.uuid).toBe('a');
	});

	it('exports ChatGPT conversations with messages in chronological order', async () => {
		const conversation = chatgptConversation('ChatGPT会話', 'gpt-1', {
			second: { role: 'assistant', text: 'answer', create_time: 200 },
			first: { role: 'user', text: 'question', create_time: 100 },
		});

		await exporterFor().export([conversation], 'chatgpt-conversation');

		const content = fs.readFileSync(path.join(outputDir, 'ChatGPT会話.md'), 'utf-8');
		expect(content).toContain('# ChatGPT会話');
		expect(content.indexOf('question')).toBeLessThan(content.indexOf('answer'));
	});
});

describe('error handling', () => {
	it('continues after a failure and reports it', async () => {
		// A directory occupying the target name makes exactly one write fail.
		fs.mkdirSync(path.join(outputDir, 'blocked.md'));

		const data = [
			claudeConversation('first', 'a'),
			claudeConversation('blocked', 'b'),
			claudeConversation('last', 'c'),
		];

		const result = await exporterFor().export(data, 'claude-conversation');

		expect(result.exported).toBe(2);
		expect(result.failed).toHaveLength(1);
		expect(result.failed[0].title).toBe('blocked');
		expect(writtenFiles()).toContain('first.md');
		expect(writtenFiles()).toContain('last.md');
	});

	it('rejects an output destination that is a file', async () => {
		const filePath = path.join(outputDir, 'not-a-dir');
		fs.writeFileSync(filePath, 'x');

		const exporter = new ConversationExporter({
			outputDir: filePath,
			filenameFormat: 'title',
			exportFormat: 'markdown',
		});

		await expect(exporter.export([claudeConversation('a')], 'claude-conversation')).rejects.toThrow(
			/not a directory/,
		);
	});

	it('creates the output directory when it does not exist', async () => {
		const nested = path.join(outputDir, 'a', 'b', 'c');

		const exporter = new ConversationExporter({
			outputDir: nested,
			filenameFormat: 'title',
			exportFormat: 'markdown',
		});
		await exporter.export([claudeConversation('nested', 'a')], 'claude-conversation');

		expect(fs.existsSync(path.join(nested, 'nested.md'))).toBe(true);
	});

	it('rejects unsupported data types', async () => {
		await expect(exporterFor().export({}, 'generic-json')).rejects.toThrow(
			/Unsupported data type/,
		);
	});

	it('starts each run with a fresh set of used filenames', async () => {
		const exporter = exporterFor();
		await exporter.export([claudeConversation('reused', 'a')], 'claude-conversation');
		await exporter.export([claudeConversation('reused', 'b')], 'claude-conversation');

		// The second run overwrites rather than producing "reused-2.md".
		expect(writtenFiles()).toEqual(['reused.md']);
	});
});
