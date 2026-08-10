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

export interface ExportFailure {
  title: string;
  error: string;
}

export interface ExportResult {
  exported: number;
  failed: ExportFailure[];
}

/**
 * Upper bound on the base name of an exported file.
 *
 * - Characters: Windows resolves paths against a 260 character limit unless long
 *   paths are enabled, and the output directory consumes part of that budget.
 * - Bytes: ext4/APFS/NTFS cap a single name at 255 bytes, and Japanese titles
 *   cost three bytes per character, so a character limit alone is not enough.
 */
const MAX_BASENAME_CHARS = 80;
const MAX_BASENAME_BYTES = 200;

/** Used when neither the conversation title nor its id yields a usable name. */
const UNTITLED = 'untitled';

/** Device names that cannot be used as a file name on Windows. */
const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

export class ConversationExporter {
  private options: ExportOptions;
  /** Lower-cased names already written, so titles that collide get a suffix. */
  private usedFilenames = new Set<string>();

  constructor(options: ExportOptions) {
    this.options = options;
  }

  /**
   * Export conversations to the configured output directory.
   *
   * A conversation that cannot be written is recorded and the run continues, so
   * one bad title never costs the caller the remaining conversations.
   */
  async export(data: unknown, dataType: string): Promise<ExportResult> {
    this.ensureDirectory(this.options.outputDir);
    this.usedFilenames.clear();

    if (dataType === 'claude-conversation') {
      return this.exportClaudeData(data);
    }
    if (dataType === 'chatgpt-conversation') {
      return this.exportChatGPTData(data);
    }
    throw new Error(`Unsupported data type for export: ${dataType}`);
  }

  private async exportClaudeData(data: unknown): Promise<ExportResult> {
    const validated = DataParser.validateClaudeConversation(data);
    const conversations: ClaudeConversations = Array.isArray(validated)
      ? validated as ClaudeConversations
      : [validated as ClaudeConversation];

    console.log(`Exporting ${conversations.length} Claude conversation(s) as ${this.options.exportFormat.toUpperCase()}...`);

    return this.writeAll(
      conversations,
      (conversation) => conversation.name,
      (conversation) => conversation.uuid,
      (conversation) => this.convertClaudeToMarkdown(conversation)
    );
  }

  private async exportChatGPTData(data: unknown): Promise<ExportResult> {
    const validated = DataParser.validateChatGPTConversation(data);
    const conversations: ChatGPTConversations = Array.isArray(validated)
      ? validated as ChatGPTConversations
      : [validated as ChatGPTConversation];

    console.log(`Exporting ${conversations.length} ChatGPT conversation(s) as ${this.options.exportFormat.toUpperCase()}...`);

    return this.writeAll(
      conversations,
      (conversation) => conversation.title,
      (conversation) => conversation.id,
      (conversation) => this.convertChatGPTToMarkdown(conversation)
    );
  }

  private writeAll<T>(
    conversations: T[],
    getTitle: (conversation: T) => string,
    getId: (conversation: T) => string,
    toMarkdown: (conversation: T) => string
  ): ExportResult {
    const result: ExportResult = { exported: 0, failed: [] };

    for (const conversation of conversations) {
      const title = getTitle(conversation);
      let filename = '';

      try {
        filename = this.generateFilename(title, getId(conversation));

        let content: string;
        switch (this.options.exportFormat) {
          case 'markdown':
            content = toMarkdown(conversation);
            break;
          case 'json':
            content = JSON.stringify(conversation, null, 2);
            break;
          case 'yaml':
            content = yamlDump(conversation, { indent: 2, lineWidth: -1 });
            break;
        }

        fs.writeFileSync(path.join(this.options.outputDir, filename), content, 'utf-8');
        console.log(`  ✓ Exported: ${filename}`);
        result.exported += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ✗ Failed: ${filename || title}: ${message}`);
        result.failed.push({ title: title || '(untitled)', error: message });
      }
    }

    return result;
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

  private generateFilename(title: string, id: string): string {
    const extension = this.options.exportFormat === 'markdown' ? 'md' : this.options.exportFormat;

    // The preferred field is not guaranteed to yield a usable name: ChatGPT
    // exports are only recognised by title/create_time/mapping, a deleted Claude
    // conversation carries an empty name, and a title of "---" sanitises to
    // nothing. Falling back to the other field keeps such conversations
    // distinguishable instead of collapsing them all into "untitled".
    const ordered = this.options.filenameFormat === 'id' ? [id, title] : [title, id];
    const baseName =
      ordered.map((value) => this.sanitizeFilename(value)).find((value) => value !== '') ??
      UNTITLED;

    return this.deduplicate(baseName, extension);
  }

  /**
   * Append a counter until the name is unused. Comparison is case-insensitive
   * because Windows and macOS treat "Title.md" and "title.md" as one file.
   */
  private deduplicate(baseName: string, extension: string): string {
    let candidate = `${baseName}.${extension}`;
    let counter = 2;

    while (this.usedFilenames.has(candidate.toLowerCase())) {
      candidate = `${baseName}-${counter}.${extension}`;
      counter += 1;
    }

    this.usedFilenames.add(candidate.toLowerCase());
    return candidate;
  }

  /** Returns a usable file name, or an empty string when nothing survives. */
  private sanitizeFilename(name: string): string {
    if (typeof name !== 'string') {
      return '';
    }

    // Replace characters that are invalid on Windows (and control characters)
    let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');

    // Replace multiple consecutive dashes/spaces with single dash
    sanitized = sanitized.replace(/[-\s]+/g, '-');

    // Remove leading/trailing dashes and spaces
    sanitized = sanitized.trim().replace(/^-+|-+$/g, '');

    sanitized = this.truncate(sanitized);

    // Windows silently drops trailing dots and spaces, which would make the
    // written name differ from the reported one.
    sanitized = sanitized.replace(/[. ]+$/, '');

    // The caller decides what to do with an unusable name.
    if (!sanitized) {
      return '';
    }

    // A reserved device name is rejected by Windows even with an extension.
    const stem = sanitized.split('.')[0].toUpperCase();
    if (WINDOWS_RESERVED_NAMES.has(stem)) {
      sanitized = `_${sanitized}`;
    }

    return sanitized;
  }

  /** Truncate to both a character and a byte budget without splitting characters. */
  private truncate(name: string): string {
    if (name.length <= MAX_BASENAME_CHARS && Buffer.byteLength(name, 'utf-8') <= MAX_BASENAME_BYTES) {
      return name;
    }

    let result = '';
    let chars = 0;
    let bytes = 0;

    // Iterating the string yields whole code points, so surrogate pairs stay intact.
    for (const char of name) {
      const charBytes = Buffer.byteLength(char, 'utf-8');
      if (chars + 1 > MAX_BASENAME_CHARS || bytes + charBytes > MAX_BASENAME_BYTES) {
        break;
      }
      result += char;
      chars += 1;
      bytes += charBytes;
    }

    return result;
  }

  private ensureDirectory(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      if (!fs.statSync(dirPath).isDirectory()) {
        throw new Error(`Export destination is not a directory: ${path.resolve(dirPath)}`);
      }
      return;
    }

    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }
    return this.formatDateObject(date);
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    if (Number.isNaN(date.getTime())) {
      return String(timestamp);
    }
    return this.formatDateObject(date);
  }

  private formatDateObject(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
