// ============================================================
//  sync.js – Gerenciador de sincronização offline
//  Envia fila de operações pendentes quando internet volta
// ============================================================

const SYNC_INTERVAL = 30_000; // 30 segundos
let _syncTimer = null;
let _isSyncing = false;

window.SyncManager = {

  async init() {
    // Verifica status ao iniciar
    this.updateUI();

    // Inicia loop de sync
    if (_syncTimer) clearInterval(_syncTimer);
    _syncTimer = setInterval(() => this.sync(), SYNC_INTERVAL);

    // Sync quando fica online
    window.addEventListener('online', () => {
      console.log('[SYNC] Conexão restaurada – iniciando sync');
      setTimeout(() => this.sync(), 1000);
    });

    // Background sync via Service Worker
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data?.type === 'BACKGROUND_SYNC') this.sync();
    });

    // Sync inicial se online
    if (navigator.onLine) await this.sync();
  },

  async sync() {
    if (_isSyncing || !navigator.onLine || !Auth.isLoggedIn()) return;
    _isSyncing = true;

    try {
      const pending = await LocalDB.syncQueue.getPending();
      if (pending.length === 0) {
        _isSyncing = false;
        return;
      }

      console.log(`[SYNC] Enviando ${pending.length} operações pendentes...`);
      this.updateUI('syncing', pending.length);

      // Monta payload para o endpoint /sync/push
      const operations = pending.map(item => ({
        type:      item.entity_type || item.type,
        operation: item.operation,
        client_id: item.client_id,
        payload:   item.payload,
      }));

      const result = await SyncAPI.push(operations);

      // Marca itens processados como done
      const successIds = result.details
        .filter(d => d.status === 'ok')
        .map(d => d.client_id);

      for (const item of pending) {
        if (successIds.includes(item.client_id)) {
          await LocalDB.syncQueue.markDone(item.local_id);
        }
      }

      console.log(`[SYNC] ✅ ${result.success} ok, ${result.errors} erros`);

      if (result.success > 0) {
        showToast(`${result.success} item(s) sincronizado(s)`, 'success');
      }
      if (result.errors > 0) {
        showToast(`${result.errors} item(s) com erro de sync`, 'error');
      }

      // Pull de dados novos do servidor
      const lastSync = localStorage.getItem('afaia_last_sync');
      const pullData = await SyncAPI.pull(lastSync);
      localStorage.setItem('afaia_last_sync', pullData.timestamp);

      // Salva dados recebidos no IndexedDB
      if (pullData.tracks?.length) {
        for (const t of pullData.tracks) {
          if (!t.client_id) continue;
          const exists = await LocalDB.tracks.get(t.client_id);
          if (!exists) await LocalDB.tracks.save(t);
        }
      }
      if (pullData.waypoints?.length) {
        for (const w of pullData.waypoints) {
          if (!w.client_id) continue;
          const exists = await LocalDB.waypoints.get(w.client_id);
          if (!exists) await LocalDB.waypoints.save(w);
        }
      }

    } catch (err) {
      console.warn('[SYNC] Falha:', err.message);
    } finally {
      _isSyncing = false;
      this.updateUI();
    }
  },

  async getPendingCount() {
    const pending = await LocalDB.syncQueue.getPending();
    return pending.length;
  },

  async updateUI(state, count) {
    const el = document.getElementById('syncStatus');
    if (!el) return;

    if (state === 'syncing') {
      el.innerHTML = `<i class="fa fa-rotate fa-spin"></i> <span>Sincronizando (${count})...</span>`;
      el.style.color = 'var(--warning)';
      return;
    }

    const pending = await this.getPendingCount();
    if (pending > 0) {
      el.innerHTML = `<i class="fa fa-circle-exclamation"></i> <span>${pending} pendente(s)</span>`;
      el.style.color = 'var(--warning)';

      // Registra Background Sync se disponível
      navigator.serviceWorker?.ready.then(reg => {
        if ('sync' in reg) reg.sync.register('sync-offline-data').catch(() => {});
      });
    } else {
      el.innerHTML = `<i class="fa fa-circle-check"></i> <span>Sincronizado</span>`;
      el.style.color = 'var(--secondary)';
    }
  },
};
