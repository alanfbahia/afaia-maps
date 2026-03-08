// ============================================================
//  ROUTES – Sync (sincronização offline → servidor)
//  POST /api/v1/sync/push   – envia lote de operações offline
//  GET  /api/v1/sync/pull   – busca dados novos desde último sync
//  GET  /api/v1/sync/status – status da fila
// ============================================================
import { Hono } from 'hono';
import { query, withTransaction } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';

const sync = new Hono();
sync.use('*', authMiddleware);

// ── POST /push – recebe operações offline em lote ─────────
sync.post('/push', async (c) => {
  const userId   = c.get('user').id;
  const deviceId = c.req.header('X-Device-ID') || 'unknown';
  const body     = await c.req.json().catch(() => ({}));
  const ops      = Array.isArray(body.operations) ? body.operations : [];

  if (ops.length === 0) return c.json({ processed: 0 });

  const results = { success: 0, errors: 0, details: [] };

  for (const op of ops) {
    try {
      await processSyncOp(userId, deviceId, op);
      results.success++;
      results.details.push({ client_id: op.client_id, status: 'ok' });
    } catch (err) {
      results.errors++;
      results.details.push({ client_id: op.client_id, status: 'error', error: err.message });

      // Registra na fila para retry
      await query(
        `INSERT INTO sync_queue
           (user_id, device_id, entity_type, entity_id, operation, payload, status, error_msg, attempts)
         VALUES ($1,$2,$3,$4,$5,$6,'error',$7,1)
         ON CONFLICT DO NOTHING`,
        [userId, deviceId, op.type, op.client_id, op.operation,
         JSON.stringify(op.payload), err.message]
      ).catch(() => {}); // não falha se a inserção falhar
    }
  }

  return c.json({
    processed: ops.length,
    ...results,
    timestamp: new Date().toISOString(),
  });
});

// ── Processa uma operação de sync ─────────────────────────
async function processSyncOp(userId, deviceId, op) {
  const { type, operation, payload, client_id } = op;

  switch (type) {
    // ── Trilha ──────────────────────────────────────────────
    case 'track': {
      if (operation === 'create' || operation === 'update') {
        const exists = await query('SELECT id FROM tracks WHERE client_id = $1', [client_id]);

        if (exists.rows[0]) {
          // Update
          await query(
            `UPDATE tracks SET
               name = COALESCE($1, name), description = COALESCE($2, description),
               color = COALESCE($3, color), project_id = COALESCE($4, project_id),
               status = COALESCE($5, status), synced_at = NOW()
             WHERE client_id = $6 AND user_id = $7`,
            [payload.name, payload.description, payload.color,
             payload.project_id, payload.status, client_id, userId]
          );
        } else {
          // Create
          await query(
            `INSERT INTO tracks
               (user_id, name, description, color, project_id, status,
                device_id, client_id, started_at, synced_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
            [userId, payload.name || 'Nova Trilha', payload.description,
             payload.color || '#ef4444', payload.project_id,
             payload.status || 'active', deviceId, client_id,
             payload.started_at || new Date().toISOString()]
          );
        }
      } else if (operation === 'delete') {
        await query(
          'DELETE FROM tracks WHERE client_id = $1 AND user_id = $2',
          [client_id, userId]
        );
      }
      break;
    }

    // ── Pontos de trilha ─────────────────────────────────────
    case 'track_points': {
      const pts = Array.isArray(payload.points) ? payload.points : [];
      if (pts.length === 0) break;

      // Busca server_id da trilha pelo client_id
      const trackRes = await query(
        'SELECT id FROM tracks WHERE client_id = $1 AND user_id = $2',
        [payload.track_client_id, userId]
      );
      if (!trackRes.rows[0]) throw new Error(`Trilha ${payload.track_client_id} não encontrada`);
      const trackId = trackRes.rows[0].id;

      const values = [];
      const params = [];
      let i = 1;
      for (const p of pts) {
        values.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`);
        params.push(trackId, parseFloat(p.lat), parseFloat(p.lng),
          p.altitude != null ? parseFloat(p.altitude) : null,
          p.accuracy != null ? parseFloat(p.accuracy) : null,
          p.speed    != null ? parseFloat(p.speed)    : null,
          p.heading  != null ? parseFloat(p.heading)  : null,
          p.recorded_at || new Date().toISOString());
      }

      await query(
        `INSERT INTO track_points (track_id, lat, lng, altitude, accuracy, speed, heading, recorded_at)
         VALUES ${values.join(',')} ON CONFLICT DO NOTHING`,
        params
      );
      break;
    }

    // ── Waypoint ─────────────────────────────────────────────
    case 'waypoint': {
      if (operation === 'create' || operation === 'update') {
        const exists = await query('SELECT id FROM waypoints WHERE client_id = $1', [client_id]);

        if (exists.rows[0]) {
          await query(
            `UPDATE waypoints SET
               name = COALESCE($1, name), description = COALESCE($2, description),
               lat = COALESCE($3, lat), lng = COALESCE($4, lng),
               form_data = COALESCE($5::jsonb, form_data), synced_at = NOW()
             WHERE client_id = $6 AND user_id = $7`,
            [payload.name, payload.description,
             payload.lat ? parseFloat(payload.lat) : null,
             payload.lng ? parseFloat(payload.lng) : null,
             payload.form_data ? JSON.stringify(payload.form_data) : null,
             client_id, userId]
          );
        } else {
          await query(
            `INSERT INTO waypoints
               (user_id, name, description, symbol, color,
                lat, lng, altitude, accuracy, form_data, photos,
                project_id, device_id, client_id, synced_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
            [userId, payload.name || 'Waypoint', payload.description,
             payload.symbol || 'pin', payload.color || '#f59e0b',
             parseFloat(payload.lat), parseFloat(payload.lng),
             payload.altitude != null ? parseFloat(payload.altitude) : null,
             payload.accuracy != null ? parseFloat(payload.accuracy) : null,
             JSON.stringify(payload.form_data || {}),
             payload.photos || [],
             payload.project_id || null, deviceId, client_id]
          );
        }
      } else if (operation === 'delete') {
        await query(
          'DELETE FROM waypoints WHERE client_id = $1 AND user_id = $2',
          [client_id, userId]
        );
      }
      break;
    }

    default:
      throw new Error(`Tipo de entidade desconhecido: ${type}`);
  }
}

// ── GET /pull – busca dados alterados desde último sync ───
sync.get('/pull', async (c) => {
  const userId = c.get('user').id;
  const since  = c.req.query('since'); // timestamp ISO

  const sinceDate = since ? new Date(since) : new Date(0);

  const [tracksRes, waypointsRes] = await Promise.all([
    query(
      `SELECT id, name, description, color, status,
              distance_m, duration_s, started_at, finished_at,
              device_id, client_id, updated_at
       FROM tracks
       WHERE user_id = $1 AND updated_at > $2
       ORDER BY updated_at DESC LIMIT 200`,
      [userId, sinceDate.toISOString()]
    ),
    query(
      `SELECT id, name, description, symbol, color,
              lat, lng, altitude, form_data, photos,
              device_id, client_id, updated_at
       FROM waypoints
       WHERE user_id = $1 AND updated_at > $2
       ORDER BY updated_at DESC LIMIT 500`,
      [userId, sinceDate.toISOString()]
    ),
  ]);

  return c.json({
    tracks:    tracksRes.rows,
    waypoints: waypointsRes.rows,
    timestamp: new Date().toISOString(),
  });
});

// ── GET /status – status da fila de sync ─────────────────
sync.get('/status', async (c) => {
  const userId = c.get('user').id;

  const result = await query(
    `SELECT status, COUNT(*)::int AS count
     FROM sync_queue WHERE user_id = $1
     GROUP BY status`,
    [userId]
  );

  const counts = { pending: 0, processing: 0, done: 0, error: 0 };
  result.rows.forEach(r => { counts[r.status] = r.count; });

  return c.json(counts);
});

export default sync;
