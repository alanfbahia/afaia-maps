/* ============================================================
   AFAIA MAPS — Global App JS
   ============================================================ */

window.AfaiaMaps = window.AfaiaMaps || {};

/* ====== TOAST ====== */
AfaiaMaps.showToast = function (type, title, message, duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: 'fa-check-circle',
    error:   'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info:    'fa-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button onclick="this.parentElement.remove()"
      style="background:none;border:none;cursor:pointer;color:var(--color-gray-mid);margin-left:8px;padding:0;">
      <i class="fas fa-times" style="font-size:12px;"></i>
    </button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  if (duration > 0) {
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  return toast;
};

// Global alias
window.showToast = AfaiaMaps.showToast;

/* ====== SIDEBAR TOGGLE ====== */
window.toggleSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show');
};

/* ====== DROPDOWN ====== */
window.toggleDropdown = function (id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.toggle('open');
    // Close other dropdowns
    document.querySelectorAll('.dropdown.open').forEach(d => {
      if (d.id !== id) d.classList.remove('open');
    });
  }
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  }
});

/* ====== OFFLINE MODE ====== */
window.toggleOfflineMode = function (checkbox) {
  const banner = document.getElementById('offlineBanner');
  if (checkbox.checked) {
    if (banner) banner.classList.add('show');
    showToast('warning', 'Modo Offline Ativado', 'Trabalhando com dados locais. Sincronize quando retornar à rede.');
  } else {
    if (banner) banner.classList.remove('show');
    showToast('success', 'Modo Online', 'Conectado à internet. Sincronização automática ativa.');
  }
};

window.addEventListener('offline', () => {
  const banner = document.getElementById('offlineBanner');
  if (banner) banner.classList.add('show');
  showToast('warning', 'Conexão perdida', 'Você está offline. Os dados serão sincronizados quando a conexão retornar.');
});

window.addEventListener('online', () => {
  const banner = document.getElementById('offlineBanner');
  if (banner) banner.classList.remove('show');
  showToast('success', 'Conexão restabelecida', 'Sincronizando dados automaticamente…');
});

/* ====== MODAL ====== */
AfaiaMaps.openModal = function (id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
};

AfaiaMaps.closeModal = function (id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
};

window.openModal  = AfaiaMaps.openModal;
window.closeModal = AfaiaMaps.closeModal;

// Close on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

/* ====== GPS SIMULATION ====== */
AfaiaMaps.GPS = {
  lat: -23.5505,
  lng: -46.6333,
  alt: 752,
  sats: 12,
  accuracy: 3,

  update() {
    this.lat += (Math.random() - 0.5) * 0.00005;
    this.lng += (Math.random() - 0.5) * 0.00005;
    this.alt += (Math.random() - 0.5) * 2;
    this.sats = 10 + Math.floor(Math.random() * 5);
    this.accuracy = 2 + Math.floor(Math.random() * 4);
  },

  getFormatted() {
    return {
      lat:      this.lat.toFixed(6) + '°',
      lng:      this.lng.toFixed(6) + '°',
      alt:      Math.round(this.alt) + 'm',
      sats:     this.sats + ' sats',
      accuracy: '±' + this.accuracy + 'm'
    };
  }
};

// Update GPS display every 3s
setInterval(() => {
  AfaiaMaps.GPS.update();
  const g = AfaiaMaps.GPS.getFormatted();

  const els = {
    dashLat:  g.lat,
    dashLng:  g.lng,
    dashAlt:  g.alt + ' alt',
    dashSats: g.sats,
    dashAcc:  g.accuracy + ' precisão'
  };

  Object.entries(els).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}, 3000);

/* ====== SYNC ====== */
window.syncNow = function () {
  const btn = event?.target?.closest('button');
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando…';
    btn.disabled = true;

    setTimeout(() => {
      btn.innerHTML = orig;
      btn.disabled = false;
      showToast('success', 'Sincronização concluída!', '3 trilhas, 12 waypoints e 8 fotos enviados com sucesso.');

      // Update badge
      const badge = document.getElementById('syncBadge');
      if (badge) badge.textContent = '0';
    }, 2500);
  }
};

/* ====== IMPORT MODAL HELPER ====== */
window.openImportModal = function () {
  openModal('importModal');
};
