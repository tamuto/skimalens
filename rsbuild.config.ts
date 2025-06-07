import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { TanStackRouterRspack } from "@tanstack/router-plugin/rspack";
import fs from 'fs';
import path from 'path';

export default defineConfig({
	plugins: [pluginReact()],
	source: {
		entry: { index: "./src/main.tsx" },
	},
	html: {
		template: "./index.html",
	},
	tools: {
		rspack: {
			plugins: [TanStackRouterRspack()],
		},
	},
	dev: {
		setupMiddlewares: [
			(middlewares, devServer) => {
				// API endpoint to serve files for CLI
				middlewares.unshift({
					name: 'cli-file-server',
					middleware: (req, res, next) => {
						if (req.url?.startsWith('/api/file')) {
							const url = new URL(req.url, `http://${req.headers.host}`);
							const filePath = url.searchParams.get('path');
							
							if (!filePath) {
								res.writeHead(400, { 'Content-Type': 'application/json' });
								res.end(JSON.stringify({ error: 'File path is required' }));
								return;
							}

							try {
								if (!fs.existsSync(filePath)) {
									res.writeHead(404, { 'Content-Type': 'application/json' });
									res.end(JSON.stringify({ error: 'File not found' }));
									return;
								}

								const content = fs.readFileSync(filePath, 'utf-8');
								res.writeHead(200, { 
									'Content-Type': 'text/plain',
									'Access-Control-Allow-Origin': '*',
									'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
									'Access-Control-Allow-Headers': 'Content-Type'
								});
								res.end(content);
							} catch (error) {
								res.writeHead(500, { 'Content-Type': 'application/json' });
								res.end(JSON.stringify({ error: `Failed to read file: ${error}` }));
							}
						} else {
							next();
						}
					}
				});
			}
		]
	}
});
