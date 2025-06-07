import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { DataParser } from '@/lib/parser';
import type { FileUploadResult, ParsedData } from '@/types/data';

interface FileUploadProps {
  onDataLoaded: (data: ParsedData) => void;
  onError: (error: string) => void;
}

export function FileUpload({ onDataLoaded, onError }: FileUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<FileUploadResult | null>(null);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const uploadResult = await DataParser.parseFile(file);
      setUploadResult(uploadResult);
      
      const parsedData = DataParser.parseData(uploadResult);
      onDataLoaded(parsedData);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  }, [onDataLoaded, onError]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0]);
    }
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
      'text/yaml': ['.yaml', '.yml'],
      'application/x-yaml': ['.yaml', '.yml']
    },
    multiple: false,
    disabled: isProcessing
  });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Data File Upload
          </CardTitle>
          <CardDescription>
            Upload a JSON or YAML file to visualize your data. Supports Claude conversation logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${isDragReject ? 'border-destructive bg-destructive/5' : ''}
              ${isProcessing ? 'pointer-events-none opacity-50' : 'hover:border-primary/50'}
            `}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              
              {isProcessing ? (
                <div>
                  <p className="text-sm text-muted-foreground">Processing file...</p>
                </div>
              ) : isDragActive ? (
                <div>
                  <p className="text-sm font-medium">Drop your file here</p>
                  <p className="text-sm text-muted-foreground">JSON and YAML files are supported</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">Drag and drop your file here</p>
                  <p className="text-sm text-muted-foreground">or click to browse files</p>
                  <div className="mt-4">
                    <Button variant="outline" type="button">
                      Select File
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isDragReject && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Only JSON (.json) and YAML (.yaml, .yml) files are supported.
              </AlertDescription>
            </Alert>
          )}

          {uploadResult && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="text-sm space-y-1">
                <p><span className="font-medium">File:</span> {uploadResult.filename}</p>
                <p><span className="font-medium">Size:</span> {(uploadResult.size / 1024).toFixed(1)} KB</p>
                <p><span className="font-medium">Type:</span> {uploadResult.type.toUpperCase()}</p>
                <p><span className="font-medium">Modified:</span> {uploadResult.lastModified.toLocaleString()}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}