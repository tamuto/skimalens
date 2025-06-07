import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageCircle, Search, Calendar, User, Bot, Filter } from 'lucide-react';
import { MessageItem } from '@/components/message-item';
import { DataParser } from '@/lib/parser';
import type { ClaudeConversation, ClaudeChatMessage, ChatGPTConversation, ChatGPTMessage } from '@/types/data';

interface ConversationViewerProps {
  conversation: ClaudeConversation | ChatGPTConversation;
  conversationType: 'claude' | 'chatgpt';
}

export function ConversationViewer({ conversation, conversationType }: ConversationViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [filterSender, setFilterSender] = useState<'all' | 'human' | 'assistant'>('all');

  // Extract messages based on conversation type
  const allMessages = useMemo(() => {
    if (conversationType === 'claude') {
      return (conversation as ClaudeConversation).chat_messages;
    } else {
      return DataParser.extractChatGPTMessages(conversation as ChatGPTConversation);
    }
  }, [conversation, conversationType]);

  const filteredMessages = useMemo(() => {
    let messages = allMessages;

    // Filter by sender
    if (filterSender !== 'all') {
      if (conversationType === 'claude') {
        messages = (messages as ClaudeChatMessage[]).filter(msg => msg.sender === filterSender);
      } else {
        const senderRole = filterSender === 'human' ? 'user' : 'assistant';
        messages = (messages as ChatGPTMessage[]).filter(msg => msg.author.role === senderRole);
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (conversationType === 'claude') {
        messages = (messages as ClaudeChatMessage[]).filter(msg => 
          msg.text.toLowerCase().includes(query) ||
          msg.uuid.toLowerCase().includes(query)
        );
      } else {
        messages = (messages as ChatGPTMessage[]).filter(msg => 
          (msg.content?.parts?.some(part => 
            typeof part === 'string' && part.toLowerCase().includes(query)
          ) || false) ||
          msg.id.toLowerCase().includes(query)
        );
      }
    }

    // Sort messages
    if (conversationType === 'claude') {
      return (messages as ClaudeChatMessage[]).sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else {
      return (messages as ChatGPTMessage[]).sort((a, b) => {
        if (a.create_time === null) return -1;
        if (b.create_time === null) return 1;
        return a.create_time - b.create_time;
      });
    }
  }, [allMessages, searchQuery, filterSender, conversationType]);

  const conversationStats = useMemo(() => {
    const messages = allMessages;
    
    if (conversationType === 'claude') {
      const claudeMessages = messages as ClaudeChatMessage[];
      const humanCount = claudeMessages.filter(m => m.sender === 'human').length;
      const assistantCount = claudeMessages.filter(m => m.sender === 'assistant').length;
      const feedbackCount = claudeMessages.filter(m => m.chat_feedback).length;
      
      return {
        total: messages.length,
        human: humanCount,
        assistant: assistantCount,
        feedback: feedbackCount
      };
    } else {
      const chatgptMessages = messages as ChatGPTMessage[];
      const humanCount = chatgptMessages.filter(m => m.author.role === 'user').length;
      const assistantCount = chatgptMessages.filter(m => m.author.role === 'assistant').length;
      
      return {
        total: messages.length,
        human: humanCount,
        assistant: assistantCount,
        feedback: 0 // ChatGPT doesn't have feedback in the exported format
      };
    }
  }, [allMessages, conversationType]);

  // Get conversation metadata
  const { title, createdDate, updatedDate, conversationId } = useMemo(() => {
    if (conversationType === 'claude') {
      const conv = conversation as ClaudeConversation;
      return {
        title: conv.name,
        createdDate: new Date(conv.created_at).toLocaleDateString(),
        updatedDate: new Date(conv.updated_at).toLocaleDateString(),
        conversationId: conv.uuid
      };
    } else {
      const conv = conversation as ChatGPTConversation;
      return {
        title: conv.title,
        createdDate: new Date(conv.create_time * 1000).toLocaleDateString(),
        updatedDate: new Date(conv.update_time * 1000).toLocaleDateString(),
        conversationId: conv.id
      };
    }
  }, [conversation, conversationType]);

  const assistantName = conversationType === 'claude' ? 'Claude' : 'ChatGPT';

  return (
    <div className="space-y-6">
      {/* Conversation Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>ID: {conversationId}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Created:</span> {createdDate}
            </div>
            <div>
              <span className="font-medium">Updated:</span> {updatedDate}
            </div>
            <div>
              <span className="font-medium">Messages:</span> {allMessages.length}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted p-3 rounded-lg text-center">
              <div className="text-2xl font-bold">{conversationStats.total}</div>
              <div className="text-xs text-muted-foreground">Total Messages</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{conversationStats.human}</div>
              <div className="text-xs text-muted-foreground">User Messages</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{conversationStats.assistant}</div>
              <div className="text-xs text-muted-foreground">{assistantName} Messages</div>
            </div>
            {conversationType === 'claude' && (
              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-600">{conversationStats.feedback}</div>
                <div className="text-xs text-muted-foreground">With Feedback</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterSender === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterSender('all')}
              >
                <Filter className="h-4 w-4 mr-1" />
                All
              </Button>
              <Button
                variant={filterSender === 'human' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterSender('human')}
              >
                <User className="h-4 w-4 mr-1" />
                User
              </Button>
              <Button
                variant={filterSender === 'assistant' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterSender('assistant')}
              >
                <Bot className="h-4 w-4 mr-1" />
                {assistantName}
              </Button>
            </div>
          </div>
          
          {searchQuery && (
            <div className="mt-2 text-sm text-muted-foreground">
              Found {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Messages List */}
      <div className="space-y-4">
        {filteredMessages.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || filterSender !== 'all' 
                  ? 'No messages match your current filters.' 
                  : 'No messages found in this conversation.'}
              </p>
              {(searchQuery || filterSender !== 'all') && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterSender('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredMessages.map((message) => {
            const messageId = conversationType === 'claude' 
              ? (message as ClaudeChatMessage).uuid 
              : (message as ChatGPTMessage).id;
            
            return (
              <MessageItem
                key={messageId}
                message={message}
                messageType={conversationType}
                isSelected={selectedMessageId === messageId}
                onClick={() => setSelectedMessageId(
                  selectedMessageId === messageId ? null : messageId
                )}
              />
            );
          })
        )}
      </div>
    </div>
  );
}