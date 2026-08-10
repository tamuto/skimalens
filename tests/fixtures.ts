import type { ChatGPTConversation, ClaudeConversation } from '../src/types/data';

export function claudeConversation(
	name: string,
	uuid = 'conversation-uuid',
	messages: Partial<ClaudeConversation['chat_messages'][number]>[] = [],
): ClaudeConversation {
	return {
		uuid,
		name,
		created_at: '2025-01-02T03:04:05Z',
		updated_at: '2025-01-02T03:04:06Z',
		chat_messages: (messages.length > 0 ? messages : [{}]).map((message, index) => ({
			uuid: `message-${index}`,
			text: 'hello',
			sender: 'human' as const,
			created_at: '2025-01-02T03:04:05Z',
			updated_at: '2025-01-02T03:04:05Z',
			...message,
		})),
	};
}

export function chatgptConversation(
	title: string,
	id = 'conversation-id',
	nodes: Record<string, { role: string; text: string; create_time: number | null }> = {
		a: { role: 'user', text: 'question', create_time: 1000 },
		b: { role: 'assistant', text: 'answer', create_time: 2000 },
	},
): ChatGPTConversation {
	const mapping: ChatGPTConversation['mapping'] = {};

	for (const [key, node] of Object.entries(nodes)) {
		mapping[key] = {
			id: key,
			message: {
				id: key,
				author: { role: node.role as 'user' | 'assistant' | 'system' },
				create_time: node.create_time,
				content: { content_type: 'text', parts: [node.text] },
				status: 'finished_successfully',
				weight: 1,
				recipient: 'all',
				metadata: {},
			},
			parent: null,
			children: [],
		};
	}

	return {
		id,
		title,
		create_time: 1000,
		update_time: 2000,
		mapping,
	};
}
