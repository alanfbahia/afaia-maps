/* ============================================================
   AFAIA MAPS — Map Viewer JS
   ============================================================ */

(function () {
  'use strict';

  /* ====== CANVAS MAP RENDERER ====== */
  const canvas  = document.getElementById('mapCanvas');
  const ctx     = canvas.getContext('2d');
  const container = document.getElementById('mapContainer');

  let zoom        = 12;
  let mapOffset   = { x: 0, y: 0 };
  let isDragging  = false;
  let dragStart   = { x: 0, y: 0 };
  let currentTool = 'move';
  let isRecording = false;
  let recordTimer = null;
  let recSeconds  = 0;
  let recDistance = 0;
  let gpsFollow   = true;
  let drawPoints  = [];
  let gpsX = 0, gpsY = 0;

  // Waypoints on map
  const waypoints = [
    { x: 0.45, y: 0.42, name: 'Afloramento 01',     cat: 'amostra', icon: '●', color: '#163F59',  desc: 'Amostra coletada. Quartzo com veios.' },
    { x: 0.52, y: 0.55, name: 'Acampamento Base',   cat: 'campo',   icon: '▲', color: '#1F6B5C',  desc: 'Base principal da equipe.' },
    { x: 0.38, y: 0.60, name: 'Risco Deslizamento', cat: 'risco',   icon: '⚠', color: '#E58A2B',  desc: 'Área instável. Evitar.' },
    { x: 0.60, y: 0.38, name: 'Vista Panorâmica',   cat: 'poi',     icon: '◆', color: '#2FA37C',  desc: 'Ponto de interesse.' },
  ];

  // Track path (percentage of canvas)
  const trackPath = [
    [0.30, 0.72], [0.33, 0.68], [0.36, 0.65],
    [0.38, 0.60], [0.42, 0.55], [0.45, 0.50],
    [0.48, 0.45], [0.50, 0.42],
  ];

  // Current recorded points
  let liveTrackPoints = [];

  /* ====== RESIZE ====== */
  function resize() {
    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;
    gpsX = canvas.width  * 0.5;
    gpsY = canvas.height * 0.44;
    draw();
  }

  window.addEventListener('resize', resize);
  resize();

  /* ====== DRAW ====== */
  function draw() {
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // --- BG ---
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1c3d1c');
    grad.addColorStop(0.4, '#243824');
    grad.addColorStop(1, '#1a2e1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(mapOffset.x, mapOffset.y);

    drawGrid(W, H);
    drawTerrain(W, H);
    drawContours(W, H);
    drawTrack(W, H);
    if (isRecording) drawLiveTrack(W, H);
    drawWaypoints(W, H);
    drawDrawnPoints(W, H);

    ctx.restore();

    drawGPSMarker();
    updateCoords();
  }

  /* ====== GRID ====== */
  function drawGrid(W, H) {
    const step = (40 + zoom * 2);
    ctx.strokeStyle = 'rgba(47,163,124,0.07)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  /* ====== TERRAIN ====== */
  function drawTerrain(W, H) {
    // Base terrain patches
    const patches = [
      { color: '#1f3f1f', points: [[0,H*0.4],[W*0.3,H*0.2],[W*0.6,H*0.25],[W,H*0.15],[W,H],[0,H]] },
      { color: '#2a4a2a', points: [[0,H*0.5],[W*0.25,H*0.35],[W*0.5,H*0.4],[W*0.8,H*0.3],[W,H*0.35],[W,H*0.7],[W*0.5,H*0.75],[0,H*0.8]] },
      { color: '#304d30', points: [[W*0.1,H*0.6],[W*0.4,H*0.45],[W*0.7,H*0.5],[W*0.9,H*0.55],[W*0.8,H*0.8],[W*0.3,H*0.85]] },
    ];

    patches.forEach(patch => {
      ctx.beginPath();
      ctx.moveTo(patch.points[0][0], patch.points[0][1]);
      patch.points.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.fillStyle = patch.color;
      ctx.fill();
    });
  }

  /* ====== CONTOUR LINES ====== */
  function drawContours(W, H) {
    const contours = [
      { color: 'rgba(100,160,100,0.45)', width: 1.5, offset: 0 },
      { color: 'rgba(90,150,90,0.35)',   width: 1.2, offset: 15 },
      { color: 'rgba(80,140,80,0.28)',   width: 1.0, offset: 30 },
      { color: 'rgba(70,130,70,0.22)',   width: 0.8, offset: 45 },
      { color: 'rgba(100,160,100,0.55)', width: 2.0, offset: 60, bold: true },
    ];

    contours.forEach(c => {
      ctx.beginPath();
      ctx.strokeStyle = c.color;
      ctx.lineWidth   = c.width;
      ctx.setLineDash(c.bold ? [] : []);

      const y0 = H * 0.35 + c.offset;
      ctx.moveTo(0, y0);
      ctx.bezierCurveTo(W*0.2, y0-40, W*0.4, y0+20, W*0.6, y0-30);
      ctx.bezierCurveTo(W*0.75, y0-50, W*0.88, y0-10, W, y0-20);
      ctx.stroke();

      const y1 = H * 0.50 + c.offset * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, y1);
      ctx.bezierCurveTo(W*0.15, y1-25, W*0.35, y1+30, W*0.55, y1-15);
      ctx.bezierCurveTo(W*0.70, y1-35, W*0.85, y1+10, W, y1-5);
      ctx.stroke();
    });

    ctx.setLineDash([]);
  }

  /* ====== EXISTING TRACK ====== */
  function drawTrack(W, H) {
    if (trackPath.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = '#E58A2B';
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.setLineDash([8, 4]);

    ctx.moveTo(trackPath[0][0] * W, trackPath[0][1] * H);
    trackPath.slice(1).forEach(p => ctx.lineTo(p[0] * W, p[1] * H));
    ctx.stroke();
    ctx.setLineDash([]);

    // Track start/end
    const start = trackPath[0];
    const end   = trackPath[trackPath.length - 1];
    drawCircleMarker(start[0]*W, start[1]*H, 6, '#2FA37C', 'S');
    drawCircleMarker(end[0]*W, end[1]*H, 6, '#E58A2B', 'F');
  }

  function drawCircleMarker(x, y, r, color, label) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = color;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.fillStyle  = 'white';
    ctx.font       = 'bold 8px Inter';
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }

  /* ====== LIVE TRACK ====== */
  function drawLiveTrack(W, H) {
    if (liveTrackPoints.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = '#C94B4B';
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    const first = liveTrackPoints[0];
    ctx.moveTo(first.x, first.y);
    liveTrackPoints.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }

  /* ====== WAYPOINTS ====== */
  function drawWaypoints(W, H) {
    waypoints.forEach((wp, idx) => {
      const x = wp.x * W;
      const y = wp.y * H;

      // Shadow
      ctx.beginPath();
      ctx.arc(x, y + 1, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      // Outer circle
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle   = wp.color;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();

      // Label
      ctx.fillStyle    = 'white';
      ctx.font         = 'bold 9px Inter';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';

      // Label background
      const lbl = wp.name.length > 14 ? wp.name.substring(0, 13) + '…' : wp.name;
      const lw  = ctx.measureText(lbl).width + 8;
      ctx.fillStyle    = 'rgba(15,45,58,0.8)';
      ctx.beginPath();
      ctx.roundRect(x - lw/2, y - 22, lw, 14, 3);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.fillText(lbl, x, y - 10);
    });
  }

  /* ====== DRAWN POINTS (user draw) ====== */
  function drawDrawnPoints(W, H) {
    if (drawPoints.length === 0) return;

    if (currentTool === 'line' || currentTool === 'area' || currentTool === 'measure') {
      ctx.beginPath();
      ctx.strokeStyle = currentTool === 'measure' ? '#163F59' : '#2FA37C';
      ctx.lineWidth   = 2;
      ctx.setLineDash([5, 3]);
      ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
      drawPoints.forEach(p => ctx.lineTo(p.x, p.y));
      if (currentTool === 'area' && drawPoints.length > 2) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      if (currentTool === 'area' && drawPoints.length > 2) {
        ctx.fillStyle = 'rgba(47,163,124,0.15)';
        ctx.fill();
      }
    }

    drawPoints.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle   = '#2FA37C';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth   = 2;
      ctx.stroke();
    });
  }

  /* ====== GPS MARKER (over canvas) ====== */
  function drawGPSMarker() {
    // Managed via DOM element — just update position
    const marker = document.getElementById('gpsMarker');
    if (marker && gpsFollow) {
      marker.style.left = (gpsX + mapOffset.x) + 'px';
      marker.style.top  = (gpsY + mapOffset.y) + 'px';
    }
  }

  /* ====== UPDATE COORDS ====== */
  let baseLat = -23.5505, baseLng = -46.6333;

  function updateCoords() {
    const lat = document.getElementById('mapLat');
    const lng = document.getElementById('mapLng');
    const alt = document.getElementById('mapAlt');
    const zl  = document.getElementById('mapZoom');

    if (lat) lat.textContent = baseLat.toFixed(6) + '°';
    if (lng) lng.textContent = baseLng.toFixed(6) + '°';
    if (alt) alt.textContent = Math.round(752 + Math.sin(Date.now() / 5000) * 10) + 'm';
    if (zl)  zl.textContent  = zoom;
  }

  /* ====== DRAG ====== */
  canvas.addEventListener('mousedown', (e) => {
    if (currentTool === 'move') {
      isDragging = true;
      dragStart  = { x: e.clientX - mapOffset.x, y: e.clientY - mapOffset.y };
      canvas.style.cursor = 'grabbing';
    } else if (currentTool === 'point') {
      openAddWaypoint(e.offsetX, e.offsetY);
    } else if (currentTool === 'line' || currentTool === 'area' || currentTool === 'measure') {
      drawPoints.push({ x: e.offsetX - mapOffset.x, y: e.offsetY - mapOffset.y });
      draw();
      if (currentTool === 'measure' && drawPoints.length >= 2) {
        const dist = calcDistance();
        showMeasure(dist);
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      mapOffset.x = e.clientX - dragStart.x;
      mapOffset.y = e.clientY - dragStart.y;
      baseLat += (e.movementY * 0.00005);
      baseLng -= (e.movementX * 0.00005);
      draw();
    }

    // Check waypoint hover
    const W = canvas.width, H = canvas.height;
    const mx = e.offsetX - mapOffset.x;
    const my = e.offsetY - mapOffset.y;
    let hovering = false;

    waypoints.forEach(wp => {
      const wx = wp.x * W, wy = wp.y * H;
      const dist = Math.sqrt((mx - wx)**2 + (my - wy)**2);
      if (dist < 12) {
        canvas.style.cursor = 'pointer';
        hovering = true;
      }
    });

    if (!hovering && currentTool === 'move') {
      canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    if (currentTool === 'move') canvas.style.cursor = 'grab';
  });

  canvas.addEventListener('click', (e) => {
    if (currentTool !== 'move') return;
    const W = canvas.width, H = canvas.height;
    const mx = e.offsetX - mapOffset.x;
    const my = e.offsetY - mapOffset.y;

    waypoints.forEach(wp => {
      const wx = wp.x * W, wy = wp.y * H;
      const dist = Math.sqrt((mx - wx)**2 + (my - wy)**2);
      if (dist < 14) {
        showWPPopup(wp, e.clientX, e.clientY);
      }
    });
  });

  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    isDragging = true;
    dragStart = { x: t.clientX - mapOffset.x, y: t.clientY - mapOffset.y };
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const t = e.touches[0];
    mapOffset.x = t.clientX - dragStart.x;
    mapOffset.y = t.clientY - dragStart.y;
    draw();
  }, { passive: true });

  canvas.addEventListener('touchend', () => { isDragging = false; });

  // Wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    zoomMap(delta);
  }, { passive: false });

  /* ====== ZOOM ====== */
  window.zoomMap = function (delta) {
    zoom = Math.max(1, Math.min(20, zoom + delta));
    const zl = document.getElementById('zoomLabel');
    if (zl) zl.textContent = 'z' + zoom;
    draw();
  };

  /* ====== TOOL SELECTION ====== */
  window.setTool = function (tool, btn) {
    currentTool = tool;
    drawPoints  = [];

    document.querySelectorAll('.map-tool-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Clear measure
    const mr = document.getElementById('measureResult');
    if (tool !== 'measure' && mr) mr.classList.remove('show');

    // Cursor
    canvas.style.cursor = tool === 'move' ? 'grab' : 'crosshair';
    draw();

    const toolNames = { move: 'Mover mapa', point: 'Clique para adicionar ponto', line: 'Clique para desenhar linha (duplo clique para finalizar)', area: 'Clique para desenhar área', measure: 'Clique para medir distância' };
    showToast('info', toolNames[tool] || tool, '', 2000);
  };

  canvas.addEventListener('dblclick', (e) => {
    if (currentTool === 'line' || currentTool === 'area') {
      if (drawPoints.length > 1) {
        showToast('success', currentTool === 'line' ? 'Linha criada!' : 'Área criada!', `${drawPoints.length} pontos registrados.`);
        drawPoints = [];
        draw();
      }
    }
  });

  /* ====== GPS FOLLOW ====== */
  window.toggleGPSFollow = function (btn) {
    gpsFollow = !gpsFollow;
    if (btn) btn.classList.toggle('active', gpsFollow);
    if (gpsFollow) {
      mapOffset = { x: 0, y: 0 };
      draw();
      showToast('info', 'Centralizando no GPS', '', 1500);
    }
  };

  /* ====== GPS SIMULATION ====== */
  setInterval(() => {
    baseLat += (Math.random() - 0.5) * 0.000015;
    baseLng += (Math.random() - 0.5) * 0.000015;

    if (isRecording) {
      const prevX = gpsX, prevY = gpsY;
      gpsX += (Math.random() - 0.5) * 3;
      gpsY += (Math.random() - 0.5) * 3;
      liveTrackPoints.push({ x: gpsX - mapOffset.x, y: gpsY - mapOffset.y });
      if (liveTrackPoints.length > 200) liveTrackPoints.shift();

      const dx = gpsX - prevX, dy = gpsY - prevY;
      recDistance += Math.sqrt(dx*dx + dy*dy) * 0.00005;
    }

    updateCoords();
    draw();

    // GPS status
    const sats = 10 + Math.floor(Math.random() * 5);
    const acc  = 2 + Math.floor(Math.random() * 4);
    const gs = document.getElementById('mapGpsStatus');
    if (gs) gs.textContent = `GPS · ${sats} sats · ±${acc}m`;
  }, 3000);

  /* ====== TRACK RECORDING ====== */
  window.toggleTrackRecording = function () {
    isRecording = !isRecording;
    const bar  = document.getElementById('recordingBar');
    const btn  = document.getElementById('recordTrackBtn');
    const icon = document.getElementById('trackBtnIcon');
    const text = document.getElementById('trackBtnText');

    if (isRecording) {
      bar.classList.add('active');
      btn.classList.add('btn-danger');
      btn.classList.remove('btn-primary');
      icon.className = 'fas fa-circle';
      text.textContent = 'Parar';
      liveTrackPoints = [];
      recSeconds  = 0;
      recDistance = 0;

      recordTimer = setInterval(() => {
        recSeconds++;
        const h = Math.floor(recSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((recSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (recSeconds % 60).toString().padStart(2, '0');
        const timer = document.getElementById('recTimer');
        const dist  = document.getElementById('recDist');
        if (timer) timer.textContent = `${h}:${m}:${s}`;
        if (dist)  dist.textContent  = recDistance.toFixed(2) + ' km';
      }, 1000);

      showToast('success', 'Gravação iniciada!', 'Trilha sendo gravada. Ande com o dispositivo.');
    } else {
      clearInterval(recordTimer);
      bar.classList.remove('active');
      btn.classList.remove('btn-danger');
      btn.classList.add('btn-primary');
      icon.className = 'fas fa-circle';
      text.textContent = 'Gravar Trilha';
      draw();
      showToast('success', 'Trilha salva!', `${recDistance.toFixed(2)} km · ${formatTime(recSeconds)}. Acesse Trilhas para ver.`);
    }
  };

  window.pauseTrack = function (btn) {
    if (!isRecording) return;
    clearInterval(recordTimer);
    isRecording = false;
    btn.innerHTML = '<i class="fas fa-play"></i>';
    btn.onclick = function() { resumeTrack(this); };
    showToast('info', 'Trilha pausada', 'Clique em ▶ para retomar.');
  };

  window.resumeTrack = function (btn) {
    isRecording = true;
    btn.innerHTML = '<i class="fas fa-pause"></i>';
    btn.onclick = function() { pauseTrack(this); };
    recordTimer = setInterval(() => { recSeconds++; }, 1000);
    showToast('info', 'Trilha retomada', '');
  };

  window.stopTrack = function () {
    toggleTrackRecording();
  };

  function formatTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}h ${m}min ${s}s`;
  }

  /* ====== LAYERS ====== */
  const layers = [
    { name: 'Mapa Base',          type: 'Raster',    color: '#163F59', visible: true  },
    { name: 'Mapa Geológico',     type: 'GeoPDF',    color: '#C94B4B', visible: true  },
    { name: 'Trilhas',            type: 'Vetor',     color: '#E58A2B', visible: true  },
    { name: 'Waypoints',          type: 'Vetor',     color: '#2FA37C', visible: true  },
    { name: 'Fotos',              type: 'Media',     color: '#1F6B5C', visible: true  },
    { name: 'Curvas de Nível',    type: 'Vetor',     color: '#6B8F71', visible: false },
  ];

  function renderLayers() {
    const container = document.getElementById('layersList');
    if (!container) return;

    container.innerHTML = layers.map((l, i) => `
      <div class="layer-row">
        <div class="layer-color-dot" style="background:${l.color};"></div>
        <div style="flex:1;min-width:0;">
          <div class="layer-row-name">${l.name}</div>
          <div class="layer-row-type">${l.type}</div>
        </div>
        <label class="toggle-switch" style="flex-shrink:0;">
          <input type="checkbox" ${l.visible ? 'checked' : ''} onchange="toggleLayer(${i}, this)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('');
  }

  window.toggleLayer = function (idx, input) {
    layers[idx].visible = input.checked;
    draw();
    showToast('info', layers[idx].name, input.checked ? 'Camada ativada' : 'Camada desativada', 1500);
  };

  window.toggleLayers = function () {
    const panel = document.getElementById('layerPanel');
    if (panel) {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) renderLayers();
    }
  };

  /* ====== WAYPOINT POPUP ====== */
  function showWPPopup(wp, clientX, clientY) {
    const popup = document.getElementById('wpPopup');
    if (!popup) return;

    document.getElementById('wpPopupName').textContent   = wp.name;
    document.getElementById('wpPopupDesc').textContent   = wp.desc;
    document.getElementById('wpPopupCoords').textContent = `${AfaiaMaps.GPS.lat.toFixed(4)}°, ${AfaiaMaps.GPS.lng.toFixed(4)}°`;

    popup.style.left = (clientX - 100) + 'px';
    popup.style.top  = (clientY - 140) + 'px';
    popup.classList.add('show');
  }

  /* ====== WAYPOINT MODAL ====== */
  function openAddWaypoint(x, y) {
    openModal('addWpModal');
    const lat = document.getElementById('wpLat');
    const lng = document.getElementById('wpLng');
    if (lat) lat.value = baseLat.toFixed(6);
    if (lng) lng.value = baseLng.toFixed(6);
  }

  window.saveWaypoint = function () {
    const name = document.getElementById('wpName')?.value;
    if (!name) { showToast('warning', 'Nome obrigatório', 'Informe o nome do ponto.'); return; }

    const lat  = document.getElementById('wpLat')?.value;
    const lng  = document.getElementById('wpLng')?.value;

    waypoints.push({
      x: 0.5 + (Math.random() - 0.5) * 0.2,
      y: 0.5 + (Math.random() - 0.5) * 0.2,
      name, cat: 'novo', icon: '●', color: '#2FA37C', desc: document.getElementById('wpDesc')?.value || ''
    });

    closeModal('addWpModal');
    draw();
    showToast('success', 'Ponto salvo!', `"${name}" adicionado ao mapa. Posição: ${lat}, ${lng}`);

    // Reset
    document.getElementById('wpName').value = '';
    document.getElementById('wpDesc').value = '';
  };

  window.selectCategory = function (btn, cat) {
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  };

  window.previewPhoto = function (input) {
    if (!input.files?.length) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('wpPhotoPreview');
      if (preview) {
        preview.style.display = 'block';
        preview.innerHTML = `<img src="${e.target.result}" style="width:100%;border-radius:8px;max-height:150px;object-fit:cover;">`;
      }
    };
    reader.readAsDataURL(input.files[0]);
  };

  /* ====== MEASURE ====== */
  function calcDistance() {
    if (drawPoints.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < drawPoints.length; i++) {
      const dx = drawPoints[i].x - drawPoints[i-1].x;
      const dy = drawPoints[i].y - drawPoints[i-1].y;
      total += Math.sqrt(dx*dx + dy*dy);
    }
    return (total * 0.01).toFixed(2);
  }

  function showMeasure(dist) {
    const el = document.getElementById('measureResult');
    const val = document.getElementById('measureValue');
    if (el && val) {
      val.textContent = dist + ' km';
      el.classList.add('show');
    }
  }

  /* ====== OFFLINE ====== */
  window.toggleOffline = function (btn) {
    btn.classList.toggle('active');
    const on = btn.classList.contains('active');
    showToast(on ? 'success' : 'info', on ? 'Mapa disponível offline!' : 'Cache offline removido', on ? 'Este mapa foi baixado e pode ser usado sem internet.' : '');
  };

  /* ====== COMPASS ====== */
  window.resetNorth = function () {
    showToast('info', 'Mapa orientado para o Norte', '', 1500);
  };

  /* ====== INIT ====== */
  renderLayers();
  draw();

  // Animate draw on load
  requestAnimationFrame(draw);

})();
