import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { User, Bot, Clock, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { ClaudeChatMessage } from '@/types/data';

interface MessageItemProps {
  message: ClaudeChatMessage;
  isSelected?: boolean;
  onClick?: () => void;
}

export function MessageItem({ message, isSelected, onClick }: MessageItemProps) {
  const isHuman = message.sender === 'human';
  const timestamp = new Date(message.created_at).toLocaleString();

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
                  {isHuman ? 'User' : 'Claude'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {timestamp}
              </div>
            </div>
            
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.text}
              </div>
            </div>

            {((message.attachments && message.attachments.length > 0) || 
              (message.files && message.files.length > 0)) && (
              <div className="mt-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Attachments:</div>
                {message.attachments?.map((attachment, index) => (
                  <div key={`attachment-${index}`} className="text-xs bg-muted p-2 rounded">
                    <div className="font-medium">{attachment.file_name}</div>
                    <div className="text-muted-foreground">
                      {attachment.file_type} • {(attachment.file_size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ))}
                {message.files?.map((file, index) => (
                  <div key={`file-${index}`} className="text-xs bg-muted p-2 rounded">
                    <div className="font-medium">{file.file_name}</div>
                    <div className="text-muted-foreground">
                      {file.file_type} • {(file.file_size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ))}
              </div>
            )}

            {message.chat_feedback && (
              <div className="mt-3 flex items-center gap-1 text-xs">
                {message.chat_feedback.type === 'good' ? (
                  <ThumbsUp className="h-3 w-3 text-green-600" />
                ) : (
                  <ThumbsDown className="h-3 w-3 text-red-600" />
                )}
                <span className="text-muted-foreground">
                  {message.chat_feedback.type === 'good' ? 'Positive' : 'Negative'} feedback
                  {message.chat_feedback.reason && `: ${message.chat_feedback.reason}`}
                </span>
              </div>
            )}

          </div>
        </div>
      </CardContent>
    </Card>
  );
}