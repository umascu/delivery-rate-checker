import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { networkInterfaces } from 'node:os';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function localNetworkUrls() {
  const urls = [`http://127.0.0.1:${port}/`];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        urls.push(`http://${entry.address}:${port}/`);
      }
    }
  }
  return urls;
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = normalize(join(root, pathname));
  if (!file.startsWith(root)) {
    response.writeHead(403);
    response.end('forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    const ext = extname(file);
    const cacheControl = ext === '.html' || ext === '.js' || ext === '.css' || ext === '.webmanifest'
      ? 'no-cache'
      : 'public, max-age=86400';
    response.writeHead(200, {
      'content-type': types[ext] || 'application/octet-stream',
      'cache-control': cacheControl
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
}).listen(port, host, () => {
  console.log('Open one of these URLs:');
  for (const url of localNetworkUrls()) console.log(`  ${url}`);
});
