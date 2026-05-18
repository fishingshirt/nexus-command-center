/**
 * Nexus Database Client — frontend wrapper for the local SQLite REST API.
 * Replaces direct localStorage usage with persistent host-backed storage.
 *
 * Usage:
 *   await NexusDB.list('notes');
 *   await NexusDB.get('notes', 'uuid-123');
 *   await NexusDB.create('notes', { title: 'Hello', body: '...' });
 *   await NexusDB.update('notes', 'uuid-123', { title: 'Updated' });
 *   await NexusDB.delete('notes', 'uuid-123');
 *   await NexusDB.search('notes', 'keyword');
 *   await NexusDB.stats();
 *   await NexusDB.export();
 *   await NexusDB.import(data, wipe);
 */
(function(global) {
  'use strict';

  const API_BASE = '/api/db';

  async function _fetch(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(API_BASE + path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  const NexusDB = {
    /** List all rows in a table, optionally filtered */
    list: (table, params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) qs.set(k, v);
      });
      const q = qs.toString();
      return _fetch('GET', `/${table}${q ? '?' + q : ''}`);
    },

    /** Get a single row by ID */
    get: (table, id) => _fetch('GET', `/${table}/${encodeURIComponent(id)}`),

    /** Create a new row. Returns { ok, id } */
    create: (table, data) => _fetch('POST', `/${table}`, data),

    /** Bulk insert/replace rows. Returns { ok, ids } */
    bulk: (table, rows) => _fetch('POST', `/${table}`, rows),

    /** Update a row by ID */
    update: (table, id, data) => _fetch('PUT', `/${table}/${encodeURIComponent(id)}`, data),

    /** Delete a row by ID */
    delete: (table, id) => _fetch('DELETE', `/${table}/${encodeURIComponent(id)}`),

    /** Search across title/body/description fields */
    search: (table, keyword, extra = {}) => NexusDB.list(table, { ...extra, search: keyword }),

    /** Database stats (row counts per table) */
    stats: () => _fetch('GET', '/stats'),

    /** Export entire database as JSON blob */
    export: () => _fetch('GET', '/backup'),

    /** Import JSON blob (destructive if wipe=true) */
    import: (data, wipe = false) => _fetch('POST', '/restore', { data, wipe }),
  };

  // ── Settings convenience helpers ──
  NexusDB.settings = {
    get: async (key, defaultVal) => {
      const res = await NexusDB.list('app_settings', { key });
      const row = res.data?.[0];
      if (!row) return defaultVal;
      try { return JSON.parse(row.value); } catch { return row.value; }
    },
    set: (key, value) => NexusDB.create('app_settings', { key, value }),
  };

  global.NexusDB = NexusDB;
})(window);
