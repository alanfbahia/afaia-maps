// ============================================================
//  modules/mbtiles/metadata.js
//  Extrai e valida metadados de arquivos .mbtiles
//  MBTiles é um SQLite com schema padronizado (MapBox spec)
// ============================================================
import Database from 'better-sqlite3';
import { existsSync, statSync } from 'fs';

/**
 * @typedef {Object} MBTilesMetadata
 * @property {string}   name        - Nome do tileset
 * @property {string}   description - Descrição
 * @property {string}   format      - Formato dos tiles: png | jpg | pbf | webp
 * @property {number}   minzoom     - Nível de zoom mínimo
 * @property {number}   maxzoom     - Nível de zoom máximo
 * @property {number[]} bounds      - [west, south, east, north] em graus decimais
 * @property {number[]} center      - [lon, lat, zoom]
 * @property {string}   type        - overlay | baselayer
 * @property {string}   version     - Versão do tileset
 * @property {string}   attribution - Atribuição da fonte
 * @property {number}   fileSize    - Tamanho em bytes
 * @property {number}   tileCount   - Número de tiles (aproximado)
 */

/**
 * Valida se o arquivo é um MBTiles válido
 * @param {string} filePath
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateMBTiles(filePath) {
  if (!existsSync(filePath)) {
    return { valid: false, error: 'Arquivo não encontrado' };
  }

  const ext = filePath.toLowerCase();
  if (!ext.endsWith('.mbtiles')) {
    return { valid: false, error: 'Extensão deve ser .mbtiles' };
  }

  const stats = statSync(filePath);
  if (stats.size === 0) {
    return { valid: false, error: 'Arquivo vazio' };
  }

  // Limite de 5 GB
  if (stats.size > 5 * 1024 * 1024 * 1024) {
    return { valid: false, error: 'Arquivo excede 5 GB' };
  }

  let db;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true, timeout: 5000 });

    // Verifica tabela metadata
    const hasMeta = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='metadata'"
    ).get();
    if (!hasMeta) {
      return { valid: false, error: 'Tabela metadata não encontrada – arquivo não é MBTiles válido' };
    }

    // Verifica tabela tiles
    const hasTiles = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tiles','map')"
    ).all();
    if (hasTiles.length === 0) {
      return { valid: false, error: 'Tabela tiles/map não encontrada' };
    }

    // Verifica pelo menos 1 tile
    const tileCount = db.prepare('SELECT COUNT(*) AS c FROM tiles').get();
    if ((tileCount?.c ?? 0) === 0) {
      return { valid: false, error: 'Nenhum tile encontrado no arquivo' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Erro ao abrir SQLite: ${err.message}` };
  } finally {
    try { db?.close(); } catch {}
  }
}

/**
 * Extrai todos os metadados de um MBTiles
 * @param {string} filePath
 * @returns {MBTilesMetadata}
 */
export function extractMetadata(filePath) {
  const stats = statSync(filePath);

  const db = new Database(filePath, { readonly: true, fileMustExist: true, timeout: 5000 });
  try {
    // Lê a tabela metadata (key-value)
    const rows  = db.prepare('SELECT name, value FROM metadata').all();
    const meta  = Object.fromEntries(rows.map(r => [r.name, r.value]));

    // ── Bounds ────────────────────────────────────────────
    let bounds = [-180, -85.051129, 180, 85.051129]; // default world
    if (meta.bounds) {
      const parts = meta.bounds.split(',').map(Number);
      if (parts.length === 4 && parts.every(isFinite)) bounds = parts;
    }

    // ── Center ────────────────────────────────────────────
    let center = [0, 0, 2];
    if (meta.center) {
      const parts = meta.center.split(',').map(Number);
      if (parts.length === 3 && parts.every(isFinite)) center = parts;
    } else {
      // Calcula centro a partir dos bounds
      center = [
        (bounds[0] + bounds[2]) / 2,
        (bounds[1] + bounds[3]) / 2,
        Math.max(2, parseInt(meta.minzoom || '2')),
      ];
    }

    // ── Zoom levels ───────────────────────────────────────
    let minzoom = parseInt(meta.minzoom ?? '0');
    let maxzoom = parseInt(meta.maxzoom ?? '18');

    // Valida contra os tiles reais
    try {
      const actualMin = db.prepare('SELECT MIN(zoom_level) AS z FROM tiles').get();
      const actualMax = db.prepare('SELECT MAX(zoom_level) AS z FROM tiles').get();
      if (actualMin?.z != null) minzoom = Math.min(minzoom, actualMin.z);
      if (actualMax?.z != null) maxzoom = Math.max(maxzoom, actualMax.z);
    } catch {}

    // ── Tile count (aproximado) ───────────────────────────
    let tileCount = 0;
    try {
      const tc = db.prepare('SELECT COUNT(*) AS c FROM tiles').get();
      tileCount = tc?.c ?? 0;
    } catch {}

    // ── Formato ───────────────────────────────────────────
    const format = (meta.format || 'png').toLowerCase();

    return {
      name:        meta.name        || 'Mapa sem título',
      description: meta.description || '',
      format,
      minzoom,
      maxzoom,
      bounds,
      center,
      type:        meta.type        || 'baselayer',
      version:     meta.version     || '1.0',
      attribution: meta.attribution || '',
      fileSize:    stats.size,
      tileCount,
      // Extras úteis
      json:    meta.json    || null,
      scheme:  meta.scheme  || 'xyz',
    };
  } finally {
    try { db.close(); } catch {}
  }
}

/**
 * Converte bounds de array para string WKT Polygon (para PostGIS)
 * @param {number[]} bounds [west, south, east, north]
 * @returns {string} WKT
 */
export function boundsToWKT(bounds) {
  const [w, s, e, n] = bounds;
  return `POLYGON((${w} ${s},${e} ${s},${e} ${n},${w} ${n},${w} ${s}))`;
}

/**
 * Formata tamanho de arquivo
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
