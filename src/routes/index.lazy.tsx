import { createLazyFileRoute } from '@tanstack/react-router';
import React, { useState } from 'react';
import { FileUpload } from '@/components/file-upload';
import { ConversationViewer } from '@/components/conversation-viewer';
import { ConversationsList } from '@/components/conversations-list';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { DataParser } from '@/lib/parser';
import type { ParsedData, ClaudeConversation, ClaudeConversations } from '@/types/data';

export const Route = createLazyFileRoute('/')({
  component: Index,
});

function Index() {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ClaudeConversation | null>(null);

  const handleDataLoaded = (data: ParsedData) => {
    setError(null);
    setParsedData(data);
    setSelectedConversation(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setParsedData(null);
    setSelectedConversation(null);
  };

  const handleReset = () => {
    setParsedData(null);
    setError(null);
    setSelectedConversation(null);
  };

  const handleSelectConversation = (conversation: ClaudeConversation) => {
    setSelectedConversation(conversation);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  const renderContent = () => {
    if (error) {
      return (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    if (!parsedData) {
      return <FileUpload onDataLoaded={handleDataLoaded} onError={handleError} />;
    }

    if (parsedData.type === 'claude-conversation') {
      try {
        const conversationData = DataParser.validateClaudeConversation(parsedData.raw);
        
        // Check if it's a single conversation or array of conversations
        const isSingleConversation = !Array.isArray(conversationData);
        const conversations = isSingleConversation ? [conversationData as ClaudeConversation] : conversationData as ClaudeConversations;
        
        // If viewing a specific conversation
        if (selectedConversation) {
          return (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" onClick={handleBackToList}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to List
                  </Button>
                  <div>
                    <h2 className="text-lg font-semibold">Conversation Details</h2>
                    <p className="text-sm text-muted-foreground">
                      File: {parsedData.metadata.filename}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  Load Different File
                </button>
              </div>
              <ConversationViewer conversation={selectedConversation} />
            </div>
          );
        }
        
        // Show list of conversations (or single conversation if only one)
        if (conversations.length === 1) {
          return (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold">Single Conversation Analysis</h2>
                  <p className="text-sm text-muted-foreground">
                    File: {parsedData.metadata.filename} • 
                    Parsed: {parsedData.metadata.parseTime.toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  Load Different File
                </button>
              </div>
              <ConversationViewer conversation={conversations[0]} />
            </div>
          );
        }
        
        // Multiple conversations
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Conversations Overview</h2>
                <p className="text-sm text-muted-foreground">
                  File: {parsedData.metadata.filename} • 
                  {conversations.length} conversations • 
                  Parsed: {parsedData.metadata.parseTime.toLocaleString()}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Load Different File
              </button>
            </div>
            <ConversationsList 
              conversations={conversations} 
              onSelectConversation={handleSelectConversation}
            />
          </div>
        );
        
      } catch (validationError) {
        return (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to validate Claude conversation format: {validationError instanceof Error ? validationError.message : 'Unknown error'}
            </AlertDescription>
          </Alert>
        );
      }
    }

    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Data type "{parsedData.type}" is not yet supported. Currently only Claude conversation logs are supported.
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">SkimaLens</h1>
        <p className="text-muted-foreground mt-2">
          Data visualization tool for JSON and YAML files. Upload your Claude conversation logs to get started.
        </p>
      </div>
      
      {renderContent()}
    </div>
  );
}
