// ============================================================
//  ROUTES – Tracks (Trilhas GPS)
//  GET    /api/v1/tracks
//  POST   /api/v1/tracks
//  GET    /api/v1/tracks/:id
//  PUT    /api/v1/tracks/:id
//  DELETE /api/v1/tracks/:id
//  POST   /api/v1/tracks/:id/points       (stream de pontos GPS)
//  GET    /api/v1/tracks/:id/geojson      (exportar como GeoJSON)
//  POST   /api/v1/tracks/:id/finish       (finalizar e calcular stats)
// ============================================================
import { Hono } from 'hono';
import { z } from 'zod';
import { query, withTransaction } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';

const tracks = new Hono();
tracks.use('*', authMiddleware);

// ── GET / – listar trilhas ────────────────────────────────
tracks.get('/', async (c) => {
  const userId    = c.get('user').id;
  const projectId = c.req.query('project_id');
  const limit     = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset    = parseInt(c.req.query('offset') || '0');

  let sql = `
    SELECT t.id, t.name, t.description, t.color, t.status,
           t.distance_m, t.duration_s, t.elevation_gain_m,
           t.avg_speed_kmh, t.started_at, t.finished_at,
           t.is_public, t.project_id, t.created_at,
           ST_AsGeoJSON(t.geom)::json AS geom,
           COUNT(tp.id)::int AS point_count
    FROM tracks t
    LEFT JOIN track_points tp ON tp.track_id = t.id
    WHERE t.user_id = $1
  `;
  const params = [userId];

  if (projectId) {
    params.push(projectId);
    sql += ` AND t.project_id = $${params.length}`;
  }

  sql += ` GROUP BY t.id ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return c.json({ data: result.rows, total: result.rows.length });
});

// ── POST / – criar trilha ─────────────────────────────────
tracks.post('/', async (c) => {
  const userId = c.get('user').id;
  const body   = await c.req.json().catch(() => ({}));

  const { name = 'Nova Trilha', description, color = '#ef4444',
          project_id, device_id, client_id, started_at } = body;

  // Verifica duplicata por client_id
  if (client_id) {
    const dup = await query('SELECT id FROM tracks WHERE client_id = $1', [client_id]);
    if (dup.rows[0]) return c.json(dup.rows[0], 200); // idempotente
  }

  const result = await query(
    `INSERT INTO tracks (user_id, name, description, color, project_id,
                         device_id, client_id, started_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'recording')
     RETURNING *`,
    [userId, name, description || null, color,
     project_id || null, device_id || null, client_id || null,
     started_at || new Date().toISOString()]
  );

  return c.json(result.rows[0], 201);
});

// ── GET /:id ──────────────────────────────────────────────
tracks.get('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    `SELECT t.*, ST_AsGeoJSON(t.geom)::json AS geom
     FROM tracks t WHERE t.id = $1 AND (t.user_id = $2 OR t.is_public = TRUE)`,
    [id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Trilha não encontrada' }, 404);
  return c.json(result.rows[0]);
});

// ── PUT /:id – atualizar trilha ───────────────────────────
tracks.put('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();
  const body   = await c.req.json().catch(() => ({}));

  const { name, description, color, is_public, project_id, status } = body;

  const result = await query(
    `UPDATE tracks SET
       name        = COALESCE($1, name),
       description = COALESCE($2, description),
       color       = COALESCE($3, color),
       is_public   = COALESCE($4, is_public),
       project_id  = COALESCE($5, project_id),
       status      = COALESCE($6, status)
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
    [name, description, color, is_public, project_id, status, id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Trilha não encontrada' }, 404);
  return c.json(result.rows[0]);
});

// ── DELETE /:id ───────────────────────────────────────────
tracks.delete('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();
  const result = await query(
    'DELETE FROM tracks WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Trilha não encontrada' }, 404);
  return c.json({ deleted: true });
});

// ── POST /:id/points – adicionar pontos GPS ───────────────
tracks.post('/:id/points', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();
  const body   = await c.req.json().catch(() => ({}));
  const points  = Array.isArray(body.points) ? body.points : [body];

  // Verifica ownership
  const track = await query(
    'SELECT id FROM tracks WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  if (!track.rows[0]) return c.json({ error: 'Trilha não encontrada' }, 404);

  // Insere pontos em batch
  if (points.length === 0) return c.json({ inserted: 0 });

  const values = [];
  const params = [];
  let i = 1;

  for (const p of points) {
    values.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`);
    params.push(
      id,
      parseFloat(p.lat),
      parseFloat(p.lng),
      p.altitude != null ? parseFloat(p.altitude) : null,
      p.accuracy != null ? parseFloat(p.accuracy) : null,
      p.speed    != null ? parseFloat(p.speed)    : null,
      p.heading  != null ? parseFloat(p.heading)  : null,
      p.recorded_at || new Date().toISOString()
    );
  }

  await query(
    `INSERT INTO track_points (track_id, lat, lng, altitude, accuracy, speed, heading, recorded_at)
     VALUES ${values.join(',')}
     ON CONFLICT DO NOTHING`,
    params
  );

  return c.json({ inserted: points.length });
});

// ── POST /:id/finish – finalizar trilha e calcular stats ──
tracks.post('/:id/finish', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const track = await query(
    'SELECT id FROM tracks WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  if (!track.rows[0]) return c.json({ error: 'Trilha não encontrada' }, 404);

  // Calcula stats e constrói geometria a partir dos pontos
  const stats = await query(`
    WITH pts AS (
      SELECT lat, lng, altitude, speed, recorded_at,
             ROW_NUMBER() OVER (ORDER BY recorded_at) AS rn
      FROM track_points WHERE track_id = $1
    ),
    calcs AS (
      SELECT
        COUNT(*)                                          AS point_count,
        MIN(altitude)                                     AS min_elev,
        MAX(altitude)                                     AS max_elev,
        AVG(speed)                                        AS avg_speed,
        MAX(speed)                                        AS max_speed,
        MIN(recorded_at)                                  AS started,
        MAX(recorded_at)                                  AS finished,
        EXTRACT(EPOCH FROM (MAX(recorded_at) - MIN(recorded_at)))::int AS duration_s,
        ST_MakeLine(
          ST_SetSRID(ST_MakePoint(lng, lat, COALESCE(altitude,0)), 4326)
          ORDER BY recorded_at
        ) AS geom
      FROM pts
    )
    SELECT *, ST_Length(geom::geography) AS distance_m FROM calcs
  `, [id]);

  const s = stats.rows[0];
  if (!s || !s.geom) return c.json({ error: 'Sem pontos gravados' }, 400);

  const result = await query(
    `UPDATE tracks SET
       status           = 'active',
       geom             = $1,
       distance_m       = $2,
       duration_s       = $3,
       min_elevation_m  = $4,
       max_elevation_m  = $5,
       avg_speed_kmh    = $6,
       max_speed_kmh    = $7,
       started_at       = $8,
       finished_at      = $9,
       synced_at        = NOW()
     WHERE id = $10 RETURNING *`,
    [s.geom, s.distance_m, s.duration_s,
     s.min_elev, s.max_elev,
     s.avg_speed ? s.avg_speed * 3.6 : null,
     s.max_speed ? s.max_speed * 3.6 : null,
     s.started, s.finished, id]
  );

  return c.json(result.rows[0]);
});

// ── GET /:id/geojson – exportar trilha como GeoJSON ───────
tracks.get('/:id/geojson', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    `SELECT t.name, t.description, t.distance_m, t.duration_s,
            ST_AsGeoJSON(t.geom)::json AS geometry
     FROM tracks t WHERE t.id = $1 AND (t.user_id = $2 OR t.is_public = TRUE)`,
    [id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Trilha não encontrada' }, 404);

  const { geometry, ...props } = result.rows[0];
  return c.json({
    type: 'Feature',
    geometry,
    properties: props,
  });
});

export default tracks;
