/* =========================================================
   Afaia Maps — projects.js
   Projetos, Exportação, Compartilhamento e Relatórios
   ========================================================= */

'use strict';

/* ── Mock data ──────────────────────────────────────────── */
const PROJECTS = [
  {
    id: 1,
    name: 'Projeto Cobre — Serra Norte',
    description: 'Mapeamento geológico detalhado da região de Serra Norte para prospecção de jazidas de cobre. Inclui levantamento topográfico e análise de solo.',
    type: 'Mineração',
    status: 'ativo',
    progress: 72,
    maps: 8, tracks: 24, waypoints: 312, photos: 187,
    members: [
      { initials:'JS', color:'#163F59' },
      { initials:'MC', color:'#1F6B5C' },
      { initials:'CA', color:'#E58A2B' },
    ],
    startDate: '2025-01-15',
    endDate: '2025-06-30',
    updated: 'Há 2 horas',
    size: '1.2 GB',
    color: '#E58A2B',
  },
  {
    id: 2,
    name: 'Mapeamento Geológico 2024',
    description: 'Mapeamento sistemático da área de concessão para identificar estruturas geológicas e ocorrências minerais.',
    type: 'Geológico',
    status: 'concluído',
    progress: 100,
    maps: 15, tracks: 42, waypoints: 890, photos: 436,
    members: [
      { initials:'JS', color:'#163F59' },
      { initials:'AF', color:'#2FA37C' },
    ],
    startDate: '2024-03-01',
    endDate: '2024-12-31',
    updated: 'Há 3 dias',
    size: '3.4 GB',
    color: '#2FA37C',
  },
  {
    id: 3,
    name: 'Levantamento Ambiental',
    description: 'Estudo de impacto ambiental e identificação de áreas sensíveis. Monitoramento de flora, fauna e recursos hídricos.',
    type: 'Ambiental',
    status: 'ativo',
    progress: 45,
    maps: 6, tracks: 18, waypoints: 204, photos: 312,
    members: [
      { initials:'MC', color:'#1F6B5C' },
      { initials:'LR', color:'#C94B4B' },
      { initials:'PE', color:'#163F59' },
      { initials:'+2', color:'#A7B0B7' },
    ],
    startDate: '2025-02-01',
    endDate: '2025-08-31',
    updated: 'Ontem',
    size: '820 MB',
    color: '#1F6B5C',
  },
  {
    id: 4,
    name: 'Rota de Emergência — Vale do Rio',
    description: 'Mapeamento de rotas de acesso e pontos de evacuação para o plano de emergência da operação.',
    type: 'Emergência',
    status: 'ativo',
    progress: 88,
    maps: 3, tracks: 7, waypoints: 56, photos: 42,
    members: [
      { initials:'CA', color:'#E58A2B' },
      { initials:'JS', color:'#163F59' },
    ],
    startDate: '2025-01-10',
    endDate: '2025-03-31',
    updated: 'Há 5 horas',
    size: '245 MB',
    color: '#C94B4B',
  },
  {
    id: 5,
    name: 'Topografia Serra da Canastra',
    description: 'Levantamento topográfico de alta precisão para projeto de infraestrutura. Integração com drones e GPS RTK.',
    type: 'Topográfico',
    status: 'pausa',
    progress: 30,
    maps: 4, tracks: 9, waypoints: 123, photos: 76,
    members: [
      { initials:'RL', color:'#2FA37C' },
    ],
    startDate: '2024-11-01',
    endDate: '2025-05-30',
    updated: 'Há 1 semana',
    size: '560 MB',
    color: '#163F59',
  },
  {
    id: 6,
    name: 'Expedição Amazônia — Bloco A',
    description: 'Exploração e mapeamento de nova área de concessão na região amazônica. Coordenação com equipes remotas.',
    type: 'Expedição',
    status: 'ativo',
    progress: 18,
    maps: 2, tracks: 5, waypoints: 38, photos: 24,
    members: [
      { initials:'JS', color:'#163F59' },
      { initials:'AF', color:'#2FA37C' },
      { initials:'LR', color:'#C94B4B' },
    ],
    startDate: '2025-03-01',
    endDate: '2025-12-31',
    updated: 'Há 12 minutos',
    size: '180 MB',
    color: '#2FA37C',
  },
];

const EXPORT_HISTORY = [
  { id:1, project:'Projeto Cobre — Serra Norte', format:'GPX',      date:'08/03 14:30', size:'2.4 MB', status:'success' },
  { id:2, project:'Mapeamento Geológico 2024',   format:'GeoJSON',  date:'07/03 09:15', size:'8.7 MB', status:'success' },
  { id:3, project:'Levantamento Ambiental',      format:'KML',      date:'06/03 16:45', size:'1.2 MB', status:'success' },
  { id:4, project:'Rota de Emergência',          format:'Shapefile',date:'05/03 11:00', size:'4.1 MB', status:'success' },
  { id:5, project:'Expedição Amazônia',          format:'CSV',      date:'03/03 08:30', size:'245 KB', status:'error'   },
];

const ACTIVE_SHARES = [
  { id:1, project:'Projeto Cobre — Serra Norte', link:'afaia.app/s/kX4mP9', permission:'leitura', expires:'15/04/2025', views:12 },
  { id:2, project:'Levantamento Ambiental',      link:'afaia.app/s/jR7nL2', permission:'edição',  expires:'30/06/2025', views:5  },
  { id:3, project:'Rota de Emergência',          link:'afaia.app/s/wQ1oZ8', permission:'leitura', expires:'31/03/2025', views:28 },
];

const SHARED_WITH_ME = [
  { id:1, project:'Planta Mina Cobre',     owner:'Lucia Rocha',  permission:'leitura', since:'01/02/2025' },
  { id:2, project:'Zonas de Preservação', owner:'Carlos Mendes', permission:'edição',  since:'15/01/2025' },
];

const REPORT_PROJECTS = [
  { name:'Projeto Cobre — Serra Norte', start:'15/01/2025', end:'30/06/2025', records:524, km:87.4, progress:72, status:'ativo'    },
  { name:'Mapeamento Geológico 2024',   start:'01/03/2024', end:'31/12/2024', records:1368,km:94.2, progress:100,status:'concluído' },
  { name:'Levantamento Ambiental',      start:'01/02/2025', end:'31/08/2025', records:516, km:23.1, progress:45, status:'ativo'    },
  { name:'Rota de Emergência',          start:'10/01/2025', end:'31/03/2025', records:98,  km:12.8, progress:88, status:'ativo'    },
  { name:'Topografia Serra Canastra',   start:'01/11/2024', end:'30/05/2025', records:199, km:16.5, progress:30, status:'pausa'    },
];

/* ── State ──────────────────────────────────────────────── */
let currentView = 'grid';
let currentProjects = [...PROJECTS];
let selectedFormat = 'gpx';

/* ── TAB SWITCHING ──────────────────────────────────────── */
function showTab(tab, btn) {
  ['projects','export','sharing','reports'].forEach(t => {
    const el = document.getElementById('tab' + capitalize(t));
    if (el) el.style.display = 'none';
  });
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const target = document.getElementById('tab' + capitalize(tab));
  if (target) target.style.display = 'block';

  if (tab === 'export')   renderExportHistory();
  if (tab === 'sharing')  renderSharing();
  if (tab === 'reports')  setTimeout(renderReportCharts, 120);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ── PROJECT VIEW ───────────────────────────────────────── */
function setView(mode) {
  currentView = mode;
  document.getElementById('projectsGrid').style.display = mode === 'grid' ? 'grid' : 'none';
  document.getElementById('projectsList').style.display = mode === 'list' ? 'block' : 'none';
  document.getElementById('viewGrid').classList.toggle('active', mode === 'grid');
  document.getElementById('viewList').classList.toggle('active', mode === 'list');
  if (mode === 'list') renderProjectsList();
}

function filterProjects() {
  const q = (document.getElementById('projectSearch')?.value || '').toLowerCase();
  const status = document.getElementById('projectStatusFilter')?.value || '';
  currentProjects = PROJECTS.filter(p => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.type.toLowerCase().includes(q);
    const matchS = !status || p.status === status;
    return matchQ && matchS;
  });
  renderProjectsGrid();
  if (currentView === 'list') renderProjectsList();
}

function renderProjectsGrid() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  const typeColors = { 'Mineração':'#E58A2B','Geológico':'#163F59','Ambiental':'#1F6B5C','Topográfico':'#163F59','Emergência':'#C94B4B','Expedição':'#2FA37C','Outro':'#A7B0B7' };
  const typeIcons  = { 'Mineração':'fas fa-gem','Geológico':'fas fa-mountain','Ambiental':'fas fa-leaf','Topográfico':'fas fa-drafting-compass','Emergência':'fas fa-exclamation-triangle','Expedição':'fas fa-compass','Outro':'fas fa-folder' };
  const statusColors = { ativo:'badge-green', concluído:'badge-dark', pausa:'badge-orange' };
  const statusLabels = { ativo:'Ativo', concluído:'Concluído', pausa:'Em pausa' };

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
    const tc = typeColors[p.type] || '#A7B0B7';
    const ti = typeIcons[p.type] || 'fas fa-folder';
    const sc = statusColors[p.status] || 'badge-gray';
    const sl = statusLabels[p.status] || p.status;
    const progressColor = p.progress >= 80 ? '#2FA37C' : p.progress >= 40 ? '#E58A2B' : '#C94B4B';
    const membersHTML = p.members.map((m, i) =>
      `<div class="member-avatar" style="background:${m.color};z-index:${p.members.length - i};">${m.initials}</div>`
    ).join('');

    return `
      <div class="project-card" onclick="openProjectDetail(${p.id})">
        <div class="project-card-header">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div class="project-type-badge" style="background:${tc}18;color:${tc};">
              <i class="${ti}"></i> ${p.type}
            </div>
            <span class="badge ${sc}">${sl}</span>
          </div>
          <div class="project-title">${p.name}</div>
          <div class="project-desc">${p.description.substring(0,100)}${p.description.length>100?'…':''}</div>
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
            <span>${p.size}</span>
          </div>
        </div>
        <div class="project-card-footer">
          <div class="proj-members">${membersHTML}</div>
          <span style="font-size:10px;color:var(--color-gray-mid);margin-left:auto;">${p.updated}</span>
          <div style="display:flex;gap:4px;margin-left:8px;">
            <button class="btn btn-ghost btn-icon-sm" onclick="event.stopPropagation();exportProject(${p.id})" title="Exportar">
              <i class="fas fa-file-export" style="font-size:10px;color:var(--color-gray-mid);"></i>
            </button>
            <button class="btn btn-ghost btn-icon-sm" onclick="event.stopPropagation();shareProject(${p.id})" title="Compartilhar">
              <i class="fas fa-share-alt" style="font-size:10px;color:var(--color-gray-mid);"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderProjectsList() {
  const tbody = document.getElementById('projectsListBody');
  if (!tbody) return;
  const statusColors = { ativo:'badge-green', concluído:'badge-dark', pausa:'badge-orange' };
  const statusLabels = { ativo:'Ativo', concluído:'Concluído', pausa:'Em pausa' };
  tbody.innerHTML = currentProjects.map(p => {
    const progressColor = p.progress >= 80 ? '#2FA37C' : p.progress >= 40 ? '#E58A2B' : '#C94B4B';
    return `
      <tr onclick="openProjectDetail(${p.id})" style="cursor:pointer;">
        <td>
          <div style="font-weight:600;color:var(--color-petroleum);font-size:var(--text-sm);">${p.name}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);">${p.type} · ${p.updated}</div>
        </td>
        <td><span class="badge ${statusColors[p.status]}">${statusLabels[p.status]}</span></td>
        <td style="text-align:center;font-family:var(--font-mono);font-size:var(--text-sm);">${p.maps}</td>
        <td style="text-align:center;font-family:var(--font-mono);font-size:var(--text-sm);">${p.tracks}</td>
        <td>
          <div style="display:flex;">
            ${p.members.slice(0,3).map(m=>`<div style="width:22px;height:22px;border-radius:50%;background:${m.color};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:white;margin-left:-5px;">${m.initials}</div>`).join('')}
          </div>
        </td>
        <td style="color:var(--color-gray-mid);font-size:var(--text-xs);">${p.updated}</td>
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
            <button class="btn btn-ghost btn-icon-sm" onclick="event.stopPropagation();exportProject(${p.id})"><i class="fas fa-file-export" style="font-size:10px;color:var(--color-gray-mid);"></i></button>
            <button class="btn btn-ghost btn-icon-sm" onclick="event.stopPropagation();shareProject(${p.id})"><i class="fas fa-share-alt" style="font-size:10px;color:var(--color-gray-mid);"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ── PROJECT DETAIL MODAL ───────────────────────────────── */
function openProjectDetail(id) {
  const p = PROJECTS.find(x => x.id === id);
  if (!p) return;

  const progressColor = p.progress >= 80 ? '#2FA37C' : p.progress >= 40 ? '#E58A2B' : '#C94B4B';
  const statusColors = { ativo:'badge-green', concluído:'badge-dark', pausa:'badge-orange' };
  const statusLabels = { ativo:'Ativo', concluído:'Concluído', pausa:'Em pausa' };

  document.getElementById('projDetailHeader').innerHTML = `
    <h4 style="display:flex;align-items:center;gap:8px;">
      <div style="width:32px;height:32px;background:${p.color}20;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;">
        <i class="fas fa-folder-open" style="color:${p.color};font-size:14px;"></i>
      </div>
      ${p.name}
    </h4>
    <button class="btn btn-ghost btn-icon" onclick="closeModal('projectDetailModal')"><i class="fas fa-times"></i></button>`;

  document.getElementById('projDetailBody').innerHTML = `
    <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap;">
      <span class="badge ${statusColors[p.status]}">${statusLabels[p.status]}</span>
      <span class="badge badge-gray">${p.type}</span>
      <span class="badge badge-gray"><i class="fas fa-hdd" style="margin-right:3px;"></i>${p.size}</span>
    </div>
    <p style="color:var(--color-gray-mid);font-size:var(--text-sm);margin-bottom:var(--space-4);line-height:1.6;">${p.description}</p>

    <!-- Stats row -->
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

    <!-- Progress -->
    <div style="margin-bottom:var(--space-4);">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:var(--text-sm);font-weight:600;color:var(--color-petroleum);">Progresso do projeto</span>
        <span style="font-size:var(--text-sm);font-family:var(--font-mono);color:${progressColor};">${p.progress}%</span>
      </div>
      <div style="height:8px;background:var(--color-fog);border-radius:99px;overflow:hidden;">
        <div style="width:${p.progress}%;height:100%;background:${progressColor};border-radius:99px;transition:width 0.6s;"></div>
      </div>
    </div>

    <!-- Dates & Members -->
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--space-4);">
      <div>
        <div style="font-size:var(--text-xs);color:var(--color-gray-mid);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Período</div>
        <div style="font-size:var(--text-sm);font-family:var(--font-mono);color:var(--color-petroleum);">${formatDate(p.startDate)} → ${formatDate(p.endDate)}</div>
      </div>
      <div>
        <div style="font-size:var(--text-xs);color:var(--color-gray-mid);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Equipe</div>
        <div style="display:flex;gap:0;align-items:center;">
          ${p.members.map((m, i) => `<div style="width:28px;height:28px;border-radius:50%;background:${m.color};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:white;margin-left:${i>0?'-6px':'0'};">${m.initials}</div>`).join('')}
          <span style="font-size:var(--text-xs);color:var(--color-gray-mid);margin-left:8px;">${p.members.length} colaboradores</span>
        </div>
      </div>
    </div>`;

  showModal('projectDetailModal');
}

/* ── EXPORT ─────────────────────────────────────────────── */
function selectFormat(btn, fmt) {
  const parent = btn.closest('.format-grid') || btn.parentElement;
  parent.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedFormat = fmt;
}

function runExport() {
  const project = document.getElementById('exportProject')?.value;
  if (!project) {
    showToast('warning', 'Selecione um projeto', 'Escolha o projeto antes de exportar.');
    return;
  }
  showToast('info', 'Exportando…', `Gerando arquivo ${selectedFormat.toUpperCase()}...`);
  setTimeout(() => {
    showToast('success', 'Exportação concluída!', `Arquivo ${selectedFormat.toUpperCase()} gerado com sucesso.`);
  }, 2200);
}

function exportProject(id) {
  const p = PROJECTS.find(x => x.id === id);
  if (!p) return;
  showTab('export', document.querySelectorAll('.admin-tab')[1]);
  setTimeout(() => {
    const sel = document.getElementById('exportProject');
    if (sel) sel.value = p.name;
    showToast('info', 'Projeto selecionado', `"${p.name}" pré-selecionado para exportação.`);
  }, 100);
}

function renderExportHistory() {
  const container = document.getElementById('exportHistory');
  if (!container) return;
  const fmtColors = { GPX:'#E58A2B', GeoJSON:'#2FA37C', KML:'#163F59', Shapefile:'#1F6B5C', CSV:'#A7B0B7', PDF:'#C94B4B' };
  const fmtIcons  = { GPX:'fas fa-route', GeoJSON:'fas fa-code', KML:'fab fa-google', Shapefile:'fas fa-vector-square', CSV:'fas fa-table', PDF:'fas fa-file-pdf' };
  container.innerHTML = EXPORT_HISTORY.map(e => {
    const c = fmtColors[e.format] || '#A7B0B7';
    const i = fmtIcons[e.format]  || 'fas fa-file';
    return `
      <div class="export-hist-item">
        <div style="width:36px;height:36px;background:${c}18;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="${i}" style="font-size:14px;color:${c};"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-petroleum);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.project}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);font-family:var(--font-mono);">${e.date} · ${e.size}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
          <span class="badge" style="font-size:9px;background:${c}18;color:${c};">${e.format}</span>
          <span class="${e.status==='success'?'badge-green':'badge-orange'} badge" style="font-size:9px;">${e.status==='success'?'✓ OK':'⚠ Erro'}</span>
        </div>
      </div>`;
  }).join('');
}

/* ── SHARING ─────────────────────────────────────────────── */
function shareProject(id) {
  const p = PROJECTS.find(x => x.id === id);
  if (!p) return;
  showToast('info', 'Compartilhar', `Abrindo opções para "${p.name}"…`);
  setTimeout(() => showTab('sharing', document.querySelectorAll('.admin-tab')[2]), 300);
}

function showShareModal() {
  showToast('info', 'Novo link de compartilhamento', 'Funcionalidade disponível em breve.');
}

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
          <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-petroleum);">${s.project}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);font-family:var(--font-mono);">${s.link}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);margin-top:2px;">Expira: ${s.expires} · ${s.views} visualizações</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span class="badge ${permColors[s.permission]}">${s.permission}</span>
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
          <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-petroleum);">${s.project}</div>
          <div style="font-size:10px;color:var(--color-gray-mid);">por ${s.owner} · desde ${s.since}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span class="badge badge-blue">${s.permission}</span>
          <button class="btn btn-ghost btn-xs" onclick="window.location.href='app.html'">
            <i class="fas fa-external-link-alt" style="font-size:10px;"></i> Abrir
          </button>
        </div>
      </div>`).join('');
  }
}

/* ── REPORTS / CHARTS ───────────────────────────────────── */
let reportChartsInit = false;

function renderReportCharts() {
  if (reportChartsInit) return;
  reportChartsInit = true;

  // Activity per project (horizontal bar)
  const actCanvas = document.getElementById('projectActivityChart');
  if (actCanvas) {
    new Chart(actCanvas, {
      type: 'bar',
      data: {
        labels: PROJECTS.map(p => p.name.split('—')[0].trim().substring(0,18)+'…'),
        datasets: [
          { label:'Trilhas',    data: PROJECTS.map(p=>p.tracks),   backgroundColor:'#E58A2B', borderRadius:4 },
          { label:'Waypoints',  data: PROJECTS.map(p=>Math.round(p.waypoints/10)), backgroundColor:'#2FA37C', borderRadius:4 },
          { label:'Fotos (÷10)',data: PROJECTS.map(p=>Math.round(p.photos/10)),    backgroundColor:'#163F59', borderRadius:4 },
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: { legend:{ position:'top', labels:{ font:{size:10}, usePointStyle:true } }, tooltip:{backgroundColor:'#0F2D3A'} },
        scales: {
          x: { stacked:true, grid:{display:false}, ticks:{color:'#A7B0B7',font:{size:9}}, border:{display:false} },
          y: { stacked:true, grid:{color:'rgba(167,176,183,0.1)'}, ticks:{color:'#A7B0B7',font:{size:10}}, border:{display:false} }
        }
      }
    });
  }

  // Data type doughnut
  const dtCanvas = document.getElementById('dataTypeChart');
  if (dtCanvas) {
    const totals = PROJECTS.reduce((a, p) => {
      a.maps += p.maps; a.tracks += p.tracks; a.waypoints += p.waypoints; a.photos += p.photos; return a;
    }, {maps:0,tracks:0,waypoints:0,photos:0});
    new Chart(dtCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Mapas','Trilhas','Waypoints','Fotos'],
        datasets: [{ data:[totals.maps,totals.tracks,totals.waypoints,totals.photos], backgroundColor:['#163F59','#E58A2B','#2FA37C','#1F6B5C'], borderWidth:0, hoverOffset:8 }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
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
  const sc = { ativo:'badge-green', concluído:'badge-dark', pausa:'badge-orange' };
  tbody.innerHTML = REPORT_PROJECTS.map(p => {
    const progressColor = p.progress >= 80 ? '#2FA37C' : p.progress >= 40 ? '#E58A2B' : '#C94B4B';
    return `
      <tr>
        <td style="font-weight:600;font-size:var(--text-sm);color:var(--color-petroleum);">${p.name}</td>
        <td style="color:var(--color-gray-mid);font-size:var(--text-xs);font-family:var(--font-mono);">${p.start}</td>
        <td style="color:var(--color-gray-mid);font-size:var(--text-xs);font-family:var(--font-mono);">${p.end}</td>
        <td style="text-align:center;font-family:var(--font-mono);">${p.records}</td>
        <td style="text-align:center;font-family:var(--font-mono);">${p.km} km</td>
        <td style="min-width:130px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:6px;background:var(--color-fog);border-radius:99px;overflow:hidden;">
              <div style="width:${p.progress}%;height:100%;background:${progressColor};border-radius:99px;"></div>
            </div>
            <span style="font-size:11px;font-family:var(--font-mono);color:${progressColor};min-width:28px;">${p.progress}%</span>
          </div>
        </td>
        <td><span class="badge ${sc[p.status]}">${p.status.charAt(0).toUpperCase()+p.status.slice(1)}</span></td>
      </tr>`;
  }).join('');
}

/* ── MODALS ──────────────────────────────────────────────── */
function showNewProjectModal() { showModal('newProjectModal'); }
function showExportModal()     { showModal('exportModal'); }

function createProject() {
  const name = document.getElementById('newProjName')?.value?.trim();
  if (!name) { showToast('warning','Nome obrigatório','Digite um nome para o projeto.'); return; }
  showToast('success','Projeto criado!',`"${name}" foi adicionado à sua biblioteca.`);
  closeModal('newProjectModal');
}

function showModal(id) {
  const m = document.getElementById(id);
  if (m) { m.style.display='flex'; requestAnimationFrame(()=>{ m.style.opacity='1'; const inner=m.querySelector('.modal'); if(inner) inner.style.transform='translateY(0)'; }); }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display='none';
}
function closeModalOutside(e, id) {
  if (e.target.id === id) closeModal(id);
}

/* ── HELPERS ─────────────────────────────────────────────── */
function formatDate(str) {
  if (!str) return '—';
  const [y,m,d] = str.split('-');
  return `${d}/${m}/${y}`;
}

/* ── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderProjectsGrid();
  // Set default date for new project form
  const today = new Date().toISOString().split('T')[0];
  const startEl = document.getElementById('newProjStart');
  if (startEl) startEl.value = today;
});
