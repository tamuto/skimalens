import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageCircle, Search, Calendar, User, Bot, Filter } from 'lucide-react';
import { MessageItem } from '@/components/message-item';
import type { ClaudeConversation, ClaudeChatMessage } from '@/types/data';

interface ConversationViewerProps {
  conversation: ClaudeConversation;
}

export function ConversationViewer({ conversation }: ConversationViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [filterSender, setFilterSender] = useState<'all' | 'human' | 'assistant'>('all');

  const filteredMessages = useMemo(() => {
    let messages = conversation.chat_messages;

    // Filter by sender
    if (filterSender !== 'all') {
      messages = messages.filter(msg => msg.sender === filterSender);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      messages = messages.filter(msg => 
        msg.text.toLowerCase().includes(query) ||
        msg.uuid.toLowerCase().includes(query)
      );
    }

    return messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [conversation.chat_messages, searchQuery, filterSender]);

  const conversationStats = useMemo(() => {
    const messages = conversation.chat_messages;
    const humanCount = messages.filter(m => m.sender === 'human').length;
    const assistantCount = messages.filter(m => m.sender === 'assistant').length;
    const feedbackCount = messages.filter(m => m.chat_feedback).length;
    
    return {
      total: messages.length,
      human: humanCount,
      assistant: assistantCount,
      feedback: feedbackCount
    };
  }, [conversation.chat_messages]);

  const createdDate = new Date(conversation.created_at).toLocaleDateString();
  const updatedDate = new Date(conversation.updated_at).toLocaleDateString();

  return (
    <div className="space-y-6">
      {/* Conversation Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {conversation.name}
          </CardTitle>
          <CardDescription>UUID: {conversation.uuid}</CardDescription>
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
              <span className="font-medium">Messages:</span> {conversation.chat_messages.length}
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
              <div className="text-xs text-muted-foreground">Assistant Messages</div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">{conversationStats.feedback}</div>
              <div className="text-xs text-muted-foreground">With Feedback</div>
            </div>
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
                Claude
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
          filteredMessages.map((message) => (
            <MessageItem
              key={message.uuid}
              message={message}
              isSelected={selectedMessageId === message.uuid}
              onClick={() => setSelectedMessageId(
                selectedMessageId === message.uuid ? null : message.uuid
              )}
            />
          ))
        )}
      </div>
    </div>
  );
}