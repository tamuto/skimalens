import { createLazyFileRoute } from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import { FileUpload } from '@/components/file-upload';
import { ConversationViewer } from '@/components/conversation-viewer';
import { ConversationSidebar } from '@/components/conversation-sidebar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Upload } from 'lucide-react';
import { DataParser } from '@/lib/parser';
import type { 
  ParsedData, 
  ClaudeConversation, 
  ClaudeConversations, 
  ChatGPTConversation, 
  ChatGPTConversations 
} from '@/types/data';

export const Route = createLazyFileRoute('/')({
  component: Index,
});

function Index() {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ClaudeConversation | ChatGPTConversation | null>(null);
  const [conversationType, setConversationType] = useState<'claude' | 'chatgpt' | null>(null);

  // Check for CLI-provided file
  useEffect(() => {
    const checkCliFile = async () => {
      // Check if file is provided via CLI
      const urlParams = new URLSearchParams(window.location.search);
      const cliFileParam = urlParams.get('file');
      
      if (cliFileParam === 'cli-provided') {
        try {
          // Fetch file from CLI server
          const response = await fetch('/api/file');
          if (!response.ok) {
            throw new Error(`Failed to load file: ${response.statusText}`);
          }
          
          const data = await response.json();
          const fileContent = data.content;
          const fileName = data.filename || 'CLI-provided file';
          
          // Parse the file content
          const uploadResult = {
            filename: fileName,
            content: fileContent,
            type: fileName.endsWith('.yaml') || fileName.endsWith('.yml') ? 'yaml' as const : 'json' as const,
            size: fileContent.length,
            lastModified: new Date()
          };
          const result = DataParser.parseData(uploadResult);
          
          handleDataLoaded(result);
        } catch (err) {
          handleError(`Failed to load CLI file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    };

    checkCliFile();
  }, []);

  const handleDataLoaded = (data: ParsedData) => {
    setError(null);
    setParsedData(data);
    setSelectedConversation(null);
    setConversationType(data.type === 'claude-conversation' ? 'claude' : data.type === 'chatgpt-conversation' ? 'chatgpt' : null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setParsedData(null);
    setSelectedConversation(null);
    setConversationType(null);
  };

  const handleReset = () => {
    setParsedData(null);
    setError(null);
    setSelectedConversation(null);
    setConversationType(null);
  };

  const handleSelectConversation = (conversation: ClaudeConversation | ChatGPTConversation) => {
    setSelectedConversation(conversation);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      );
    }

    if (!parsedData) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Upload Conversation Data</h2>
              <p className="text-muted-foreground">
                Upload your Claude or ChatGPT conversation logs to get started with analysis.
              </p>
            </div>
            <FileUpload onDataLoaded={handleDataLoaded} onError={handleError} />
          </div>
        </div>
      );
    }

    if (parsedData.type === 'claude-conversation') {
      try {
        const conversationData = DataParser.validateClaudeConversation(parsedData.raw);
        
        // Check if it's a single conversation or array of conversations
        const isSingleConversation = !Array.isArray(conversationData);
        const conversations = isSingleConversation ? [conversationData as ClaudeConversation] : conversationData as ClaudeConversations;
        
        // Two-pane layout for conversations
        return (
          <div className="flex h-[calc(100vh-120px)]">
            {/* Left Sidebar */}
            <div className="w-80 flex-shrink-0">
              <ConversationSidebar
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
                onReset={handleReset}
              />
            </div>
            
            {/* Right Content Area */}
            <div className="flex-1 overflow-hidden">
              {selectedConversation && conversationType ? (
                <div className="h-full overflow-y-auto p-6">
                  <ConversationViewer 
                    conversation={selectedConversation} 
                    conversationType={conversationType}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <h3 className="text-lg font-medium mb-2">Select a Conversation</h3>
                    <p className="text-sm">
                      Choose a conversation from the sidebar to view its details and messages.
                    </p>
                    <div className="mt-4 text-xs">
                      {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} loaded from {parsedData.metadata.filename}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
        
      } catch (validationError) {
        return (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Alert className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to validate Claude conversation format: {validationError instanceof Error ? validationError.message : 'Unknown error'}
              </AlertDescription>
            </Alert>
          </div>
        );
      }
    }

    if (parsedData.type === 'chatgpt-conversation') {
      try {
        const conversationData = DataParser.validateChatGPTConversation(parsedData.raw);
        
        // Check if it's a single conversation or array of conversations
        const isSingleConversation = !Array.isArray(conversationData);
        const conversations = isSingleConversation ? [conversationData as ChatGPTConversation] : conversationData as ChatGPTConversations;
        
        // Two-pane layout for conversations
        return (
          <div className="flex h-[calc(100vh-120px)]">
            {/* Left Sidebar */}
            <div className="w-80 flex-shrink-0">
              <ConversationSidebar
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
                onReset={handleReset}
              />
            </div>
            
            {/* Right Content Area */}
            <div className="flex-1 overflow-hidden">
              {selectedConversation && conversationType ? (
                <div className="h-full overflow-y-auto p-6">
                  <ConversationViewer 
                    conversation={selectedConversation} 
                    conversationType={conversationType}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <h3 className="text-lg font-medium mb-2">Select a Conversation</h3>
                    <p className="text-sm">
                      Choose a conversation from the sidebar to view its details and messages.
                    </p>
                    <div className="mt-4 text-xs">
                      {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} loaded from {parsedData.metadata.filename}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
        
      } catch (validationError) {
        return (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Alert className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to validate ChatGPT conversation format: {validationError instanceof Error ? validationError.message : 'Unknown error'}
              </AlertDescription>
            </Alert>
          </div>
        );
      }
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Data type "{parsedData.type}" is not yet supported. Currently Claude and ChatGPT conversation logs are supported.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col">
      {!parsedData && (
        <div className="p-6 border-b">
          <h1 className="text-3xl font-bold tracking-tight">SkimaLens</h1>
          <p className="text-muted-foreground mt-2">
            Data visualization tool for JSON and YAML files. Upload your Claude conversation logs to get started.
          </p>
        </div>
      )}
      
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}
