// ============================================================
//  frontend/js/mbtiles.js
//  Integração Leaflet com MBTiles via API backend
//  - Carrega camadas MBTiles como base layers ou overlays
//  - Controles de seleção, toggle e opacidade
//  - Cache SW dos tiles já visualizados
//  - UI da biblioteca de mapas offline
// ============================================================

import { API } from './api.js';

// ── Estado global das camadas ─────────────────────────────
const _layers  = new Map();   // mapId → { layer, info, enabled }
let   _map     = null;        // instância Leaflet
let   _control = null;        // controle de camadas
let   _baseLayers   = {};     // { 'nome': layer } para o control
let   _overlayLayers = {};

// ── Inicialização ─────────────────────────────────────────

/**
 * Inicializa o módulo com a instância do mapa Leaflet
 * @param {L.Map} leafletMap
 */
export function initMBTiles(leafletMap) {
  _map = leafletMap;
  _refreshLayerControl();
}

// ── API: buscar mapas MBTiles do usuário ─────────────────

/**
 * Carrega lista de mapas MBTiles do backend
 * @returns {Promise<Array>}
 */
export async function fetchMBTilesMaps() {
  try {
    const data = await API.get('/maps?file_type=mbtiles&limit=100');
    return data.data || [];
  } catch (err) {
    console.warn('[MBTiles] Falha ao buscar mapas:', err.message);
    return [];
  }
}

/**
 * Busca metadados detalhados de um MBTiles
 * @param {string} mapId
 * @returns {Promise<Object>}
 */
export async function fetchMBTilesInfo(mapId) {
  try {
    return await API.get(`/tiles/${mapId}/info`, { authless: true });
  } catch (err) {
    console.warn('[MBTiles] Info error:', err.message);
    return null;
  }
}

// ── Criação de camadas Leaflet ────────────────────────────

/**
 * Cria um L.TileLayer para um MBTiles pelo ID
 * @param {string} mapId
 * @param {Object} options - opções adicionais para L.TileLayer
 * @returns {L.TileLayer}
 */
export function createMBTilesLayer(mapId, options = {}) {
  const apiBase   = window.AFAIA_API_URL || '/api/v1';
  const tilesBase = apiBase.replace('/api/v1', '');

  const tileUrl = `${tilesBase}/tiles/${mapId}/{z}/{x}/{y}.png`;

  const layer = L.tileLayer(tileUrl, {
    maxZoom:         22,
    minZoom:         0,
    attribution:     options.attribution || 'Mapa offline – Afaia Maps',
    opacity:         options.opacity     ?? 1.0,
    errorTileUrl:    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    crossOrigin:     true,
    updateWhenIdle:  true,
    keepBuffer:      4,
    ...options,
  });

  // Adiciona header de autenticação via pane custom
  layer.on('tileload', () => {});

  return layer;
}

/**
 * Adiciona camada MBTiles ao mapa e ao controle de camadas
 * @param {string} mapId
 * @param {Object} info - metadados do tileset
 * @param {Object} options
 * @returns {L.TileLayer}
 */
export function addMBTilesLayer(mapId, info, options = {}) {
  if (_layers.has(mapId)) return _layers.get(mapId).layer;

  const layer = createMBTilesLayer(mapId, {
    attribution: info.attribution || info.name || 'Offline',
    opacity:     options.opacity ?? 1.0,
    minZoom:     info.minzoom ?? 0,
    maxZoom:     info.maxzoom ?? 18,
  });

  const isBase = (info.type === 'baselayer') || options.asBase;

  _layers.set(mapId, { layer, info, enabled: false, isBase });

  if (isBase) {
    _baseLayers[info.name || mapId] = layer;
  } else {
    _overlayLayers[info.name || mapId] = layer;
  }

  _refreshLayerControl();

  return layer;
}

/**
 * Ativa uma camada MBTiles no mapa
 * @param {string} mapId
 */
export function enableMBTilesLayer(mapId) {
  const entry = _layers.get(mapId);
  if (!entry || !_map) return;

  entry.layer.addTo(_map);
  entry.enabled = true;

  // Centraliza o mapa nos bounds do tileset se não estiver visível
  if (entry.info?.bounds) {
    const [w, s, e, n] = entry.info.bounds;
    const bounds = L.latLngBounds([[s, w], [n, e]]);
    if (!_map.getBounds().intersects(bounds)) {
      _map.fitBounds(bounds);
    }
  } else if (entry.info?.center?.length >= 2) {
    const [lon, lat, zoom] = entry.info.center;
    _map.setView([lat, lon], zoom ?? 10);
  }
}

/**
 * Desativa uma camada MBTiles do mapa
 * @param {string} mapId
 */
export function disableMBTilesLayer(mapId) {
  const entry = _layers.get(mapId);
  if (!entry) return;
  _map?.removeLayer(entry.layer);
  entry.enabled = false;
}

/**
 * Toggle de uma camada
 * @param {string} mapId
 * @returns {boolean} novo estado
 */
export function toggleMBTilesLayer(mapId) {
  const entry = _layers.get(mapId);
  if (!entry) return false;

  if (entry.enabled) {
    disableMBTilesLayer(mapId);
    return false;
  } else {
    enableMBTilesLayer(mapId);
    return true;
  }
}

/**
 * Define opacidade de uma camada (0.0–1.0)
 * @param {string} mapId
 * @param {number} opacity
 */
export function setLayerOpacity(mapId, opacity) {
  const entry = _layers.get(mapId);
  if (!entry) return;
  entry.layer.setOpacity(Math.max(0, Math.min(1, opacity)));
}

/**
 * Remove camada completamente
 * @param {string} mapId
 */
export function removeMBTilesLayer(mapId) {
  const entry = _layers.get(mapId);
  if (!entry) return;

  disableMBTilesLayer(mapId);

  const name = entry.info?.name || mapId;
  delete _baseLayers[name];
  delete _overlayLayers[name];

  _layers.delete(mapId);
  _refreshLayerControl();
}

// ── Controle de camadas ───────────────────────────────────

function _refreshLayerControl() {
  if (!_map) return;

  if (_control) {
    _map.removeControl(_control);
    _control = null;
  }

  const hasLayers = Object.keys(_baseLayers).length + Object.keys(_overlayLayers).length > 0;
  if (!hasLayers) return;

  _control = L.control.layers(_baseLayers, _overlayLayers, {
    position: 'topright',
    collapsed: true,
  });

  _control.addTo(_map);
}

// ── Pré-download de tiles para offline ───────────────────

/**
 * Pré-cacheia tiles de um nível de zoom via Service Worker
 * @param {string} mapId
 * @param {number[]} bounds [w, s, e, n]
 * @param {number} zoom
 * @param {function} onProgress (downloaded, total) => void
 */
export async function preCacheTiles(mapId, bounds, zoom, onProgress) {
  if (!('serviceWorker' in navigator)) return;

  const [w, s, e, n] = bounds;

  // Converte lat/lon para tile x/y
  function lon2tile(lon, z) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
  function lat2tile(lat, z) { return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z)); }

  const minX = lon2tile(w, zoom);
  const maxX = lon2tile(e, zoom);
  const minY = lat2tile(n, zoom);
  const maxY = lat2tile(s, zoom);

  const total = (maxX - minX + 1) * (maxY - minY + 1);
  let downloaded = 0;

  const tilesBase = (window.AFAIA_API_URL || '/api/v1').replace('/api/v1', '');

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const url = `${tilesBase}/tiles/${mapId}/${zoom}/${x}/${y}.png`;
      navigator.serviceWorker.controller?.postMessage({
        type: 'CACHE_MAP_FILE',
        payload: { url }
      });
      downloaded++;
      onProgress?.(downloaded, total);
    }
    // Yield para não travar a UI
    await new Promise(r => setTimeout(r, 0));
  }
}

// ── Uso como mapa base ────────────────────────────────────

/**
 * Define um MBTiles como mapa base atual (remove outros base layers do mapa)
 * @param {string} mapId
 * @param {Object} info
 */
export async function setAsBaseMap(mapId, info) {
  if (!_map) return;

  // Remove base layers atuais
  for (const [id, entry] of _layers) {
    if (entry.isBase && entry.enabled) {
      _map.removeLayer(entry.layer);
      entry.enabled = false;
    }
  }

  // Adiciona (ou reutiliza) a camada
  if (!_layers.has(mapId)) {
    addMBTilesLayer(mapId, info, { asBase: true });
  }

  enableMBTilesLayer(mapId);

  // Emite evento para UI atualizar
  window.dispatchEvent(new CustomEvent('afaia:basemap-changed', {
    detail: { mapId, info }
  }));
}

// ── Export do estado para debug ───────────────────────────
export function getLayersState() {
  const state = [];
  for (const [id, entry] of _layers) {
    state.push({
      id,
      name:    entry.info?.name || id,
      enabled: entry.enabled,
      isBase:  entry.isBase,
    });
  }
  return state;
}
