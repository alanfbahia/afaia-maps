// ============================================================
//  ROUTES – Projects
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
            COUNT(DISTINCT t.id)::int AS track_count,
            COUNT(DISTINCT w.id)::int AS waypoint_count,
            COUNT(DISTINCT m.id)::int AS map_count
     FROM projects p
     LEFT JOIN tracks t    ON t.project_id = p.id
     LEFT JOIN waypoints w ON w.project_id = p.id
     LEFT JOIN maps m      ON m.project_id = p.id
     WHERE p.owner_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [userId]
  );

  return c.json({ data: result.rows });
});

// ── POST / – criar projeto ────────────────────────────────
projects.post('/', async (c) => {
  const userId = c.get('user').id;
  const body = await c.req.json().catch(() => ({}));

  const { name, description } = body;

  if (!name) {
    return c.json({ error: 'Nome do projeto obrigatório' }, 400);
  }

  const result = await query(
    `INSERT INTO projects (owner_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, name, description || null]
  );

  return c.json(result.rows[0], 201);
});

// ── GET /:id ──────────────────────────────────────────────
projects.get('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    `SELECT *
     FROM projects
     WHERE id = $1 AND owner_id = $2`,
    [id, userId]
  );

  if (!result.rows[0]) {
    return c.json({ error: 'Projeto não encontrado' }, 404);
  }

  return c.json(result.rows[0]);
});

// ── PUT /:id – atualizar projeto ──────────────────────────
projects.put('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();
  const body = await c.req.json().catch(() => ({}));

  const { name, description } = body;

  const result = await query(
    `UPDATE projects SET
       name = COALESCE($1, name),
       description = COALESCE($2, description)
     WHERE id = $3 AND owner_id = $4
     RETURNING *`,
    [name, description, id, userId]
  );

  if (!result.rows[0]) {
    return c.json({ error: 'Projeto não encontrado' }, 404);
  }

  return c.json(result.rows[0]);
});

// ── DELETE /:id ───────────────────────────────────────────
projects.delete('/:id', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const result = await query(
    `DELETE FROM projects
     WHERE id = $1 AND owner_id = $2
     RETURNING id`,
    [id, userId]
  );

  if (!result.rows[0]) {
    return c.json({ error: 'Projeto não encontrado' }, 404);
  }

  return c.json({ deleted: true });
});

// ── GET /:id/stats – estatísticas do projeto ─────────────
projects.get('/:id/stats', async (c) => {
  const userId = c.get('user').id;
  const { id } = c.req.param();

  const ownerCheck = await query(
    `SELECT id
     FROM projects
     WHERE id = $1 AND owner_id = $2`,
    [id, userId]
  );

  if (!ownerCheck.rows[0]) {
    return c.json({ error: 'Projeto não encontrado' }, 404);
  }

  const result = await query(
    `SELECT
       COUNT(DISTINCT t.id)::int  AS total_tracks,
       COUNT(DISTINCT w.id)::int  AS total_waypoints,
       COUNT(DISTINCT m.id)::int  AS total_maps,
       COUNT(DISTINCT ph.id)::int AS total_photos,
       COALESCE(SUM(t.distance_m), 0)::float AS total_distance_m,
       COALESCE(SUM(t.duration_s), 0)::int   AS total_duration_s,
       COALESCE(SUM(m.file_size), 0)::bigint AS total_storage_bytes
     FROM projects p
     LEFT JOIN tracks t    ON t.project_id = p.id
     LEFT JOIN waypoints w ON w.project_id = p.id
     LEFT JOIN maps m      ON m.project_id = p.id
     LEFT JOIN photos ph   ON ph.project_id = p.id
     WHERE p.id = $1 AND p.owner_id = $2`,
    [id, userId]
  );

  return c.json(result.rows[0] || {});
});

// ── POST /:id/members – placeholder ──────────────────────
projects.post('/:id/members', async (c) => {
  return c.json(
    { error: 'Compartilhamento de membros ainda não está disponível neste schema' },
    501
  );
});

// ── DELETE /:id/members/:memberId – placeholder ──────────
projects.delete('/:id/members/:memberId', async (c) => {
  return c.json(
    { error: 'Compartilhamento de membros ainda não está disponível neste schema' },
    501
  );
});

export default projects;