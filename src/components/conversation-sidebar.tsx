import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageCircle, Search, Calendar, X, Filter, EyeOff } from 'lucide-react';
import type { ClaudeConversations, ClaudeConversation } from '@/types/data';

interface ConversationSidebarProps {
  conversations: ClaudeConversations;
  selectedConversation: ClaudeConversation | null;
  onSelectConversation: (conversation: ClaudeConversation) => void;
  onReset: () => void;
}

export function ConversationSidebar({ 
  conversations, 
  selectedConversation, 
  onSelectConversation,
  onReset 
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hideDeletedConversations, setHideDeletedConversations] = useState(true);

  const sortedAndFilteredConversations = useMemo(() => {
    let filtered = conversations;
    
    // Filter out deleted conversations (empty name) if hideDeletedConversations is true
    if (hideDeletedConversations) {
      filtered = filtered.filter(conv => conv.name.trim() !== '');
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => 
        conv.name.toLowerCase().includes(query) ||
        conv.uuid.toLowerCase().includes(query)
      );
    }
    
    return filtered.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, [conversations, searchQuery, hideDeletedConversations]);

  const totalMessages = useMemo(() => {
    return conversations.reduce((total, conv) => total + conv.chat_messages.length, 0);
  }, [conversations]);

  const deletedConversationsCount = useMemo(() => {
    return conversations.filter(conv => conv.name.trim() === '').length;
  }, [conversations]);

  return (
    <div className="h-full bg-muted/50 border-r">
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground mb-4">
          {conversations.length} conversations • {totalMessages} messages
          {deletedConversationsCount > 0 && (
            <span className="text-orange-600">
              {' '}• {deletedConversationsCount} deleted
            </span>
          )}
        </div>

        {/* Filter Controls */}
        <div className="mb-4 pb-4 border-b">
          <div className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideDeletedConversations}
                onChange={(e) => setHideDeletedConversations(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="flex items-center gap-1">
                <EyeOff className="h-3 w-3" />
                Hide deleted conversations
              </span>
            </label>
          </div>
        </div>
        
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
            {sortedAndFilteredConversations.length} result{sortedAndFilteredConversations.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="overflow-y-auto" style={{ height: 'calc(100vh - 240px)' }}>
        <div className="p-2 space-y-1">
          {sortedAndFilteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {searchQuery 
                  ? 'No conversations match your search.' 
                  : 'No conversations found.'}
              </p>
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="mt-2"
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            sortedAndFilteredConversations.map((conversation) => {
              const isDeleted = conversation.name.trim() === '';
              return (
                <div
                  key={conversation.uuid}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedConversation?.uuid === conversation.uuid
                      ? 'bg-primary text-primary-foreground'
                      : isDeleted
                      ? 'hover:bg-red-50 border-l-2 border-l-red-200'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => onSelectConversation(conversation)}
                >
                  <div className="space-y-2">
                    <div className={`font-medium text-sm line-clamp-2 leading-tight ${
                      isDeleted ? 'text-red-600 italic' : ''
                    }`}>
                      {isDeleted ? `[Deleted Conversation]` : conversation.name}
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs opacity-75">
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {conversation.chat_messages.length}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(conversation.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="text-xs opacity-60 truncate">
                      {conversation.uuid.slice(0, 8)}...
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}