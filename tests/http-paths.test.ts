import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { getContentType, getPathname, resolveWithinRoot } from '../bin/http-paths';

const root = path.resolve('/srv/skimalens/dist/web');

describe('getPathname', () => {
	it('drops the query string', () => {
		expect(getPathname('/?file=cli-provided')).toBe('/');
		expect(getPathname('/about?x=1#y')).toBe('/about');
	});

	it('collapses dot segments', () => {
		expect(getPathname('/static/../index.html')).toBe('/index.html');
		expect(getPathname('/a/b/../../c')).toBe('/c');
	});

	it('defaults a missing url to the root', () => {
		expect(getPathname(undefined)).toBe('/');
	});
});

describe('resolveWithinRoot', () => {
	it('serves index.html for the root path', () => {
		expect(resolveWithinRoot(root, '/')).toBe(path.join(root, 'index.html'));
		expect(resolveWithinRoot(root, '')).toBe(path.join(root, 'index.html'));
	});

	it('resolves ordinary asset paths below the root', () => {
		expect(resolveWithinRoot(root, '/static/js/index.js')).toBe(
			path.join(root, 'static', 'js', 'index.js'),
		);
	});

	it('keeps absolute-looking paths inside the root', () => {
		// A leading "/" must not escape to the filesystem root.
		expect(resolveWithinRoot(root, '/etc/hostname')).toBe(path.join(root, 'etc', 'hostname'));
	});

	it('rejects traversal above the root', () => {
		expect(resolveWithinRoot(root, '../../etc/passwd')).toBeNull();
		expect(resolveWithinRoot(root, 'static/../../../etc/passwd')).toBeNull();
	});

	it('rejects percent-encoded traversal', () => {
		// %2f survives URL parsing, so decoding has to happen before the check.
		expect(resolveWithinRoot(root, '..%2f..%2fetc%2fpasswd')).toBeNull();
		expect(resolveWithinRoot(root, '%2e%2e/%2e%2e/etc/passwd')).toBeNull();
	});

	it('rejects null bytes', () => {
		expect(resolveWithinRoot(root, '/index.html%00.js')).toBeNull();
	});

	it('rejects malformed percent-encoding', () => {
		expect(resolveWithinRoot(root, '/%zz')).toBeNull();
	});

	it('does not treat a sibling directory with a shared prefix as inside the root', () => {
		expect(resolveWithinRoot(root, '../web-backup/secret.txt')).toBeNull();
	});
});

describe('getContentType', () => {
	it('marks text formats as utf-8', () => {
		expect(getContentType('.html')).toBe('text/html; charset=utf-8');
		expect(getContentType('.JS')).toBe('text/javascript; charset=utf-8');
		expect(getContentType('.css')).toBe('text/css; charset=utf-8');
	});

	it('falls back to a binary type for unknown extensions', () => {
		expect(getContentType('.bin')).toBe('application/octet-stream');
		expect(getContentType('')).toBe('application/octet-stream');
	});
});
