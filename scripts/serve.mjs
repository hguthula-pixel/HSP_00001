// Zero-dependency static server for local preview and Playwright.
// Usage: node scripts/serve.mjs [port]   (or PORT=9000 node scripts/serve.mjs)
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 8080);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = normalize(join(root, rel));
  if (!file.startsWith(root + sep) || file.includes(`${sep}node_modules${sep}`)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  let stat;
  try {
    stat = statSync(file);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  if (!stat.isFile()) {
    res.writeHead(404).end('Not found');
    return;
  }
  const type = types[extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  // Range support keeps <audio> seeking/looping happy in Chromium.
  if (range && /^bytes=\d*-\d*$/.test(range)) {
    let [start, end] = range.slice(6).split('-').map((v) => (v === '' ? undefined : Number(v)));
    start ??= 0;
    end = Math.min(end ?? stat.size - 1, stat.size - 1);
    if (start > end) {
      res.writeHead(416, { 'content-range': `bytes */${stat.size}` }).end();
      return;
    }
    res.writeHead(206, {
      'content-type': type,
      'content-range': `bytes ${start}-${end}/${stat.size}`,
      'content-length': end - start + 1,
      'accept-ranges': 'bytes',
      'cache-control': 'no-cache',
    });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, {
    'content-type': type,
    'content-length': stat.size,
    'accept-ranges': 'bytes',
    'cache-control': 'no-cache',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`Poorna Market preview: http://localhost:${port}/`);
});
