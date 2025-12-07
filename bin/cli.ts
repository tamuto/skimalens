#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';
import { spawn } from 'child_process';
import { load as yamlLoad } from 'js-yaml';
import { MarkdownExporter, type FilenameFormat, type ExportFormat } from './exporter';
import { DataParser } from '../src/lib/parser';

interface ServerOptions {
  port: number;
  filePath?: string;
}

interface CliOptions {
  exportDir?: string;
  filenameFormat: FilenameFormat;
  exportFormat: ExportFormat;
  filePath?: string;
  showHelp?: boolean;
}

function main(): void {
  const options = parseArgs();

  if (options.showHelp) {
    showHelp();
    process.exit(0);
  }

  const port = 8080;

  // Validate file if provided
  let validatedFilePath: string | undefined;
  if (options.filePath) {
    validatedFilePath = validateFilePath(options.filePath);
  }

  // Export mode
  if (options.exportDir) {
    if (!validatedFilePath) {
      console.error('Error: File path is required when using --export option');
      showHelp();
      process.exit(1);
    }

    exportToMarkdown(validatedFilePath, options.exportDir, options.filenameFormat, options.exportFormat);
    return;
  }

  // Server mode (default)
  if (validatedFilePath) {
    console.log(`Starting SkimaLens with file: ${validatedFilePath}`);
  } else {
    console.log('Starting SkimaLens...');
  }

  startServer({ port, filePath: validatedFilePath });
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    filenameFormat: 'title',
    exportFormat: 'markdown'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Skip standalone "--" (used by npm/pnpm to separate script args)
    if (arg === '--') {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.showHelp = true;
      return options;
    }

    if (arg === '--export') {
      if (i + 1 >= args.length) {
        console.error('Error: --export requires a directory path');
        process.exit(1);
      }
      options.exportDir = args[++i];
      continue;
    }

    if (arg === '--filename-format') {
      if (i + 1 >= args.length) {
        console.error('Error: --filename-format requires a value (title or id)');
        process.exit(1);
      }
      const format = args[++i];
      if (format !== 'title' && format !== 'id') {
        console.error('Error: --filename-format must be either "title" or "id"');
        process.exit(1);
      }
      options.filenameFormat = format;
      continue;
    }

    if (arg === '--export-format') {
      if (i + 1 >= args.length) {
        console.error('Error: --export-format requires a value (markdown, json, or yaml)');
        process.exit(1);
      }
      const format = args[++i];
      if (format !== 'markdown' && format !== 'json' && format !== 'yaml') {
        console.error('Error: --export-format must be either "markdown", "json", or "yaml"');
        process.exit(1);
      }
      options.exportFormat = format as ExportFormat;
      continue;
    }

    if (arg.startsWith('--')) {
      console.error(`Error: Unknown option: ${arg}`);
      showHelp();
      process.exit(1);
    }

    // Positional argument (file path)
    if (!options.filePath) {
      options.filePath = arg;
    } else {
      console.error(`Error: Multiple file paths specified: ${options.filePath}, ${arg}`);
      process.exit(1);
    }
  }

  return options;
}

function validateFilePath(filePath: string): string {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(`Error: File not found: ${fullPath}`);
    process.exit(1);
  }

  const ext = path.extname(fullPath).toLowerCase();
  if (!['.json', '.yaml', '.yml'].includes(ext)) {
    console.error(`Error: Unsupported file type. Please use .json, .yaml, or .yml files.`);
    process.exit(1);
  }

  return fullPath;
}

async function exportToMarkdown(
  filePath: string,
  exportDir: string,
  filenameFormat: FilenameFormat,
  exportFormat: ExportFormat
): Promise<void> {
  try {
    console.log(`Reading file: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Parse file
    const ext = path.extname(filePath).toLowerCase();
    let data: unknown;

    if (ext === '.json') {
      data = JSON.parse(content);
    } else {
      data = yamlLoad(content);
    }

    // Detect data type
    const uploadResult = {
      filename: path.basename(filePath),
      content,
      type: ext === '.json' ? 'json' as const : 'yaml' as const,
      size: content.length,
      lastModified: new Date()
    };

    const parsed = DataParser.parseData(uploadResult);
    console.log(`Detected data type: ${parsed.type}`);

    if (parsed.type !== 'claude-conversation' && parsed.type !== 'chatgpt-conversation') {
      console.error(`Error: Unsupported data type for export: ${parsed.type}`);
      console.error('Only Claude and ChatGPT conversations can be exported.');
      process.exit(1);
    }

    // Export
    const exporter = new MarkdownExporter({
      outputDir: exportDir,
      filenameFormat,
      exportFormat
    });

    await exporter.export(data, parsed.type);
    console.log(`\nExport completed successfully to: ${path.resolve(exportDir)}`);
  } catch (error) {
    console.error(`Error during export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

function showHelp(): void {
  console.log(`
SkimaLens - Claude and ChatGPT conversation viewer and exporter

USAGE:
  skimalens [OPTIONS] [FILE]

OPTIONS:
  --export <directory>              Export conversations to files in the specified directory
  --export-format <format>          Set export format (default: markdown)
                                    - markdown: Export as Markdown files
                                    - json: Export as formatted JSON files
                                    - yaml: Export as formatted YAML files
  --filename-format <title|id>      Set filename format for exported files (default: title)
                                    - title: Use conversation title as filename
                                    - id: Use conversation ID as filename
  -h, --help                        Show this help message

EXAMPLES:
  # Start web viewer with a conversation file
  skimalens conversations.json

  # Export conversations as Markdown using titles as filenames (default)
  skimalens --export ./output conversations.json

  # Export conversations as formatted JSON
  skimalens --export ./output --export-format json conversations.json

  # Export conversations as formatted YAML with ID-based filenames
  skimalens --export ./output --export-format yaml --filename-format id conversations.json

  # Start web viewer without a file (upload file in browser)
  skimalens
`);
}

function startServer(options: ServerOptions): void {
  const { port, filePath } = options;
  const distPath = path.join(__dirname, '..', 'dist');
  
  // Check if build exists
  if (!fs.existsSync(distPath)) {
    console.error('Error: Build not found. Please run "pnpm run build" first.');
    process.exit(1);
  }

  // Track active connections for graceful shutdown
  const connections = new Set<any>();

  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '/';

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle API endpoint for file serving
    if (pathname === '/api/file') {
      console.log(`API request: ${pathname}, filePath: ${filePath}`);
      
      if (!filePath) {
        console.log('No file provided to CLI');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No file provided to CLI' }));
        return;
      }

      // Use async file reading for large files
      console.log(`Reading file: ${filePath}`);
      const fileName = path.basename(filePath);
      
      fs.readFile(filePath, 'utf-8', (error, fileContent) => {
        if (error) {
          console.error(`Error reading file: ${error}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Failed to read file: ${error}` }));
          return;
        }

        console.log(`File read successfully, length: ${fileContent.length}`);
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'X-Filename': fileName
        });
        res.end(JSON.stringify({ content: fileContent, filename: fileName }));
      });
      return;
    }

    // Serve static files
    let filePath_static = path.join(distPath, pathname === '/' ? 'index.html' : pathname);
    
    // If file doesn't exist, serve index.html for SPA routing
    if (!fs.existsSync(filePath_static)) {
      filePath_static = path.join(distPath, 'index.html');
    }

    try {
      const stat = fs.statSync(filePath_static);
      
      if (stat.isFile()) {
        const ext = path.extname(filePath_static);
        const contentType = getContentType(ext);
        
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath_static).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  });

  // Track connections
  server.on('connection', (connection) => {
    connections.add(connection);
    connection.on('close', () => {
      connections.delete(connection);
    });
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}${filePath ? `/?file=cli-provided` : ''}`;
    console.log(`SkimaLens server started at ${url}`);
    
    // Open browser after a short delay
    setTimeout(() => {
      openBrowser(url);
    }, 1000);
  });

  // Handle server shutdown
  let isShuttingDown = false;
  
  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) {
      console.log('\nForce shutdown...');
      process.exit(1);
    }
    
    isShuttingDown = true;
    console.log(`\nReceived ${signal}. Shutting down SkimaLens server...`);
    
    // Close all active connections
    for (const connection of connections) {
      connection.destroy();
    }
    connections.clear();
    
    server.close(() => {
      console.log('Server closed successfully.');
      process.exit(0);
    });
    
    // Force shutdown after 3 seconds (reduced from 5)
    setTimeout(() => {
      console.log('Force shutdown due to timeout.');
      process.exit(1);
    }, 3000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return types[ext.toLowerCase()] || 'text/plain';
}

function openBrowser(url: string): void {
  // Check if running in VSCode or other environments where xdg-open might not work
  if (process.env.VSCODE_PID || process.env.TERM_PROGRAM === 'vscode') {
    console.log(`\n🌐 Open this URL in your browser: ${url}\n`);
    return;
  }

  try {
    if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' });
    } else if (process.platform === 'win32') {
      spawn('start', [url], { shell: true, detached: true, stdio: 'ignore' });
    } else {
      // Linux/Unix - try multiple approaches
      const commands = ['xdg-open', 'sensible-browser', 'firefox', 'google-chrome', 'chromium'];
      
      for (const cmd of commands) {
        try {
          spawn(cmd, [url], { detached: true, stdio: 'ignore' });
          break;
        } catch (err) {
          continue;
        }
      }
    }
  } catch (err) {
    console.log(`\n🌐 Open this URL in your browser: ${url}\n`);
  }
}

main();