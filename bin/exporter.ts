import * as fs from 'fs';
import * as path from 'path';
import { dump as yamlDump } from 'js-yaml';
import type {
  ClaudeConversation,
  ClaudeConversations,
  ChatGPTConversation,
  ChatGPTConversations,
  ClaudeChatMessage,
  ChatGPTMessage
} from '../src/types/data';
import { DataParser } from '../src/lib/parser';

export type FilenameFormat = 'title' | 'id';
export type ExportFormat = 'markdown' | 'json' | 'yaml';

export interface ExportOptions {
  outputDir: string;
  filenameFormat: FilenameFormat;
  exportFormat: ExportFormat;
}

export class MarkdownExporter {
  private options: ExportOptions;

  constructor(options: ExportOptions) {
    this.options = options;
  }

  /**
   * Export conversations to Markdown files
   */
  async export(data: unknown, dataType: string): Promise<void> {
    this.ensureDirectory(this.options.outputDir);

    if (dataType === 'claude-conversation') {
      await this.exportClaudeData(data);
    } else if (dataType === 'chatgpt-conversation') {
      await this.exportChatGPTData(data);
    } else {
      throw new Error(`Unsupported data type for export: ${dataType}`);
    }
  }

  private async exportClaudeData(data: unknown): Promise<void> {
    const validated = DataParser.validateClaudeConversation(data);

    if (Array.isArray(validated)) {
      // Multiple conversations
      const conversations = validated as ClaudeConversations;
      console.log(`Exporting ${conversations.length} Claude conversations as ${this.options.exportFormat.toUpperCase()}...`);

      for (const conversation of conversations) {
        this.exportSingleClaudeConversation(conversation);
      }
    } else {
      // Single conversation
      const conversation = validated as ClaudeConversation;
      console.log(`Exporting Claude conversation as ${this.options.exportFormat.toUpperCase()}...`);
      this.exportSingleClaudeConversation(conversation);
    }
  }

  private exportSingleClaudeConversation(conversation: ClaudeConversation): void {
    const filename = this.generateFilename(
      conversation.name,
      conversation.uuid,
      this.options.filenameFormat,
      this.options.exportFormat
    );

    let content: string;
    switch (this.options.exportFormat) {
      case 'markdown':
        content = this.convertClaudeToMarkdown(conversation);
        break;
      case 'json':
        content = JSON.stringify(conversation, null, 2);
        break;
      case 'yaml':
        content = yamlDump(conversation, { indent: 2, lineWidth: -1 });
        break;
    }

    const filePath = path.join(this.options.outputDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✓ Exported: ${filename}`);
  }

  private async exportChatGPTData(data: unknown): Promise<void> {
    const validated = DataParser.validateChatGPTConversation(data);

    if (Array.isArray(validated)) {
      // Multiple conversations
      const conversations = validated as ChatGPTConversations;
      console.log(`Exporting ${conversations.length} ChatGPT conversations as ${this.options.exportFormat.toUpperCase()}...`);

      for (const conversation of conversations) {
        this.exportSingleChatGPTConversation(conversation);
      }
    } else {
      // Single conversation
      const conversation = validated as ChatGPTConversation;
      console.log(`Exporting ChatGPT conversation as ${this.options.exportFormat.toUpperCase()}...`);
      this.exportSingleChatGPTConversation(conversation);
    }
  }

  private exportSingleChatGPTConversation(conversation: ChatGPTConversation): void {
    const filename = this.generateFilename(
      conversation.title,
      conversation.id,
      this.options.filenameFormat,
      this.options.exportFormat
    );

    let content: string;
    switch (this.options.exportFormat) {
      case 'markdown':
        content = this.convertChatGPTToMarkdown(conversation);
        break;
      case 'json':
        content = JSON.stringify(conversation, null, 2);
        break;
      case 'yaml':
        content = yamlDump(conversation, { indent: 2, lineWidth: -1 });
        break;
    }

    const filePath = path.join(this.options.outputDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✓ Exported: ${filename}`);
  }

  private convertClaudeToMarkdown(conversation: ClaudeConversation): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${conversation.name}`);
    lines.push('');
    lines.push(`**Created:** ${this.formatDate(conversation.created_at)}`);
    lines.push(`**Updated:** ${this.formatDate(conversation.updated_at)}`);
    lines.push(`**ID:** ${conversation.uuid}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Messages
    for (const message of conversation.chat_messages) {
      lines.push(this.convertClaudeMessage(message));
      lines.push('');
    }

    return lines.join('\n');
  }

  private convertClaudeMessage(message: ClaudeChatMessage): string {
    const lines: string[] = [];
    const sender = message.sender === 'human' ? 'Human' : 'Assistant';

    // Message header
    lines.push(`## ${sender} (${this.formatDate(message.created_at)})`);
    lines.push('');

    // Main text content
    if (message.text) {
      lines.push(message.text);
      lines.push('');
    }

    // Content blocks (thinking, etc.)
    if (message.content && message.content.length > 0) {
      for (const content of message.content) {
        if (content.type === 'thinking' && content.thinking) {
          lines.push('### Thinking');
          lines.push('');
          lines.push(content.thinking);
          lines.push('');
        } else if (content.type === 'text' && content.text && content.text !== message.text) {
          lines.push(content.text);
          lines.push('');
        }
      }
    }

    // Attachments
    if (message.attachments && message.attachments.length > 0) {
      lines.push('**Attachments:**');
      for (const attachment of message.attachments) {
        lines.push(`- ${attachment.file_name} (${attachment.file_type}, ${this.formatFileSize(attachment.file_size)})`);
        if (attachment.extracted_content) {
          lines.push('  ```');
          lines.push(attachment.extracted_content);
          lines.push('  ```');
        }
      }
      lines.push('');
    }

    // Files
    if (message.files && message.files.length > 0) {
      lines.push('**Files:**');
      for (const file of message.files) {
        lines.push(`- ${file.file_name} (${file.file_type}, ${this.formatFileSize(file.file_size)})`);
        if (file.extracted_content) {
          lines.push('  ```');
          lines.push(file.extracted_content);
          lines.push('  ```');
        }
      }
      lines.push('');
    }

    // Feedback
    if (message.chat_feedback) {
      const emoji = message.chat_feedback.type === 'good' ? '👍' : '👎';
      lines.push(`**Feedback:** ${emoji} ${message.chat_feedback.type}`);
      if (message.chat_feedback.reason) {
        lines.push(`**Reason:** ${message.chat_feedback.reason}`);
      }
      lines.push('');
    }

    lines.push('---');

    return lines.join('\n');
  }

  private convertChatGPTToMarkdown(conversation: ChatGPTConversation): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${conversation.title}`);
    lines.push('');
    lines.push(`**Created:** ${this.formatTimestamp(conversation.create_time)}`);
    lines.push(`**Updated:** ${this.formatTimestamp(conversation.update_time)}`);
    lines.push(`**ID:** ${conversation.id}`);
    if (conversation.conversation_id) {
      lines.push(`**Conversation ID:** ${conversation.conversation_id}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // Extract and sort messages
    const messages = DataParser.extractChatGPTMessages(conversation);

    // Messages
    for (const message of messages) {
      lines.push(this.convertChatGPTMessage(message));
      lines.push('');
    }

    return lines.join('\n');
  }

  private convertChatGPTMessage(message: ChatGPTMessage): string {
    const lines: string[] = [];
    const role = message.author.role === 'user' ? 'User' : 'Assistant';

    // Message header
    const timestamp = message.create_time ? this.formatTimestamp(message.create_time) : 'Unknown';
    lines.push(`## ${role} (${timestamp})`);
    lines.push('');

    // Content
    if (message.content?.parts) {
      for (const part of message.content.parts) {
        if (typeof part === 'string' && part.trim()) {
          lines.push(part);
          lines.push('');
        }
      }
    }

    // Metadata if present
    if (message.metadata && Object.keys(message.metadata).length > 0) {
      const metadataStr = JSON.stringify(message.metadata, null, 2);
      if (metadataStr !== '{}') {
        lines.push('**Metadata:**');
        lines.push('```json');
        lines.push(metadataStr);
        lines.push('```');
        lines.push('');
      }
    }

    lines.push('---');

    return lines.join('\n');
  }

  private generateFilename(title: string, id: string, format: FilenameFormat, exportFormat: ExportFormat): string {
    const baseName = format === 'title' ? this.sanitizeFilename(title) : id;
    const extension = exportFormat === 'markdown' ? 'md' : exportFormat;
    return `${baseName}.${extension}`;
  }

  private sanitizeFilename(name: string): string {
    // Replace invalid filename characters
    let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');

    // Replace multiple consecutive dashes/spaces with single dash
    sanitized = sanitized.replace(/[-\s]+/g, '-');

    // Remove leading/trailing dashes and spaces
    sanitized = sanitized.trim().replace(/^-+|-+$/g, '');

    // Limit length to 200 characters
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200);
    }

    // Fallback to 'untitled' if empty
    if (!sanitized) {
      sanitized = 'untitled';
    }

    return sanitized;
  }

  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  }

  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return dateString;
    }
  }

  private formatTimestamp(timestamp: number): string {
    try {
      const date = new Date(timestamp * 1000);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return String(timestamp);
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
