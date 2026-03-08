# MBTiles no Afaia Maps

## O que é MBTiles?

MBTiles é um formato de arquivo SQLite que armazena tiles de mapa em um único arquivo `.mbtiles`. É o formato recomendado para uso offline no Afaia Maps porque:

- **Um único arquivo** contém todos os tiles de uma área
- **SQLite**: consultas rápidas, sem servidor
- **Padrão aberto** (especificação MapBox): compatível com dezenas de ferramentas
- **Compacto**: tiles PNG/JPEG são armazenados de forma eficiente

---

## Ferramentas para Gerar MBTiles

### 1. QGIS (recomendado para GeoPDF / Rasters)

```
Raster → Miscellaneous → Tile Index
   OU
Processing → Toolbox → Raster tools → Generate XYZ tiles (MBTiles)
```

**Passos:**
1. Abra o QGIS e carregue seu raster (GeoTIFF, GeoPDF, ECW, etc.)
2. Vá em **Processing → Toolbox**
3. Busque **"Generate XYZ tiles (MBTiles)"**
4. Configure:
   - **Extent**: extensão da área desejada
   - **Minimum zoom**: 0–8 (visão geral)
   - **Maximum zoom**: 14–18 (detalhe)
   - **Output file**: `meu-mapa.mbtiles`
5. Execute e aguarde (pode demorar para zooms altos)

> ⚠️ Zoom 18 em áreas grandes pode gerar arquivos de vários GB. Use com cuidado.

---

### 2. mb-util (linha de comando)

Converte pastas de tiles XYZ para MBTiles:

```bash
# Instalação
pip install mbutil

# Converter pasta de tiles para MBTiles
mb-util ./tiles meu-mapa.mbtiles --scheme=xyz

# Converter MBTiles para pasta de tiles
mb-util meu-mapa.mbtiles ./tiles --scheme=xyz
```

---

### 3. TileMill / MapBox Studio

Para gerar mapas vetoriais ou estilizados:

```bash
# MapBox CLI (requer conta MapBox para algumas funções)
npm install -g @mapbox/mapbox-gl-js
```

---

### 4. gdal2tiles (GDAL)

Converte qualquer raster georreferenciado para tiles:

```bash
# Instalar GDAL
sudo apt install gdal-bin   # Linux
brew install gdal            # macOS

# Gerar tiles em pasta
gdal2tiles.py -z 8-16 meu-mapa.tif ./tiles/

# Depois converter para MBTiles com mb-util
mb-util ./tiles meu-mapa.mbtiles --scheme=xyz
```

---

### 5. TileliveNPM / tippecanoe (GeoJSON → MBTiles vetorial)

```bash
npm install -g @mapbox/tippecanoe

# GeoJSON para MBTiles vetorial
tippecanoe -o meu-mapa.mbtiles -z 16 minha-area.geojson

# Com múltiplos layers
tippecanoe -o meu-mapa.mbtiles \
  --layer=trilhas   trilhas.geojson \
  --layer=pontos    pontos.geojson
```

---

## Importar no Afaia Maps

### Via Interface Web

1. Acesse **Biblioteca de Mapas** → **Importar**
2. Arraste o arquivo `.mbtiles` ou clique em "selecionar"
3. Defina um nome (opcional) e tags
4. Aguarde o upload e validação
5. O arquivo será validado (tabelas `metadata` e `tiles` presentes)
6. Metadados extraídos automaticamente: minzoom, maxzoom, bounds, centro, formato

### Via API (automatizado)

```bash
curl -X POST https://sua-api/api/v1/maps/upload \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "file=@meu-mapa.mbtiles" \
  -F "name=Mapa da Serra da Canastra" \
  -F "tags=trilha,offline,topo"
```

**Resposta:**
```json
{
  "id": "uuid-do-mapa",
  "name": "Mapa da Serra da Canastra",
  "file_type": "mbtiles",
  "min_zoom": 8,
  "max_zoom": 16,
  "tile_format": "png",
  "mbtiles_info": {
    "tileCount": 12543,
    "fileSizeFormatted": "245.8 MB",
    "center": [-46.5, -20.2, 12],
    "tileUrl": "/tiles/uuid-do-mapa/{z}/{x}/{y}.png"
  }
}
```

---

## Usar como Mapa Base

### No App (Interface)

1. Abra **Biblioteca de Mapas**
2. Encontre o MBTiles desejado
3. Toque em **"Usar como Base"**
4. Volte ao mapa principal — o MBTiles será carregado como base layer

### Via JavaScript (Leaflet)

```javascript
import { initMBTiles, setAsBaseMap, fetchMBTilesInfo } from './js/mbtiles.js';

// Inicializa com mapa Leaflet
initMBTiles(mapInstance);

// Busca info e define como base
const info = await fetchMBTilesInfo('uuid-do-mapa');
await setAsBaseMap('uuid-do-mapa', info);
```

### URL direta do tile

```
GET /tiles/{mapId}/{z}/{x}/{y}.png
```

**Leaflet:**
```javascript
L.tileLayer('/tiles/uuid-do-mapa/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: 'Mapa offline – Afaia Maps'
}).addTo(map);
```

---

## Rota de Tiles – Detalhes Técnicos

| Endpoint | Descrição |
|---|---|
| `GET /tiles/{id}/{z}/{x}/{y}.png` | Retorna tile PNG/JPEG/WebP |
| `GET /tiles/{id}/info` | Metadados do tileset |
| `GET /tiles/{id}/preview` | Tile de preview (zoom central) |
| `GET /tiles/stats` | Estatísticas do cache LRU |

**Comportamento:**
- Tiles inexistentes retornam PNG transparente 256×256 (não 404)
- Cabeçalho `Cache-Control: public, max-age=2592000` (30 dias)
- Conversão automática TMS→XYZ (y invertido para Leaflet)
- Detecção de formato por magic bytes (PNG/JPEG/WebP/PBF)
- Suporte a tiles comprimidos em gzip (MVT/PBF)

---

## Cache Offline

### Service Worker

O SW v3 do Afaia Maps cacheia automaticamente os tiles MBTiles visitados:

- **Cache name**: `afaia-v3-mbtiles`
- **Estratégia**: Cache-first (tiles são imutáveis)
- **TTL**: 90 dias
- Os tiles são armazenados no navegador após a primeira visualização

### Pré-download de tiles

```javascript
import { preCacheTiles } from './js/mbtiles.js';

// Baixa todos os tiles de zoom 12 para uma área
await preCacheTiles(
  'uuid-do-mapa',
  [-47.0, -20.5, -46.0, -19.5],   // bounds [W, S, E, N]
  12,                               // zoom level
  (downloaded, total) => {
    console.log(`${downloaded}/${total} tiles`);
  }
);
```

---

## Cache LRU SQLite (Backend)

O backend mantém conexões SQLite abertas em um cache LRU para evitar overhead:

| Parâmetro | Valor |
|---|---|
| Máximo de conexões simultâneas | 20 |
| TTL de conexão inativa | 5 minutos |
| Cache SQLite por arquivo | 32 MB |
| mmap por arquivo | 256 MB |

```
GET /tiles/stats
```
```json
{
  "size": 3,
  "max": 20,
  "entries": [
    { "mapId": "...", "idleSecs": 12, "lastUsed": "..." }
  ]
}
```

---

## Limites Recomendados

| Situação | Zoom Max | Tamanho Esperado |
|---|---|---|
| País inteiro (visão geral) | 10 | 50–200 MB |
| Estado / região | 13 | 200–800 MB |
| Trilha / área pequena | 16 | 50–500 MB |
| Mapeamento detalhado | 18 | 500 MB–5 GB |

> **Limite do servidor**: 5 GB por arquivo (configurável em `MAX_FILE_SIZE_MB` no `.env`)

> **Para uso no celular (Capacitor)**: recomendamos máximo de 2 GB por arquivo.

---

## Validação do MBTiles

O Afaia Maps valida automaticamente antes de aceitar o upload:

```
✅ Arquivo .mbtiles existe
✅ Tamanho > 0 bytes e ≤ 5 GB
✅ SQLite válido (abre sem erro)
✅ Tabela 'metadata' presente
✅ Tabela 'tiles' ou 'map' presente
✅ Pelo menos 1 tile encontrado
```

Se a validação falhar, o upload é rejeitado com mensagem de erro detalhada.

---

## Exemplo de Workflow Completo

```bash
# 1. Baixar área de interesse via OSM (exemplo: Chapada dos Veadeiros)
# Use o MapBox/OpenMapTiles ou gere a partir de rasters próprios

# 2. Converter GeoTIFF para MBTiles com QGIS ou GDAL
gdal2tiles.py -z 8-15 chapada.tif ./tiles-chapada/
mb-util ./tiles-chapada chapada-veadeiros.mbtiles --scheme=xyz

# 3. Validar localmente
sqlite3 chapada-veadeiros.mbtiles "SELECT name,value FROM metadata LIMIT 10;"

# 4. Upload para Afaia Maps
curl -X POST https://api.afaiamaps.com/api/v1/maps/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@chapada-veadeiros.mbtiles" \
  -F "name=Chapada dos Veadeiros – Zoom 8-15"

# 5. No app: Biblioteca → "Usar como Base"
# 6. Acesse o mapa offline – sem internet!
```

---

## Solução de Problemas

| Problema | Causa | Solução |
|---|---|---|
| "Arquivo não é MBTiles válido" | Falta tabela metadata/tiles | Gere novamente com ferramenta compatível |
| Tiles em branco | Zoom fora do range | Verifique minzoom/maxzoom no `/info` |
| Tiles invertidos | Esquema TMS vs XYZ | O Afaia converte automaticamente |
| Upload muito lento | Arquivo grande | Divida em áreas menores |
| "Excede 5 GB" | Arquivo grande demais | Reduza zoom max ou a área |
| Tiles JPEG tem artefatos | Qualidade baixa na geração | Regere com qualidade 85+ |

---

*Documentação Afaia Maps – gerado em 2026-03-08*
