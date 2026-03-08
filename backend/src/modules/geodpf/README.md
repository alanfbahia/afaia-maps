# GeoPDF Processing Pipeline

## Status atual
O pipeline está **estruturado e funcional** para as etapas de:
- ✅ Validação de arquivo (magic bytes, tamanho)
- ✅ Extração de metadados (gdalinfo, pdfinfo, XMP)
- ✅ Registro no banco de dados (bounds, CRS, layers)
- ⚠️ Conversão para tiles/GeoTIFF (requer GDAL no servidor)

## Para ativar conversão raster completa

### 1. Instale GDAL no servidor
```bash
# Ubuntu / Debian
apt-get install -y gdal-bin python3-gdal

# Verificar versão
gdalinfo --version
```

### 2. No Railway
Adicione no `Dockerfile`:
```dockerfile
RUN apt-get update && apt-get install -y gdal-bin
```

### 3. Converta manualmente (teste local)
```bash
# Extrair informações
gdalinfo seu_mapa.pdf

# Converter para GeoTIFF
gdal_translate -of GTiff seu_mapa.pdf saida.tif

# Converter para tiles MBTiles
gdal2tiles.py -z 8-16 saida.tif ./tiles/
mb-util ./tiles/ mapa.mbtiles
```

## Fluxo do pipeline
```
Upload PDF
    │
    ▼
[1] validate.js  → verifica magic bytes, tamanho, formato
    │
    ▼
[2] extract.js   → gdalinfo / pdfinfo / XMP parsing
    │              extrai: CRS, bounds, layers, pageCount
    ▼
[3] convert.js   → gdal_translate → GeoTIFF
    │              gdal2tiles → raster tiles (pendente)
    ▼
[4] register     → salva bounds/CRS no banco
                   atualiza status do mapa
```

## Formatos de entrada suportados
| Formato | Suporte | Notas |
|---|---|---|
| GeoPDF (Avenza) | ✅ Extração | Conversão pendente GDAL |
| GeoTIFF | ✅ Nativo | Direto no Leaflet |
| MBTiles | ✅ Nativo | SQLite tiles |
| GPX | ✅ Parser JS | Frontend |
| KML/KMZ | ✅ Parser JS | Frontend |
| GeoJSON | ✅ Nativo | Frontend |
