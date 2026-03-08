// ============================================================
//  Middleware – Verificação de JWT
// ============================================================
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

/**
 * Middleware Hono – verifica Bearer token e injeta user no context
 */
export async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Token não fornecido' }, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    c.set('user', payload);
    await next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return c.json({ error: 'Token expirado' }, 401);
    }
    return c.json({ error: 'Token inválido' }, 401);
  }
}

/**
 * Middleware – verifica se usuário é admin
 */
export async function adminMiddleware(c, next) {
  const user = c.get('user');
  if (!user || !['admin','superadmin'].includes(user.role)) {
    return c.json({ error: 'Acesso negado' }, 403);
  }
  await next();
}

/**
 * Gera access token (curto prazo)
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * Gera refresh token (longo prazo)
 */
export function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET + '_refresh', {
    expiresIn: '30d',
  });
}

/**
 * Verifica refresh token
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_SECRET + '_refresh');
}
