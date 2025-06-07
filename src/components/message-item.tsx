import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { User, Bot, Clock, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { ClaudeChatMessage, ChatGPTMessage } from '@/types/data';

interface MessageItemProps {
  message: ClaudeChatMessage | ChatGPTMessage;
  isSelected?: boolean;
  onClick?: () => void;
  messageType?: 'claude' | 'chatgpt';
}

export function MessageItem({ message, isSelected, onClick, messageType = 'claude' }: MessageItemProps) {
  // Determine if message is from human/user
  const isHuman = messageType === 'claude' 
    ? (message as ClaudeChatMessage).sender === 'human'
    : (message as ChatGPTMessage).author.role === 'user';
  
  // Get timestamp
  const timestamp = messageType === 'claude'
    ? new Date((message as ClaudeChatMessage).created_at).toLocaleString()
    : (message as ChatGPTMessage).create_time 
      ? new Date((message as ChatGPTMessage).create_time * 1000).toLocaleString()
      : 'Unknown time';
  
  // Get message text
  const messageText = messageType === 'claude'
    ? (message as ClaudeChatMessage).text
    : (message as ChatGPTMessage).content?.parts?.filter(part => typeof part === 'string').join('\n') || '[No content]';
  
  // Get message ID for selection
  const messageId = messageType === 'claude'
    ? (message as ClaudeChatMessage).uuid
    : (message as ChatGPTMessage).id;

  // Assistant name
  const assistantName = messageType === 'claude' ? 'Claude' : 'ChatGPT';

  return (
    <Card 
      className={`
        mb-4 cursor-pointer transition-all duration-200 hover:shadow-md
        ${isSelected ? 'ring-2 ring-primary' : ''}
        ${isHuman ? 'ml-8' : 'mr-8'}
      `}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`
            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
            ${isHuman ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}
          `}>
            {isHuman ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {isHuman ? 'User' : assistantName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {timestamp}
              </div>
            </div>
            
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {messageText || '[Empty message]'}
              </div>
            </div>

            {/* Only show attachments for Claude messages */}
            {messageType === 'claude' && (
              <>
                {(((message as ClaudeChatMessage).attachments && (message as ClaudeChatMessage).attachments!.length > 0) || 
                  ((message as ClaudeChatMessage).files && (message as ClaudeChatMessage).files!.length > 0)) && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Attachments:</div>
                    {(message as ClaudeChatMessage).attachments?.map((attachment, index) => (
                      <div key={`attachment-${index}`} className="text-xs bg-muted p-2 rounded">
                        <div className="font-medium">{attachment.file_name}</div>
                        <div className="text-muted-foreground">
                          {attachment.file_type} • {(attachment.file_size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    ))}
                    {(message as ClaudeChatMessage).files?.map((file, index) => (
                      <div key={`file-${index}`} className="text-xs bg-muted p-2 rounded">
                        <div className="font-medium">{file.file_name}</div>
                        <div className="text-muted-foreground">
                          {file.file_type} • {(file.file_size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(message as ClaudeChatMessage).chat_feedback && (
                  <div className="mt-3 flex items-center gap-1 text-xs">
                    {(message as ClaudeChatMessage).chat_feedback!.type === 'good' ? (
                      <ThumbsUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <ThumbsDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className="text-muted-foreground">
                      {(message as ClaudeChatMessage).chat_feedback!.type === 'good' ? 'Positive' : 'Negative'} feedback
                      {(message as ClaudeChatMessage).chat_feedback!.reason && `: ${(message as ClaudeChatMessage).chat_feedback!.reason}`}
                    </span>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </CardContent>
    </Card>
  );
}