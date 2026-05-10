/**
 * StorageAdapter — T-013-a
 * Unified persistence: server-first with localStorage offline fallback.
 */

const STORE_DIR = '/api/store';
const LS_PREFIX = 'ncc-';
const TIMEOUT = 2000;

function _lsKey(app) { return LS_PREFIX + app; }

function _safeParse(raw, app) {
  try { return raw ? JSON.parse(raw) : {}; }
  catch {
    console.warn(`[StorageAdapter] Corrupted data for ${app}`);
    return {};
  }
}

function _isSerializable(data) {
  try { JSON.parse(JSON.stringify(data)); return true; }
  catch { return false; }
}

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
    // Fallback to localStorage; backfill server silently if local data exists
    const raw = localStorage.getItem(_lsKey(app));
    const parsed = _safeParse(raw, app);
    if (raw && parsed && Object.keys(parsed).length) {
      // silent backfill (fire-and-forget)
      _req('POST', `${STORE_DIR}/write`, { app, data: parsed }).catch(() => {});
    }
    return parsed;
  },

  async write(app, data) {
    if (!_isSerializable(data)) {
      console.warn(`[StorageAdapter] Non-serializable data for ${app}`);
      return false;
    }
    const server = await _req('POST', `${STORE_DIR}/write`, { app, data });
    if (server.ok) {
      localStorage.setItem(_lsKey(app), JSON.stringify(data));
      window.__nexusOffline = false;
      return true;
    }
    localStorage.setItem(_lsKey(app), JSON.stringify(data));
    window.__nexusOffline = true;
    window.__offlineQueue = window.__offlineQueue || [];
    window.__offlineQueue.push({ app, data });
    return false;
  },

  async merge(app, patch) {
    if (!_isSerializable(patch)) {
      console.warn(`[StorageAdapter] Non-serializable patch for ${app}`);
      return {};
    }
    const server = await _req('POST', `${STORE_DIR}/merge`, { app, patch });
    if (server.ok && server.data !== undefined) {
      localStorage.setItem(_lsKey(app), JSON.stringify(server.data));
      window.__nexusOffline = false;
      return server.data;
    }
    // Local merge fallback
    const raw = localStorage.getItem(_lsKey(app));
    const current = _safeParse(raw, app);
    const merged = { ...current, ...patch };
    localStorage.setItem(_lsKey(app), JSON.stringify(merged));
    window.__nexusOffline = true;
    return merged;
  },

  isOnline() {
    return navigator.onLine && !window.__nexusOffline;
  },
};
