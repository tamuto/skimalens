import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageCircle, Search, Calendar, X, Filter, EyeOff } from 'lucide-react';
import { DataParser } from '@/lib/parser';
import type { 
  ClaudeConversations, 
  ClaudeConversation, 
  ChatGPTConversations, 
  ChatGPTConversation 
} from '@/types/data';

interface ConversationSidebarProps {
  conversations: ClaudeConversations | ChatGPTConversations;
  selectedConversation: ClaudeConversation | ChatGPTConversation | null;
  onSelectConversation: (conversation: ClaudeConversation | ChatGPTConversation) => void;
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

  // Determine conversation type
  const conversationType = useMemo(() => {
    if (conversations.length === 0) return 'unknown';
    const firstConv = conversations[0];
    if ('uuid' in firstConv && 'chat_messages' in firstConv) return 'claude';
    if ('id' in firstConv && 'mapping' in firstConv) return 'chatgpt';
    return 'unknown';
  }, [conversations]);

  const sortedAndFilteredConversations = useMemo(() => {
    let filtered = conversations;
    
    if (conversationType === 'claude') {
      const claudeConversations = filtered as ClaudeConversations;
      
      // Filter out deleted conversations (empty name) if hideDeletedConversations is true
      if (hideDeletedConversations) {
        filtered = claudeConversations.filter(conv => conv.name.trim() !== '');
      }
      
      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = (filtered as ClaudeConversations).filter(conv => 
          conv.name.toLowerCase().includes(query) ||
          conv.uuid.toLowerCase().includes(query)
        );
      }
      
      return (filtered as ClaudeConversations).sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } else if (conversationType === 'chatgpt') {
      const chatgptConversations = filtered as ChatGPTConversations;
      
      // ChatGPT doesn't have "deleted" conversations in the same way, but we can filter empty titles
      if (hideDeletedConversations) {
        filtered = chatgptConversations.filter(conv => conv.title.trim() !== '');
      }
      
      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = (filtered as ChatGPTConversations).filter(conv => 
          conv.title.toLowerCase().includes(query) ||
          conv.id.toLowerCase().includes(query)
        );
      }
      
      return (filtered as ChatGPTConversations).sort((a, b) => 
        b.update_time - a.update_time
      );
    }
    
    return filtered;
  }, [conversations, searchQuery, hideDeletedConversations, conversationType]);

  const totalMessages = useMemo(() => {
    if (conversationType === 'claude') {
      return (conversations as ClaudeConversations).reduce((total, conv) => total + conv.chat_messages.length, 0);
    } else if (conversationType === 'chatgpt') {
      return (conversations as ChatGPTConversations).reduce((total, conv) => {
        return total + DataParser.extractChatGPTMessages(conv).length;
      }, 0);
    }
    return 0;
  }, [conversations, conversationType]);

  const deletedConversationsCount = useMemo(() => {
    if (conversationType === 'claude') {
      return (conversations as ClaudeConversations).filter(conv => conv.name.trim() === '').length;
    } else if (conversationType === 'chatgpt') {
      return (conversations as ChatGPTConversations).filter(conv => conv.title.trim() === '').length;
    }
    return 0;
  }, [conversations, conversationType]);

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
              if (conversationType === 'claude') {
                const claudeConv = conversation as ClaudeConversation;
                const isDeleted = claudeConv.name.trim() === '';
                const isSelected = selectedConversation && 'uuid' in selectedConversation && selectedConversation.uuid === claudeConv.uuid;
                
                return (
                  <div
                    key={claudeConv.uuid}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : isDeleted
                        ? 'hover:bg-red-50 border-l-2 border-l-red-200'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => onSelectConversation(claudeConv)}
                  >
                    <div className="space-y-2">
                      <div className={`font-medium text-sm line-clamp-2 leading-tight ${
                        isDeleted ? 'text-red-600 italic' : ''
                      }`}>
                        {isDeleted ? `[Deleted Conversation]` : claudeConv.name}
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs opacity-75">
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {claudeConv.chat_messages.length}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(claudeConv.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="text-xs opacity-60 truncate">
                        {claudeConv.uuid.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                );
              } else if (conversationType === 'chatgpt') {
                const chatgptConv = conversation as ChatGPTConversation;
                const isDeleted = chatgptConv.title.trim() === '';
                const isSelected = selectedConversation && 'id' in selectedConversation && selectedConversation.id === chatgptConv.id;
                const messageCount = DataParser.extractChatGPTMessages(chatgptConv).length;
                
                return (
                  <div
                    key={chatgptConv.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : isDeleted
                        ? 'hover:bg-red-50 border-l-2 border-l-red-200'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => onSelectConversation(chatgptConv)}
                  >
                    <div className="space-y-2">
                      <div className={`font-medium text-sm line-clamp-2 leading-tight ${
                        isDeleted ? 'text-red-600 italic' : ''
                      }`}>
                        {isDeleted ? `[Empty Title]` : chatgptConv.title}
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs opacity-75">
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {messageCount}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(chatgptConv.update_time * 1000).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="text-xs opacity-60 truncate">
                        {chatgptConv.id.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                );
              }
              
              return null;
            })
          )}
        </div>
      </div>
    </div>
  );
}