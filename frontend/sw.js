// ============================================================
//  Service Worker – Afaia Maps PWA v3
//  Estratégias otimizadas para uso como app nativo (Capacitor)
//  v3: Adiciona suporte a tiles MBTiles locais (/tiles/*)
// ============================================================

const CACHE_VERSION   = 'afaia-v3';
const STATIC_CACHE    = `${CACHE_VERSION}-static`;
const TILES_CACHE     = `${CACHE_VERSION}-tiles`;
const MBTILES_CACHE   = `${CACHE_VERSION}-mbtiles`;  // tiles do servidor próprio
const API_CACHE       = `${CACHE_VERSION}-api`;
const MAPS_CACHE      = `${CACHE_VERSION}-maps`;

// Assets que compõem o "app shell" – cacheados imediatamente
const APP_SHELL = [
  '/',
  '/index.html',
  '/login.html',
  '/app.html',
  '/maps-library.html',
  '/manifest.json',
  '/css/app.css',
  '/css/mobile.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/db.js',
  '/js/map.js',
  '/js/tracks.js',
  '/js/waypoints.js',
  '/js/sync.js',
  '/js/capacitor.js',
  '/js/mbtiles.js',
];

// Domínios de tiles para cachear agressivamente
const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'tiles.stadiamaps.com',
  'server.arcgisonline.com',
  'tile.opentopomap.org',
  'a.tile.opentopomap.org',
  'b.tile.opentopomap.org',
  'c.tile.opentopomap.org',
];

// ── INSTALL – pré-cacheia o shell ─────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW v3] Instalando...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        // Adiciona um a um para não falhar tudo se um asset faltar
        return Promise.allSettled(
          APP_SHELL.map(url => cache.add(url).catch(e => console.warn('[SW] Não cacheou:', url, e.message)))
        );
      })
      .then(() => {
        console.log('[SW v3] Shell cacheado. Forçando ativação...');
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE – remove caches antigos ─────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW v3] Ativando...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('afaia-') && !k.startsWith(CACHE_VERSION))
          .map(k => {
            console.log('[SW v3] Removendo cache antigo:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH – roteador de requisições ──────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-GET (exceto sync)
  if (request.method !== 'GET') return;

  // Ignora chrome-extension, capacitor://, etc.
  if (!['http:', 'https:'].includes(url.protocol)) return;

  // 1. Tiles MBTiles do servidor próprio → Cache agressivo
  if (isMBTilesServerRequest(url)) {
    event.respondWith(mbtilesServerStrategy(request));
    return;
  }

  // 2. Tiles de mapa externos → Cache-first agressivo (365 dias)
  if (isTileRequest(url)) {
    event.respondWith(tileStrategy(request));
    return;
  }

  // 3. API → Network-first com fallback offline
  if (isApiRequest(url)) {
    event.respondWith(apiStrategy(request));
    return;
  }

  // 4. Arquivos de mapa (PDFs, GeoTIFFs, etc.) → Cache on demand
  if (isMapFileRequest(url)) {
    event.respondWith(mapFileStrategy(request));
    return;
  }

  // 5. App shell e assets estáticos → Cache-first
  event.respondWith(staticStrategy(request));
});

// ── Estratégia: tiles MBTiles do servidor próprio ─────────
// Cache muito agressivo – 90 dias – pois são tiles estáticos do arquivo
async function mbtilesServerStrategy(request) {
  const cache  = await caches.open(MBTILES_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // Retorna imediatamente do cache (tiles são imutáveis)
    return cached;
  }

  try {
    const response = await fetchWithTimeout(request, 10000);
    if (response.ok) {
      // Clona e adiciona headers de cache
      const clone = response.clone();
      const headers = new Headers(clone.headers);
      headers.set('Cache-Control', `max-age=${90 * 24 * 3600}`);
      headers.set('X-SW-Cached', new Date().toISOString());
      const cachedResponse = new Response(await clone.arrayBuffer(), {
        status: response.status,
        headers,
      });
      cache.put(request, cachedResponse);
    }
    return response;
  } catch {
    // Tile offline não disponível → transparente
    return new Response(
      atob('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAAtJREFUaN7twTEBAAAAwqD1T20ND6AAAAAAAAAAAAAA4N8AKvAAAQ=='),
      { status: 200, headers: { 'Content-Type': 'image/png' } }
    );
  }
}

// ── Estratégia: tiles de mapa externos ─────────────────────
async function tileStrategy(request) {
  const cache  = await caches.open(TILES_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // Retorna do cache imediatamente, atualiza em background
    fetchAndCache(request, cache).catch(() => {});
    return cached;
  }

  try {
    const response = await fetchWithTimeout(request, 8000);
    if (response.ok) {
      const clone = response.clone();
      cache.put(request, addCacheHeaders(clone, 365 * 24 * 3600));
    }
    return response;
  } catch {
    // Tile não disponível offline – retorna tile transparente 1x1
    return new Response(
      atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
      { status: 200, headers: { 'Content-Type': 'image/png' } }
    );
  }
}

// ── Estratégia: API ───────────────────────────────────────
async function apiStrategy(request) {
  try {
    const response = await fetchWithTimeout(request, 10000);

    // Cacheia respostas GET bem-sucedidas por 5 minutos
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(API_CACHE);
      cache.put(request, addCacheHeaders(response.clone(), 300));
    }
    return response;
  } catch (networkErr) {
    // Offline – tenta cache da API
    const cache  = await caches.open(API_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      // Adiciona header indicando que é dado offline
      const headers = new Headers(cached.headers);
      headers.set('X-SW-Cache', 'offline');
      return new Response(cached.body, { status: cached.status, headers });
    }

    // Resposta padrão offline
    return new Response(
      JSON.stringify({
        error:   'offline',
        message: 'Sem conexão. Usando dados locais.',
        offline: true,
      }),
      {
        status:  503,
        headers: { 'Content-Type': 'application/json', 'X-SW-Cache': 'fallback' },
      }
    );
  }
}

// ── Estratégia: arquivos de mapa (cache on demand) ────────
async function mapFileStrategy(request) {
  const cache  = await caches.open(MAPS_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ── Estratégia: assets estáticos ─────────────────────────
async function staticStrategy(request) {
  const cache  = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // SPA fallback
    if (request.headers.get('accept')?.includes('text/html')) {
      const shell = await cache.match('/index.html') || await cache.match('/app.html');
      if (shell) return shell;
    }
    return new Response('', { status: 503 });
  }
}

// ── Helpers ───────────────────────────────────────────────
function isMBTilesServerRequest(url) {
  // Tiles servidos pelo nosso backend: /tiles/{mapId}/{z}/{x}/{y}.png
  return url.pathname.match(/^\/tiles\/[a-f0-9-]{36}\/\d+\/\d+\/\d+/);
}

function isTileRequest(url) {
  return TILE_HOSTS.some(h => url.hostname.includes(h));
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isMapFileRequest(url) {
  return url.pathname.startsWith('/uploads/') ||
    /\.(pdf|tif|tiff|mbtiles|gpx|kml|geojson)$/i.test(url.pathname);
}

async function fetchAndCache(request, cache) {
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms);
    fetch(request).then(res => { clearTimeout(timer); resolve(res); }, reject);
  });
}

function addCacheHeaders(response, maxAge) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', `max-age=${maxAge}`);
  headers.set('X-SW-Cached', new Date().toISOString());
  return new Response(response.body, { status: response.status, headers });
}

// ── Background Sync ───────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-data') {
    console.log('[SW v2] Background sync disparado');
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(client => client.postMessage({ type: 'BACKGROUND_SYNC' }));
}

// ── Periodic Background Sync (experimental) ──────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-sync') {
    event.waitUntil(notifyClientsToSync());
  }
});

// ── Push Notifications ─────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = { title: 'Afaia Maps', body: '', url: '/' };
  try { data = { ...data, ...event.data.json() }; }
  catch { data.body = event.data.text(); }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-72.png',
      tag:     data.tag    || 'afaia-notification',
      renotify: data.renotify || false,
      data:    { url: data.url },
      actions: data.actions || [],
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) return client.focus();
        }
        return clients.openWindow(url);
      })
  );
});

// ── Message handler (comunicação com o app) ───────────────
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_MAP_FILE':
      // Cacheia arquivo de mapa ou tile sob demanda
      if (payload?.url) {
        const isMBTile = /\/tiles\/[a-f0-9-]{36}\/\d+\/\d+\/\d+/.test(payload.url);
        const cacheName = isMBTile ? MBTILES_CACHE : MAPS_CACHE;
        caches.open(cacheName)
          .then(cache => cache.add(payload.url))
          .catch(() => {});
      }
      break;

    case 'CLEAR_TILES_CACHE':
      Promise.all([
        caches.delete(TILES_CACHE),
        caches.delete(MBTILES_CACHE),
      ]).then(() => event.source?.postMessage({ type: 'TILES_CACHE_CLEARED' }));
      break;

    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => event.source?.postMessage({ type: 'CACHE_SIZE', size }));
      break;
  }
});

async function getCacheSize() {
  const sizes = {};
  for (const name of [STATIC_CACHE, TILES_CACHE, MBTILES_CACHE, API_CACHE, MAPS_CACHE]) {
    const cache = await caches.open(name);
    const keys  = await cache.keys();
    sizes[name] = keys.length;
  }
  return sizes;
}
