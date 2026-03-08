// ============================================================
//  modules/mbtiles/validate.js
//  Valida se um arquivo é um MBTiles SQLite válido
// ============================================================
import Database from 'better-sqlite3';
import { existsSync, statSync } from 'fs';

const MAX_SIZE_GB = 10;

/**
 * Valida o arquivo MBTiles
 * @returns {{ valid: boolean, reason?: string, sizeMB: number }}
 */
export function validateMBTiles(filePath) {
  if (!existsSync(filePath)) {
    return { valid: false, reason: 'Arquivo não encontrado' };
  }

  const stat   = statSync(filePath);
  const sizeMB = stat.size / (1024 * 1024);

  if (sizeMB > MAX_SIZE_GB * 1024) {
    return { valid: false, reason: `Arquivo muito grande: ${(sizeMB/1024).toFixed(1)} GB (máx ${MAX_SIZE_GB} GB)` };
  }

  // Verifica magic bytes do SQLite (0x53 0x51 0x4C 0x69 = "SQLi")
  let db;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true });
  } catch (err) {
    return { valid: false, reason: `Não é um SQLite válido: ${err.message}` };
  }

  try {
    // Verifica tabelas obrigatórias do MBTiles spec
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table'`
    ).all().map(r => r.name);

    if (!tables.includes('tiles')) {
      return { valid: false, reason: 'Tabela "tiles" não encontrada – não é MBTiles válido' };
    }
    if (!tables.includes('metadata')) {
      return { valid: false, reason: 'Tabela "metadata" não encontrada – não é MBTiles válido' };
    }

    // Verifica se tem pelo menos um tile
    const tileCount = db.prepare('SELECT COUNT(*) AS cnt FROM tiles').get();
    if (!tileCount || tileCount.cnt === 0) {
      return { valid: false, reason: 'MBTiles sem tiles (arquivo vazio)' };
    }

    return { valid: true, sizeMB: parseFloat(sizeMB.toFixed(2)), tileCount: tileCount.cnt };

  } catch (err) {
    return { valid: false, reason: `Erro ao ler MBTiles: ${err.message}` };
  } finally {
    db?.close();
  }
}
