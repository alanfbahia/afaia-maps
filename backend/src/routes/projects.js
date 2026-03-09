/* =========================================================
   Afaia Maps — projects.js (API REAL)
   Projetos, Exportação, Compartilhamento e Relatórios
   ========================================================= */

'use strict';

/* ── Mock temporário apenas para módulos ainda sem backend ───────────── */
const EXPORT_HISTORY = [
  { id:1, project:'Projeto Exemplo', format:'GPX',       date:'08/03 14:30', size:'2.4 MB', status:'success' },
  { id:2, project:'Projeto Exemplo', format:'GeoJSON',   date:'07/03 09:15', size:'8.7 MB', status:'success' },
  { id:3, project:'Projeto Exemplo', format:'KML',       date:'06/03 16:45', size:'1.2 MB', status:'success' },
  { id:4, project:'Projeto Exemplo', format:'Shapefile', date:'05/03 11:00', size:'4.1 MB', status:'success' },
  { id:5, project:'Projeto Exemplo', format:'CSV',       date:'03/03 08:30', size:'245 KB', status:'error'   },
];

const ACTIVE_SHARES = [
  { id:1, project:'Projeto Exemplo', link:'afaia.app/s/demo001', permission:'leitura', expires:'15/04/2026', views:12 },
  { id:2, project:'Projeto Exemplo', link:'afaia.app/s/demo002', permission:'edição',  expires:'30/06/2026', views:5  },
];

const SHARED_WITH_ME = [
  { id:1, project:'Projeto Compartilhado', owner:'Lucia Rocha',  permission:'leitura', since:'01/02/2026' },
  { id:2, project:'Zonas de Preservação',  owner:'Carlos Mendes', permission:'edição', since:'15/01/2026' },
];

/* ── Estado ─────────────────────────────────────────────── */
let currentView = 'grid';
let currentProjects = [];
let allProjects = [];
let selectedFormat = 'gpx';
let projectStatsCache = {};

/* ── Helpers ────────────────────────────────────────────── */
function showToastSafe(type, title, message = '') {
  if (window.showToast) {
    window.showToast(type, title, message);
  } else {
    console.log(`[${type}] ${title} ${message}`);
  }
}

function normalizeArrayResponse(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.rows)) return res.rows;
  return [];
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function formatDateTimeRelative(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '—';

  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return 'Agora mesmo';
  if (mins < 60) return `Há ${mins} min`;
  if (hours < 24) return `Há ${hours} h`;
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;

  return formatDate(str);
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function mapProjectType(type) {
  if (!type) return 'Outro';
  const t = String(type).toLowerCase();

  if (t.includes('miner')) return 'Mineração';
  if (t.includes('geo')) return 'Geológico';
  if (t.includes('ambient')) return 'Ambiental';
  if (t.includes('topo')) return 'Topográfico';
  if (t.includes('emerg')) return 'Emergência';
  if (t.includes('exped')) return 'Expedição';
  return capitalize(type);
}

function mapProjectStatus(status) {
  if (!status) return 'ativo';

  const s = String(status).toLowerCase();

  if (['active', 'ativo', 'in_progress', 'ongoing'].includes(s)) return 'ativo';
  if (['completed', 'concluido', 'concluído', 'done'].includes(s)) return 'concluído';
  if (['paused', 'pause', 'pausa'].includes(s)) return 'pausa';

  return s;
}

function typeColor(type) {
  const t = mapProjectType(type);
  const colors = {
    'Mineração': '#E58A2B',
    'Geológico': '#163F59',
    'Ambiental': '#1F6B5C',
    'Topográfico': '#163F59',
    'Emergência': '#C94B4B',
    'Expedição': '#2FA37C',
    'Outro': '#A7B0B7'
  };
  return colors[t] || '#A7B0B7';
}

function typeIcon(type) {
  const t = mapProjectType(type);
  const icons = {
    'Mineração': 'fas fa-gem',
    'Geológico': 'fas fa-mountain',
    'Ambiental': 'fas fa-leaf',
    'Topográfico': 'fas fa-drafting-compass',
    'Emergência': 'fas fa-exclamation-triangle',
    'Expedição': 'fas fa-compass',
    'Outro': 'fas fa-folder'
  };
  return icons[t] || 'fas fa-folder';
}

function statusColor(status) {
  const s = mapProjectStatus(status);
  const colors = {
    ativo: 'badge-green',
    concluído: 'badge-dark',
    pausa: 'badge-orange'
  };
  return colors[s] || 'badge-gray';
}

function statusLabel(status) {
  const s = mapProjectStatus(status);
  const labels = {
    ativo: 'Ativo',
    concluído: 'Concluído',
    pausa: 'Em pausa'
  };
  return labels[s] || capitalize(s);
}

function getProjectProgress(p, stats = null) {
  if (p.progress != null && !isNaN(Number(p.progress))) {
    return Math.max(0, Math.min(100, Number(p.progress)));
  }

  if (stats) {
    const activity =
      Number(stats.total_tracks || 0) +
      Number(stats.total_waypoints || 0) +
      Number(stats.total_maps || 0) +
      Number(stats.total_photos || 0);

    if (activity >= 200) return 100;
    if (activity >= 120) return 85;
    if (activity >= 60) return 65;
    if (activity >= 20) return 40;
    if (activity > 0) return 20;
  }

  return 0;
}

function buildMembers(project) {
  if (Array.isArray(project.members) && project.members.length) {
    return project.members.map(m => {
      const name = m.name || m.email || 'Membro';
      const parts = name.trim().split(/\s+/).slice(0, 2);
      const initials = parts.map(x => x[0]?.toUpperCase() || '').join('') || 'MB';
      return {
        initials,
        color: '#163F59'
      };
    });
  }

  return [{ initials: 'EU', color: '#163F59' }];
}

function projectFromApi(project, stats = null) {
  return {
    id: project.id,
    name: project.name || 'Projeto sem nome',
    description: project.description || 'Sem descrição',
    type: mapProjectType(project.type || project.icon || 'Outro'),
    status: mapProjectStatus(project.status),
    progress: getProjectProgress(project, stats),
    maps: Number(project.map_count || stats?.total_maps || 0),
    tracks: Number(project.track_count || stats?.total_tracks || 0),
    waypoints: Number(project.waypoint_count || stats?.total_waypoints || 0),
    photos: Number(stats?.total_photos || 0),
    members: buildMembers(project),
    startDate: project.start_date || project.created_at || null,
    endDate: project.end_date || null,
    updated: formatDateTimeRelative(project.updated_at || project.created_at),
    updatedAt: project.updated_at || project.created_at || null,
    size: formatBytes(stats?.total_storage_bytes || 0),
    color: project.color || typeColor(project.type),
    raw: project,
    stats: stats || null
  };
}

/* ── API ────────────────────────────────────────────────── */
async function fetchProjects() {
  const res = await ProjectsAPI.list();
  const data = normalizeArrayResponse(res);

  const statsList = await Promise.all(
    data.map(async (p) => {
      try {
        const stats = await ProjectsAPI.stats(p.id);
        projectStatsCache[p.id] = stats || {};
        return projectFromApi(p, stats || {});
      } catch {
        return projectFromApi(p, {});
      }
    })
  );

  allProjects = statsList;
  currentProjects = [...allProjects];
}

async function fetchProjectDetail(id) {
  const [project, stats] = await Promise.all([
    ProjectsAPI.get(id),
    ProjectsAPI.stats(id).catch(() => ({}))
  ]);

  projectStatsCache[id] = stats || {};
  return projectFromApi(project, stats || {});
}

/* ── Tabs ──────────────────────────────────────────────── */
function showTab(tab, btn) {
  ['projects','export','sharing','reports'].forEach(t => {
    const el = document.getElementById('tab' + capitalize(t));
    if (el) el.style.display = 'none';
  });

  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const target = document.getElementById('tab' + capitalize(tab));
  if (target) target.style.display = 'block';

  if (tab === 'export') renderExportHistory();
  if (tab === 'sharing') renderSharing();
  if (tab === 'reports') setTimeout(renderReportCharts, 120);
}

window.showTab = showTab;

/* ── Project View ──────────────────────────────────────── */
function setView(mode) {
  currentView = mode;
  const grid = document.getElementById('projectsGrid');
  const list = document.getElementById('projectsList');

  if (grid) grid.style.display = mode === 'grid' ? 'grid' : 'none';
  if (list) list.style.display = mode === 'list' ? 'block' : 'none';

  document.getElementById('viewGrid')?.classList.toggle('active', mode === 'grid');
  document.getElementById('viewList')?.classList.toggle('active', mode === 'list');

  if (mode === 'list') renderProjectsList();
}

window.setView = setView;

function filterProjects() {
  const q = (document.getElementById('projectSearch')?.value || '').toLowerCase();
  const status = document.getElementById('projectStatusFilter')?.value || '';

  currentProjects = allProjects.filter(p => {
    const matchQ =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q);

    const matchS = !status || p.status === status;
    return matchQ && matchS;
  });

  renderProjectsGrid();
  if (currentView === 'list') renderProjectsList();
}

window.filterProjects = filterProjects;

function renderProjectsGrid() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  if (!currentProjects.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--color-gray-mid);">
        <i class="fas fa-folder-open" style="font-size:40px;margin-bottom:16px;display:block;opacity:0.4;"></i>
        <div style="font-size:var(--text-base);font-weight:600;margin-bottom:6px;">Nenhum projeto encontrado</div>
        <div style="font-size:var(--text-sm);">Tente ajustar os filtros ou crie um novo projeto.</div>
      </div>`;
    return;
  }

  grid.innerHTML = currentProjects.map(p => {
    const tc = typeColor(p.type);
    const ti = typeIcon(p.type);
    const sc = statusColor(p.status);
    const sl = statusLabel(p.status);
    const progressColor = p.progress >= 80 ? '#2FA37C' : p.progress >= 40 ? '#E58A2B' : '#C94B4B';

    const membersHTML = p.members.map((m, i) =>
      `<div class="member-avatar" style="background:${m.color};z-index:${p.members.length - i};">${escapeHtml(m.initials)}</div>`
    ).join('');

    return `
      <div class="project-card" onclick="openProjectDetail('${p.id}')">
        <div class="project-card-header">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div class="project-type-badge" style="background:${tc}18;color:${tc};">
              <i class="${ti}"></i> ${escapeHtml(p.type)}
            </div>
            <span class="badge ${sc}">${sl}</span>
          </div>
          <div class="project-title">${escapeHtml(p.name)}</div>
          <div class="project-desc">${escapeHtml(p.description.substring(0, 100))}${p.description.length > 100 ? '…' : ''}</div>
        </div>
        <div class="project-card-body">
          <div class="project-stats">
            <div class="project-stat"><i class="fas fa-layer-group"></i> <strong>${p.maps}</strong> mapas</div>
            <div class="project-stat"><i class="fas fa-route"></i> <strong>${p.tracks}</strong> trilhas</div>
            <div class="project-stat"><i class="fas fa-map-pin"></i> <strong>${p.waypoints}</strong> pts</div>
            <div class="project-stat"><i class="fas fa-camera"></i> <strong>${p.photos}</strong> fotos</div>
          </div>
          <div class="progress-mini" style="margin-top:10px;">
            <div class="progress-mini-bar" style="width:${p.progress}%;background:${progressColor};"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--color-gray-mid);margin-top:4px;">
            <span style="font-family:var(--font-mono);">${p.progress}% concluído</span>
            <span>${escapeHtml(p.size)}</span>
          </div>
        </div>
        <div class="project-card-footer">
          <div class="proj-members">${membersHTML}</div>
          <span style="font-size:10px;color:var(--color-gray-mid);margin-left:auto;">${escapeHtml(p.updated)}</span>
          <div style="display:flex;gap:4px;margin-left:8px;">
            <button class="btn btn-ghost btn-icon-sm" onclick="event.stopPropagation();exportProject('${p.id}')" title="Exportar">
              <i class="fas fa-file-export" style="font-size:10px;color:var(--color-gray-mid);"></i>
            </button>
            <button class="btn btn-ghost btn-icon-sm" onclick="event.stopPropagation();shareProject('${p.id}')" title="Compartilhar">
              <i class="fas fa-share-alt" style="font-size:10px;color:var(--color-gray-mid);"></i>
            </button>
            <button class="btn btn-ghost btn-icon-sm" onclick="event.stopPropagation();deleteProject('${p.id}')" title="Excluir">
              <i class="fas fa-trash" style="font-size:10px;color:var(--color-gray-mid);"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderProjectsList() {
  const tbody = document.getElementById('projectsListBody');
  if (!tbody) return;

  tbody.innerHTML = currentProjects.map(p => {
    const progressColor = p.progress >= 80 ? '#2FA37C' : p.progress >= 40 ? '#E58A2B' : '#C94B4B';

    return `
      <tr onclick="openProjectDetail('${p.id}')" style="cursor:pointer;">
        <td>
          <div style="font-weight:600;color:var(--color-petroleum);font-size:var(--text-sm);">${escapeHtml(p.name)}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);">${escapeHtml(p.type)} · ${escapeHtml(p.updated)}</div>
        </td>
        <td><span class="badge ${statusColor(p.status)}">${statusLabel(p.status)}</span></td>
        <td style="text-align:center;font-family:var(--font-mono);font-size:var(--text-sm);">${p.maps}</td>
        <td style="text-align:center;font-family:var(--font-mono);font-size:var(--text-sm);">${p.tracks}</td>
        <td>
          <div style="display:flex;">
            ${p.members.slice(0,3).map(m=>`<div style="width:22px;height:22px;border-radius:50%;background:${m.color};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:white;margin-left:-5px;">${escapeHtml(m.initials)}</div>`).join('')}
          </div>
        </td>
        <td style="color:var(--color-gray-mid);font-size:var(--text-xs);">${escapeHtml(p.updated)}</td>
        <td style="min-width:120px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:4px;background:var(--color-fog);border-radius:99px;overflow:hidden;">
              <div style="width:${p.progress}%;height:100%;background:${progressColor};border-radius:99px;"></div>
            </div>
            <span style="font-size:10px;font-family:var(--font-mono);color:var(--color-gray-mid);white-space:nowrap;">${p.progress}%</span>
          </div>
        </td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-ghost btn-icon-sm" onclick="event.stopPropagation();exportProject('${p.id}')"><i class="fas fa-file-export" style="font-size:10px;color:var(--color-gray-mid);"></i></button>
            <button class="btn btn-ghost btn-icon-sm" onclick="event.stopPropagation();shareProject('${p.id}')"><i class="fas fa-share-alt" style="font-size:10px;color:var(--color-gray-mid);"></i></button>
            <button class="btn btn-ghost btn-icon-sm" onclick="event.stopPropagation();deleteProject('${p.id}')"><i class="fas fa-trash" style="font-size:10px;color:var(--color-gray-mid);"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ── Project Detail Modal ──────────────────────────────── */
async function openProjectDetail(id) {
  try {
    const p = await fetchProjectDetail(id);

    const progressColor = p.progress >= 80 ? '#2FA37C' : p.progress >= 40 ? '#E58A2B' : '#C94B4B';

    const header = document.getElementById('projDetailHeader');
    const body = document.getElementById('projDetailBody');

    if (!header || !body) return;

    header.innerHTML = `
      <h4 style="display:flex;align-items:center;gap:8px;">
        <div style="width:32px;height:32px;background:${p.color}20;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;">
          <i class="fas fa-folder-open" style="color:${p.color};font-size:14px;"></i>
        </div>
        ${escapeHtml(p.name)}
      </h4>
      <button class="btn btn-ghost btn-icon" onclick="closeModal('projectDetailModal')"><i class="fas fa-times"></i></button>`;

    body.innerHTML = `
      <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap;">
        <span class="badge ${statusColor(p.status)}">${statusLabel(p.status)}</span>
        <span class="badge badge-gray">${escapeHtml(p.type)}</span>
        <span class="badge badge-gray"><i class="fas fa-hdd" style="margin-right:3px;"></i>${escapeHtml(p.size)}</span>
      </div>
      <p style="color:var(--color-gray-mid);font-size:var(--text-sm);margin-bottom:var(--space-4);line-height:1.6;">${escapeHtml(p.description)}</p>

      <div class="grid grid-4 gap-3 mb-5">
        <div style="text-align:center;padding:var(--space-3);background:var(--color-fog);border-radius:var(--radius-lg);">
          <div style="font-size:20px;font-weight:800;color:var(--color-petroleum);font-family:var(--font-mono);">${p.maps}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);margin-top:3px;"><i class="fas fa-layer-group" style="color:var(--color-teal-mid);"></i> Mapas</div>
        </div>
        <div style="text-align:center;padding:var(--space-3);background:var(--color-fog);border-radius:var(--radius-lg);">
          <div style="font-size:20px;font-weight:800;color:var(--color-petroleum);font-family:var(--font-mono);">${p.tracks}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);margin-top:3px;"><i class="fas fa-route" style="color:#E58A2B;"></i> Trilhas</div>
        </div>
        <div style="text-align:center;padding:var(--space-3);background:var(--color-fog);border-radius:var(--radius-lg);">
          <div style="font-size:20px;font-weight:800;color:var(--color-petroleum);font-family:var(--font-mono);">${p.waypoints}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);margin-top:3px;"><i class="fas fa-map-pin" style="color:var(--color-teal-mid);"></i> Waypoints</div>
        </div>
        <div style="text-align:center;padding:var(--space-3);background:var(--color-fog);border-radius:var(--radius-lg);">
          <div style="font-size:20px;font-weight:800;color:var(--color-petroleum);font-family:var(--font-mono);">${p.photos}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);margin-top:3px;"><i class="fas fa-camera" style="color:#163F59;"></i> Fotos</div>
        </div>
      </div>

      <div style="margin-bottom:var(--space-4);">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:var(--text-sm);font-weight:600;color:var(--color-petroleum);">Progresso do projeto</span>
          <span style="font-size:var(--text-sm);font-family:var(--font-mono);color:${progressColor};">${p.progress}%</span>
        </div>
        <div style="height:8px;background:var(--color-fog);border-radius:99px;overflow:hidden;">
          <div style="width:${p.progress}%;height:100%;background:${progressColor};border-radius:99px;transition:width 0.6s;"></div>
        </div>
      </div>

      <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--space-4);">
        <div>
          <div style="font-size:var(--text-xs);color:var(--color-gray-mid);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Período</div>
          <div style="font-size:var(--text-sm);font-family:var(--font-mono);color:var(--color-petroleum);">${formatDate(p.startDate)} → ${formatDate(p.endDate)}</div>
        </div>
        <div>
          <div style="font-size:var(--text-xs);color:var(--color-gray-mid);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Equipe</div>
          <div style="display:flex;gap:0;align-items:center;">
            ${p.members.map((m, i) => `<div style="width:28px;height:28px;border-radius:50%;background:${m.color};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:white;margin-left:${i > 0 ? '-6px' : '0'};">${escapeHtml(m.initials)}</div>`).join('')}
            <span style="font-size:var(--text-xs);color:var(--color-gray-mid);margin-left:8px;">${p.members.length} colaboradores</span>
          </div>
        </div>
      </div>`;

    showModal('projectDetailModal');
  } catch (err) {
    showToastSafe('error', 'Erro ao abrir projeto', err.message || 'Falha ao carregar o detalhe');
  }
}

window.openProjectDetail = openProjectDetail;

/* ── Export ─────────────────────────────────────────────── */
function selectFormat(btn, fmt) {
  const parent = btn.closest('.format-grid') || btn.parentElement;
  parent.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedFormat = fmt;
}

window.selectFormat = selectFormat;

function runExport() {
  const project = document.getElementById('exportProject')?.value;
  if (!project) {
    showToastSafe('warning', 'Selecione um projeto', 'Escolha o projeto antes de exportar.');
    return;
  }
  showToastSafe('info', 'Exportando…', `Gerando arquivo ${selectedFormat.toUpperCase()}...`);
  setTimeout(() => {
    showToastSafe('success', 'Exportação concluída!', `Arquivo ${selectedFormat.toUpperCase()} gerado com sucesso.`);
  }, 2200);
}

window.runExport = runExport;

function exportProject(id) {
  const p = allProjects.find(x => String(x.id) === String(id));
  if (!p) return;

  showTab('export', document.querySelectorAll('.admin-tab')[1]);

  setTimeout(() => {
    const sel = document.getElementById('exportProject');
    if (sel) sel.value = p.name;
    showToastSafe('info', 'Projeto selecionado', `"${p.name}" pré-selecionado para exportação.`);
  }, 100);
}

window.exportProject = exportProject;

function renderExportHistory() {
  const container = document.getElementById('exportHistory');
  if (!container) return;

  const fmtColors = { GPX:'#E58A2B', GeoJSON:'#2FA37C', KML:'#163F59', Shapefile:'#1F6B5C', CSV:'#A7B0B7', PDF:'#C94B4B' };
  const fmtIcons  = { GPX:'fas fa-route', GeoJSON:'fas fa-code', KML:'fab fa-google', Shapefile:'fas fa-vector-square', CSV:'fas fa-table', PDF:'fas fa-file-pdf' };

  container.innerHTML = EXPORT_HISTORY.map(e => {
    const c = fmtColors[e.format] || '#A7B0B7';
    const i = fmtIcons[e.format] || 'fas fa-file';
    return `
      <div class="export-hist-item">
        <div style="width:36px;height:36px;background:${c}18;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="${i}" style="font-size:14px;color:${c};"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-petroleum);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(e.project)}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);font-family:var(--font-mono);">${escapeHtml(e.date)} · ${escapeHtml(e.size)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
          <span class="badge" style="font-size:9px;background:${c}18;color:${c};">${escapeHtml(e.format)}</span>
          <span class="${e.status==='success'?'badge-green':'badge-orange'} badge" style="font-size:9px;">${e.status==='success'?'✓ OK':'⚠ Erro'}</span>
        </div>
      </div>`;
  }).join('');
}

/* ── Sharing ────────────────────────────────────────────── */
function shareProject(id) {
  const p = allProjects.find(x => String(x.id) === String(id));
  if (!p) return;
  showToastSafe('info', 'Compartilhar', `Abrindo opções para "${p.name}"…`);
  setTimeout(() => showTab('sharing', document.querySelectorAll('.admin-tab')[2]), 300);
}

window.shareProject = shareProject;

function showShareModal() {
  showToastSafe('info', 'Novo link de compartilhamento', 'Funcionalidade disponível em breve.');
}

window.showShareModal = showShareModal;

function renderSharing() {
  const active = document.getElementById('activeShares');
  if (active) {
    const permColors = { leitura:'badge-gray', edição:'badge-blue' };
    active.innerHTML = ACTIVE_SHARES.map(s => `
      <div class="share-item">
        <div style="width:36px;height:36px;background:rgba(47,163,124,0.1);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-link" style="font-size:14px;color:#2FA37C;"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-petroleum);">${escapeHtml(s.project)}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);font-family:var(--font-mono);">${escapeHtml(s.link)}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);margin-top:2px;">Expira: ${escapeHtml(s.expires)} · ${s.views} visualizações</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span class="badge ${permColors[s.permission]}">${escapeHtml(s.permission)}</span>
          <button class="btn btn-ghost btn-xs" onclick="navigator.clipboard&&navigator.clipboard.writeText('${s.link}');showToast('success','Copiado!','Link copiado para a área de transferência.')">
            <i class="fas fa-copy" style="font-size:10px;"></i> Copiar
          </button>
        </div>
      </div>`).join('');
  }

  const shared = document.getElementById('sharedWithMe');
  if (shared) {
    shared.innerHTML = SHARED_WITH_ME.map(s => `
      <div class="share-item">
        <div style="width:36px;height:36px;background:rgba(22,63,89,0.1);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-folder" style="font-size:14px;color:#163F59;"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-petroleum);">${escapeHtml(s.project)}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);">por ${escapeHtml(s.owner)} · desde ${escapeHtml(s.since)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span class="badge badge-blue">${escapeHtml(s.permission)}</span>
          <button class="btn btn-ghost btn-xs" onclick="window.location.href='app.html'">
            <i class="fas fa-external-link-alt" style="font-size:10px;"></i> Abrir
          </button>
        </div>
      </div>`).join('');
  }
}

/* ── Reports / Charts ───────────────────────────────────── */
let reportChartsInit = false;

function renderReportCharts() {
  const projects = allProjects.length ? allProjects : [];

  const actCanvas = document.getElementById('projectActivityChart');
  if (actCanvas && typeof Chart !== 'undefined') {
    new Chart(actCanvas, {
      type: 'bar',
      data: {
        labels: projects.map(p => (p.name.length > 18 ? p.name.substring(0, 18) + '…' : p.name)),
        datasets: [
          { label:'Trilhas', data: projects.map(p => p.tracks), backgroundColor:'#E58A2B', borderRadius:4 },
          { label:'Waypoints', data: projects.map(p => p.waypoints), backgroundColor:'#2FA37C', borderRadius:4 },
          { label:'Fotos', data: projects.map(p => p.photos), backgroundColor:'#163F59', borderRadius:4 }
        ]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        plugins: {
          legend:{ position:'top', labels:{ font:{size:10}, usePointStyle:true } },
          tooltip:{ backgroundColor:'#0F2D3A' }
        },
        scales: {
          x: { stacked:true, grid:{display:false}, ticks:{color:'#A7B0B7',font:{size:9}}, border:{display:false} },
          y: { stacked:true, grid:{color:'rgba(167,176,183,0.1)'}, ticks:{color:'#A7B0B7',font:{size:10}}, border:{display:false} }
        }
      }
    });
  }

  const dtCanvas = document.getElementById('dataTypeChart');
  if (dtCanvas && typeof Chart !== 'undefined') {
    const totals = projects.reduce((a, p) => {
      a.maps += p.maps;
      a.tracks += p.tracks;
      a.waypoints += p.waypoints;
      a.photos += p.photos;
      return a;
    }, {maps:0,tracks:0,waypoints:0,photos:0});

    new Chart(dtCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Mapas','Trilhas','Waypoints','Fotos'],
        datasets: [{
          data:[totals.maps,totals.tracks,totals.waypoints,totals.photos],
          backgroundColor:['#163F59','#E58A2B','#2FA37C','#1F6B5C'],
          borderWidth:0,
          hoverOffset:8
        }]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        plugins: { legend:{ position:'bottom', labels:{font:{size:10},padding:14,usePointStyle:true} } },
        cutout:'62%'
      }
    });
  }

  renderProgressTable();
}

function renderProgressTable() {
  const tbody = document.getElementById('projectProgressBody');
  if (!tbody) return;

  tbody.innerHTML = allProjects.map(p => {
    const progressColor = p.progress >= 80 ? '#2FA37C' : p.progress >= 40 ? '#E58A2B' : '#C94B4B';
    return `
      <tr>
        <td style="font-weight:600;font-size:var(--text-sm);color:var(--color-petroleum);">${escapeHtml(p.name)}</td>
        <td style="color:var(--color-gray-mid);font-size:var(--text-xs);font-family:var(--font-mono);">${formatDate(p.startDate)}</td>
        <td style="color:var(--color-gray-mid);font-size:var(--text-xs);font-family:var(--font-mono);">${formatDate(p.endDate)}</td>
        <td style="text-align:center;font-family:var(--font-mono);">${p.maps + p.tracks + p.waypoints + p.photos}</td>
        <td style="text-align:center;font-family:var(--font-mono);">${p.stats?.total_distance_m ? (Number(p.stats.total_distance_m) / 1000).toFixed(1) : '0.0'} km</td>
        <td style="min-width:130px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:6px;background:var(--color-fog);border-radius:99px;overflow:hidden;">
              <div style="width:${p.progress}%;height:100%;background:${progressColor};border-radius:99px;"></div>
            </div>
            <span style="font-size:11px;font-family:var(--font-mono);color:${progressColor};min-width:28px;">${p.progress}%</span>
          </div>
        </td>
        <td><span class="badge ${statusColor(p.status)}">${statusLabel(p.status)}</span></td>
      </tr>`;
  }).join('');
}

/* ── CRUD real ──────────────────────────────────────────── */
async function createProject() {
  const name = document.getElementById('newProjName')?.value?.trim();
  const description = document.getElementById('newProjDesc')?.value?.trim() || '';
  const color = document.getElementById('newProjColor')?.value || '#2563eb';
  const icon = document.getElementById('newProjIcon')?.value || 'map';
  const status = document.getElementById('newProjStatus')?.value || 'active';

  if (!name) {
    showToastSafe('warning','Nome obrigatório','Digite um nome para o projeto.');
    return;
  }

  try {
    await ProjectsAPI.create({ name, description, color, icon, status });
    closeModal('newProjectModal');
    showToastSafe('success','Projeto criado!',`"${name}" foi adicionado à sua biblioteca.`);
    resetNewProjectForm();
    await reloadProjects();
  } catch (err) {
    showToastSafe('error', 'Erro ao criar projeto', err.message || 'Falha ao criar');
  }
}

window.createProject = createProject;

async function deleteProject(id) {
  const p = allProjects.find(x => String(x.id) === String(id));
  const ok = window.confirm(`Deseja excluir o projeto "${p?.name || id}"?`);
  if (!ok) return;

  try {
    await ProjectsAPI.delete(id);
    showToastSafe('success', 'Projeto excluído', `"${p?.name || 'Projeto'}" removido com sucesso.`);
    await reloadProjects();
  } catch (err) {
    showToastSafe('error', 'Erro ao excluir projeto', err.message || 'Falha ao excluir');
  }
}

window.deleteProject = deleteProject;

/* ── Modals ─────────────────────────────────────────────── */
function showNewProjectModal() { showModal('newProjectModal'); }
function showExportModal()     { showModal('exportModal'); }

window.showNewProjectModal = showNewProjectModal;
window.showExportModal = showExportModal;

function showModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.style.display='flex';
    requestAnimationFrame(() => {
      m.style.opacity='1';
      const inner = m.querySelector('.modal');
      if (inner) inner.style.transform='translateY(0)';
    });
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display='none';
}

function closeModalOutside(e, id) {
  if (e.target.id === id) closeModal(id);
}

window.showModal = showModal;
window.closeModal = closeModal;
window.closeModalOutside = closeModalOutside;

function resetNewProjectForm() {
  const ids = ['newProjName', 'newProjDesc'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const colorEl = document.getElementById('newProjColor');
  if (colorEl) colorEl.value = '#2563eb';

  const iconEl = document.getElementById('newProjIcon');
  if (iconEl) iconEl.value = 'map';

  const statusEl = document.getElementById('newProjStatus');
  if (statusEl) statusEl.value = 'active';
}

/* ── Reload ─────────────────────────────────────────────── */
async function reloadProjects() {
  await fetchProjects();
  filterProjects();
  renderProjectsGrid();
  if (currentView === 'list') renderProjectsList();
  reportChartsInit = false;
}

/* ── Init ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await reloadProjects();

    const today = new Date().toISOString().split('T')[0];
    const startEl = document.getElementById('newProjStart');
    if (startEl) startEl.value = today;
  } catch (err) {
    showToastSafe('error', 'Erro ao carregar projetos', err.message || 'Falha ao consultar a API');
  }
});
