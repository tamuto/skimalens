import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { spawn } from 'child_process';
import { load as yamlLoad } from 'js-yaml';
import { ConversationExporter, type FilenameFormat, type ExportFormat } from './exporter';
import { DataParser, stripBom } from '../src/lib/parser';
import { getContentType, getPathname, resolveWithinRoot } from './http-paths';

const DEFAULT_PORT = 8080;
const MAX_PORT_ATTEMPTS = 20;
// Only ever reachable from the machine running the CLI: the server hands out
// the contents of a local file, so it must not be exposed to the network.
const HOST = '127.0.0.1';

interface ServerOptions {
  port: number;
  portIsExplicit: boolean;
  filePath?: string;
}

interface CliOptions {
  exportDir?: string;
  filenameFormat: FilenameFormat;
  exportFormat: ExportFormat;
  filePath?: string;
  port?: number;
  showHelp?: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.showHelp) {
    showHelp();
    process.exit(0);
  }

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

    await exportConversations(validatedFilePath, options.exportDir, options.filenameFormat, options.exportFormat);
    return;
  }

  // Server mode (default)
  if (validatedFilePath) {
    console.log(`Starting SkimaLens with file: ${validatedFilePath}`);
  } else {
    console.log('Starting SkimaLens...');
  }

  startServer({
    port: options.port ?? DEFAULT_PORT,
    portIsExplicit: options.port !== undefined,
    filePath: validatedFilePath
  });
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    filenameFormat: 'id',
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

    if (arg === '--port' || arg === '-p') {
      if (i + 1 >= args.length) {
        console.error('Error: --port requires a port number');
        process.exit(1);
      }
      const value = Number(args[++i]);
      if (!Number.isInteger(value) || value < 1 || value > 65535) {
        console.error('Error: --port must be an integer between 1 and 65535');
        process.exit(1);
      }
      options.port = value;
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

    if (arg.startsWith('-') && arg !== '-') {
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

  if (!fs.statSync(fullPath).isFile()) {
    console.error(`Error: Not a file: ${fullPath}`);
    process.exit(1);
  }

  const ext = path.extname(fullPath).toLowerCase();
  if (!['.json', '.yaml', '.yml'].includes(ext)) {
    console.error(`Error: Unsupported file type. Please use .json, .yaml, or .yml files.`);
    process.exit(1);
  }

  return fullPath;
}

async function exportConversations(
  filePath: string,
  exportDir: string,
  filenameFormat: FilenameFormat,
  exportFormat: ExportFormat
): Promise<void> {
  let parsedType: string;
  let data: unknown;

  try {
    console.log(`Reading file: ${filePath}`);
    // stripBom: files re-saved by Windows editors frequently carry a UTF-8 BOM.
    const content = stripBom(fs.readFileSync(filePath, 'utf-8'));

    const ext = path.extname(filePath).toLowerCase();

    // Detect data type
    const uploadResult = {
      filename: path.basename(filePath),
      content,
      type: ext === '.json' ? 'json' as const : 'yaml' as const,
      size: Buffer.byteLength(content, 'utf-8'),
      lastModified: new Date()
    };

    const parsed = DataParser.parseData(uploadResult);
    data = parsed.raw;
    parsedType = parsed.type;
    console.log(`Detected data type: ${parsedType}`);
  } catch (error) {
    console.error(`Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  if (parsedType !== 'claude-conversation' && parsedType !== 'chatgpt-conversation') {
    console.error(`Error: Unsupported data type for export: ${parsedType}`);
    console.error('Only Claude and ChatGPT conversations can be exported.');
    process.exit(1);
  }

  const exporter = new ConversationExporter({
    outputDir: exportDir,
    filenameFormat,
    exportFormat
  });

  let result;
  try {
    result = await exporter.export(data, parsedType);
  } catch (error) {
    // Only setup failures (bad output directory, invalid format) land here;
    // per-conversation failures are collected and reported below.
    console.error(`Error during export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  console.log(`\nExported ${result.exported} conversation(s) to: ${path.resolve(exportDir)}`);

  if (result.failed.length > 0) {
    console.error(`\n${result.failed.length} conversation(s) could not be exported:`);
    for (const failure of result.failed) {
      console.error(`  ✗ ${failure.title}: ${failure.error}`);
    }
    process.exit(1);
  }
}

function showHelp(): void {
  console.log(`
SkimaLens - Claude and ChatGPT conversation viewer and exporter

USAGE:
  skimalens [OPTIONS] [FILE]

OPTIONS:
  -p, --port <number>               Port for the local viewer (default: ${DEFAULT_PORT})
                                    Without this option the next free port is used
                                    automatically when the default one is taken.
  --export <directory>              Export conversations to files in the specified directory
  --export-format <format>          Set export format (default: markdown)
                                    - markdown: Export as Markdown files
                                    - json: Export as formatted JSON files
                                    - yaml: Export as formatted YAML files
  --filename-format <id|title>      Set filename format for exported files (default: id)
                                    - id: Use the conversation ID as filename. Stable across
                                      exports, and unique, so re-exporting into the same
                                      directory updates files instead of overwriting a
                                      different conversation that shares a title.
                                    - title: Use the conversation title as filename.
  -h, --help                        Show this help message

EXAMPLES:
  # Start web viewer with a conversation file
  skimalens conversations.json

  # Start the viewer on a specific port
  skimalens --port 3000 conversations.json

  # Export conversations as Markdown using conversation IDs as filenames (default)
  skimalens --export ./output conversations.json

  # Export conversations as formatted JSON
  skimalens --export ./output --export-format json conversations.json

  # Export conversations as formatted YAML with title-based filenames
  skimalens --export ./output --export-format yaml --filename-format title conversations.json

  # Start web viewer without a file (upload file in browser)
  skimalens
`);
}

function startServer(options: ServerOptions): void {
  const { portIsExplicit, filePath } = options;
  const webRoot = path.join(__dirname, 'web');

  // Check if build exists
  if (!fs.existsSync(path.join(webRoot, 'index.html'))) {
    console.error('Error: Web assets not found. This usually means the package was not built.');
    console.error('If you are running from a source checkout, run "pnpm run build" first.');
    process.exit(1);
  }

  // Track active connections for graceful shutdown
  const connections = new Set<import('net').Socket>();

  const server = http.createServer((req, res) => {
    // Only same-origin requests from the viewer itself are expected, so no CORS
    // headers are sent: a browser on another origin must not be able to read
    // the response.
    const pathname = getPathname(req.url);

    if (pathname === null) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

    if (pathname === '/api/file') {
      serveConversationFile(res, filePath);
      return;
    }

    serveStaticFile(res, webRoot, pathname);
  });

  // Track connections
  server.on('connection', (connection) => {
    connections.add(connection);
    connection.on('close', () => {
      connections.delete(connection);
    });
  });

  listen(server, options.port, portIsExplicit, (port) => {
    const url = `http://localhost:${port}${filePath ? `/?file=cli-provided` : ''}`;
    console.log(`SkimaLens server started at ${url}`);
    console.log('Press Ctrl+C to stop.');

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

    // Force shutdown after 3 seconds
    setTimeout(() => {
      console.log('Force shutdown due to timeout.');
      process.exit(1);
    }, 3000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  // Never emitted on Windows, but harmless to register there.
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

function listen(
  server: http.Server,
  startPort: number,
  portIsExplicit: boolean,
  onListening: (port: number) => void
): void {
  let port = startPort;
  let attempt = 0;

  // Registered once: a retry must not stack up another "listening" handler, or
  // the successful attempt would report itself several times.
  server.once('listening', () => onListening(port));

  const tryListen = () => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EADDRINUSE') {
        console.error(`Error: Failed to start server: ${error.message}`);
        process.exit(1);
      }

      if (portIsExplicit) {
        console.error(`Error: Port ${port} is already in use. Choose another port with --port.`);
        process.exit(1);
      }

      attempt += 1;
      if (attempt >= MAX_PORT_ATTEMPTS) {
        console.error(
          `Error: No free port found in range ${startPort}-${startPort + MAX_PORT_ATTEMPTS - 1}. ` +
          'Specify one explicitly with --port.'
        );
        process.exit(1);
      }

      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      port += 1;
      tryListen();
    });

    server.listen(port, HOST);
  };

  tryListen();
}

function serveConversationFile(res: http.ServerResponse, filePath: string | undefined): void {
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'No file provided to CLI' }));
    return;
  }

  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  let headersSent = false;
  let isFirstChunk = true;

  stream.on('data', (chunk) => {
    if (!headersSent) {
      headersSent = true;
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        // Header values must be ASCII, so non-ASCII filenames are percent-encoded
        // and decoded again in the browser.
        'X-Filename': encodeURIComponent(path.basename(filePath))
      });
    }

    let text = chunk as string;
    if (isFirstChunk) {
      isFirstChunk = false;
      text = stripBom(text);
    }

    if (!res.write(text)) {
      stream.pause();
    }
  });

  res.on('drain', () => stream.resume());

  stream.on('end', () => {
    if (!headersSent) {
      // Empty file
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Filename': encodeURIComponent(path.basename(filePath))
      });
    }
    res.end();
  });

  stream.on('error', (error) => {
    console.error(`Error reading file: ${error.message}`);
    if (!headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Failed to read file' }));
    } else {
      res.destroy();
    }
  });

  res.on('close', () => stream.destroy());
}

function serveStaticFile(res: http.ServerResponse, webRoot: string, pathname: string): void {
  const requested = resolveWithinRoot(webRoot, pathname);

  if (requested === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  let target = requested;
  if (!isReadableFile(target)) {
    // Hashed build assets must 404 instead of silently returning the SPA shell,
    // otherwise a typo in an asset URL looks like a working response.
    if (pathname.startsWith('/static/')) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    // Anything else is treated as a client-side route.
    target = path.join(webRoot, 'index.html');
  }

  const stream = fs.createReadStream(target);
  let headersSent = false;

  stream.on('open', () => {
    headersSent = true;
    res.writeHead(200, { 'Content-Type': getContentType(path.extname(target)) });
  });

  stream.on('error', () => {
    if (!headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    } else {
      res.destroy();
    }
  });

  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

function isReadableFile(target: string): boolean {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function openBrowser(url: string): void {
  // Check if running in VSCode or other environments where xdg-open might not work
  if (process.env.VSCODE_PID || process.env.TERM_PROGRAM === 'vscode') {
    console.log(`\n🌐 Open this URL in your browser: ${url}\n`);
    return;
  }

  const fallback = () => console.log(`\n🌐 Open this URL in your browser: ${url}\n`);

  try {
    if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).on('error', fallback).unref();
    } else if (process.platform === 'win32') {
      // `start` is a cmd builtin, so cmd is invoked directly rather than through
      // `shell: true` (which would break on URLs containing "&"). The empty
      // string is the window title argument `start` expects first.
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true })
        .on('error', fallback)
        .unref();
    } else {
      openBrowserLinux(url, fallback);
    }
  } catch {
    fallback();
  }
}

function openBrowserLinux(url: string, fallback: () => void): void {
  const commands = ['xdg-open', 'sensible-browser', 'x-www-browser', 'firefox', 'google-chrome', 'chromium'];

  const tryNext = (index: number) => {
    if (index >= commands.length) {
      fallback();
      return;
    }

    // spawn only reports a missing binary asynchronously via "error", so each
    // candidate has to be attempted in turn rather than in a plain loop.
    const child = spawn(commands[index], [url], { detached: true, stdio: 'ignore' });
    child.on('error', () => tryNext(index + 1));
    child.unref();
  };

  tryNext(0);
}

main().catch((error) => {
  console.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
