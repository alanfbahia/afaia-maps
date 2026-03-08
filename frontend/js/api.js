// ============================================================
//  api.js – Cliente HTTP centralizado
//  Todas as chamadas ao backend passam por aqui
// ============================================================

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api/v1'
  : '/api/v1';  // produção: proxy nginx

window.API_BASE = API_BASE;

/** Retorna o token armazenado */
function getToken() {
  return localStorage.getItem('afaia_token');
}

/**
 * Wrapper fetch com auth + retry automático
 */
async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    'X-Device-ID':  localStorage.getItem('afaia_device_id') || 'unknown',
    ...options.headers,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Remove Content-Type para FormData
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (networkErr) {
    throw new Error('Sem conexão com o servidor');
  }

  // Token expirado → tenta renovar
  if (res.status === 401) {
    const refreshToken = localStorage.getItem('afaia_refresh_token');
    if (refreshToken) {
      const refreshed = await tryRefreshToken(refreshToken);
      if (refreshed) {
        headers['Authorization'] = `Bearer ${getToken()}`;
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      } else {
        localStorage.removeItem('afaia_token');
        localStorage.removeItem('afaia_user');
        window.location.href = '/login.html';
        return;
      }
    }
  }

  if (!res.ok) {
    let errMsg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function tryRefreshToken(refreshToken) {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('afaia_token', data.accessToken);
    return true;
  } catch {
    return false;
  }
}

// ── Auth API ──────────────────────────────────────────────
window.AuthAPI = {
  login(email, password, deviceId) {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, deviceId }),
    });
  },
  register(name, email, password) {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },
  me() {
    return apiFetch('/auth/me');
  },
  forgotPassword(email) {
    return apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  logout() {
    return apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  },
};

// ── Tracks API ────────────────────────────────────────────
window.TracksAPI = {
  list(params = {})     { return apiFetch(`/tracks?${new URLSearchParams(params)}`); },
  get(id)               { return apiFetch(`/tracks/${id}`); },
  create(data)          { return apiFetch('/tracks', { method: 'POST', body: JSON.stringify(data) }); },
  update(id, data)      { return apiFetch(`/tracks/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  delete(id)            { return apiFetch(`/tracks/${id}`, { method: 'DELETE' }); },
  addPoints(id, points) { return apiFetch(`/tracks/${id}/points`, { method: 'POST', body: JSON.stringify({ points }) }); },
  finish(id)            { return apiFetch(`/tracks/${id}/finish`, { method: 'POST' }); },
  geojson(id)           { return apiFetch(`/tracks/${id}/geojson`); },
};

// ── Waypoints API ─────────────────────────────────────────
window.WaypointsAPI = {
  list(params = {})   { return apiFetch(`/waypoints?${new URLSearchParams(params)}`); },
  get(id)             { return apiFetch(`/waypoints/${id}`); },
  create(data)        { return apiFetch('/waypoints', { method: 'POST', body: JSON.stringify(data) }); },
  update(id, data)    { return apiFetch(`/waypoints/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  delete(id)          { return apiFetch(`/waypoints/${id}`, { method: 'DELETE' }); },
  bbox(minLng, minLat, maxLng, maxLat) {
    return apiFetch(`/waypoints/bbox?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`);
  },
};

// ── Maps API ──────────────────────────────────────────────
window.MapsAPI = {
  list(params = {})  { return apiFetch(`/maps?${new URLSearchParams(params)}`); },
  get(id)            { return apiFetch(`/maps/${id}`); },
  update(id, data)   { return apiFetch(`/maps/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  delete(id)         { return apiFetch(`/maps/${id}`, { method: 'DELETE' }); },
  status(id)         { return apiFetch(`/maps/${id}/status`); },
  upload(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/maps/upload`);
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('X-Device-ID', localStorage.getItem('afaia_device_id') || 'unknown');

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
        });
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText).error)); }
          catch { reject(new Error(`Upload falhou: ${xhr.status}`)); }
        }
      };
      xhr.onerror = () => reject(new Error('Erro de rede no upload'));
      xhr.send(formData);
    });
  },
};

// ── Projects API ──────────────────────────────────────────
window.ProjectsAPI = {
  list()            { return apiFetch('/projects'); },
  get(id)           { return apiFetch(`/projects/${id}`); },
  create(data)      { return apiFetch('/projects', { method: 'POST', body: JSON.stringify(data) }); },
  update(id, data)  { return apiFetch(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  delete(id)        { return apiFetch(`/projects/${id}`, { method: 'DELETE' }); },
  stats(id)         { return apiFetch(`/projects/${id}/stats`); },
};

// ── Sync API ──────────────────────────────────────────────
window.SyncAPI = {
  push(operations) { return apiFetch('/sync/push', { method: 'POST', body: JSON.stringify({ operations }) }); },
  pull(since)      { return apiFetch(`/sync/pull${since ? `?since=${since}` : ''}`); },
  status()         { return apiFetch('/sync/status'); },
};

// ── Photos API ────────────────────────────────────────────
window.PhotosAPI = {
  list(params = {}) { return apiFetch(`/photos?${new URLSearchParams(params)}`); },
  delete(id)        { return apiFetch(`/photos/${id}`, { method: 'DELETE' }); },
  upload(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/photos/upload`);
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
        });
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(`Upload falhou: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Erro de rede'));
      xhr.send(formData);
    });
  },
};

// ── Toast global ──────────────────────────────────────────
window.showToast = function(msg, type = 'default') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
};
