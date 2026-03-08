// ============================================================
//  tracks.js – Gravação de trilhas GPS em tempo real
// ============================================================

let _activeTrack     = null;   // trilha em gravação
let _trackPoints     = [];     // buffer de pontos do device
let _watchId         = null;   // ID do watchPosition
let _trackStartTime  = null;
let _hudInterval     = null;
let _pendingBatch    = [];     // pontos aguardando envio
const BATCH_INTERVAL = 10000;  // envia pontos a cada 10s
const MIN_DISTANCE   = 5;      // metros mínimos entre pontos

window.initTracks = function () {
  document.getElementById('btnStopTrack')?.addEventListener('click', stopTrack);
};

// ── Inicia gravação ───────────────────────────────────────
window.toggleRecord = async function () {
  if (_activeTrack) {
    stopTrack();
    return;
  }

  const btn = document.getElementById('btnRecord');
  btn?.classList.add('recording');

  const clientId = 'track_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const trackData = {
    name:       `Trilha ${new Date().toLocaleDateString('pt-BR')}`,
    color:      '#ef4444',
    status:     'recording',
    client_id:  clientId,
    device_id:  localStorage.getItem('afaia_device_id'),
    started_at: new Date().toISOString(),
    points:     [],
  };

  // Salva localmente
  await LocalDB.tracks.save(trackData);
  _activeTrack    = trackData;
  _trackPoints    = [];
  _trackStartTime = Date.now();

  // Cria trilha no servidor (se online)
  if (navigator.onLine && Auth.isLoggedIn()) {
    try {
      const serverTrack = await TracksAPI.create(trackData);
      _activeTrack.server_id = serverTrack.id;
    } catch {
      await LocalDB.syncQueue.add({
        type: 'track', operation: 'create',
        client_id: clientId, payload: trackData,
      });
    }
  }

  // Inicia GPS
  _watchId = navigator.geolocation.watchPosition(
    onGPSUpdate,
    (err) => console.warn('[GPS] Erro:', err.message),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
  );

  // Mostra HUD
  document.getElementById('trackHUD')?.classList.remove('hidden');
  _hudInterval = setInterval(updateHUD, 1000);

  // Batch upload a cada 10s
  _batchTimer = setInterval(flushPoints, BATCH_INTERVAL);

  showToast('Gravação iniciada', 'success');
};

// ── Recebe update do GPS ──────────────────────────────────
function onGPSUpdate(pos) {
  const { latitude: lat, longitude: lng, altitude,
          accuracy, speed, heading } = pos.coords;

  // Filtra pontos muito próximos
  const last = _trackPoints[_trackPoints.length - 1];
  if (last && haversine(last.lat, last.lng, lat, lng) < MIN_DISTANCE) return;

  const point = {
    lat, lng, altitude, accuracy,
    speed:      speed   || 0,
    heading:    heading || 0,
    recorded_at: new Date(pos.timestamp).toISOString(),
    track_client_id: _activeTrack.client_id,
  };

  _trackPoints.push(point);
  _pendingBatch.push(point);
  _activeTrack.points = _trackPoints;

  // Atualiza posição no mapa
  if (window.updateUserPosition) updateUserPosition(lat, lng, accuracy);

  // Desenha linha no mapa
  if (_trackPoints.length >= 2) {
    const map = window.getMap?.();
    const layer = window.getTracksLayer?.();
    if (map && layer) {
      layer.clearLayers();
      // Redesenha trilha ativa
      const coords = _trackPoints.map(p => [p.lat, p.lng]);
      L.polyline(coords, { color: '#ef4444', weight: 4, opacity: .9 }).addTo(layer);
    }
  }
}

// ── Envia batch de pontos ao servidor ─────────────────────
async function flushPoints() {
  if (_pendingBatch.length === 0 || !_activeTrack) return;

  const toSend = [..._pendingBatch];
  _pendingBatch = [];

  if (_activeTrack.server_id && navigator.onLine) {
    try {
      await TracksAPI.addPoints(_activeTrack.server_id, toSend);
    } catch {
      // Salva na fila offline
      await LocalDB.syncQueue.add({
        type: 'track_points', operation: 'create',
        client_id: _activeTrack.client_id + '_pts_' + Date.now(),
        payload: { track_client_id: _activeTrack.client_id, points: toSend },
      });
    }
  } else {
    await LocalDB.syncQueue.add({
      type: 'track_points', operation: 'create',
      client_id: _activeTrack.client_id + '_pts_' + Date.now(),
      payload: { track_client_id: _activeTrack.client_id, points: toSend },
    });
  }

  // Salva pontos localmente
  await LocalDB.trackPoints.addBatch(toSend);
}

// ── Para gravação ─────────────────────────────────────────
async function stopTrack() {
  if (!_activeTrack) return;

  // Para GPS e timers
  if (_watchId) navigator.geolocation.clearWatch(_watchId);
  clearInterval(_hudInterval);
  clearInterval(_batchTimer);

  // Envia pontos restantes
  await flushPoints();

  // Finaliza no servidor
  if (_activeTrack.server_id && navigator.onLine) {
    try {
      const finished = await TracksAPI.finish(_activeTrack.server_id);
      showToast(`Trilha finalizada: ${formatDistance(finished.distance_m)}`, 'success');
    } catch (err) {
      showToast('Trilha salva localmente', 'default');
    }
  } else {
    // Calcula stats básicas localmente
    const distance = calcLocalDistance(_trackPoints);
    showToast(`Trilha salva: ${formatDistance(distance)}`, 'success');
  }

  // Atualiza status local
  _activeTrack.status    = 'active';
  _activeTrack.finished_at = new Date().toISOString();
  await LocalDB.tracks.save(_activeTrack);

  // Reseta estado
  document.getElementById('btnRecord')?.classList.remove('recording');
  document.getElementById('trackHUD')?.classList.add('hidden');
  _activeTrack    = null;
  _trackPoints    = [];
  _trackStartTime = null;
}

// ── Atualiza HUD ──────────────────────────────────────────
function updateHUD() {
  if (!_trackStartTime) return;

  const elapsed = Math.floor((Date.now() - _trackStartTime) / 1000);
  const min     = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const sec     = (elapsed % 60).toString().padStart(2, '0');

  document.getElementById('hudTime').textContent  = `${min}:${sec}`;
  document.getElementById('hudDist').textContent  = (calcLocalDistance(_trackPoints) / 1000).toFixed(2);

  // Velocidade do último ponto
  const last = _trackPoints[_trackPoints.length - 1];
  const speed = last?.speed ? (last.speed * 3.6).toFixed(1) : '0.0';
  document.getElementById('hudSpeed').textContent = speed;
}

// ── Helpers ───────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R  = 6371000; // metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a  = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcLocalDistance(points) {
  let dist = 0;
  for (let i = 1; i < points.length; i++) {
    dist += haversine(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
  }
  return dist;
}

function formatDistance(meters) {
  if (!meters) return '0 m';
  return meters >= 1000 ? (meters/1000).toFixed(2)+' km' : Math.round(meters)+' m';
}
