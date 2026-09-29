// Servidor local para testar o Hub com a mesma API (sem Netlify):  node dev-server.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { handle } from './lib/handler.mjs';
const root = path.dirname(fileURLToPath(import.meta.url)); const DATA = path.join(root, '.data'); fs.mkdirSync(DATA, { recursive: true });
const f = k => path.join(DATA, encodeURIComponent(k));
const store = {
  async get(k, o = {}) { try { const b = fs.readFileSync(f(k)); if (o.type === 'json') return JSON.parse(b.toString()); if (o.type === 'arrayBuffer') return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); return b.toString(); } catch { return null; } },
  async set(k, v) { fs.writeFileSync(f(k), typeof v === 'string' ? v : Buffer.from(v)); },
  async setJSON(k, v) { fs.writeFileSync(f(k), JSON.stringify(v)); },
  async delete(k) { try { fs.unlinkSync(f(k)); } catch {} }
};
const PORT = +process.env.PORT || 8888, HUB_KEY = process.env.HUB_KEY || '';
http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
      const r = await handle(new Request('http://x' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), store, { HUB_KEY });
      res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    const file = path.join(root, 'public', req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(fs.readFileSync(file));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(PORT, () => console.log('LBX Hub em http://localhost:' + PORT + (HUB_KEY ? ' (chave de acesso ativa)' : '')));
