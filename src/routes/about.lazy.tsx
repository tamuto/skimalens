import { createLazyFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, MessageCircle, Search, Filter } from 'lucide-react';

export const Route = createLazyFileRoute('/about')({
  component: About,
});

function About() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">About SkimaLens</h1>
        <p className="text-muted-foreground mt-2">
          A powerful data visualization tool for analyzing conversation logs and structured data.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Supported Formats
            </CardTitle>
            <CardDescription>
              File types and data structures we can handle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="font-medium">Claude Conversation Logs</div>
                <div className="text-sm text-muted-foreground">
                  conversation.json files exported from Claude
                </div>
              </div>
              <div>
                <div className="font-medium">JSON Files</div>
                <div className="text-sm text-muted-foreground">
                  Generic JSON data structures
                </div>
              </div>
              <div>
                <div className="font-medium">YAML Files</div>
                <div className="text-sm text-muted-foreground">
                  YAML data files (.yaml, .yml)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Features
            </CardTitle>
            <CardDescription>
              What you can do with SkimaLens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Search className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="font-medium">Full-text Search</div>
                  <div className="text-sm text-muted-foreground">
                    Search through message content and metadata
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Filter className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="font-medium">Smart Filtering</div>
                  <div className="text-sm text-muted-foreground">
                    Filter by sender, date, or content type
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MessageCircle className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="font-medium">Conversation Flow</div>
                  <div className="text-sm text-muted-foreground">
                    Visualize message threads and interactions
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
            <CardDescription>
              Get started with SkimaLens in a few simple steps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg font-bold text-primary">1</span>
                </div>
                <h3 className="font-medium mb-2">Upload Your Data</h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop your JSON or YAML file onto the upload area
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg font-bold text-primary">2</span>
                </div>
                <h3 className="font-medium mb-2">Explore Your Data</h3>
                <p className="text-sm text-muted-foreground">
                  Browse through messages, search content, and apply filters
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg font-bold text-primary">3</span>
                </div>
                <h3 className="font-medium mb-2">Analyze Insights</h3>
                <p className="text-sm text-muted-foreground">
                  View conversation statistics and message patterns
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Privacy & Security</CardTitle>
            <CardDescription>
              Your data stays private and secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="font-medium">Client-Side Processing</div>
                <div className="text-sm text-muted-foreground">
                  All data processing happens in your browser. No files are uploaded to any server.
                </div>
              </div>
              <div>
                <div className="font-medium">No Data Storage</div>
                <div className="text-sm text-muted-foreground">
                  SkimaLens doesn't store or retain any of your data. Everything is processed locally.
                </div>
              </div>
              <div>
                <div className="font-medium">Open Source</div>
                <div className="text-sm text-muted-foreground">
                  Built with React, TypeScript, and open-source libraries you can trust.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
