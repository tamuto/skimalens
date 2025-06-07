#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';
import { spawn } from 'child_process';

interface ServerOptions {
  port: number;
  filePath?: string;
}

function main(): void {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const port = 8080;

  let validatedFilePath: string | undefined;

  if (filePath) {
    // File specified - validate
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

    validatedFilePath = fullPath;
    console.log(`Starting SkimaLens with file: ${fullPath}`);
  } else {
    console.log('Starting SkimaLens...');
  }

  // Start standalone web server
  startServer({ port, filePath: validatedFilePath });
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