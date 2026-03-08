// ============================================================
//  ROUTES – Auth
//  POST /api/v1/auth/register
//  POST /api/v1/auth/login
//  POST /api/v1/auth/refresh
//  POST /api/v1/auth/logout
//  GET  /api/v1/auth/me
//  POST /api/v1/auth/forgot-password
//  POST /api/v1/auth/reset-password
// ============================================================
import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/client.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  authMiddleware,
} from '../middleware/auth.js';

const auth = new Hono();

// ── Schemas de validação ──────────────────────────────────
const RegisterSchema = z.object({
  name:     z.string().min(2).max(100),
  email:    z.string().email(),
  password: z.string().min(8).max(100),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
});

// ── POST /register ────────────────────────────────────────
auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Body inválido' }, 400);

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, 422);
  }

  const { name, email, password } = parsed.data;

  // Verifica email duplicado
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return c.json({ error: 'E-mail já cadastrado' }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, role, plan, avatar_url, created_at`,
    [name, email, passwordHash]
  );

  const user = result.rows[0];
  const accessToken  = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id });

  // Salva refresh token
  const tokenHash = await bcrypt.hash(refreshToken, 8);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
    [user.id, tokenHash]
  );

  return c.json({ user, accessToken, refreshToken }, 201);
});

// ── POST /login ───────────────────────────────────────────
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Body inválido' }, 400);

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos' }, 422);
  }

  const { email, password, deviceId } = parsed.data;

  const result = await query(
    'SELECT id, name, email, password_hash, role, plan, avatar_url, is_active FROM users WHERE email = $1',
    [email]
  );

  const user = result.rows[0];

  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    return c.json({ error: 'E-mail ou senha inválidos' }, 401);
  }

  if (!user.is_active) {
    return c.json({ error: 'Conta desativada' }, 403);
  }

  const { password_hash, ...userSafe } = user;
  const accessToken  = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id });

  const tokenHash = await bcrypt.hash(refreshToken, 8);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_id, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
    [user.id, tokenHash, deviceId || null]
  );

  return c.json({ user: userSafe, accessToken, refreshToken });
});

// ── GET /me ───────────────────────────────────────────────
auth.get('/me', authMiddleware, async (c) => {
  const { id } = c.get('user');
  const result = await query(
    'SELECT id, name, email, role, plan, avatar_url, created_at FROM users WHERE id = $1',
    [id]
  );
  if (!result.rows[0]) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json(result.rows[0]);
});

// ── POST /refresh ─────────────────────────────────────────
auth.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { refreshToken } = body || {};
  if (!refreshToken) return c.json({ error: 'Refresh token obrigatório' }, 400);

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return c.json({ error: 'Refresh token inválido ou expirado' }, 401);
  }

  // Verifica no banco (revogação)
  const tokens = await query(
    `SELECT id, token_hash FROM refresh_tokens
     WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()`,
    [payload.id]
  );

  let validToken = null;
  for (const row of tokens.rows) {
    if (await bcrypt.compare(refreshToken, row.token_hash)) {
      validToken = row;
      break;
    }
  }

  if (!validToken) return c.json({ error: 'Refresh token revogado' }, 401);

  const userResult = await query(
    'SELECT id, email, role FROM users WHERE id = $1 AND is_active = TRUE',
    [payload.id]
  );
  const user = userResult.rows[0];
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  const newAccessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });

  return c.json({ accessToken: newAccessToken });
});

// ── POST /logout ──────────────────────────────────────────
auth.post('/logout', authMiddleware, async (c) => {
  const { id } = c.get('user');
  // Revoga todos os refresh tokens do usuário
  await query(
    'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1',
    [id]
  );
  return c.json({ message: 'Logout realizado' });
});

// ── POST /forgot-password ─────────────────────────────────
auth.post('/forgot-password', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { email } = body || {};
  if (!email) return c.json({ error: 'E-mail obrigatório' }, 400);

  const result = await query('SELECT id FROM users WHERE email = $1', [email]);
  // Não revela se e-mail existe
  if (result.rows[0]) {
    const token   = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await query(
      'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
      [token, expires.toISOString(), result.rows[0].id]
    );
    // TODO: enviar e-mail com link de reset contendo token
    console.log(`[AUTH] Reset token para ${email}: ${token}`);
  }

  return c.json({ message: 'Se o e-mail existir, você receberá as instruções' });
});

// ── POST /reset-password ──────────────────────────────────
auth.post('/reset-password', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { token, password } = body || {};
  if (!token || !password) return c.json({ error: 'Token e senha obrigatórios' }, 400);
  if (password.length < 8)  return c.json({ error: 'Senha muito curta (mín. 8 caracteres)' }, 422);

  const result = await query(
    'SELECT id FROM users WHERE reset_token = $1 AND reset_expires > NOW()',
    [token]
  );

  if (!result.rows[0]) return c.json({ error: 'Token inválido ou expirado' }, 400);

  const hash = await bcrypt.hash(password, 12);
  await query(
    'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
    [hash, result.rows[0].id]
  );

  return c.json({ message: 'Senha redefinida com sucesso' });
});

export default auth;
