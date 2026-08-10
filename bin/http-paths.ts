import * as path from 'path';

/**
 * Extract the path portion of a request URL. Returns null for malformed input.
 */
export function getPathname(requestUrl: string | undefined): string | null {
  try {
    return new URL(requestUrl || '/', 'http://localhost').pathname;
  } catch {
    return null;
  }
}

/**
 * Map a URL path onto a file below `root`.
 *
 * Returns null when the request escapes the root or is otherwise unusable, so
 * the caller can reject it instead of reading an arbitrary file off disk.
 */
export function resolveWithinRoot(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded.includes('\0')) {
    return null;
  }

  if (decoded === '/' || decoded === '') {
    return path.join(root, 'index.html');
  }

  // Strip the leading separator so `resolve` treats the rest as relative, then
  // verify the result is still inside the root.
  const relative = path.normalize(decoded).replace(/^[/\\]+/, '');
  const target = path.resolve(root, relative);

  if (target !== root && !target.startsWith(root + path.sep)) {
    return null;
  }

  return target;
}

export function getContentType(ext: string): string {
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return types[ext.toLowerCase()] || 'application/octet-stream';
}
