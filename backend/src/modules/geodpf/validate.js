// ============================================================
//  GeoPDF – Validação de arquivo
// ============================================================

import { existsSync, statSync, createReadStream } from 'fs';

const MAX_SIZE_MB = 500;

/**
 * Valida se o arquivo é um PDF válido
 * @returns {{ valid: boolean, reason?: string, type: string, sizeMB: number }}
 */
export async function validateGeoPDF(filePath) {

  if (!existsSync(filePath)) {
    return { valid: false, reason: 'Arquivo não encontrado no servidor' };
  }

  const stat   = statSync(filePath);
  const sizeMB = stat.size / (1024 * 1024);

  if (sizeMB > MAX_SIZE_MB) {
    return {
      valid: false,
      reason: `Arquivo muito grande: ${sizeMB.toFixed(1)}MB (máx ${MAX_SIZE_MB}MB)`
    };
  }

  // verifica magic bytes do PDF
  const header = await readFirstBytes(filePath, 8);

  if (!header.startsWith('%PDF')) {
    return { valid: false, reason: 'Arquivo não é um PDF válido' };
  }

  return {
    valid: true,
    type: 'pdf',
    sizeMB: parseFloat(sizeMB.toFixed(2))
  };

}

function readFirstBytes(filePath, n) {

  return new Promise((resolve, reject) => {

    const chunks = [];

    const stream = createReadStream(filePath, {
      start: 0,
      end: n - 1
    });

    stream.on('data', chunk => chunks.push(chunk));

    stream.on('end', () =>
      resolve(Buffer.concat(chunks).toString('ascii'))
    );

    stream.on('error', reject);

  });

}