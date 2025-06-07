import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageCircle, Search, Calendar, ArrowRight } from 'lucide-react';
import type { ClaudeConversations, ClaudeConversation } from '@/types/data';

interface ConversationsListProps {
  conversations: ClaudeConversations;
  onSelectConversation: (conversation: ClaudeConversation) => void;
}

export function ConversationsList({ conversations, onSelectConversation }: ConversationsListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => 
      conv.name.toLowerCase().includes(query) ||
      conv.uuid.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const totalMessages = useMemo(() => {
    return conversations.reduce((total, conv) => total + conv.chat_messages.length, 0);
  }, [conversations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Claude Conversations
          </CardTitle>
          <CardDescription>
            {conversations.length} conversations with {totalMessages} total messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {searchQuery && (
            <div className="mt-2 text-sm text-muted-foreground">
              Found {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversations List */}
      <div className="space-y-4">
        {filteredConversations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery 
                  ? 'No conversations match your search.' 
                  : 'No conversations found.'}
              </p>
              {searchQuery && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredConversations.map((conversation) => (
            <Card 
              key={conversation.uuid} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectConversation(conversation)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium truncate">{conversation.name}</h3>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {conversation.chat_messages.length} messages
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(conversation.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Updated:</span>
                        {new Date(conversation.updated_at).toLocaleDateString()}
                      </div>
                      <div className="truncate">
                        ID: {conversation.uuid.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}