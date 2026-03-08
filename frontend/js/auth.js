// ============================================================
//  auth.js – Gerenciamento de sessão no frontend
// ============================================================

window.Auth = {
  /** Retorna o usuário atual (do localStorage) */
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('afaia_user'));
    } catch {
      return null;
    }
  },

  /** Retorna o token atual */
  getToken() {
    return localStorage.getItem('afaia_token');
  },

  /** Verifica se está autenticado */
  isLoggedIn() {
    return !!this.getToken();
  },

  /** Redireciona para login se não autenticado */
  requireAuth() {
    if (!this.isLoggedIn()) {
      location.href = '/login.html';
      return false;
    }
    return true;
  },

  /** Salva sessão após login */
  setSession(token, user, refreshToken) {
    localStorage.setItem('afaia_token', token);
    localStorage.setItem('afaia_user', JSON.stringify(user));
    if (refreshToken) localStorage.setItem('afaia_refresh_token', refreshToken);
  },

  /** Remove sessão (logout) */
  clearSession() {
    localStorage.removeItem('afaia_token');
    localStorage.removeItem('afaia_user');
    localStorage.removeItem('afaia_refresh_token');
  },

  /** Faz logout completo */
  async logout() {
    try { await AuthAPI.logout(); } catch {}
    this.clearSession();
    location.href = '/login.html';
  },
};
