// ============================================================
//  waypoints.js – Gestão de waypoints no frontend
// ============================================================

window.initWaypoints = function () {
  // Nada a inicializar além do que já está no map.js
  // Esta função existe para carregamento futuro de waypoints
  // na página específica (waypoints.html)
};

// Reexporta funções usadas por outras páginas
window.WaypointManager = {

  async createFromGPS(name, description, symbol, form_data) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng,
                  altitude, accuracy } = pos.coords;

          const wp = {
            name, description, symbol,
            lat, lng, altitude, accuracy,
            form_data: form_data || {},
            client_id: 'wp_' + Date.now() + '_' + Math.random().toString(36).slice(2),
            device_id: localStorage.getItem('afaia_device_id'),
            created_at: new Date().toISOString(),
          };

          // Salva localmente
          await LocalDB.waypoints.save(wp);

          // Envia ao servidor ou enfileira
          if (navigator.onLine && Auth.isLoggedIn()) {
            try {
              const saved = await WaypointsAPI.create(wp);
              resolve({ ...wp, server_id: saved.id });
            } catch {
              await LocalDB.syncQueue.add({
                type: 'waypoint', operation: 'create',
                client_id: wp.client_id, payload: wp,
              });
              resolve(wp);
            }
          } else {
            await LocalDB.syncQueue.add({
              type: 'waypoint', operation: 'create',
              client_id: wp.client_id, payload: wp,
            });
            resolve(wp);
          }
        },
        (err) => reject(new Error('GPS indisponível: ' + err.message)),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  },

  async loadAll() {
    if (navigator.onLine && Auth.isLoggedIn()) {
      try {
        const res = await WaypointsAPI.list({ limit: 500 });
        return res.data;
      } catch {}
    }
    return LocalDB.waypoints.getAll();
  },

  async deleteWaypoint(clientId, serverId) {
    await LocalDB.waypoints.delete(clientId);
    if (serverId && navigator.onLine) {
      try { await WaypointsAPI.delete(serverId); } catch {}
    }
  },
};
