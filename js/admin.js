/* ============================================================
   AFAIA MAPS — admin.js
   Lógica completa do painel administrativo web
   ============================================================ */

'use strict';

/* ============================================================
   DADOS MOCK
   ============================================================ */

const ADMIN_USERS = [
  { id:1, name:'João Silva',     initials:'JS', email:'joao@empresa.com',    plan:'Profissional', projects:4,  maps:8,   lastSeen:'08/03 14:30', active:true,  storage:2.4,  role:'geólogo' },
  { id:2, name:'Maria Costa',    initials:'MC', email:'maria@empresa.com',   plan:'Profissional', projects:3,  maps:12,  lastSeen:'08/03 11:15', active:true,  storage:8.7,  role:'topógrafa' },
  { id:3, name:'Pedro Alves',    initials:'PA', email:'pedro@empresa.com',   plan:'Explorador',   projects:1,  maps:2,   lastSeen:'07/03 16:40', active:false, storage:0.3,  role:'campo' },
  { id:4, name:'Ana Ferreira',   initials:'AF', email:'ana@empresa.com',     plan:'Corporativo',  projects:8,  maps:47,  lastSeen:'08/03 09:00', active:true,  storage:42.1, role:'engenheira' },
  { id:5, name:'Carlos Mendes',  initials:'CM', email:'carlos@mineradora.com', plan:'Profissional', projects:5, maps:23,  lastSeen:'07/03 18:55', active:true,  storage:18.5, role:'mineração' },
  { id:6, name:'Lucia Rocha',    initials:'LR', email:'lucia@construtora.com', plan:'Corporativo', projects:12, maps:89,  lastSeen:'08/03 13:20', active:true,  storage:89.3, role:'diretora' },
  { id:7, name:'Rodrigo Lima',   initials:'RL', email:'rodrigo@empresa.com',  plan:'Explorador',  projects:2,  maps:3,   lastSeen:'05/03 10:30', active:false, storage:1.2,  role:'campo' },
  { id:8, name:'Fernanda Gomes', initials:'FG', email:'fernanda@geo.com',     plan:'Profissional', projects:6, maps:18,  lastSeen:'08/03 15:45', active:true,  storage:12.8, role:'geóloga' },
];

const ADMIN_MAPS = [
  { id:1,  name:'Mapa Geológico Área 3',    user:'João Silva',    type:'GeoPDF',   size:'24 MB',  georef:true,  date:'08/03', visibility:'privado', downloads:4  },
  { id:2,  name:'Topografia Serra',         user:'Maria Costa',   type:'GeoTIFF',  size:'18 MB',  georef:true,  date:'07/03', visibility:'equipe',  downloads:7  },
  { id:3,  name:'Levantamento Drones',      user:'Ana Ferreira',  type:'GeoTIFF',  size:'87 MB',  georef:true,  date:'06/03', visibility:'público', downloads:23 },
  { id:4,  name:'Planta Mina Cobre',        user:'Carlos Mendes', type:'GeoPDF',   size:'41 MB',  georef:true,  date:'05/03', visibility:'privado', downloads:2  },
  { id:5,  name:'Zonas Ambientais',         user:'Lucia Rocha',   type:'KML',      size:'3.2 MB', georef:true,  date:'04/03', visibility:'equipe',  downloads:9  },
  { id:6,  name:'Carta Topográfica 1:50k',  user:'Fernanda Gomes',type:'GeoPDF',   size:'33 MB',  georef:true,  date:'03/03', visibility:'equipe',  downloads:5  },
  { id:7,  name:'Levantamento GPS RTK',     user:'Pedro Alves',   type:'GeoJSON',  size:'1.8 MB', georef:true,  date:'02/03', visibility:'privado', downloads:1  },
  { id:8,  name:'Shapefile Concessões',     user:'Rodrigo Lima',  type:'Shapefile',size:'12 MB',  georef:false, date:'01/03', visibility:'privado', downloads:0  },
];

const SYNC_ACTIVITY = [
  { id:1,  user:'João Silva',    action:'Sincronizou 3 trilhas e 12 waypoints',               time:'Há 12 min', ts:'14:30', type:'sync',    project:'Projeto Cobre' },
  { id:2,  user:'Ana Ferreira',  action:'Importou mapa GeoPDF "Levantamento Drones"',         time:'Há 35 min', ts:'14:07', type:'map',     project:'Levantamento Ambiental' },
  { id:3,  user:'Maria Costa',   action:'Criou 5 waypoints no projeto Serra Norte',           time:'Há 1h',     ts:'13:42', type:'point',   project:'Mapeamento Geológico' },
  { id:4,  user:'Carlos Mendes', action:'Gravou trilha "Acesso Mina Cobre" — 5.3 km',        time:'Há 2h',     ts:'12:30', type:'track',   project:'Projeto Cobre' },
  { id:5,  user:'Lucia Rocha',   action:'Compartilhou projeto Cobre com 4 usuários',          time:'Há 3h',     ts:'11:15', type:'share',   project:'Projeto Cobre' },
  { id:6,  user:'Pedro Alves',   action:'Baixou mapa para uso offline',                       time:'Há 5h',     ts:'09:30', type:'offline', project:'—' },
  { id:7,  user:'Rodrigo Lima',  action:'Exportou trilhas em formato GPX',                   time:'Há 8h',     ts:'06:45', type:'export',  project:'Topografia Serra' },
  { id:8,  user:'Fernanda Gomes',action:'Adicionou 28 fotos georreferenciadas',               time:'Há 10h',    ts:'04:22', type:'photo',   project:'Levantamento Ambiental' },
  { id:9,  user:'João Silva',    action:'Iniciou gravação de trilha — Encosta Sul',           time:'Ontem',     ts:'Ontem', type:'track',   project:'Projeto Cobre' },
  { id:10, user:'Maria Costa',   action:'Concluiu formulário de coleta de solos (14 pontos)', time:'Ontem',     ts:'Ontem', type:'form',    project:'Mapeamento Geológico' },
  { id:11, user:'Ana Ferreira',  action:'Validou georreferência do GeoPDF "Planta Mina"',    time:'Ontem',     ts:'Ontem', type:'validate',project:'Projeto Cobre' },
  { id:12, user:'Lucia Rocha',   action:'Gerou relatório PDF do projeto Cobre',              time:'2 dias',    ts:'2 dias',type:'export',  project:'Projeto Cobre' },
];

const TYPE_CONFIG = {
  sync:     { icon:'fas fa-sync-alt',        bg:'rgba(47,163,124,0.12)',  color:'#2FA37C',  label:'Sync'     },
  map:      { icon:'fas fa-file-pdf',        bg:'rgba(201,75,75,0.1)',    color:'#C94B4B',  label:'Mapa'     },
  point:    { icon:'fas fa-map-pin',         bg:'rgba(22,63,89,0.12)',    color:'#163F59',  label:'Waypoint' },
  track:    { icon:'fas fa-route',           bg:'rgba(229,138,43,0.12)', color:'#E58A2B',  label:'Trilha'   },
  share:    { icon:'fas fa-share-alt',       bg:'rgba(31,107,92,0.12)',  color:'#1F6B5C',  label:'Share'    },
  offline:  { icon:'fas fa-download',        bg:'rgba(22,63,89,0.12)',    color:'#163F59',  label:'Offline'  },
  export:   { icon:'fas fa-file-export',     bg:'rgba(47,163,124,0.12)', color:'#2FA37C',  label:'Export'   },
  photo:    { icon:'fas fa-camera',          bg:'rgba(31,107,92,0.12)',  color:'#1F6B5C',  label:'Foto'     },
  form:     { icon:'fas fa-clipboard-list',  bg:'rgba(229,138,43,0.12)', color:'#E58A2B',  label:'Form'     },
  validate: { icon:'fas fa-check-circle',    bg:'rgba(47,163,124,0.12)', color:'#2FA37C',  label:'Validação'},
};

const PLAN_COLORS = { Corporativo:'badge-dark', Profissional:'badge-blue', Explorador:'badge-gray' };
const VIS_COLORS  = { privado:'badge-gray', equipe:'badge-blue', público:'badge-green' };

/* ============================================================
   STATE
   ============================================================ */

let currentTab      = 'overview';
let usersSort       = { field:'name', dir:'asc' };
let mapsSort        = { field:'name', dir:'asc' };
let chartsRendered  = { activity:false, dist:false, storage:false };
let storageChart    = null;
let activityChart   = null;
let distributionChart = null;
let liveUsers       = 47;
let liveMapCount    = 312;
let liveInterval    = null;

/* ============================================================
   TAB SYSTEM
   ============================================================ */

function showAdminTab(tab, btn) {
  // Esconde todos
  ['Overview','Users','Maps','Activity','Storage'].forEach(t => {
    const el = document.getElementById('tab' + t);
    if (el) {
      el.style.display = 'none';
      el.classList.remove('anim-fade-in');
    }
  });

  // Remove active de todos
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const capitalName = tab.charAt(0).toUpperCase() + tab.slice(1);
  const target = document.getElementById('tab' + capitalName);
  if (target) {
    target.style.display = 'block';
    requestAnimationFrame(() => target.classList.add('anim-fade-in'));
  }

  currentTab = tab;

  // Lazy render
  switch (tab) {
    case 'users':    renderUsersTable(); break;
    case 'maps':     renderAdminMaps(); break;
    case 'activity': renderActivityLog(); break;
    case 'storage':  setTimeout(renderStorageTab, 100); break;
  }
}

/* ============================================================
   OVERVIEW — charts + live stats
   ============================================================ */

function initOverview() {
  renderRecentSyncs();
  setTimeout(() => {
    initActivityChart();
    initDistributionChart();
    drawGlobalMap();
  }, 120);
  startLiveCounters();
}

function startLiveCounters() {
  if (liveInterval) return;
  liveInterval = setInterval(() => {
    // Simula variações suaves nos contadores
    const deltaUsers = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
    liveUsers = Math.max(40, Math.min(60, liveUsers + deltaUsers));

    const el = document.getElementById('kpiActiveUsers');
    if (el) el.textContent = liveUsers;
  }, 5000);
}

function initActivityChart() {
  if (chartsRendered.activity) return;
  const canvas = document.getElementById('adminActivityChart');
  if (!canvas) return;

  const labels  = Array.from({length:15}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (14 - i));
    return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
  });

  activityChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Trilhas gravadas',
          data: [12,18,8,25,15,22,30,19,27,35,24,18,28,32,24],
          borderColor: '#E58A2B',
          backgroundColor: 'rgba(229,138,43,0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.42,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#E58A2B',
        },
        {
          label: 'Waypoints criados',
          data: [45,62,30,80,55,74,95,60,82,105,75,58,88,96,82],
          borderColor: '#2FA37C',
          backgroundColor: 'rgba(47,163,124,0.07)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.42,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#2FA37C',
        },
        {
          label: 'Sincronizações',
          data: [8,14,5,18,9,16,22,12,19,28,17,11,21,25,16],
          borderColor: '#163F59',
          backgroundColor: 'rgba(22,63,89,0.05)',
          borderWidth: 2,
          fill: false,
          tension: 0.42,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#163F59',
          borderDash: [6,3],
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: {
          position: 'top',
          labels: { font:{size:11}, usePointStyle:true, padding:16 }
        },
        tooltip: {
          backgroundColor: '#0F2D3A',
          padding: 12,
          cornerRadius: 10,
          titleFont: { size:12, weight:'bold' },
          bodyFont: { size:11 },
        }
      },
      scales: {
        x: {
          grid: { display:false },
          ticks: { color:'#A7B0B7', font:{size:9}, maxTicksLimit:8 },
          border: { display:false },
        },
        y: {
          grid: { color:'rgba(167,176,183,0.1)', drawTicks:false },
          ticks: { color:'#A7B0B7', font:{size:10}, padding:8 },
          border: { display:false },
        }
      }
    }
  });

  chartsRendered.activity = true;
}

function initDistributionChart() {
  if (chartsRendered.dist) return;
  const canvas = document.getElementById('distChart');
  if (!canvas) return;

  distributionChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Trilhas','Waypoints','Mapas','Fotos','Formulários'],
      datasets: [{
        data: [1847, 24391, 312, 8924, 643],
        backgroundColor: ['#E58A2B','#2FA37C','#163F59','#1F6B5C','#A7B0B7'],
        borderWidth: 0,
        hoverOffset: 10,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font:{size:10}, padding:14, usePointStyle:true }
        },
        tooltip: {
          backgroundColor: '#0F2D3A',
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString('pt-BR')}`
          }
        }
      },
      cutout: '64%',
    }
  });

  chartsRendered.dist = true;
}

function drawGlobalMap() {
  const canvas = document.getElementById('globalMapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth  || canvas.width;
  const H = canvas.offsetHeight || canvas.height;
  canvas.width  = W;
  canvas.height = H;

  // Background gradient
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#163F59');
  g.addColorStop(0.6, '#1A5449');
  g.addColorStop(1, '#1F6B5C');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.8;
  for (let x = 0; x < W; x += 28) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Contour lines (simulated topography)
  ctx.strokeStyle = 'rgba(47,163,124,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const cy = H * (0.3 + i * 0.12);
    ctx.moveTo(0, cy + Math.sin(0) * 15);
    for (let x = 0; x < W; x += 5) {
      ctx.lineTo(x, cy + Math.sin(x * 0.025 + i) * 12 + Math.cos(x * 0.01) * 8);
    }
    ctx.stroke();
  }

  // User dots (simulated positions)
  const dots = [
    {x:0.18, y:0.38, active:true,  size:7},
    {x:0.30, y:0.55, active:true,  size:6},
    {x:0.42, y:0.32, active:true,  size:7},
    {x:0.52, y:0.62, active:true,  size:6},
    {x:0.61, y:0.28, active:true,  size:7},
    {x:0.68, y:0.52, active:true,  size:8},
    {x:0.77, y:0.40, active:false, size:5},
    {x:0.22, y:0.70, active:false, size:5},
    {x:0.85, y:0.65, active:true,  size:6},
  ];

  dots.forEach(d => {
    const x = d.x * W, y = d.y * H;

    if (d.active) {
      // Halo
      ctx.beginPath(); ctx.arc(x, y, d.size + 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(47,163,124,0.15)'; ctx.fill();
      // Ring
      ctx.beginPath(); ctx.arc(x, y, d.size + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(47,163,124,0.3)'; ctx.fill();
    }

    // Dot
    ctx.beginPath(); ctx.arc(x, y, d.size, 0, Math.PI * 2);
    ctx.fillStyle = d.active ? 'rgba(47,163,124,0.95)' : 'rgba(167,176,183,0.6)';
    ctx.fill();

    // White center
    if (d.active) {
      ctx.beginPath(); ctx.arc(x, y, d.size * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
    }
  });

  // Track paths (dashed)
  const activeDots = dots.filter(d => d.active);
  ctx.strokeStyle = 'rgba(229,138,43,0.55)';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 3]);

  // Path 1
  ctx.beginPath();
  ctx.moveTo(activeDots[0].x * W, activeDots[0].y * H);
  ctx.lineTo(activeDots[1].x * W, activeDots[1].y * H);
  ctx.lineTo(activeDots[3].x * W, activeDots[3].y * H);
  ctx.stroke();

  // Path 2
  ctx.beginPath();
  ctx.moveTo(activeDots[2].x * W, activeDots[2].y * H);
  ctx.lineTo(activeDots[4].x * W, activeDots[4].y * H);
  ctx.lineTo(activeDots[5].x * W, activeDots[5].y * H);
  ctx.stroke();

  ctx.setLineDash([]);
}

/* ============================================================
   RECENT SYNCS
   ============================================================ */

function renderRecentSyncs() {
  const container = document.getElementById('recentSyncsList');
  if (!container) return;

  container.innerHTML = SYNC_ACTIVITY.slice(0, 6).map(a => {
    const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.sync;
    return `
      <div class="recent-sync-item">
        <div class="recent-sync-icon" style="background:${cfg.bg};">
          <i class="${cfg.icon}" style="color:${cfg.color};font-size:13px;"></i>
        </div>
        <div class="recent-sync-info">
          <div class="recent-sync-user">${a.user}</div>
          <div class="recent-sync-desc">${a.action}</div>
        </div>
        <span class="recent-sync-time">${a.time}</span>
      </div>`;
  }).join('');
}

/* ============================================================
   USERS TAB
   ============================================================ */

let filteredUsers = [...ADMIN_USERS];

function renderUsersTable(users) {
  const list = users || filteredUsers;
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `
      <tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-gray-mid);">
        <i class="fas fa-search" style="font-size:24px;display:block;margin-bottom:10px;opacity:0.4;"></i>
        Nenhum usuário encontrado
      </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div class="avatar-text" style="width:34px;height:34px;font-size:11px;background:${getUserColor(u.id)};">
            ${u.initials}
          </div>
          <div>
            <div style="font-weight:700;color:var(--color-petroleum);font-size:var(--text-sm);">${u.name}</div>
            <div style="font-size:10px;color:var(--color-gray-mid);">${u.role}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--color-gray-mid);font-size:var(--text-sm);">${u.email}</td>
      <td><span class="badge ${PLAN_COLORS[u.plan]}">${u.plan}</span></td>
      <td style="text-align:center;font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600;">${u.projects}</td>
      <td style="text-align:center;font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600;">${u.maps}</td>
      <td>
        <div style="font-size:var(--text-xs);color:var(--color-gray-mid);font-family:var(--font-mono);">${u.lastSeen}</div>
      </td>
      <td>
        ${u.active
          ? `<span class="badge badge-green"><span class="dot dot-green pulse" style="width:6px;height:6px;margin-right:3px;"></span>Ativo</span>`
          : `<span class="badge badge-gray"><span class="dot dot-gray" style="width:6px;height:6px;margin-right:3px;"></span>Inativo</span>`}
      </td>
      <td>
        <div style="display:flex;gap:4px;justify-content:flex-end;">
          <button class="btn btn-ghost btn-icon-sm" title="Editar usuário" onclick="editUser(${u.id})">
            <i class="fas fa-edit" style="font-size:11px;color:var(--color-gray-mid);"></i>
          </button>
          <button class="btn btn-ghost btn-icon-sm" title="Ver atividade" onclick="viewUserActivity(${u.id})">
            <i class="fas fa-chart-line" style="font-size:11px;color:var(--color-gray-mid);"></i>
          </button>
          <button class="btn btn-ghost btn-icon-sm" title="Remover usuário" onclick="confirmRemoveUser(${u.id})">
            <i class="fas fa-trash" style="font-size:11px;color:var(--color-error);"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function getUserColor(id) {
  const palette = ['linear-gradient(135deg,#163F59,#1F6B5C)','linear-gradient(135deg,#1F6B5C,#2FA37C)','linear-gradient(135deg,#E58A2B,#C94B4B)','linear-gradient(135deg,#2FA37C,#163F59)','linear-gradient(135deg,#C94B4B,#E58A2B)','linear-gradient(135deg,#163F59,#0F2D3A)','linear-gradient(135deg,#A7B0B7,#49545C)','linear-gradient(135deg,#1F6B5C,#163F59)'];
  return palette[(id - 1) % palette.length];
}

function filterUsers(query) {
  const q = (query || document.getElementById('userSearch')?.value || '').toLowerCase();
  const planFilter = document.getElementById('planFilter')?.value || '';
  const statusFilter = document.getElementById('statusFilter')?.value || '';

  filteredUsers = ADMIN_USERS.filter(u => {
    const matchQ  = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
    const matchP  = !planFilter   || u.plan === planFilter;
    const matchS  = !statusFilter || (statusFilter === 'ativo' ? u.active : !u.active);
    return matchQ && matchP && matchS;
  });

  renderUsersTable();
}

function sortUsers(field) {
  if (usersSort.field === field) {
    usersSort.dir = usersSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    usersSort = { field, dir:'asc' };
  }

  filteredUsers.sort((a, b) => {
    let va = a[field], vb = b[field];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    return usersSort.dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  renderUsersTable();
  updateSortHeaders('users');
}

function updateSortHeaders(table) {
  const sort = table === 'users' ? usersSort : mapsSort;
  document.querySelectorAll(`#tab${table.charAt(0).toUpperCase()+table.slice(1)} .th-sort`).forEach(th => {
    th.classList.remove('asc','desc');
    const icon = th.querySelector('i');
    if (th.dataset.field === sort.field) {
      th.classList.add(sort.dir);
      if (icon) icon.className = `fas fa-sort-${sort.dir === 'asc' ? 'up' : 'down'}`;
    } else {
      if (icon) icon.className = 'fas fa-sort';
    }
  });
}

function editUser(id) {
  const u = ADMIN_USERS.find(x => x.id === id);
  if (!u) return;
  showToast('info', 'Editar usuário', `Abrindo editor de "${u.name}"…`);
}

function viewUserActivity(id) {
  const u = ADMIN_USERS.find(x => x.id === id);
  if (!u) return;
  showToast('info', 'Atividade', `Carregando log de "${u.name}"…`);
  setTimeout(() => showAdminTab('activity', document.querySelectorAll('.admin-tab')[3]), 400);
}

function confirmRemoveUser(id) {
  const u = ADMIN_USERS.find(x => x.id === id);
  if (!u) return;
  showConfirmDialog(
    `Remover "${u.name}"?`,
    'Esta ação é irreversível. Todos os dados do usuário serão arquivados.',
    'danger',
    () => {
      showToast('success', 'Usuário removido', `"${u.name}" foi removido da plataforma.`);
    }
  );
}

/* ============================================================
   MAPS TAB
   ============================================================ */

let filteredMaps = [...ADMIN_MAPS];

function renderAdminMaps(maps) {
  const list = maps || filteredMaps;
  const tbody = document.getElementById('adminMapsBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-gray-mid);">Nenhum mapa encontrado</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(m => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div style="width:34px;height:34px;background:var(--gradient-map);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="${getMapTypeIcon(m.type)}" style="font-size:13px;color:rgba(255,255,255,0.9);"></i>
          </div>
          <span style="font-weight:600;font-size:var(--text-sm);color:var(--color-petroleum);">${m.name}</span>
        </div>
      </td>
      <td style="font-size:var(--text-sm);color:var(--color-gray-dark);">${m.user}</td>
      <td><span class="badge badge-gray">${m.type}</span></td>
      <td><span class="text-mono" style="font-size:11px;">${m.size}</span></td>
      <td style="text-align:center;">
        ${m.georef
          ? `<span class="badge badge-green"><i class="fas fa-check" style="font-size:9px;"></i> Sim</span>`
          : `<span class="badge badge-red"><i class="fas fa-times" style="font-size:9px;"></i> Não</span>`}
      </td>
      <td style="color:var(--color-gray-mid);font-size:var(--text-xs);font-family:var(--font-mono);">${m.date}</td>
      <td><span class="badge ${VIS_COLORS[m.visibility]}">${m.visibility}</span></td>
      <td>
        <div style="display:flex;gap:4px;justify-content:flex-end;">
          <button class="btn btn-ghost btn-icon-sm" title="Detalhes" onclick="showMapDetail(${m.id})">
            <i class="fas fa-eye" style="font-size:11px;color:var(--color-gray-mid);"></i>
          </button>
          <button class="btn btn-ghost btn-icon-sm" title="Compartilhar" onclick="showToast('info','Compartilhar','Abrindo opções...')">
            <i class="fas fa-share-alt" style="font-size:11px;color:var(--color-gray-mid);"></i>
          </button>
          <button class="btn btn-ghost btn-icon-sm" title="Remover mapa" onclick="confirmRemoveMap(${m.id})">
            <i class="fas fa-trash" style="font-size:11px;color:var(--color-error);"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function getMapTypeIcon(type) {
  const icons = { GeoPDF:'fas fa-file-pdf', GeoTIFF:'fas fa-mountain', KML:'fab fa-google', GeoJSON:'fas fa-code', Shapefile:'fas fa-vector-square', GPX:'fas fa-route' };
  return icons[type] || 'fas fa-map';
}

function filterMaps() {
  const q = (document.getElementById('mapSearch')?.value || '').toLowerCase();
  const typeF = document.getElementById('mapTypeFilter')?.value || '';
  const georefF = document.getElementById('mapGeorefFilter')?.value || '';

  filteredMaps = ADMIN_MAPS.filter(m => {
    const matchQ = !q || m.name.toLowerCase().includes(q) || m.user.toLowerCase().includes(q);
    const matchT = !typeF || m.type === typeF;
    const matchG = !georefF || (georefF === 'sim' ? m.georef : !m.georef);
    return matchQ && matchT && matchG;
  });

  renderAdminMaps();
}

function showMapDetail(id) {
  const m = ADMIN_MAPS.find(x => x.id === id);
  if (!m) return;
  showToast('info', m.name, `${m.type} · ${m.size} · ${m.georef ? 'Georreferenciado' : 'Sem georreferência'}`);
}

function confirmRemoveMap(id) {
  const m = ADMIN_MAPS.find(x => x.id === id);
  if (!m) return;
  showConfirmDialog(
    `Remover "${m.name}"?`,
    'O mapa e seus dados associados serão excluídos permanentemente.',
    'danger',
    () => showToast('success', 'Mapa removido', `"${m.name}" foi removido com sucesso.`)
  );
}

/* ============================================================
   ACTIVITY LOG
   ============================================================ */

function renderActivityLog() {
  const container = document.getElementById('activityLog');
  if (!container) return;

  container.innerHTML = SYNC_ACTIVITY.map(a => {
    const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.sync;
    return `
      <div class="activity-log-item">
        <div class="al-dot" style="background:${cfg.bg};">
          <i class="${cfg.icon}" style="color:${cfg.color};"></i>
        </div>
        <div class="al-content">
          <div class="al-text">
            <strong>${a.user}</strong> ${a.action}
            ${a.project !== '—' ? `<span style="font-size:10px;background:rgba(15,45,58,0.06);color:var(--color-gray-mid);padding:1px 6px;border-radius:4px;margin-left:4px;">${a.project}</span>` : ''}
          </div>
          <div class="al-time">${a.time}</div>
        </div>
        <span class="al-badge" style="background:${cfg.bg};color:${cfg.color};">${cfg.label}</span>
      </div>`;
  }).join('');
}

function filterActivity() {
  const q = (document.getElementById('activitySearch')?.value || '').toLowerCase();
  const typeF = document.getElementById('activityTypeFilter')?.value || '';
  const filtered = SYNC_ACTIVITY.filter(a => {
    const matchQ = !q || a.user.toLowerCase().includes(q) || a.action.toLowerCase().includes(q);
    const matchT = !typeF || a.type === typeF;
    return matchQ && matchT;
  });

  const container = document.getElementById('activityLog');
  if (!container) return;

  if (!filtered.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-gray-mid);">Nenhuma atividade encontrada</div>`;
    return;
  }

  container.innerHTML = filtered.map(a => {
    const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.sync;
    return `
      <div class="activity-log-item">
        <div class="al-dot" style="background:${cfg.bg};">
          <i class="${cfg.icon}" style="color:${cfg.color};"></i>
        </div>
        <div class="al-content">
          <div class="al-text"><strong>${a.user}</strong> ${a.action}</div>
          <div class="al-time">${a.time}</div>
        </div>
        <span class="al-badge" style="background:${cfg.bg};color:${cfg.color};">${cfg.label}</span>
      </div>`;
  }).join('');
}

function exportActivityLog() {
  showToast('info', 'Exportar log', 'Gerando arquivo CSV com todas as atividades…');
  setTimeout(() => showToast('success', 'Log exportado!', 'Arquivo activity_log_2025-03-08.csv gerado.'), 1800);
}

/* ============================================================
   STORAGE TAB
   ============================================================ */

function renderStorageTab() {
  renderStorageChart();
  renderStorageBars();
}

function renderStorageChart() {
  if (chartsRendered.storage) return;
  const canvas = document.getElementById('storageChart');
  if (!canvas) return;

  storageChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ADMIN_USERS.map(u => u.name.split(' ')[0]),
      datasets: [{
        label: 'GB usados',
        data: ADMIN_USERS.map(u => u.storage),
        backgroundColor: ADMIN_USERS.map((u, i) => {
          const colors = ['#2FA37C','#163F59','#A7B0B7','#E58A2B','#1F6B5C','#C94B4B','#A7B0B7','#163F59'];
          return colors[i % colors.length];
        }),
        borderRadius: 8,
        borderSkipped: false,
        hoverBackgroundColor: '#0F2D3A',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display:false },
        tooltip: {
          backgroundColor: '#0F2D3A',
          cornerRadius: 10,
          padding: 12,
          callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)} GB` }
        }
      },
      scales: {
        x: {
          grid: { display:false },
          border: { display:false },
          ticks: { color:'#A7B0B7', font:{size:11} }
        },
        y: {
          grid: { color:'rgba(167,176,183,0.1)', drawTicks:false },
          border: { display:false },
          ticks: { color:'#A7B0B7', font:{size:10}, padding:8, callback: v => v + ' GB' }
        }
      }
    }
  });

  chartsRendered.storage = true;
}

function renderStorageBars() {
  const container = document.getElementById('storageTypeBars');
  if (!container) return;

  const types = [
    { name:'Mapas PDF/TIFF',      gb:198, color:'#2FA37C' },
    { name:'Fotos de campo',      gb:42,  color:'#163F59' },
    { name:'Trilhas GPX',         gb:5,   color:'#E58A2B' },
    { name:'Dados GeoJSON',       gb:3,   color:'#1F6B5C' },
  ];
  const total = 248;

  container.innerHTML = types.map(t => `
    <div class="storage-item">
      <div class="storage-item-header">
        <span class="storage-item-name" style="color:${t.color};">${t.name}</span>
        <span class="storage-item-size">${t.gb} GB</span>
      </div>
      <div class="progress-wrap">
        <div class="progress-bar" style="width:${(t.gb/total*100).toFixed(1)}%;background:${t.color};"></div>
      </div>
    </div>
  `).join('');
}

/* ============================================================
   CONFIRM DIALOG
   ============================================================ */

function showConfirmDialog(title, message, type, onConfirm) {
  let modal = document.getElementById('confirmDialogModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirmDialogModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:420px;">
        <div class="modal-header">
          <h4 id="confirmTitle"></h4>
          <button class="btn btn-ghost btn-icon" onclick="closeModal('confirmDialogModal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <p id="confirmMessage" style="color:var(--color-gray-mid);font-size:var(--text-sm);line-height:1.6;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('confirmDialogModal')">Cancelar</button>
          <button class="btn btn-danger" id="confirmOkBtn"><i class="fas fa-trash"></i> Confirmar exclusão</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  document.getElementById('confirmTitle').innerHTML = `<i class="fas fa-exclamation-triangle" style="color:var(--color-error);margin-right:8px;font-size:16px;"></i>${title}`;
  document.getElementById('confirmMessage').textContent = message;

  const okBtn = document.getElementById('confirmOkBtn');
  okBtn.onclick = () => {
    closeModal('confirmDialogModal');
    if (typeof onConfirm === 'function') onConfirm();
  };

  showModal('confirmDialogModal');
}

/* ============================================================
   MODAL SYSTEM
   ============================================================ */

function showModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'flex';
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'none';
}

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => {
      if (m.style.display !== 'none') closeModal(m.id);
    });
  }
});

/* ============================================================
   SIDEBAR TOGGLE (já declarado em app.js — guard)
   ============================================================ */

if (typeof window.toggleSidebar !== 'function') {
  window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    if (overlay) overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
  };
}

/* ============================================================
   TOAST SYSTEM (já declarado em app.js — guard)
   ============================================================ */

if (typeof window.showToast !== 'function') {
  window.showToast = function(type, title, message, duration) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success:'fas fa-check-circle', error:'fas fa-times-circle', warning:'fas fa-exclamation-triangle', info:'fas fa-info-circle' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon"><i class="${icons[type] || icons.info}"></i></div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-msg">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.closest('.toast').remove()"><i class="fas fa-times"></i></button>`;

    container.appendChild(toast);

    const ms = duration || (type === 'error' ? 5000 : 3500);
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, ms);
  };
}

/* ============================================================
   INVITES / QUICK ACTIONS
   ============================================================ */

function inviteUser() {
  let modal = document.getElementById('inviteUserModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'inviteUserModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:480px;">
        <div class="modal-header">
          <h4><i class="fas fa-user-plus" style="color:var(--color-accent-green);margin-right:8px;"></i> Convidar Usuário</h4>
          <button class="btn btn-ghost btn-icon" onclick="closeModal('inviteUserModal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:var(--space-4);">
            <label class="form-label">E-mail</label>
            <input type="email" class="form-input" placeholder="usuario@empresa.com" id="inviteEmail">
          </div>
          <div class="form-group" style="margin-bottom:var(--space-4);">
            <label class="form-label">Plano</label>
            <select class="form-select" id="invitePlan">
              <option>Explorador</option>
              <option>Profissional</option>
              <option>Corporativo</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Mensagem personalizada (opcional)</label>
            <textarea class="form-input" rows="3" placeholder="Olá, você foi convidado para a plataforma Afaia Maps..." style="resize:none;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('inviteUserModal')">Cancelar</button>
          <button class="btn btn-primary" onclick="sendInvite()"><i class="fas fa-paper-plane"></i> Enviar convite</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  showModal('inviteUserModal');
}

function sendInvite() {
  const email = document.getElementById('inviteEmail')?.value?.trim();
  if (!email || !email.includes('@')) {
    showToast('warning', 'E-mail inválido', 'Digite um e-mail válido para continuar.');
    return;
  }
  closeModal('inviteUserModal');
  showToast('success', 'Convite enviado!', `Convite enviado para ${email}`);
}

/* ============================================================
   UPLOAD MAP SHORTCUT
   ============================================================ */

function goToMapUpload() {
  window.location.href = 'maps.html';
}

/* ============================================================
   EXPORT LOG
   ============================================================ */

function exportLog() {
  showToast('info', 'Exportar log', 'Preparando arquivo…');
  setTimeout(() => showToast('success', 'Log exportado!', 'activity_log_2025-03-08.csv gerado com sucesso.'), 1800);
}

/* ============================================================
   LIVE INDICATOR — pisca o badge "online"
   ============================================================ */

function animateLiveBadge() {
  const badge = document.getElementById('liveBadge');
  if (!badge) return;
  setInterval(() => {
    badge.style.opacity = '0.5';
    setTimeout(() => badge.style.opacity = '1', 600);
  }, 3000);
}

/* ============================================================
   INIT
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initOverview();
  animateLiveBadge();
});
