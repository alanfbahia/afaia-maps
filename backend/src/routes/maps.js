// ============================================================
//  ROUTES – Maps (Biblioteca de mapas)
//  GET    /api/v1/maps
//  POST   /api/v1/maps/upload        (multipart)
//  GET    /api/v1/maps/:id
//  PUT    /api/v1/maps/:id
//  DELETE /api/v1/maps/:id
//  GET    /api/v1/maps/:id/status    (status processamento GeoPDF)
// ============================================================
import { Hono } from 'hono';
import { join, resolve, extname } from 'path';
import { existsSync, unlinkSync } from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import { enqueueGeoPDFJob } from '../modules/geodpf/queue.js';
import { validateMBTiles, extractMetadata, boundsToWKT, formatFileSize } from '../modules/mbtiles/metadata.js';

const maps = new Hono();
maps.use('*', authMiddleware);

// ── Configuração multer ───────────────────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_SIZE   = parseInt(process.env.MAX_FILE_SIZE_MB || '200') * 1024 * 1024;

const ALLOWED_EXTS = ['.pdf','.tif','.tiff','.mbtiles','.kml','.kmz','.gpx','.geojson','.json'];
const FILE_TYPES = {
  '.pdf':     'geopdf',
  '.tif':     'geotiff',
  '.tiff':    'geotiff',
  '.mbtiles': 'mbtiles',
  '.kml':     'kml',
  '.kmz':     'kml',
  '.gpx':     'gpx',
  '.geojson': 'geojson',
  '.json':    'geojson',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = join(UPLOAD_DIR, 'maps');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    ALLOWED_EXTS.includes(ext) ? cb(null, true) : cb(new Error(`Tipo não suportado: ${ext}`));
  },
});

// ── GET / – listar mapas ──────────────────────────────────
maps.get('/', async (c) => {
  const userId    = c.get('user').id;
  const projectId = c.req.query('project_id');
  const fileType  = c.req.query('file_type');
  const limit     = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset    = parseInt(c.req.query('offset') || '0');

  let sql = `
    SELECT id, name, description, file_type, file_size, thumbnail_path,
           is_georeferenced, crs, min_zoom, max_zoom,
           geodpf_status, is_public, is_offline,
           tags, project_id, created_at,
           ST_AsGeoJSON(bounds)::json AS bounds
    FROM maps
    WHERE user_id = $1
  `;
  const params = [userId];

  if (projectId) { params.push(projectId); sql += ` AND project_id = $${params.length}`; }
  if (fileType)  { params.push(fileType);  sql += ` AND file_type  = $${params.length}`; }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return c.json({ data: result.rows, total: result.rows.length });
});

// ── POST /upload – upload de mapa ─────────────────────────
// Hono não tem suporte nativo a multipart/form-data com multer
// Usamos um workaround com NodeJS raw request
maps.post('/upload', async (c) => {
  const userId = c.get('user').id;

  return new Promise((resolve) => {
    const req = c.env?.incoming;
    const res = {};

    upload.single('file')(req, res, async (err) => {
      if (err) {
        resolve(c.json({ error: err.message }, 400));
        return;
      }

      const file = req.file;
      if (!file) {
        resolve(c.json({ error: 'Nenhum arquivo enviado' }, 400));
        return;
      }

      const ext      = extname(file.originalname).toLowerCase();
      const fileType = FILE_TYPES[ext] || 'image';
      const name     = req.body?.name || file.originalname.replace(ext, '');
      const projectId = req.body?.project_id || null;
      const tags      = req.body?.tags ? req.body.tags.split(',').map(t => t.trim()) : [];

      try {
        // ── Processamento MBTiles: extrai metadata ───────
        let mbMeta = null;
        let boundsWKT = null;

        if (fileType === 'mbtiles') {
          const validation = validateMBTiles(file.path);
          if (!validation.valid) {
            if (existsSync(file.path)) unlinkSync(file.path);
            resolve(c.json({ error: `MBTiles inválido: ${validation.error}` }, 400));
            return;
          }

          try {
            mbMeta = extractMetadata(file.path);
            boundsWKT = boundsToWKT(mbMeta.bounds);
          } catch (metaErr) {
            console.warn('[Maps] Falha ao extrair metadata MBTiles:', metaErr.message);
            // Não bloqueia o upload, apenas salva sem metadata
          }
        }

        const result = await query(
          `INSERT INTO maps
             (user_id, name, description, file_type, file_path, file_size,
              project_id, tags, geodpf_status, is_georeferenced,
              min_zoom, max_zoom, bounds, tile_format, extra_metadata)
           VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8,
             CASE WHEN $4 = 'geopdf' THEN 'pending' ELSE 'not_applicable' END,
             CASE WHEN $4 IN ('geotiff','mbtiles') THEN TRUE ELSE FALSE END,
             $9, $10,
             CASE WHEN $11 IS NOT NULL
               THEN ST_GeomFromText($11, 4326)
               ELSE NULL
             END,
             $12,
             $13
           )
           RETURNING *`,
          [
            userId,
            name,
            mbMeta?.description || req.body?.description || null,
            fileType,
            file.path,
            file.size,
            projectId,
            tags,
            mbMeta?.minzoom ?? null,
            mbMeta?.maxzoom ?? null,
            boundsWKT,
            mbMeta?.format || null,
            mbMeta ? JSON.stringify({
              tileCount:   mbMeta.tileCount,
              attribution: mbMeta.attribution,
              version:     mbMeta.version,
              center:      mbMeta.center,
              scheme:      mbMeta.scheme,
              type:        mbMeta.type,
            }) : null,
          ]
        );

        const map = result.rows[0];

        // Se for GeoPDF, enfileira processamento
        if (fileType === 'geopdf') {
          await enqueueGeoPDFJob(map.id, userId, file.path);
        }

        // Adiciona informações formatadas na resposta
        const response = {
          ...map,
          ...(mbMeta && {
            mbtiles_info: {
              tileCount:         mbMeta.tileCount,
              fileSizeFormatted: formatFileSize(file.size),
              attribution:       mbMeta.attribution,
              center:            mbMeta.center,
              tileUrl:           `/tiles/${map.id}/{z}/{x}/{y}.png`,
            }
          })
        };

        resolve(c.json(response, 201));
      } catch (dbErr) {
        // Remove arquivo em caso de erro de DB
        if (existsSync(file.path)) unlinkSync(file.path);
        resolve(c.json({ error: dbErr.message }, 500));
      }
    });
  });
});

// ── GET /:id ──────────────────────────────────────────────
maps.get('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    `SELECT *, ST_AsGeoJSON(bounds)::json AS bounds
     FROM maps WHERE id = $1 AND (user_id = $2 OR is_public = TRUE)`,
    [id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Mapa não encontrado' }, 404);
  return c.json(result.rows[0]);
});

// ── PUT /:id – atualizar metadados ────────────────────────
maps.put('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();
  const body   = await c.req.json().catch(() => ({}));

  const { name, description, is_public, is_offline, tags, project_id } = body;

  const result = await query(
    `UPDATE maps SET
       name        = COALESCE($1, name),
       description = COALESCE($2, description),
       is_public   = COALESCE($3, is_public),
       is_offline  = COALESCE($4, is_offline),
       tags        = COALESCE($5, tags),
       project_id  = COALESCE($6, project_id)
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
    [name, description, is_public, is_offline, tags, project_id, id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Mapa não encontrado' }, 404);
  return c.json(result.rows[0]);
});

// ── DELETE /:id ───────────────────────────────────────────
maps.delete('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    'DELETE FROM maps WHERE id = $1 AND user_id = $2 RETURNING file_path',
    [id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Mapa não encontrado' }, 404);

  // Remove arquivo físico
  const fp = result.rows[0].file_path;
  if (fp && existsSync(fp)) unlinkSync(fp);

  return c.json({ deleted: true });
});

// ── GET /:id/status – status do processamento GeoPDF ──────
maps.get('/:id/status', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    `SELECT m.geodpf_status, m.geodpf_metadata, j.status AS job_status,
            j.progress, j.log, j.error_msg, j.started_at, j.finished_at
     FROM maps m
     LEFT JOIN geodpf_jobs j ON j.map_id = m.id
     WHERE m.id = $1 AND m.user_id = $2
     ORDER BY j.created_at DESC LIMIT 1`,
    [id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Mapa não encontrado' }, 404);
  return c.json(result.rows[0]);
});

export default maps;
