// LBX Hub — API compartilhada (Netlify Functions + Netlify Blobs)
// Rotas: GET/PUT /api/state · POST /api/version · PATCH|DELETE /api/version/:id · GET /api/blob/:id
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const MAX_BODY = 5.8 * 1024 * 1024;   // limite de payload das Functions síncronas do Netlify ≈ 6 MB
const EMPTY = () => ({ app: 'lbx-hub', rev: 0, shared: { active: {}, ov: {}, custom: {}, log: [] }, metas: [] });
const b64buf = b64 => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
const bufb64 = buf => { const u = new Uint8Array(buf); let s = ''; const C = 0x8000; for (let i = 0; i < u.length; i += C) s += String.fromCharCode.apply(null, u.subarray(i, i + C)); return btoa(s); };
const okId = s => typeof s === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(s);

async function load(store) { return (await store.get('state.json', { type: 'json' })) || EMPTY(); }
async function save(store, st) { st.rev = (st.rev || 0) + 1; await store.setJSON('state.json', st); return st; }
function applyMap(dst, patch) { for (const k of Object.keys(patch || {})) { if (patch[k] === null) delete dst[k]; else dst[k] = patch[k]; } }
function mergeLog(cur, add) {
  const seen = new Set(cur.map(l => l.ts + '|' + l.msg));
  const out = cur.slice(); (add || []).forEach(l => { if (l && l.ts && !seen.has(l.ts + '|' + l.msg)) out.push({ ts: +l.ts, ind: String(l.ind || ''), type: String(l.type || ''), msg: String(l.msg || '').slice(0, 300) }); });
  return out.sort((a, b) => b.ts - a.ts).slice(0, 80);
}

export async function handle(req, store, env = {}) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
  const m = req.method;
  // Leitura é aberta; qualquer alteração exige a HUB_KEY (quando definida).
  const authed = !env.HUB_KEY || req.headers.get('x-lbx-key') === env.HUB_KEY;
  if (path === '/auth' && m === 'GET') return authed ? J({ ok: true }) : J({ error: 'unauthorized' }, 401);
  if (m !== 'GET' && m !== 'HEAD' && !authed) return J({ error: 'unauthorized' }, 401);
  try {
    if (path === '/state' && m === 'GET') return J({ ...(await load(store)), locked: !!env.HUB_KEY });

    if (path === '/state' && m === 'PUT') {
      const body = await req.json(); const st = await load(store); const p = body.patch || {};
      applyMap(st.shared.active, p.active); applyMap(st.shared.ov, p.ov); applyMap(st.shared.custom, p.custom);
      st.shared.log = mergeLog(st.shared.log, body.log);
      return J(await save(store, st));
    }

    if (path === '/version' && m === 'POST') {
      const len = +req.headers.get('content-length') || 0;
      if (len > MAX_BODY) return J({ error: 'too_large' }, 413);
      const body = await req.json(); const meta = body.meta || {};
      if (!okId(meta.id) || typeof meta.ind !== 'string' || !body.gz) return J({ error: 'bad_request' }, 400);
      const clean = { id: meta.id, ind: meta.ind, ts: +meta.ts || Date.now(), kind: String(meta.kind || 'saved'), label: String(meta.label || '').slice(0, 120), size: +meta.size || 0 };
      await store.set('blob/' + clean.id, b64buf(body.gz));
      await store.setJSON('storage/' + clean.id, body.storage || {});
      const st = await load(store);
      st.metas = st.metas.filter(x => x.id !== clean.id); st.metas.push(clean);
      if (body.activate !== false) st.shared.active[clean.ind] = clean.id;
      return J(await save(store, st));
    }

    let mm = path.match(/^\/version\/([A-Za-z0-9_-]+)$/);
    if (mm && m === 'PATCH') {
      const body = await req.json(); const st = await load(store); const v = st.metas.find(x => x.id === mm[1]);
      if (!v) return J({ error: 'not_found' }, 404);
      if (typeof body.label === 'string') v.label = body.label.slice(0, 120);
      return J(await save(store, st));
    }
    if (mm && m === 'DELETE') {
      const st = await load(store); const v = st.metas.find(x => x.id === mm[1]);
      st.metas = st.metas.filter(x => x.id !== mm[1]);
      if (v && st.shared.active[v.ind] === v.id) delete st.shared.active[v.ind];
      await store.delete('blob/' + mm[1]); await store.delete('storage/' + mm[1]);
      return J(await save(store, st));
    }

    mm = path.match(/^\/blob\/([A-Za-z0-9_-]+)$/);
    if (mm && m === 'GET') {
      const buf = await store.get('blob/' + mm[1], { type: 'arrayBuffer' });
      if (!buf) return J({ error: 'not_found' }, 404);
      const storage = (await store.get('storage/' + mm[1], { type: 'json' })) || {};
      return J({ gz: bufb64(buf), storage });
    }
    return J({ error: 'not_found' }, 404);
  } catch (e) { return J({ error: 'server_error', detail: String(e && e.message || e) }, 500); }
}
