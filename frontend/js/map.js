// ============================================================
//  map.js – Mapa Leaflet com GPS e camadas
// ============================================================

let _map           = null;
let _userMarker    = null;
let _userCircle    = null;
let _watchId       = null;
let _baseLayers    = {};
let _overlayLayers = {};
let _tracksLayer   = null;
let _waypointsLayer = null;

window.initMap = function () {
  if (_map) return;

  _map = L.map('map', {
    center: [-15.7801, -47.9292], // Brasília como padrão
    zoom:   13,
    zoomControl: false,           // personalizado
  });

  // ── Camadas base ──────────────────────────────────────────
  _baseLayers['osm'] = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenStreetMap', maxZoom: 19 }
  ).addTo(_map);

  _baseLayers['satellite'] = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: '© Esri', maxZoom: 19 }
  );

  _baseLayers['terrain'] = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenTopoMap', maxZoom: 17 }
  );

  // ── Zoom control personalizado ────────────────────────────
  L.control.zoom({ position: 'bottomright' }).addTo(_map);

  // ── Layers de trilhas e waypoints ─────────────────────────
  _tracksLayer    = L.layerGroup().addTo(_map);
  _waypointsLayer = L.layerGroup().addTo(_map);

  // ── Eventos dos controles ─────────────────────────────────
  document.getElementById('btnLocate')?.addEventListener('click', locateUser);
  document.getElementById('btnRecord')?.addEventListener('click', toggleRecord);
  document.getElementById('btnLayers')?.addEventListener('click', () => {
    document.getElementById('layersPanel')?.classList.toggle('hidden');
  });
  document.getElementById('closeLayersPanel')?.addEventListener('click', () => {
    document.getElementById('layersPanel')?.classList.add('hidden');
  });

  // Troca de camada base
  document.querySelectorAll('input[name="baseLayer"]').forEach(radio => {
    radio.addEventListener('change', () => {
      Object.values(_baseLayers).forEach(l => _map.removeLayer(l));
      _baseLayers[radio.value]?.addTo(_map);
    });
  });

  // Toggle overlays
  document.getElementById('toggleTracks')?.addEventListener('change', (e) => {
    if (e.target.checked) _map.addLayer(_tracksLayer);
    else _map.removeLayer(_tracksLayer);
  });
  document.getElementById('toggleWaypoints')?.addEventListener('change', (e) => {
    if (e.target.checked) _map.addLayer(_waypointsLayer);
    else _map.removeLayer(_waypointsLayer);
  });

  // Clique no mapa → adicionar waypoint
  document.getElementById('btnWaypoint')?.addEventListener('click', () => {
    showToast('Toque no mapa para adicionar o waypoint', 'default');
    _map.once('click', (e) => {
      const { lat, lng } = e.latlng;
      openWaypointModal(lat, lng);
    });
  });

  // Carrega dados do servidor
  loadMapData();

  // Localiza automaticamente ao abrir
  locateUser();
};

// ── Localização do usuário ────────────────────────────────
function locateUser() {
  if (!navigator.geolocation) {
    showToast('GPS não disponível neste dispositivo', 'error');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      updateUserPosition(lat, lng, accuracy);
      _map.setView([lat, lng], 16);
    },
    (err) => {
      showToast('Não foi possível obter sua localização', 'error');
      console.warn('[GPS]', err.message);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function updateUserPosition(lat, lng, accuracy) {
  const latlng = [lat, lng];

  if (_userMarker) {
    _userMarker.setLatLng(latlng);
    _userCircle?.setLatLng(latlng).setRadius(accuracy);
  } else {
    _userMarker = L.circleMarker(latlng, {
      radius: 8, color: '#2563eb', fillColor: '#2563eb',
      fillOpacity: 1, weight: 3,
    }).addTo(_map);

    _userCircle = L.circle(latlng, {
      radius: accuracy, color: '#2563eb',
      fillColor: '#2563eb', fillOpacity: 0.12, weight: 1,
    }).addTo(_map);
  }
}

// ── Carrega trilhas e waypoints existentes ────────────────
async function loadMapData() {
  try {
    // Tenta carregar do servidor
    if (Auth.isLoggedIn() && navigator.onLine) {
      const [tracksRes, wpRes] = await Promise.all([
        TracksAPI.list({ limit: 50 }),
        WaypointsAPI.list({ limit: 200 }),
      ]);

      tracksRes.data?.forEach(renderTrack);
      wpRes.data?.forEach(renderWaypoint);
    } else {
      // Offline: carrega do IndexedDB
      const localTracks    = await LocalDB.tracks.getAll();
      const localWaypoints = await LocalDB.waypoints.getAll();
      localTracks.forEach(renderTrackLocal);
      localWaypoints.forEach(renderWaypointLocal);
    }
  } catch (err) {
    console.warn('[MAP] Erro ao carregar dados:', err.message);
    // Fallback offline
    const localWaypoints = await LocalDB.waypoints.getAll();
    localWaypoints.forEach(renderWaypointLocal);
  }
}

function renderTrack(track) {
  if (!track.geom?.coordinates) return;
  const coords = track.geom.coordinates.map(c => [c[1], c[0]]);
  L.polyline(coords, {
    color: track.color || '#ef4444',
    weight: 4, opacity: .9,
  })
  .bindPopup(`<b>${track.name}</b><br>${formatDistance(track.distance_m)}`)
  .addTo(_tracksLayer);
}

function renderTrackLocal(track) {
  if (!track.points || track.points.length < 2) return;
  const coords = track.points.map(p => [p.lat, p.lng]);
  L.polyline(coords, { color: track.color || '#ef4444', weight: 4 })
   .bindPopup(track.name)
   .addTo(_tracksLayer);
}

function renderWaypoint(wp) {
  const icon = createWaypointIcon(wp.color || '#f59e0b', wp.symbol || 'pin');
  L.marker([wp.lat, wp.lng], { icon })
   .bindPopup(`<b>${wp.name}</b>${wp.description ? `<br>${wp.description}` : ''}`)
   .addTo(_waypointsLayer);
}

function renderWaypointLocal(wp) {
  renderWaypoint(wp);
}

// ── Ícone customizado para waypoint ──────────────────────
function createWaypointIcon(color, symbol) {
  const icons = { pin:'map-pin', flag:'flag', warning:'triangle-exclamation',
                  camp:'campground', water:'droplet', photo:'camera' };
  const fa = icons[symbol] || 'map-pin';
  return L.divIcon({
    html: `<div style="background:${color};width:32px;height:32px;border-radius:50% 50% 50% 0;
                transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
                border:2px solid rgba(255,255,255,.8);box-shadow:0 2px 8px rgba(0,0,0,.4)">
             <i class="fa fa-${fa}" style="transform:rotate(45deg);color:#fff;font-size:14px"></i>
           </div>`,
    iconSize:   [32, 32],
    iconAnchor: [16, 32],
    popupAnchor:[0, -32],
    className:  '',
  });
}

// ── Modal de waypoint ─────────────────────────────────────
function openWaypointModal(lat, lng) {
  document.getElementById('wpLat').value  = lat;
  document.getElementById('wpLng').value  = lng;
  document.getElementById('wpCoordsDisplay').textContent =
    `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  document.getElementById('waypointModal')?.classList.remove('hidden');
}

document.getElementById('closeWpModal')?.addEventListener('click', () => {
  document.getElementById('waypointModal')?.classList.add('hidden');
});
document.getElementById('cancelWpModal')?.addEventListener('click', () => {
  document.getElementById('waypointModal')?.classList.add('hidden');
});

document.getElementById('waypointForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const lat = parseFloat(document.getElementById('wpLat').value);
  const lng = parseFloat(document.getElementById('wpLng').value);

  const wpData = {
    name:      document.getElementById('wpName').value,
    description: document.getElementById('wpDesc').value,
    symbol:    document.getElementById('wpSymbol').value,
    lat, lng,
    client_id: 'wp_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    device_id: localStorage.getItem('afaia_device_id'),
  };

  // Renderiza imediatamente
  renderWaypoint(wpData);
  document.getElementById('waypointModal')?.classList.add('hidden');

  // Salva localmente
  await LocalDB.waypoints.save(wpData);

  // Tenta enviar ao servidor
  if (navigator.onLine && Auth.isLoggedIn()) {
    try {
      await WaypointsAPI.create(wpData);
      showToast('Waypoint salvo', 'success');
    } catch {
      await LocalDB.syncQueue.add({
        type: 'waypoint', operation: 'create',
        client_id: wpData.client_id, payload: wpData,
      });
      showToast('Waypoint salvo localmente', 'default');
    }
  } else {
    await LocalDB.syncQueue.add({
      type: 'waypoint', operation: 'create',
      client_id: wpData.client_id, payload: wpData,
    });
    showToast('Waypoint salvo offline', 'default');
  }

  // Limpa form
  e.target.reset();
});

// ── Exporta referência do mapa ────────────────────────────
window.getMap       = () => _map;
window.getTracksLayer    = () => _tracksLayer;
window.getWaypointsLayer = () => _waypointsLayer;

function formatDistance(meters) {
  if (!meters) return '—';
  return meters >= 1000
    ? (meters / 1000).toFixed(2) + ' km'
    : Math.round(meters) + ' m';
}
