// ============================================================
//  ROUTES – Waypoints / POIs
//  GET    /api/v1/waypoints
//  POST   /api/v1/waypoints
//  GET    /api/v1/waypoints/:id
//  PUT    /api/v1/waypoints/:id
//  DELETE /api/v1/waypoints/:id
//  GET    /api/v1/waypoints/bbox          (busca por área)
// ============================================================
import { Hono } from 'hono';
import { query } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';

const waypoints = new Hono();
waypoints.use('*', authMiddleware);

// ── GET / – listar waypoints ──────────────────────────────
waypoints.get('/', async (c) => {
  const userId    = c.get('user').id;
  const projectId = c.req.query('project_id');
  const trackId   = c.req.query('track_id');
  const limit     = Math.min(parseInt(c.req.query('limit') || '100'), 500);
  const offset    = parseInt(c.req.query('offset') || '0');

  let sql = `
    SELECT id, name, description, symbol, color,
           lat, lng, altitude, accuracy,
           form_data, photos,
           project_id, track_id,
           device_id, client_id, synced_at,
           created_at, updated_at,
           ST_AsGeoJSON(geom)::json AS geom
    FROM waypoints
    WHERE user_id = $1
  `;
  const params = [userId];

  if (projectId) { params.push(projectId); sql += ` AND project_id = $${params.length}`; }
  if (trackId)   { params.push(trackId);   sql += ` AND track_id   = $${params.length}`; }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return c.json({ data: result.rows, total: result.rows.length });
});

// ── GET /bbox – busca por bounding box ────────────────────
waypoints.get('/bbox', async (c) => {
  const userId = c.get('user').id;
  const { minLng, minLat, maxLng, maxLat } = c.req.query();

  if (!minLng || !minLat || !maxLng || !maxLat) {
    return c.json({ error: 'Parâmetros minLng, minLat, maxLng, maxLat obrigatórios' }, 400);
  }

  const result = await query(
    `SELECT id, name, symbol, color, lat, lng, altitude, form_data, photos, created_at
     FROM waypoints
     WHERE user_id = $1
       AND geom && ST_MakeEnvelope($2, $3, $4, $5, 4326)
     ORDER BY created_at DESC`,
    [userId, minLng, minLat, maxLng, maxLat]
  );

  return c.json({
    type: 'FeatureCollection',
    features: result.rows.map(w => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [w.lng, w.lat, w.altitude || 0] },
      properties: w,
    }))
  });
});

// ── POST / – criar waypoint ───────────────────────────────
waypoints.post('/', async (c) => {
  const userId = c.get('user').id;
  const body   = await c.req.json().catch(() => ({}));

  const { name = 'Waypoint', description, symbol = 'pin', color = '#f59e0b',
          lat, lng, altitude, accuracy,
          form_data, photos = [],
          project_id, track_id, device_id, client_id } = body;

  if (lat == null || lng == null) {
    return c.json({ error: 'lat e lng obrigatórios' }, 400);
  }

  // Idempotência por client_id
  if (client_id) {
    const dup = await query('SELECT * FROM waypoints WHERE client_id = $1', [client_id]);
    if (dup.rows[0]) return c.json(dup.rows[0], 200);
  }

  const result = await query(
    `INSERT INTO waypoints
       (user_id, name, description, symbol, color,
        lat, lng, altitude, accuracy,
        form_data, photos, project_id, track_id,
        device_id, client_id, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
     RETURNING *`,
    [userId, name, description || null, symbol, color,
     parseFloat(lat), parseFloat(lng),
     altitude != null ? parseFloat(altitude) : null,
     accuracy != null ? parseFloat(accuracy) : null,
     JSON.stringify(form_data || {}),
     photos,
     project_id || null, track_id || null,
     device_id || null, client_id || null]
  );

  return c.json(result.rows[0], 201);
});

// ── GET /:id ──────────────────────────────────────────────
waypoints.get('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    'SELECT * FROM waypoints WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Waypoint não encontrado' }, 404);
  return c.json(result.rows[0]);
});

// ── PUT /:id – atualizar waypoint ─────────────────────────
waypoints.put('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();
  const body   = await c.req.json().catch(() => ({}));

  const { name, description, symbol, color, form_data, photos, project_id } = body;

  const result = await query(
    `UPDATE waypoints SET
       name        = COALESCE($1, name),
       description = COALESCE($2, description),
       symbol      = COALESCE($3, symbol),
       color       = COALESCE($4, color),
       form_data   = COALESCE($5::jsonb, form_data),
       photos      = COALESCE($6, photos),
       project_id  = COALESCE($7, project_id)
     WHERE id = $8 AND user_id = $9
     RETURNING *`,
    [name, description, symbol, color,
     form_data ? JSON.stringify(form_data) : null,
     photos, project_id, id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Waypoint não encontrado' }, 404);
  return c.json(result.rows[0]);
});

// ── DELETE /:id ───────────────────────────────────────────
waypoints.delete('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    'DELETE FROM waypoints WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Waypoint não encontrado' }, 404);
  return c.json({ deleted: true });
});

// ── GET /export/geojson – exportar todos como GeoJSON ─────
waypoints.get('/export/geojson', async (c) => {
  const userId    = c.get('user').id;
  const projectId = c.req.query('project_id');

  let sql = 'SELECT * FROM waypoints WHERE user_id = $1';
  const params = [userId];
  if (projectId) { params.push(projectId); sql += ` AND project_id = $${params.length}`; }

  const result = await query(sql, params);

  return c.json({
    type: 'FeatureCollection',
    features: result.rows.map(w => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [w.lng, w.lat, w.altitude || 0] },
      properties: { ...w, geom: undefined },
    }))
  });
});

export default waypoints;
