// ============================================================
//  Migration runner – executa schema.sql no banco
//  Uso: node src/db/migrate.js
// ============================================================
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

async function migrate() {
  console.log('[MIGRATE] Executando schema.sql...');
  try {
    await db.query(sql);
    console.log('[MIGRATE] ✅ Schema aplicado com sucesso!');
  } catch (err) {
    console.error('[MIGRATE] ❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

migrate();
