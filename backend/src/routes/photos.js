// ============================================================
//  ROUTES – Photos (Fotos georreferenciadas)
// ============================================================
import { Hono } from 'hono';
import multer from 'multer';
import { join, extname } from 'path';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { query } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';

const photos = new Hono();
photos.use('*', authMiddleware);

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = join(UPLOAD_DIR, 'photos');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg','.jpeg','.png','.webp','.heic'];
    const ext     = extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error(`Formato não permitido: ${ext}`));
  },
});

// ── POST /upload ──────────────────────────────────────────
photos.post('/upload', async (c) => {
  const userId = c.get('user').id;

  return new Promise((resolve) => {
    const req = c.env?.incoming;

    upload.single('photo')(req, {}, async (err) => {
      if (err) { resolve(c.json({ error: err.message }, 400)); return; }

      const file = req.file;
      if (!file) { resolve(c.json({ error: 'Nenhuma foto enviada' }, 400)); return; }

      const lat         = req.body?.lat        ? parseFloat(req.body.lat) : null;
      const lng         = req.body?.lng        ? parseFloat(req.body.lng) : null;
      const altitude    = req.body?.altitude   ? parseFloat(req.body.altitude) : null;
      const bearing     = req.body?.bearing    ? parseFloat(req.body.bearing)  : null;
      const caption     = req.body?.caption    || null;
      const takenAt     = req.body?.taken_at   || new Date().toISOString();
      const waypointId  = req.body?.waypoint_id || null;
      const trackId     = req.body?.track_id   || null;
      const projectId   = req.body?.project_id || null;
      const deviceId    = req.body?.device_id  || null;
      const clientId    = req.body?.client_id  || null;

      // Gera thumbnail com sharp
      const thumbName = `thumb_${file.filename}`;
      const thumbPath = join(UPLOAD_DIR, 'photos', thumbName);
      try {
        await sharp(file.path)
          .resize(400, 400, { fit: 'inside' })
          .jpeg({ quality: 70 })
          .toFile(thumbPath);
      } catch (sharpErr) {
        console.warn('[PHOTO] Falha ao gerar thumbnail:', sharpErr.message);
      }

      try {
        const geomExpr = lat && lng
          ? `ST_SetSRID(ST_MakePoint($11, $10), 4326)`
          : 'NULL';

        const result = await query(
          `INSERT INTO photos
             (user_id, project_id, waypoint_id, track_id,
              file_path, thumbnail_path, lat, lng, altitude, bearing,
              caption, taken_at, device_id, client_id, geom, synced_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
             ${lat && lng ? `ST_SetSRID(ST_MakePoint($8, $7), 4326)` : 'NULL'},
             NOW())
           RETURNING *`,
          [userId, projectId, waypointId, trackId,
           file.path, existsSync(thumbPath) ? thumbPath : null,
           lat, lng, altitude, bearing,
           caption, takenAt, deviceId, clientId]
        );
        resolve(c.json(result.rows[0], 201));
      } catch (dbErr) {
        if (existsSync(file.path)) unlinkSync(file.path);
        resolve(c.json({ error: dbErr.message }, 500));
      }
    });
  });
});

// ── GET / – listar fotos ──────────────────────────────────
photos.get('/', async (c) => {
  const userId    = c.get('user').id;
  const projectId = c.req.query('project_id');
  const limit     = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset    = parseInt(c.req.query('offset') || '0');

  let sql = `
    SELECT id, file_path, thumbnail_path, lat, lng, altitude,
           caption, taken_at, project_id, waypoint_id, track_id, created_at
    FROM photos WHERE user_id = $1
  `;
  const params = [userId];
  if (projectId) { params.push(projectId); sql += ` AND project_id = $${params.length}`; }
  sql += ` ORDER BY taken_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return c.json({ data: result.rows, total: result.rows.length });
});

// ── DELETE /:id ───────────────────────────────────────────
photos.delete('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    'DELETE FROM photos WHERE id = $1 AND user_id = $2 RETURNING file_path, thumbnail_path',
    [id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Foto não encontrada' }, 404);

  const { file_path, thumbnail_path } = result.rows[0];
  if (file_path      && existsSync(file_path))      unlinkSync(file_path);
  if (thumbnail_path && existsSync(thumbnail_path)) unlinkSync(thumbnail_path);

  return c.json({ deleted: true });
});

export default photos;
