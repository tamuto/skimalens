import { load as yamlLoad } from 'js-yaml';
import type { 
  FileUploadResult, 
  ParsedData, 
  DataType, 
  ClaudeConversation,
  ClaudeConversations,
  DataMetadata 
} from '@/types/data';

export class DataParser {
  static async parseFile(file: File): Promise<FileUploadResult> {
    const content = await this.readFileContent(file);
    const type = this.determineFileType(file.name, content);
    
    return {
      filename: file.name,
      content,
      type,
      size: file.size,
      lastModified: new Date(file.lastModified)
    };
  }

  private static async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private static determineFileType(filename: string, content: string): 'json' | 'yaml' {
    if (filename.toLowerCase().endsWith('.json')) return 'json';
    if (filename.toLowerCase().endsWith('.yaml') || filename.toLowerCase().endsWith('.yml')) return 'yaml';
    
    // Content-based detection
    try {
      JSON.parse(content);
      return 'json';
    } catch {
      try {
        yamlLoad(content);
        return 'yaml';
      } catch {
        return 'json'; // Default fallback
      }
    }
  }

  static parseData(uploadResult: FileUploadResult): ParsedData {
    const startTime = new Date();
    let parsed: unknown;

    try {
      if (uploadResult.type === 'json') {
        parsed = JSON.parse(uploadResult.content);
      } else {
        parsed = yamlLoad(uploadResult.content);
      }
    } catch (error) {
      throw new Error(`Failed to parse ${uploadResult.type.toUpperCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const dataType = this.detectDataType(parsed, uploadResult.filename);
    const metadata: DataMetadata = {
      filename: uploadResult.filename,
      fileSize: uploadResult.size,
      parseTime: startTime,
      estimatedType: dataType,
      recordCount: this.estimateRecordCount(parsed, dataType)
    };

    return {
      raw: parsed,
      type: dataType,
      metadata
    };
  }

  private static detectDataType(data: unknown, filename: string): DataType {
    if (!data || typeof data !== 'object') return 'unknown';

    // Claude conversation detection (single conversation)
    if (this.isClaudeConversation(data)) {
      return 'claude-conversation';
    }

    // Claude conversations detection (array of conversations)
    if (this.isClaudeConversations(data)) {
      return 'claude-conversation';
    }

    // Additional Claude conversation detection by structure
    if (this.looksLikeClaudeConversation(data)) {
      return 'claude-conversation';
    }

    // Check filename hints (only if not Claude format)
    if (filename.toLowerCase().includes('chatgpt') || 
        (filename.toLowerCase().includes('conversation') && !filename.toLowerCase().includes('claude'))) {
      return 'chatgpt-conversation';
    }

    if (filename.toLowerCase().includes('cloudwatch') || filename.toLowerCase().includes('log')) {
      return 'cloudwatch-logs';
    }

    // Generic detection
    if (Array.isArray(data)) {
      return 'generic-json';
    }
    return 'generic-json';
  }

  private static isClaudeConversation(data: unknown): data is ClaudeConversation {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.uuid === 'string' &&
      typeof obj.name === 'string' &&
      Array.isArray(obj.chat_messages) &&
      obj.chat_messages.length > 0 &&
      obj.chat_messages.every((msg: unknown) => 
        typeof msg === 'object' && 
        msg !== null && 
        'uuid' in msg && 
        'text' in msg && 
        'sender' in msg
      )
    );
  }

  private static isClaudeConversations(data: unknown): data is ClaudeConversations {
    if (!Array.isArray(data) || data.length === 0) return false;
    
    // Check if all items look like Claude conversations
    return data.every((item) => this.isClaudeConversation(item) || this.looksLikeClaudeConversation(item));
  }

  private static looksLikeClaudeConversation(data: unknown): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    
    const obj = data as Record<string, unknown>;
    
    // Check for Claude-specific fields
    const hasClaudeFields = (
      'chat_messages' in obj &&
      'uuid' in obj &&
      'name' in obj &&
      'created_at' in obj &&
      'updated_at' in obj
    );

    // Check if messages have Claude-specific structure
    if (Array.isArray(obj.chat_messages) && obj.chat_messages.length > 0) {
      const firstMessage = obj.chat_messages[0];
      if (typeof firstMessage === 'object' && firstMessage !== null) {
        const msg = firstMessage as Record<string, unknown>;
        const hasClaudeMessageFields = (
          'uuid' in msg &&
          'sender' in msg &&
          'text' in msg &&
          'created_at' in msg
        );
        return hasClaudeFields && hasClaudeMessageFields;
      }
    }

    return hasClaudeFields;
  }

  private static estimateRecordCount(data: unknown, dataType: DataType): number | undefined {
    if (dataType === 'claude-conversation') {
      if (this.isClaudeConversation(data)) {
        return data.chat_messages.length;
      }
      if (this.isClaudeConversations(data)) {
        return data.reduce((total, conv) => total + conv.chat_messages.length, 0);
      }
    }
    
    if (Array.isArray(data)) {
      return data.length;
    }

    return undefined;
  }

  static validateClaudeConversation(data: unknown): ClaudeConversation | ClaudeConversations {
    if (this.isClaudeConversation(data)) {
      return data;
    }
    if (this.isClaudeConversations(data)) {
      return data;
    }
    throw new Error('Invalid Claude conversation format');
  }
}