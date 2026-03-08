// ============================================================
//  GeoPDF – Extração de metadados geoespaciais
//
//  Tenta extrair bounds e CRS do PDF por análise do conteúdo.
//  Para extração completa instale: gdal-bin, python3-gdal, pdfinfo
//
//  Integração GDAL (ativar quando disponível no servidor):
//    gdal_translate -of GTiff input.pdf output.tif
//    gdalinfo input.pdf  → extrai bounds e CRS
// ============================================================
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

/**
 * Extrai metadados geoespaciais de um GeoPDF
 * @returns {{ crs, bounds, layers, pageCount }}
 */
export async function extractMetadata(filePath) {
  const result = {
    crs:       null,
    bounds:    null,  // [minLng, minLat, maxLng, maxLat]
    layers:    [],
    pageCount: 1,
  };

  // ── Tentativa 1: gdalinfo (se disponível) ──────────────
  try {
    const gdalInfo = execSync(`gdalinfo "${filePath}" 2>/dev/null`, { timeout: 30_000 }).toString();
    result.crs     = extractCRS(gdalInfo);
    result.bounds  = extractBounds(gdalInfo);
    result.layers  = extractLayers(gdalInfo);
    return result;
  } catch {
    // gdal não instalado – continua com métodos alternativos
  }

  // ── Tentativa 2: pdfinfo (se disponível) ───────────────
  try {
    const pdfInfo = execSync(`pdfinfo "${filePath}" 2>/dev/null`, { timeout: 10_000 }).toString();
    const pages   = pdfInfo.match(/Pages:\s+(\d+)/);
    if (pages) result.pageCount = parseInt(pages[1]);
  } catch {
    // pdfinfo não instalado
  }

  // ── Tentativa 3: análise do arquivo PDF ────────────────
  // Avenza GeoPDF incorpora metadados no XMP/XML
  try {
    const content = readFileSync(filePath, 'latin1');
    const xmpMatch = content.match(/<rdf:RDF[\s\S]*?<\/rdf:RDF>/);
    if (xmpMatch) {
      const xmp = xmpMatch[0];
      // Extrai EPSG se presente
      const epsgMatch = xmp.match(/EPSG:(\d+)/);
      if (epsgMatch) result.crs = `EPSG:${epsgMatch[1]}`;

      // Extrai bounds simples
      const bboxMatch = xmp.match(/BoundingBox.*?([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)/);
      if (bboxMatch) {
        result.bounds = [
          parseFloat(bboxMatch[1]), parseFloat(bboxMatch[2]),
          parseFloat(bboxMatch[3]), parseFloat(bboxMatch[4]),
        ];
      }
    }
  } catch {
    // análise falhou
  }

  return result;
}

function extractCRS(gdalInfo) {
  const match = gdalInfo.match(/AUTHORITY\["EPSG","(\d+)"\]/);
  if (match) return `EPSG:${match[1]}`;
  const projMatch = gdalInfo.match(/PROJCS\["([^"]+)"/);
  if (projMatch) return projMatch[1];
  return null;
}

function extractBounds(gdalInfo) {
  // "Lower Left  ( -47.1234,  -23.5678)"
  const ll = gdalInfo.match(/Lower Left\s+\(\s*([+-]?\d+\.\d+),\s*([+-]?\d+\.\d+)\s*\)/);
  const ur = gdalInfo.match(/Upper Right\s+\(\s*([+-]?\d+\.\d+),\s*([+-]?\d+\.\d+)\s*\)/);
  if (ll && ur) {
    return [parseFloat(ll[1]), parseFloat(ll[2]), parseFloat(ur[1]), parseFloat(ur[2])];
  }
  return null;
}

function extractLayers(gdalInfo) {
  const layers = [];
  const matches = gdalInfo.matchAll(/SUBDATASET_\d+_NAME=(.*)/g);
  for (const m of matches) layers.push(m[1].trim());
  return layers;
}
