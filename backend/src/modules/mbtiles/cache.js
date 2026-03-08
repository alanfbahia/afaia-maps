// ============================================================
//  modules/mbtiles/cache.js
//  Cache LRU de conexões SQLite (better-sqlite3)
//  Evita abrir/fechar o arquivo a cada tile request
// ============================================================
import Database from 'better-sqlite3';
import { existsSync } from 'fs';

const MAX_CONNECTIONS = 20;          // máximo de arquivos abertos simultaneamente
const TTL_MS          = 5 * 60_000; // fecha conexão inativa após 5 min

/**
 * Entrada do cache
 * @typedef {{ db: Database, lastUsed: number, mapId: string }} CacheEntry
 */

/** @type {Map<string, CacheEntry>} */
const _cache = new Map();

let _sweepTimer = null;

/**
 * Retorna (ou abre) uma conexão SQLite para o MBTiles
 * @param {string} mapId  - UUID do mapa
 * @param {string} filePath - caminho absoluto do arquivo .mbtiles
 * @returns {Database.Database}
 */
export function getConnection(mapId, filePath) {
  // Cache hit
  if (_cache.has(mapId)) {
    const entry = _cache.get(mapId);
    entry.lastUsed = Date.now();
    return entry.db;
  }

  // Verifica se o arquivo existe
  if (!existsSync(filePath)) {
    throw new Error(`MBTiles não encontrado: ${filePath}`);
  }

  // Evicção LRU se cheio
  if (_cache.size >= MAX_CONNECTIONS) {
    evictLRU();
  }

  // Abre nova conexão (readonly)
  const db = new Database(filePath, {
    readonly:  true,
    fileMustExist: true,
    timeout:   5000,
  });

  // Otimizações de performance para leitura
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous   = OFF');
  db.pragma('cache_size     = -32000'); // 32 MB de cache SQLite
  db.pragma('mmap_size      = 268435456'); // 256 MB mmap

  _cache.set(mapId, { db, lastUsed: Date.now(), mapId, filePath });

  console.log(`[MBTiles] Conexão aberta: ${mapId} (total: ${_cache.size})`);

  // Inicia varredura periódica
  if (!_sweepTimer) {
    _sweepTimer = setInterval(sweepIdle, 60_000);
    _sweepTimer.unref?.(); // não bloqueia shutdown do Node
  }

  return db;
}

/**
 * Fecha e remove uma conexão do cache
 */
export function closeConnection(mapId) {
  const entry = _cache.get(mapId);
  if (entry) {
    try { entry.db.close(); } catch {}
    _cache.delete(mapId);
    console.log(`[MBTiles] Conexão fechada: ${mapId}`);
  }
}

/**
 * Fecha todas as conexões (para shutdown limpo)
 */
export function closeAll() {
  for (const [mapId, entry] of _cache) {
    try { entry.db.close(); } catch {}
    console.log(`[MBTiles] Fechando: ${mapId}`);
  }
  _cache.clear();
  if (_sweepTimer) { clearInterval(_sweepTimer); _sweepTimer = null; }
}

/**
 * Remove a conexão menos recentemente usada
 */
function evictLRU() {
  let oldest = null;
  let oldestTime = Infinity;

  for (const [mapId, entry] of _cache) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldest = mapId;
    }
  }

  if (oldest) closeConnection(oldest);
}

/**
 * Fecha conexões inativas há mais de TTL_MS
 */
function sweepIdle() {
  const now = Date.now();
  for (const [mapId, entry] of _cache) {
    if (now - entry.lastUsed > TTL_MS) {
      closeConnection(mapId);
    }
  }
}

/**
 * Estatísticas do cache (para admin/debug)
 */
export function cacheStats() {
  const entries = [];
  for (const [mapId, entry] of _cache) {
    entries.push({
      mapId,
      filePath:  entry.filePath,
      lastUsed:  new Date(entry.lastUsed).toISOString(),
      idleSecs:  Math.round((Date.now() - entry.lastUsed) / 1000),
    });
  }
  return { size: _cache.size, max: MAX_CONNECTIONS, entries };
}

// Garante shutdown limpo
process.on('exit',    closeAll);
process.on('SIGINT',  () => { closeAll(); process.exit(0); });
process.on('SIGTERM', () => { closeAll(); process.exit(0); });
