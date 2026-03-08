// ============================================================
//  ROUTES – Tiles MBTiles
//  GET  /tiles/:mapId/:z/:x/:y.png    → retorna tile PNG/JPEG
//  GET  /tiles/:mapId/info            → metadados do MBTiles
//  GET  /tiles/:mapId/preview         → imagem de preview (tile central)
//  GET  /tiles/stats                  → estatísticas do cache LRU
// ============================================================
import { Hono } from 'hono';
import { join, resolve } from 'path';
import { query } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import { getConnection, cacheStats } from '../modules/mbtiles/cache.js';
import { extractMetadata, formatFileSize } from '../modules/mbtiles/metadata.js';

const tiles = new Hono();

// Diretório raiz dos uploads
const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || './uploads');

// Tile transparente 256×256 para retornar quando tile não existe
const TRANSPARENT_TILE_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAAtJREFUaN7twTEBAAAAwqD1T20ND6AAAAAAAAAAAAAA4N8AKvAAAQ==';

let transparentTileBuffer = null;
function getTransparentTile() {
  if (!transparentTileBuffer) {
    transparentTileBuffer = Buffer.from(TRANSPARENT_TILE_B64, 'base64');
  }
  return transparentTileBuffer;
}

// ── Helpers ───────────────────────────────────────────────

/**
 * Busca mapa no banco e verifica permissão de acesso
 */
async function getMap(mapId, userId) {
  const result = await query(
    `SELECT id, user_id, name, file_path, file_type, min_zoom, max_zoom,
            is_public, is_offline,
            ST_AsGeoJSON(bounds)::json AS bounds
     FROM maps
     WHERE id = $1
       AND file_type = 'mbtiles'
       AND (user_id = $2 OR is_public = TRUE)
     LIMIT 1`,
    [mapId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Inverte o eixo Y (TMS → XYZ)
 * MBTiles usa TMS (y=0 no sul), Leaflet usa XYZ (y=0 no norte)
 */
function tmsY(z, y) {
  return Math.pow(2, z) - 1 - y;
}

// ── Middleware de autenticação opcional ───────────────────
// Permite tiles públicos sem token, exige token para mapas privados
tiles.use('*', async (c, next) => {
  // Tenta autenticar mas não falha se não houver token
  try {
    const header = c.req.header('Authorization');
    if (header?.startsWith('Bearer ')) {
      await authMiddleware(c, async () => {});
    }
  } catch {}
  await next();
});

// ── GET /stats – estatísticas do cache LRU ────────────────
tiles.get('/stats', async (c) => {
  const stats = cacheStats();
  return c.json(stats);
});

// ── GET /:mapId/info – metadados do tileset ────────────────
tiles.get('/:mapId/info', async (c) => {
  const { mapId } = c.req.param();
  const userId    = c.get('user')?.id || '00000000-0000-0000-0000-000000000000';

  const map = await getMap(mapId, userId).catch(() => null);
  if (!map) return c.json({ error: 'Mapa não encontrado ou sem permissão' }, 404);

  try {
    const filePath = resolve(UPLOAD_DIR, '..', map.file_path);
    const metadata = extractMetadata(filePath);

    return c.json({
      id:          map.id,
      name:        map.name,
      ...metadata,
      fileSizeFormatted: formatFileSize(metadata.fileSize),
      // URL template para Leaflet
      tileUrl:     `/tiles/${map.id}/{z}/{x}/{y}.png`,
    });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET /:mapId/preview – tile de preview ─────────────────
tiles.get('/:mapId/preview', async (c) => {
  const { mapId } = c.req.param();
  const userId    = c.get('user')?.id || '00000000-0000-0000-0000-000000000000';

  const map = await getMap(mapId, userId).catch(() => null);
  if (!map) return c.json({ error: 'Mapa não encontrado' }, 404);

  try {
    const filePath = resolve(UPLOAD_DIR, '..', map.file_path);
    const db       = getConnection(mapId, filePath);

    // Busca tile de preview (zoom intermediário, tile mais central)
    const midZoom  = Math.round(((map.min_zoom || 0) + (map.max_zoom || 10)) / 2);

    const tile = db.prepare(`
      SELECT tile_data FROM tiles
      WHERE zoom_level = ?
      ORDER BY ABS(tile_column - (SELECT AVG(tile_column) FROM tiles WHERE zoom_level = ?)) +
               ABS(tile_row    - (SELECT AVG(tile_row)    FROM tiles WHERE zoom_level = ?))
      LIMIT 1
    `).get(midZoom, midZoom, midZoom);

    if (!tile?.tile_data) {
      return new Response(getTransparentTile(), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }
      });
    }

    const contentType = tile.tile_data[0] === 0xFF ? 'image/jpeg' : 'image/png';
    return new Response(tile.tile_data, {
      headers: {
        'Content-Type':  contentType,
        'Cache-Control': 'public, max-age=86400',
      }
    });
  } catch (err) {
    console.error('[Tiles] Preview error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── GET /:mapId/:z/:x/:y.png – servir tile ─────────────────
tiles.get('/:mapId/:z/:x/:y', async (c) => {
  const { mapId, z: zStr, x: xStr, y: yStr } = c.req.param();

  const z = parseInt(zStr, 10);
  const x = parseInt(xStr, 10);
  // Remove extensão (.png, .jpg, .jpeg, .webp)
  const y = parseInt(yStr.replace(/\.(png|jpg|jpeg|webp)$/i, ''), 10);

  // Validação básica
  if (isNaN(z) || isNaN(x) || isNaN(y) || z < 0 || z > 22) {
    return new Response(getTransparentTile(), {
      headers: { 'Content-Type': 'image/png' }
    });
  }

  const userId = c.get('user')?.id || '00000000-0000-0000-0000-000000000000';

  // Cache no header para CDN
  const cacheHeaders = {
    'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=86400', // 30 dias
    'Access-Control-Allow-Origin': '*',
    'Vary': 'Accept-Encoding',
  };

  try {
    // Busca mapa no banco (com cache simples em memória por 60s)
    const map = await getMapCached(mapId, userId);

    if (!map) {
      // Retorna tile transparente em vez de 404 para não quebrar Leaflet
      return new Response(getTransparentTile(), {
        headers: { 'Content-Type': 'image/png', ...cacheHeaders }
      });
    }

    const filePath = resolve(UPLOAD_DIR, '..', map.file_path);
    const db       = getConnection(mapId, filePath);

    // MBTiles usa TMS: y invertido em relação ao XYZ do Leaflet
    const tmsYVal  = tmsY(z, y);

    // Busca o tile
    const tile = db.prepare(
      'SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?'
    ).get(z, x, tmsYVal);

    if (!tile?.tile_data) {
      // Tile não existe → retorna transparente (não 404)
      return new Response(getTransparentTile(), {
        headers: { 'Content-Type': 'image/png', ...cacheHeaders }
      });
    }

    // Detecta formato pelo magic bytes
    const data = tile.tile_data;
    let contentType = 'image/png';
    if (data[0] === 0xFF && data[1] === 0xD8) contentType = 'image/jpeg';
    else if (data[0] === 0x52 && data[1] === 0x49) contentType = 'image/webp';
    else if (data[0] === 0x1F && data[1] === 0x8B) {
      // gzip → MVT/PBF (vector tiles)
      contentType = 'application/x-protobuf';
      cacheHeaders['Content-Encoding'] = 'gzip';
    }

    return new Response(data, {
      headers: { 'Content-Type': contentType, ...cacheHeaders }
    });

  } catch (err) {
    console.error(`[Tiles] Erro ${mapId}/${z}/${x}/${y}:`, err.message);
    return new Response(getTransparentTile(), {
      headers: { 'Content-Type': 'image/png' }
    });
  }
});

// ── Cache de mapas (evita query ao banco por tile) ────────
const _mapCache = new Map(); // mapId → { map, expiresAt }
const MAP_CACHE_TTL = 60_000; // 60 segundos

async function getMapCached(mapId, userId) {
  const cached = _mapCache.get(mapId);
  if (cached && cached.expiresAt > Date.now()) {
    // Verifica permissão básica
    if (cached.map.is_public || cached.map.user_id === userId) return cached.map;
    return null;
  }

  const map = await getMap(mapId, userId);
  if (map) {
    _mapCache.set(mapId, { map, expiresAt: Date.now() + MAP_CACHE_TTL });
    // Limpa cache a cada 5 min
    if (_mapCache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of _mapCache) {
        if (v.expiresAt <= now) _mapCache.delete(k);
      }
    }
  }
  return map;
}

export default tiles;
