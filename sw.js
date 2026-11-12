const CORE = 'bicimvr-v3';
const CORE_FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const TILE_HOSTS = /(^|\.)tile\.openstreetmap\.org$|(^|\.)tile-cyclosm\.openstreetmap\.fr$|(^|\.)tile\.opentopomap\.org$/;
const PERIOD = 14 * 24 * 3600 * 1000;      // las teselas se guardan >= 14 dias (el minimo exigido es 7)
const MAX_TILES = 3000;
const tileCache = off => 'tiles-' + (Math.floor(Date.now() / PERIOD) - off);

self.addEventListener('install', e => { e.waitUntil(caches.open(CORE).then(c => c.addAll(CORE_FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CORE && k !== tileCache(0) && k !== tileCache(1)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function trim(c){ const ks = await c.keys(); for (let i = 0; i < ks.length - MAX_TILES; i++) await c.delete(ks[i]); }
async function tileResponse(req){
  const cur = await caches.open(tileCache(0)), prev = await caches.open(tileCache(1));
  const hit = (await cur.match(req.url, { ignoreVary: true })) || (await prev.match(req.url, { ignoreVary: true }));
  if (hit) return hit;
  try {
    const r = await fetch(req);
    if (r && (r.ok || r.type === 'opaque')){ await cur.put(req.url, r.clone()); trim(cur); }
    return r;
  } catch(err){ return Response.error(); }
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (TILE_HOSTS.test(u.hostname)){ e.respondWith(tileResponse(e.request)); return; }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request).then(r => { if (r && (r.ok || r.type === 'opaque')){ const copy = r.clone(); caches.open(CORE).then(c => c.put(e.request, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
