export interface FileUploadResult {
  filename: string;
  content: string;
  type: 'json' | 'yaml';
  size: number;
  lastModified: Date;
}

export interface ParsedData {
  raw: unknown;
  type: DataType;
  metadata: DataMetadata;
}

export interface DataMetadata {
  filename: string;
  fileSize: number;
  parseTime: Date;
  recordCount?: number;
  estimatedType: DataType;
}

export type DataType = 
  | 'claude-conversation'
  | 'chatgpt-conversation'
  | 'cloudwatch-logs'
  | 'generic-json'
  | 'generic-yaml'
  | 'unknown';

export interface ClaudeConversation {
  uuid: string;
  name: string;
  created_at: string;
  updated_at: string;
  account?: {
    uuid: string;
  };
  chat_messages: ClaudeChatMessage[];
}

export interface ClaudeChatMessage {
  uuid: string;
  text: string;
  content?: MessageContent[];
  sender: 'human' | 'assistant';
  created_at: string;
  updated_at: string;
  attachments?: MessageAttachment[];
  files?: MessageFile[];
  chat_feedback?: ChatFeedback;
}

export interface MessageContent {
  start_timestamp: string;
  stop_timestamp: string;
  type: 'text' | 'thinking';
  text?: string;
  thinking?: string;
  summaries?: { summary: string }[];
  cut_off?: boolean;
  citations?: unknown[];
}

export interface MessageFile {
  file_name: string;
  file_type: string;
  file_size: number;
  extracted_content?: string;
}

export interface ChatFeedback {
  uuid: string;
  type: 'good' | 'bad';
  reason?: string;
  created_at: string;
}

export interface MessageAttachment {
  file_name: string;
  file_type: string;
  file_size: number;
  extracted_content?: string;
}

export type ClaudeConversations = ClaudeConversation[];

// ChatGPT conversation types
export interface ChatGPTConversation {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: { [key: string]: ChatGPTMappingNode };
  conversation_id?: string;
  current_node?: string;
  gizmo_id?: string;
  is_archived?: boolean;
}

export interface ChatGPTMappingNode {
  id: string;
  message: ChatGPTMessage | null;
  parent: string | null;
  children: string[];
}

export interface ChatGPTMessage {
  id: string;
  author: {
    role: 'user' | 'assistant' | 'system';
    name?: string;
    metadata?: Record<string, unknown>;
  };
  create_time: number | null;
  update_time?: number | null;
  content?: {
    content_type: 'text';
    parts: (string | null | undefined)[];
  };
  status: string;
  end_turn?: boolean | null;
  weight: number;
  metadata?: Record<string, unknown>;
  recipient: string;
}

export type ChatGPTConversations = ChatGPTConversation[];

export interface ConversationView {
  conversation: ClaudeConversation;
  filteredMessages: ClaudeChatMessage[];
  searchQuery?: string;
  selectedMessageId?: string;
}

export interface ChatGPTConversationView {
  conversation: ChatGPTConversation;
  filteredMessages: ChatGPTMessage[];
  searchQuery?: string;
  selectedMessageId?: string;
}

export interface ConversationsView {
  conversations: ClaudeConversations;
  selectedConversationId?: string;
  searchQuery?: string;
}

export interface ChatGPTConversationsView {
  conversations: ChatGPTConversations;
  selectedConversationId?: string;
  searchQuery?: string;
}