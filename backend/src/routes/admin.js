// ============================================================
//  ROUTES – Admin (apenas role admin/superadmin)
// ============================================================
import { Hono } from 'hono';
import { query } from '../db/client.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const admin = new Hono();
admin.use('*', authMiddleware);
admin.use('*', adminMiddleware);

// ── GET /stats – visão geral da plataforma ────────────────
admin.get('/stats', async (c) => {
  const [users, maps, tracks, waypoints, photos, storage] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7d
           FROM users`),
    query(`SELECT COUNT(*)::int AS total, SUM(file_size)::bigint AS total_bytes FROM maps`),
    query(`SELECT COUNT(*)::int AS total, COALESCE(SUM(distance_m),0)::float AS total_distance_m FROM tracks`),
    query(`SELECT COUNT(*)::int AS total FROM waypoints`),
    query(`SELECT COUNT(*)::int AS total FROM photos`),
    query(`SELECT COALESCE(SUM(file_size),0)::bigint AS used_bytes FROM maps`),
  ]);

  return c.json({
    users:     users.rows[0],
    maps:      maps.rows[0],
    tracks:    tracks.rows[0],
    waypoints: waypoints.rows[0],
    photos:    photos.rows[0],
    storage:   storage.rows[0],
  });
});

// ── GET /users – listar usuários ──────────────────────────
admin.get('/users', async (c) => {
  const limit  = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset = parseInt(c.req.query('offset') || '0');
  const search = c.req.query('search') || '';

  const result = await query(
    `SELECT id, name, email, role, plan, is_active, created_at,
            (SELECT COUNT(*)::int FROM projects WHERE user_id = users.id) AS project_count,
            (SELECT COUNT(*)::int FROM maps      WHERE user_id = users.id) AS map_count
     FROM users
     WHERE ($1 = '' OR name ILIKE $1 OR email ILIKE $1)
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [`%${search}%`, limit, offset]
  );

  return c.json({ data: result.rows });
});

// ── PATCH /users/:id – atualizar usuário ──────────────────
admin.patch('/users/:id', async (c) => {
  const { id } = c.req.param();
  const body   = await c.req.json().catch(() => ({}));
  const { role, plan, is_active } = body;

  const result = await query(
    `UPDATE users SET
       role      = COALESCE($1, role),
       plan      = COALESCE($2, plan),
       is_active = COALESCE($3, is_active)
     WHERE id = $4 RETURNING id, name, email, role, plan, is_active`,
    [role, plan, is_active, id]
  );
  if (!result.rows[0]) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json(result.rows[0]);
});

// ── GET /maps – listar todos os mapas ─────────────────────
admin.get('/maps', async (c) => {
  const limit  = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset = parseInt(c.req.query('offset') || '0');

  const result = await query(
    `SELECT m.id, m.name, m.file_type, m.file_size, m.geodpf_status,
            m.is_public, m.created_at,
            u.name AS user_name, u.email AS user_email
     FROM maps m JOIN users u ON u.id = m.user_id
     ORDER BY m.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return c.json({ data: result.rows });
});

// ── GET /geodpf-jobs – fila de processamento GeoPDF ───────
admin.get('/geodpf-jobs', async (c) => {
  const result = await query(
    `SELECT j.*, m.name AS map_name, u.email AS user_email
     FROM geodpf_jobs j
     JOIN maps  m ON m.id = j.map_id
     JOIN users u ON u.id = j.user_id
     ORDER BY j.created_at DESC LIMIT 50`
  );
  return c.json({ data: result.rows });
});

export default admin;
