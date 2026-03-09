// ============================================================
//  ROUTES – Projects
//  GET    /api/v1/projects
//  POST   /api/v1/projects
//  GET    /api/v1/projects/:id
//  PUT    /api/v1/projects/:id
//  DELETE /api/v1/projects/:id
//  GET    /api/v1/projects/:id/stats
//  POST   /api/v1/projects/:id/members
//  DELETE /api/v1/projects/:id/members/:userId
// ============================================================
import { Hono } from 'hono';
import { query } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';

const projects = new Hono();
projects.use('*', authMiddleware);

// ── GET / – listar projetos ───────────────────────────────
projects.get('/', async (c) => {
  const userId = c.get('user').id;

  const result = await query(
    `SELECT p.*,
            COUNT(DISTINCT t.id)::int  AS track_count,
            COUNT(DISTINCT w.id)::int  AS waypoint_count,
            COUNT(DISTINCT m.id)::int  AS map_count,
            ST_AsGeoJSON(p.bounds)::json AS bounds
     FROM projects p
     LEFT JOIN tracks    t ON t.project_id = p.id
     LEFT JOIN waypoints w ON w.project_id = p.id
     LEFT JOIN maps      m ON m.project_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.updated_at DESC`,
    [userId]
  );

  return c.json({ data: result.rows });
});

// ── POST / – criar projeto ────────────────────────────────
projects.post('/', async (c) => {
  const userId = c.get('user').id;
  const body   = await c.req.json().catch(() => ({}));

  const { name, description, color = '#2563eb', icon = 'map', status = 'active' } = body;
  if (!name) return c.json({ error: 'Nome do projeto obrigatório' }, 400);

  const result = await query(
    `INSERT INTO projects (user_id, name, description, color, icon, status)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [userId, name, description || null, color, icon, status]
  );

  return c.json(result.rows[0], 201);
});

// ── GET /:id ──────────────────────────────────────────────
projects.get('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    `SELECT p.*,
            ST_AsGeoJSON(p.bounds)::json AS bounds,
            json_agg(DISTINCT jsonb_build_object(
              'user_id', pm.user_id,
              'role', pm.role,
              'name', u.name,
              'email', u.email,
              'avatar_url', u.avatar_url
            )) FILTER (WHERE pm.user_id IS NOT NULL) AS members
     FROM projects p
     LEFT JOIN project_members pm ON pm.project_id = p.id
     LEFT JOIN users u ON u.id = pm.user_id
     WHERE p.id = $1 AND p.user_id = $2
     GROUP BY p.id`,
    [id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Projeto não encontrado' }, 404);
  return c.json(result.rows[0]);
});

// ── PUT /:id – atualizar projeto ──────────────────────────
projects.put('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();
  const body   = await c.req.json().catch(() => ({}));

  const { name, description, color, icon, status } = body;

  const result = await query(
    `UPDATE projects SET
       name        = COALESCE($1, name),
       description = COALESCE($2, description),
       color       = COALESCE($3, color),
       icon        = COALESCE($4, icon),
       status      = COALESCE($5, status)
     WHERE id = $6 AND user_id = $7
     RETURNING *`,
    [name, description, color, icon, status, id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Projeto não encontrado' }, 404);
  return c.json(result.rows[0]);
});

// ── DELETE /:id ───────────────────────────────────────────
projects.delete('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );
  if (!result.rows[0]) return c.json({ error: 'Projeto não encontrado' }, 404);
  return c.json({ deleted: true });
});

// ── GET /:id/stats – estatísticas do projeto ─────────────
projects.get('/:id/stats', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    `SELECT
       COUNT(DISTINCT t.id)::int   AS total_tracks,
       COUNT(DISTINCT w.id)::int   AS total_waypoints,
       COUNT(DISTINCT m.id)::int   AS total_maps,
       COUNT(DISTINCT ph.id)::int  AS total_photos,
       COALESCE(SUM(t.distance_m), 0)::float AS total_distance_m,
       COALESCE(SUM(t.duration_s), 0)::int   AS total_duration_s,
       COALESCE(SUM(m.file_size), 0)::bigint AS total_storage_bytes
     FROM projects p
     LEFT JOIN tracks    t  ON t.project_id  = p.id
     LEFT JOIN waypoints w  ON w.project_id  = p.id
     LEFT JOIN maps      m  ON m.project_id  = p.id
     LEFT JOIN photos    ph ON ph.project_id = p.id
     WHERE p.id = $1 AND p.user_id = $2`,
    [id, userId]
  );
  return c.json(result.rows[0] || {});
});

// ── POST /:id/members – adicionar membro ──────────────────
projects.post('/:id/members', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();
  const body   = await c.req.json().catch(() => ({}));

  const { email, role = 'viewer' } = body;
  if (!email) return c.json({ error: 'E-mail obrigatório' }, 400);

  // Verifica que o projeto pertence ao usuário
  const proj = await query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!proj.rows[0]) return c.json({ error: 'Projeto não encontrado' }, 404);

  // Busca usuário pelo e-mail
  const invited = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (!invited.rows[0]) return c.json({ error: 'Usuário não encontrado' }, 404);

  await query(
    `INSERT INTO project_members (project_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3`,
    [id, invited.rows[0].id, role]
  );

  return c.json({ message: 'Membro adicionado' }, 201);
});

// ── DELETE /:id/members/:memberId ─────────────────────────
projects.delete('/:id/members/:memberId', async (c) => {
  const userId   = c.get('user').id;
  const { id, memberId } = c.req.param();

  const proj = await query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!proj.rows[0]) return c.json({ error: 'Projeto não encontrado' }, 404);

  await query(
    'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
    [id, memberId]
  );
  return c.json({ deleted: true });
});

export default projects;
