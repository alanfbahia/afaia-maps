// ============================================================
//  capacitor.js – Bridge Capacitor / Web
//  Detecta se está rodando como app nativo ou PWA/browser
//  e fornece APIs unificadas para GPS, câmera, filesystem, etc.
// ============================================================

// ── Detecção de plataforma ────────────────────────────────
const isCapacitor  = () => typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
const isAndroid    = () => isCapacitor() && window.Capacitor.getPlatform() === 'android';
const isIOS        = () => isCapacitor() && window.Capacitor.getPlatform() === 'ios';
const isWeb        = () => !isCapacitor();

window.Platform = { isCapacitor, isAndroid, isIOS, isWeb };

// ── Lazy import de plugins Capacitor ─────────────────────
async function getPlugin(name) {
  if (!isCapacitor()) return null;
  try {
    const mod = await import(`https://cdn.jsdelivr.net/npm/@capacitor/${name}@6/dist/esm/index.js`);
    return mod[name.charAt(0).toUpperCase() + name.slice(1)] || mod.default || null;
  } catch {
    return null;
  }
}

// ============================================================
//  GPS – wrapper unificado
// ============================================================
window.NativeGPS = {
  /**
   * Obtém posição atual
   * Capacitor: usa GPS nativo (mais preciso em background)
   * Web: usa navigator.geolocation
   */
  async getCurrentPosition(options = {}) {
    if (isCapacitor()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: options.timeout || 15000,
        maximumAge: options.maximumAge || 3000,
      });
      return pos.coords;
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        p => resolve(p.coords),
        reject,
        { enableHighAccuracy: true, timeout: 15000, ...options }
      );
    });
  },

  /**
   * Observa posição em tempo real
   * Retorna watchId (para cancelar depois)
   */
  async watchPosition(callback, errorCallback, options = {}) {
    if (isCapacitor()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, ...options },
        (pos, err) => {
          if (err) { errorCallback?.(err); return; }
          callback(pos.coords);
        }
      );
      return watchId;
    }
    return navigator.geolocation.watchPosition(
      p => callback(p.coords),
      errorCallback,
      { enableHighAccuracy: true, timeout: 10000, ...options }
    );
  },

  /**
   * Para observação
   */
  async clearWatch(watchId) {
    if (isCapacitor()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      await Geolocation.clearWatch({ id: watchId });
    } else {
      navigator.geolocation.clearWatch(watchId);
    }
  },

  /**
   * Solicita permissão de localização
   */
  async requestPermission() {
    if (isCapacitor()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const status = await Geolocation.requestPermissions();
      return status.location === 'granted';
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false)
      );
    });
  },
};

// ============================================================
//  Câmera – fotos georreferenciadas
// ============================================================
window.NativeCamera = {
  /**
   * Tira foto com câmera nativa
   * Retorna: { dataUrl, lat, lng, altitude, heading }
   */
  async takePicture(options = {}) {
    if (isCapacitor()) {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality:       90,
        allowEditing:  false,
        resultType:    CameraResultType.DataUrl,
        source:        CameraSource.Camera,
        width:         1920,
        height:        1920,
        saveToGallery: options.saveToGallery || false,
        ...options,
      });

      // Tenta obter GPS no momento da foto
      let gps = {};
      try {
        gps = await NativeGPS.getCurrentPosition({ timeout: 5000 });
      } catch {}

      return {
        dataUrl:   photo.dataUrl,
        format:    photo.format,
        lat:       gps.latitude,
        lng:       gps.longitude,
        altitude:  gps.altitude,
        accuracy:  gps.accuracy,
        heading:   gps.heading,
        taken_at:  new Date().toISOString(),
      };
    }

    // Web fallback – input file
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type   = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) { reject(new Error('Nenhuma foto selecionada')); return; }
        const reader = new FileReader();
        reader.onload = async (ev) => {
          let gps = {};
          try { gps = await NativeGPS.getCurrentPosition({ timeout: 5000 }); } catch {}
          resolve({
            dataUrl:  ev.target.result,
            format:   file.type.split('/')[1] || 'jpeg',
            lat:      gps.latitude,
            lng:      gps.longitude,
            altitude: gps.altitude,
            taken_at: new Date().toISOString(),
          });
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  },

  /**
   * Escolhe foto da galeria
   */
  async pickFromGallery() {
    if (isCapacitor()) {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality:    90,
        resultType: CameraResultType.DataUrl,
        source:     CameraSource.Photos,
      });
      return { dataUrl: photo.dataUrl, format: photo.format };
    }
    return this.takePicture({ source: 'gallery' });
  },
};

// ============================================================
//  Filesystem – leitura/escrita de arquivos
// ============================================================
window.NativeFS = {
  /**
   * Salva arquivo localmente
   */
  async writeFile(path, data, options = {}) {
    if (isCapacitor()) {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      return Filesystem.writeFile({
        path,
        data,
        directory: options.directory || Directory.Documents,
        encoding:  options.encoding  || Encoding.UTF8,
        recursive: true,
      });
    }
    // Web: faz download
    const blob = new Blob([data], { type: options.mimeType || 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = path.split('/').pop();
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Lê arquivo local
   */
  async readFile(path, options = {}) {
    if (isCapacitor()) {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const result = await Filesystem.readFile({
        path,
        directory: options.directory || Directory.Documents,
        encoding:  options.encoding  || Encoding.UTF8,
      });
      return result.data;
    }
    throw new Error('readFile não disponível no browser');
  },

  /**
   * Abre seletor de arquivo (para importar mapas)
   */
  pickFile(accept = '.gpx,.kml,.geojson,.pdf,.tif,.tiff') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type   = 'file';
      input.accept = accept;
      input.onchange = (e) => {
        const file = e.target.files[0];
        file ? resolve(file) : reject(new Error('Nenhum arquivo selecionado'));
      };
      input.click();
    });
  },
};

// ============================================================
//  Haptics – feedback tátil
// ============================================================
window.Haptic = {
  async light() {
    if (isCapacitor()) {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (navigator.vibrate) navigator.vibrate(30);
  },
  async medium() {
    if (isCapacitor()) {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (navigator.vibrate) navigator.vibrate(60);
  },
  async success() {
    if (isCapacitor()) {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: NotificationType.Success });
    } else if (navigator.vibrate) navigator.vibrate([30, 30, 60]);
  },
  async error() {
    if (isCapacitor()) {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: NotificationType.Error });
    } else if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  },
};

// ============================================================
//  Network – status de conexão
// ============================================================
window.NetworkStatus = {
  _connected: navigator.onLine,
  _listeners: [],

  async init() {
    if (isCapacitor()) {
      const { Network } = await import('@capacitor/network');
      const status = await Network.getStatus();
      this._connected = status.connected;

      Network.addListener('networkStatusChange', (s) => {
        this._connected = s.connected;
        this._listeners.forEach(fn => fn(s.connected));
        // Atualiza banner offline
        document.getElementById('offlineBanner')?.classList.toggle('hidden', s.connected);
      });
    } else {
      window.addEventListener('online',  () => { this._connected = true;  this._listeners.forEach(fn => fn(true)); });
      window.addEventListener('offline', () => { this._connected = false; this._listeners.forEach(fn => fn(false)); });
    }
  },

  isOnline() { return this._connected; },

  onChange(fn) { this._listeners.push(fn); },
};

// ============================================================
//  StatusBar & SplashScreen
// ============================================================
window.NativeUI = {
  async hideSplash() {
    if (isCapacitor()) {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide({ fadeOutDuration: 500 });
    }
  },

  async setStatusBarDark() {
    if (isCapacitor()) {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0f172a' });
      if (isAndroid()) await StatusBar.setOverlaysWebView({ overlay: true });
    }
  },

  async hideStatusBar() {
    if (isCapacitor()) {
      const { StatusBar } = await import('@capacitor/status-bar');
      await StatusBar.hide();
    }
  },
};

// ============================================================
//  Share
// ============================================================
window.NativeShare = {
  async share({ title, text, url, files }) {
    if (isCapacitor()) {
      const { Share } = await import('@capacitor/share');
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({ title, text, url, files, dialogTitle: title });
        return true;
      }
    }
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return true;
    }
    return false;
  },
};

// ============================================================
//  App lifecycle (Android back button, etc.)
// ============================================================
window.AppLifecycle = {
  async init() {
    if (!isCapacitor()) return;
    const { App } = await import('@capacitor/app');

    // Botão voltar do Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.minimizeApp();
      }
    });

    // App voltou ao foreground → tenta sync
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && window.SyncManager) {
        SyncManager.sync();
      }
    });

    // URL aberta externamente (deep link)
    App.addListener('appUrlOpen', ({ url }) => {
      const path = url.replace(/^https?:\/\/[^/]+/, '');
      if (path && path !== '/') window.location.href = path;
    });
  },
};

// ============================================================
//  Inicialização automática
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await NetworkStatus.init();
  await NativeUI.setStatusBarDark();
  await AppLifecycle.init();
  // Esconde splash após carregamento
  setTimeout(() => NativeUI.hideSplash(), 300);
});
