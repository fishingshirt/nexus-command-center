/**
 * StorageAdapter — T-013-a
 * Unified persistence: server-first with localStorage offline fallback.
 */

const STORE_DIR = '/api/store';
const LS_PREFIX = 'ncc-';
const TIMEOUT = 2000;

function _lsKey(app) { return LS_PREFIX + app; }

async function _req(method, endpoint, body) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, status: res.status };
    return await res.json();
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: e.name };
  }
}

export const storage = {
  async read(app) {
    const server = await _req('GET', `${STORE_DIR}/read?app=${encodeURIComponent(app)}`);
    if (server.ok && server.data !== undefined) {
      localStorage.setItem(_lsKey(app), JSON.stringify(server.data));
      return server.data;
    }
    // Fallback to localStorage
    const raw = localStorage.getItem(_lsKey(app));
    try { return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
  },

  async write(app, data) {
    const server = await _req('POST', `${STORE_DIR}/write`, { app, data });
    if (server.ok) {
      localStorage.setItem(_lsKey(app), JSON.stringify(data));
      return true;
    }
    localStorage.setItem(_lsKey(app), JSON.stringify(data));
    window.__nexusOffline = true;
    window.__offlineQueue = window.__offlineQueue || [];
    window.__offlineQueue.push({ app, data });
    return false;
  },

  async merge(app, patch) {
    const server = await _req('POST', `${STORE_DIR}/merge`, { app, patch });
    if (server.ok && server.data !== undefined) {
      localStorage.setItem(_lsKey(app), JSON.stringify(server.data));
      return server.data;
    }
    // Local merge fallback
    const raw = localStorage.getItem(_lsKey(app));
    let current = {};
    try { current = raw ? JSON.parse(raw) : {}; } catch { current = {}; }
    const merged = { ...current, ...patch };
    localStorage.setItem(_lsKey(app), JSON.stringify(merged));
    window.__nexusOffline = true;
    return merged;
  },

  isOnline() {
    return navigator.onLine && !window.__nexusOffline;
  },
};
