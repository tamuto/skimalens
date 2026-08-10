import { describe, expect, it } from 'vitest';
import { DataParser, stripBom } from '../src/lib/parser';
import { chatgptConversation, claudeConversation } from './fixtures';

function upload(content: string, filename = 'conversations.json') {
	return {
		filename,
		content,
		type: filename.endsWith('.json') ? ('json' as const) : ('yaml' as const),
		size: Buffer.byteLength(content, 'utf-8'),
		lastModified: new Date(),
	};
}

describe('stripBom', () => {
	it('removes a leading UTF-8 BOM', () => {
		expect(stripBom('﻿{"a":1}')).toBe('{"a":1}');
	});

	it('leaves content without a BOM untouched', () => {
		expect(stripBom('{"a":1}')).toBe('{"a":1}');
		expect(stripBom('')).toBe('');
	});

	it('only removes the BOM at the start', () => {
		expect(stripBom('{"a":"﻿"}')).toBe('{"a":"﻿"}');
	});
});

describe('DataParser.parseData', () => {
	it('parses a file saved with a BOM', () => {
		const json = '﻿' + JSON.stringify([claudeConversation('BOM')]);
		expect(DataParser.parseData(upload(json)).type).toBe('claude-conversation');
	});

	it('detects a single Claude conversation', () => {
		const json = JSON.stringify(claudeConversation('single'));
		const parsed = DataParser.parseData(upload(json));
		expect(parsed.type).toBe('claude-conversation');
		expect(parsed.metadata.recordCount).toBe(1);
	});

	it('detects an array of Claude conversations and counts messages', () => {
		const json = JSON.stringify([
			claudeConversation('one', 'a', [{}, {}]),
			claudeConversation('two', 'b', [{}]),
		]);
		const parsed = DataParser.parseData(upload(json));
		expect(parsed.type).toBe('claude-conversation');
		expect(parsed.metadata.recordCount).toBe(3);
	});

	it('detects ChatGPT conversations', () => {
		const single = JSON.stringify(chatgptConversation('single'));
		expect(DataParser.parseData(upload(single)).type).toBe('chatgpt-conversation');

		const many = JSON.stringify([chatgptConversation('a', 'a'), chatgptConversation('b', 'b')]);
		expect(DataParser.parseData(upload(many)).type).toBe('chatgpt-conversation');
	});

	it('parses YAML input', () => {
		const yaml = [
			'uuid: abc',
			'name: YAML会話',
			"created_at: '2025-01-01T00:00:00Z'",
			"updated_at: '2025-01-01T00:00:00Z'",
			'chat_messages:',
			'  - uuid: m1',
			'    text: hello',
			'    sender: human',
			"    created_at: '2025-01-01T00:00:00Z'",
			"    updated_at: '2025-01-01T00:00:00Z'",
		].join('\n');
		expect(DataParser.parseData(upload(yaml, 'conversation.yaml')).type).toBe('claude-conversation');
	});

	it('falls back to generic-json for unrecognised shapes', () => {
		const parsed = DataParser.parseData(upload(JSON.stringify({ hello: 'world' }), 'data.json'));
		expect(parsed.type).toBe('generic-json');
	});

	it('reports the format in the error when parsing fails', () => {
		expect(() => DataParser.parseData(upload('{not json'))).toThrow(/Failed to parse JSON/);
	});
});

describe('DataParser validation', () => {
	it('rejects data that is not a Claude conversation', () => {
		expect(() => DataParser.validateClaudeConversation({ foo: 'bar' })).toThrow(
			/Invalid Claude conversation format/,
		);
	});

	it('rejects data that is not a ChatGPT conversation', () => {
		expect(() => DataParser.validateChatGPTConversation([{ foo: 'bar' }])).toThrow(
			/Invalid ChatGPT conversation format/,
		);
	});
});

describe('DataParser.extractChatGPTMessages', () => {
	it('sorts by create_time and drops system and empty messages', () => {
		const conversation = chatgptConversation('sorting', 'id', {
			later: { role: 'assistant', text: 'second', create_time: 200 },
			earlier: { role: 'user', text: 'first', create_time: 100 },
			system: { role: 'system', text: 'ignored', create_time: 50 },
			blank: { role: 'assistant', text: '   ', create_time: 300 },
		});

		const messages = DataParser.extractChatGPTMessages(conversation);

		expect(messages.map((message) => message.content?.parts[0])).toEqual(['first', 'second']);
	});

	it('returns an empty list when the mapping holds no usable messages', () => {
		const conversation = chatgptConversation('empty', 'id', {
			system: { role: 'system', text: 'ignored', create_time: 10 },
		});
		expect(DataParser.extractChatGPTMessages(conversation)).toEqual([]);
	});
});
