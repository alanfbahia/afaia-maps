/* ============================================================
   AFAIA MAPS — Dashboard JS
   ============================================================ */

(function () {
  'use strict';

  /* ====== MOCK DATA ====== */
  const mockMaps = [
    { id: 1, name: 'Mapa Geológico Área 3', type: 'GeoPDF', size: '24 MB', date: '08/03/2026', offline: true,  icon: 'fas fa-file-pdf',    color: '#C94B4B' },
    { id: 2, name: 'Topografia Serra Norte', type: 'GeoTIFF', size: '18 MB', date: '07/03/2026', offline: true,  icon: 'fas fa-mountain',   color: '#163F59' },
    { id: 3, name: 'Mapa Operacional Base', type: 'GPX',     size: '2 MB',  date: '06/03/2026', offline: false, icon: 'fas fa-route',      color: '#E58A2B' },
    { id: 4, name: 'Planta Mina Cobre',     type: 'GeoPDF',  size: '41 MB', date: '05/03/2026', offline: true,  icon: 'fas fa-file-pdf',   color: '#C94B4B' },
  ];

  const mockTracks = [
    { id: 1, name: 'Trilha Encosta Sul',    dist: '8.4 km', time: '2h 34min', date: '08/03', synced: true  },
    { id: 2, name: 'Inspeção Perímetro A',  dist: '3.2 km', time: '0h 48min', date: '07/03', synced: true  },
    { id: 3, name: 'Reconhecimento Norte',  dist: '12.1 km',time: '4h 12min', date: '06/03', synced: false },
    { id: 4, name: 'Rota Emergência B3',    dist: '1.8 km', time: '0h 22min', date: '05/03', synced: true  },
  ];

  const mockWaypoints = [
    { id: 1,  name: 'Afloramento 01',   cat: 'Amostra',   catIcon: 'fas fa-vial',             catColor: 'blue',   lat: '-23.5501', lng: '-46.6330', project: 'Projeto Cobre', date: '08/03', synced: true  },
    { id: 2,  name: 'Acampamento Base', cat: 'Acampamento', catIcon: 'fas fa-campground',     catColor: 'green',  lat: '-23.5489', lng: '-46.6312', project: 'Serra Norte',   date: '07/03', synced: true  },
    { id: 3,  name: 'Risco Deslizamento', cat: 'Risco',   catIcon: 'fas fa-exclamation-triangle', catColor: 'orange', lat: '-23.5520', lng: '-46.6355', project: 'Projeto Cobre', date: '07/03', synced: false },
    { id: 4,  name: 'Veículo 01',       cat: 'Veículo',   catIcon: 'fas fa-truck',            catColor: 'blue',   lat: '-23.5495', lng: '-46.6340', project: 'Serra Norte',   date: '06/03', synced: true  },
    { id: 5,  name: 'POI Vista Panorâmica', cat: 'Ponto de interesse', catIcon: 'fas fa-binoculars', catColor: 'teal', lat: '-23.5478', lng: '-46.6290', project: 'Serra Norte', date: '06/03', synced: true },
  ];

  const syncItems = [
    { type: 'Trilha',    name: 'Reconhecimento Norte', status: 'pending' },
    { type: 'Waypoint',  name: 'Risco Deslizamento',   status: 'pending' },
    { type: 'Foto',      name: 'IMG_2340.jpg',          status: 'pending' },
  ];

  /* ====== RENDER RECENT MAPS ====== */
  function renderRecentMaps() {
    const container = document.getElementById('recentMapsList');
    if (!container) return;

    container.innerHTML = mockMaps.map(m => `
      <div class="map-list-item" onclick="window.location.href='app.html?map=${m.id}'">
        <div class="map-thumb" style="background:${m.id % 2 === 0 ? 'var(--gradient-primary)' : 'var(--gradient-map)'};">
          <i class="${m.icon}" style="color:rgba(255,255,255,0.85);font-size:18px;"></i>
        </div>
        <div class="map-item-info">
          <div class="map-item-name">${m.name}</div>
          <div class="map-item-meta">
            <span>${m.type}</span>
            <span>·</span>
            <span>${m.size}</span>
            ${m.offline ? '<span>·</span><span style="color:var(--color-accent-green);font-weight:600;"><i class="fas fa-check-circle"></i> offline</span>' : ''}
          </div>
        </div>
        <button class="btn btn-ghost btn-icon-sm" title="Abrir" onclick="event.stopPropagation();window.location.href='app.html?map=${m.id}'">
          <i class="fas fa-chevron-right" style="font-size:11px;color:var(--color-gray-mid);"></i>
        </button>
      </div>
    `).join('');
  }

  /* ====== RENDER RECENT TRACKS ====== */
  function renderRecentTracks() {
    const container = document.getElementById('tracksList');
    if (!container) return;

    container.innerHTML = mockTracks.map(t => `
      <div class="track-item" onclick="window.location.href='tracks.html'">
        <div class="track-icon">
          <i class="fas fa-route"></i>
        </div>
        <div class="track-info">
          <div class="track-name">${t.name}</div>
          <div class="track-meta">${t.date} ${t.synced ? '· <span style="color:var(--color-accent-green);"><i class="fas fa-check"></i> sincronizado</span>' : '· <span style="color:var(--color-alert);"><i class="fas fa-clock"></i> pendente</span>'}</div>
        </div>
        <div class="track-stats">
          <span class="track-dist">${t.dist}</span>
          <span class="track-time">${t.time}</span>
        </div>
      </div>
    `).join('');
  }

  /* ====== RENDER SYNC ITEMS ====== */
  function renderSyncItems() {
    const container = document.getElementById('syncItems');
    if (!container) return;

    const typeIcons = { Trilha: 'fas fa-route', Waypoint: 'fas fa-map-pin', Foto: 'fas fa-camera' };

    container.innerHTML = syncItems.map(s => `
      <div class="sync-item">
        <div class="sync-item-icon ${s.status}">
          <i class="${typeIcons[s.type] || 'fas fa-file'}"></i>
        </div>
        <div class="sync-item-info">
          <div class="sync-item-name">${s.name}</div>
          <div class="sync-item-type">${s.type}</div>
        </div>
        <span class="badge badge-orange" style="font-size:9px;">Pendente</span>
      </div>
    `).join('');
  }

  /* ====== RENDER WAYPOINTS TABLE ====== */
  function renderWaypointsTable() {
    const tbody = document.getElementById('waypointsTableBody');
    if (!tbody) return;

    const catColors = { blue: 'badge-blue', green: 'badge-green', orange: 'badge-orange', teal: 'badge-green' };

    tbody.innerHTML = mockWaypoints.map(w => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <div class="wp-category-icon" style="background:rgba(47,163,124,0.1);color:var(--color-accent-green);">
              <i class="${w.catIcon}" style="font-size:12px;"></i>
            </div>
            <span style="font-weight:600;">${w.name}</span>
          </div>
        </td>
        <td>
          <span class="badge ${catColors[w.catColor] || 'badge-gray'}">${w.cat}</span>
        </td>
        <td>
          <span class="text-mono" style="font-size:11px;">${w.lat}, ${w.lng}</span>
        </td>
        <td>${w.project}</td>
        <td style="color:var(--color-gray-mid);font-size:var(--text-xs);">${w.date}</td>
        <td>
          ${w.synced
            ? '<span class="badge badge-green"><i class="fas fa-check"></i> Sync</span>'
            : '<span class="badge badge-orange"><i class="fas fa-clock"></i> Pendente</span>'
          }
        </td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-ghost btn-icon-sm" title="Ver no mapa" onclick="window.location.href='app.html'">
              <i class="fas fa-map-marker-alt" style="font-size:12px;color:var(--color-gray-mid);"></i>
            </button>
            <button class="btn btn-ghost btn-icon-sm" title="Editar">
              <i class="fas fa-edit" style="font-size:12px;color:var(--color-gray-mid);"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  /* ====== CHART ====== */
  let activityChart = null;

  const chartData = {
    waypoints: {
      label: 'Waypoints criados',
      data:  [8, 12, 5, 17, 9, 14, 11],
      color: '#2FA37C'
    },
    distance: {
      label: 'Distância percorrida (km)',
      data:  [3.2, 8.4, 0, 12.1, 4.5, 7.8, 1.8],
      color: '#E58A2B'
    }
  };

  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

  function initChart(type = 'waypoints') {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;

    const d = chartData[type];

    if (activityChart) activityChart.destroy();

    activityChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: d.label,
          data: d.data,
          backgroundColor: d.data.map((_, i) => i === 6 ? d.color : d.color + '55'),
          borderColor: d.color,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F2D3A',
            titleColor: '#fff',
            bodyColor: 'rgba(255,255,255,0.8)',
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#A7B0B7', font: { size: 11, family: 'Inter' } }
          },
          y: {
            grid: { color: 'rgba(167,176,183,0.15)', drawBorder: false },
            border: { display: false },
            ticks: { color: '#A7B0B7', font: { size: 11, family: 'Inter' } }
          }
        }
      }
    });
  }

  window.switchChart = function (type, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    initChart(type);
  };

  /* ====== COUNTER ANIMATION ====== */
  function animateCounters() {
    const counters = [
      { id: 'statMaps', target: 8 },
      { id: 'statTracks', target: 24 },
      { id: 'statWaypoints', target: 147 },
      { id: 'statPhotos', target: 89 },
    ];

    counters.forEach(({ id, target }) => {
      const el = document.getElementById(id);
      if (!el) return;

      let current = 0;
      const increment = target / 40;
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        el.textContent = Math.floor(current);
      }, 30);
    });
  }

  /* ====== INIT ====== */
  document.addEventListener('DOMContentLoaded', () => {
    renderRecentMaps();
    renderRecentTracks();
    renderSyncItems();
    renderWaypointsTable();
    setTimeout(initChart, 100);
    setTimeout(animateCounters, 200);
  });

})();
