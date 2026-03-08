// ============================================================
//  GeoPDF Pipeline – Queue Manager
//  Enfileira e processa jobs de GeoPDF
//
//  NOTA: Este módulo está preparado para integração com
//  bibliotecas server-side (GDAL, Python rasterio, pdftoppm).
//  Na versão atual, executa validação e extração de metadados
//  básicos via análise do PDF. Conversão raster completa
//  requer ativação do módulo convert.js com GDAL instalado.
// ============================================================

import { query } from '../../db/client.js';
import { validateGeoPDF } from './validate.js';
import { extractMetadata } from './extract.js';

/**
 * Enfileira um job de processamento GeoPDF
 */
export async function enqueueGeoPDFJob(mapId, userId, filePath) {
  const result = await query(
    `INSERT INTO geodpf_jobs (map_id, user_id, status)
     VALUES ($1, $2, 'queued')
     RETURNING id`,
    [mapId, userId]
  );

  const jobId = result.rows[0].id;

  // Processa de forma assíncrona (não bloqueia a requisição)
  setImmediate(() => runJob(jobId, mapId, userId, filePath));

  return jobId;
}

/**
 * Executa o pipeline completo de processamento
 */
async function runJob(jobId, mapId, userId, filePath) {
  const log = [];

  async function updateJob(status, progress, extra = {}) {
    await query(
      `UPDATE geodpf_jobs SET
         status    = $1,
         progress  = $2,
         log       = $3,
         error_msg = $4,
         result    = $5,
         started_at  = CASE WHEN $1 = 'validating' THEN NOW() ELSE started_at END,
         finished_at = CASE WHEN $1 IN ('done','error') THEN NOW() ELSE finished_at END
       WHERE id = $6`,
      [
        status,
        progress,
        log,
        extra.error || null,
        extra.result ? JSON.stringify(extra.result) : null,
        jobId
      ]
    );
  }

  try {
    // ── ETAPA 1: Validação ──────────────────────────────────
    log.push('[1/4] Iniciando validação do arquivo...');
    await updateJob('validating', 10);

    const validation = await validateGeoPDF(filePath);
    if (!validation.valid) {
      throw new Error(`Arquivo inválido: ${validation.reason}`);
    }

    log.push(`[1/4] ✅ Arquivo válido. Tipo: ${validation.type}, Tamanho: ${validation.sizeMB}MB`);

    // ── ETAPA 2: Extração de metadados ──────────────────────
    log.push('[2/4] Extraindo metadados geoespaciais...');
    await updateJob('extracting', 35);

    const metadata = await extractMetadata(filePath);
    log.push(`[2/4] ✅ Metadados extraídos. CRS: ${metadata.crs || 'não detectado'}`);

    // ── ETAPA 3: Conversão/Rasterização ─────────────────────
    log.push('[3/4] Conversão raster (módulo GDAL pendente de instalação)...');
    await updateJob('converting', 65);

    // STUB – aguardando integração GDAL
    await new Promise(r => setTimeout(r, 500));

    log.push('[3/4] ⚠️ Conversão GDAL não executada (instale gdal-bin no servidor)');
    log.push('[3/4] ℹ️ PDF está disponível para visualização direta no frontend');

    // ── ETAPA 4: Registro de bounds no banco ─────────────────
    log.push('[4/4] Registrando resultado no banco de dados...');
    await updateJob('converting', 90);

    const result = {
      crs: metadata.crs || 'EPSG:4326',
      bounds: metadata.bounds || null,
      layers: metadata.layers || [],
      pageCount: metadata.pageCount || 1,
      gdal_required: true,
      gdal_status: 'pending_installation'
    };

    if (metadata.bounds) {

      const [minLng, minLat, maxLng, maxLat] = metadata.bounds;

      await query(
        `UPDATE maps SET
           is_georeferenced = TRUE,
           crs              = $1,
           bounds           = ST_MakeEnvelope($2, $3, $4, $5, 4326),
           geodpf_status    = 'ready',
           geodpf_metadata  = $6
         WHERE id = $7`,
        [
          result.crs,
          minLng,
          minLat,
          maxLng,
          maxLat,
          JSON.stringify(result),
          mapId
        ]
      );

    } else {

      await query(
        `UPDATE maps SET
           geodpf_status = 'ready',
           geodpf_metadata = $1
         WHERE id = $2`,
        [JSON.stringify(result), mapId]
      );

    }

    log.push('[4/4] ✅ Processamento concluído!');
    await updateJob('done', 100, { result });

    console.log(`[GEODPF] Job ${jobId} concluído com sucesso`);

  } catch (err) {

    log.push(`[ERRO] ${err.message}`);

    await updateJob('error', 0, { error: err.message });

    await query(
      `UPDATE maps SET geodpf_status = 'error' WHERE id = $1`,
      [mapId]
    );

    console.error(`[GEODPF] Job ${jobId} falhou:`, err.message);
  }
}
