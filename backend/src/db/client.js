// ============================================================
//  Database Client – pg Pool singleton
//  Compatível com Neon.tech (SSL obrigatório)
// ============================================================
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não definido. Verifique o .env');
}

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }   // Neon exige SSL
    : false,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Verifica conexão na inicialização
db.on('connect', () => console.log('[DB] Nova conexão PostgreSQL estabelecida'));
db.on('error',   (err) => console.error('[DB] Erro de pool:', err.message));

/**
 * Helper para transações
 * @example
 * await withTransaction(async (client) => {
 *   await client.query(...)
 * });
 */
export async function withTransaction(fn) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Helper simples para queries parametrizadas
 */
export async function query(text, params) {
  const start = Date.now();
  const res = await db.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SQL] ${duration}ms – ${text.slice(0, 80)}`);
  }
  return res;
}
