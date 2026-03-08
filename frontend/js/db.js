// ============================================================
//  db.js – IndexedDB local (armazenamento offline)
//  Usa a API nativa do browser para persistir dados sem internet
// ============================================================

const DB_NAME    = 'afaia_maps';
const DB_VERSION = 1;

let _db = null;

/** Abre (ou cria) o banco IndexedDB */
function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // ── Tracks ────────────────────────────────────────────
      if (!db.objectStoreNames.contains('tracks')) {
        const ts = db.createObjectStore('tracks', { keyPath: 'client_id' });
        ts.createIndex('project_id', 'project_id');
        ts.createIndex('status',     'status');
        ts.createIndex('created_at', 'created_at');
      }

      // ── Track Points ──────────────────────────────────────
      if (!db.objectStoreNames.contains('track_points')) {
        const tp = db.createObjectStore('track_points', { autoIncrement: true });
        tp.createIndex('track_client_id', 'track_client_id');
        tp.createIndex('recorded_at',     'recorded_at');
      }

      // ── Waypoints ─────────────────────────────────────────
      if (!db.objectStoreNames.contains('waypoints')) {
        const wp = db.createObjectStore('waypoints', { keyPath: 'client_id' });
        wp.createIndex('project_id', 'project_id');
        wp.createIndex('created_at', 'created_at');
      }

      // ── Sync Queue ────────────────────────────────────────
      if (!db.objectStoreNames.contains('sync_queue')) {
        const sq = db.createObjectStore('sync_queue', { autoIncrement: true, keyPath: 'local_id' });
        sq.createIndex('status',     'status');
        sq.createIndex('entity_type','entity_type');
      }

      // ── Maps Offline ──────────────────────────────────────
      if (!db.objectStoreNames.contains('maps_meta')) {
        db.createObjectStore('maps_meta', { keyPath: 'id' });
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Helper genérico de transação */
async function tx(storeName, mode, fn) {
  const db    = await openDB();
  const store = db.transaction(storeName, mode).objectStore(storeName);
  return new Promise((resolve, reject) => {
    const req = fn(store);
    if (req.onsuccess !== undefined) {
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    } else {
      resolve(req);
    }
  });
}

async function getAll(storeName, indexName, value) {
  const db    = await openDB();
  return new Promise((resolve, reject) => {
    const txn   = db.transaction(storeName, 'readonly');
    const store = txn.objectStore(storeName);
    const req   = indexName && value !== undefined
      ? store.index(indexName).getAll(value)
      : store.getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ── Tracks ────────────────────────────────────────────────
window.LocalDB = {

  tracks: {
    async save(track) {
      return tx('tracks', 'readwrite', s => s.put(track));
    },
    async getAll() {
      return getAll('tracks');
    },
    async get(clientId) {
      return tx('tracks', 'readonly', s => s.get(clientId));
    },
    async delete(clientId) {
      return tx('tracks', 'readwrite', s => s.delete(clientId));
    },
  },

  trackPoints: {
    async add(point) {
      return tx('track_points', 'readwrite', s => s.add(point));
    },
    async addBatch(points) {
      const db    = await openDB();
      const store = db.transaction('track_points', 'readwrite').objectStore('track_points');
      return new Promise((resolve, reject) => {
        let count = 0;
        for (const p of points) {
          const r = store.add(p);
          r.onsuccess = () => { count++; if (count === points.length) resolve(count); };
          r.onerror   = reject;
        }
        if (points.length === 0) resolve(0);
      });
    },
    async getByTrack(trackClientId) {
      return getAll('track_points', 'track_client_id', trackClientId);
    },
    async deleteByTrack(trackClientId) {
      const db    = await openDB();
      const store = db.transaction('track_points', 'readwrite').objectStore('track_points');
      const index = store.index('track_client_id');
      return new Promise((resolve, reject) => {
        const req = index.openCursor(IDBKeyRange.only(trackClientId));
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) { cursor.delete(); cursor.continue(); }
          else resolve();
        };
        req.onerror = reject;
      });
    },
  },

  waypoints: {
    async save(wp) {
      return tx('waypoints', 'readwrite', s => s.put(wp));
    },
    async getAll() {
      return getAll('waypoints');
    },
    async get(clientId) {
      return tx('waypoints', 'readonly', s => s.get(clientId));
    },
    async delete(clientId) {
      return tx('waypoints', 'readwrite', s => s.delete(clientId));
    },
  },

  syncQueue: {
    async add(op) {
      return tx('sync_queue', 'readwrite', s => s.add({ ...op, status: 'pending', created_at: Date.now() }));
    },
    async getPending() {
      return getAll('sync_queue', 'status', 'pending');
    },
    async markDone(localId) {
      const db = await openDB();
      const store = db.transaction('sync_queue', 'readwrite').objectStore('sync_queue');
      const item = await new Promise((res, rej) => {
        const r = store.get(localId); r.onsuccess = e => res(e.target.result); r.onerror = rej;
      });
      if (item) { item.status = 'done'; store.put(item); }
    },
    async clear() {
      return tx('sync_queue', 'readwrite', s => s.clear());
    },
  },

  mapsMeta: {
    async save(mapMeta) {
      return tx('maps_meta', 'readwrite', s => s.put(mapMeta));
    },
    async getAll() {
      return getAll('maps_meta');
    },
    async delete(id) {
      return tx('maps_meta', 'readwrite', s => s.delete(id));
    },
  },
};

// Inicializa o banco ao carregar o script
openDB().catch(err => console.error('[IndexedDB] Falha ao abrir:', err));
