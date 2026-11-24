import http from 'node:http';
import { readFileSync } from 'node:fs';
// Loopback only. Page is served as localhost, the cross-origin frame as 127.0.0.1.
export const serve = (port = 8799) => new Promise((r) => {
  const s = http.createServer((q, a) => {
    const f = new URL(q.url, 'http://x').pathname.replace(/[^a-z0-9.-]/gi, '');
    try { const b = readFileSync('lab/fixtures/' + f); a.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); a.end(b); }
    catch { a.writeHead(404); a.end(); }
  }).listen(port, '127.0.0.1', () => r(s));
});
