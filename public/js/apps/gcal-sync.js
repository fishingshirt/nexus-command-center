const loadSettings = window.loadSettings || (() => ({}));
const saveSettings = window.saveSettings || (() => {});
const toast = (...args) => (window.toast ? window.toast(...args) : undefined);
import { flushOutboundQueue } from './gcal-outbound.js';

/* ===== GOOGLE CALENDAR SYNC ENGINE =====
   Dual-mode: OAuth (legacy) ↔ Service Account (new).
   Service account is preferred when available; falls back to OAuth tokens.
   Settings key: calendarSync.mode = 'service_account' | 'oauth' | null
*/

export function initGoogleSync() {
  const STORAGE_KEY = 'ncc-calendar-events';
  let syncTimer = null;

  // Detect which mode we're in
  function getSyncMode() {
    const s = loadSettings().calendarSync || {};
    if (s.mode) return s.mode;
    if (s.access_token || s.status) return 'oauth';
    return 'service_account'; // default to trying service account
  }

  function isServiceAccount() { return getSyncMode() === 'service_account'; }

  document.getElementById('btn-sync-now')?.addEventListener('click', async () => {
    await doSync();
  });

  // Auto-sync every 30 min if linked
  startAutoSync();
  window.addEventListener('beforeunload', stopAutoSync);

  // Poll agent calendar commands on focus
  window.addEventListener('focus', pollAgentEvents);
  pollAgentEvents();

  function startAutoSync() {
    stopAutoSync();
    syncTimer = setInterval(doSync, 30 * 60_000);
  }

  function stopAutoSync() {
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  }

  async function pollAgentEvents() {
    try {
      const res = await fetch('/api/calendar/agent/poll');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.events || !data.events.length) return;
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      let added = 0, duplicates = 0;
      for (const ev of data.events) {
        if (stored.some(e => e.id === ev.id || (e.title === ev.title && e.date === ev.date))) {
          duplicates++;
          continue;
        }
        // Queue for outbound sync
        import('./gcal-outbound.js').then(mod => {
          mod.syncEventToGoogle(ev, 'create').catch(() => {});
        });
        stored.push({
          ...ev,
          updatedAt: Date.now(),
          lastModifiedAt: Date.now(),
          source: 'agent',
        });
        added++;
      }
      if (added) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        window.dispatchEvent(new CustomEvent('ncc-cal-updated'));
        toast(`${added} event${added > 1 ? 's' : ''} added from agent`, 'info');
      }
    } catch (e) {
      // silent fail
    }
  }

  async function doSync() {
    if (isServiceAccount()) {
      await doServiceAccountSync();
    } else {
      await doOAuthSync();
    }
  }

  // ── OAuth legacy sync ──────────────────────
  async function doOAuthSync() {
    try {
      saveStatus('syncing', null, 'inbound');
      const res = await fetch('/api/calendar/sync');
      const data = await res.json();
      if (!data.ok) {
        if (data.status === 'not_linked') {
          saveStatus('none', null);
          return;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const imported = mergeEvents(data.events || []);
      saveStatus('syncing', imported, 'inbound');
      const flushRes = await flushOutboundQueue();
      if (flushRes && flushRes.remaining) {
        saveStatus('syncing', imported, 'outbound');
      } else {
        saveStatus('synced', imported, 'outbound');
      }
    } catch (err) {
      saveStatus('error', null);
    }
  }

  // ── Service account sync ─────────────────
  async function doServiceAccountSync() {
    try {
      saveStatus('syncing', null, 'inbound');
      const now = new Date();
      const timeMin = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, -1) + 'Z';
      const timeMax = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, -1) + 'Z';
      const res = await fetch(`/api/calendar/gcal/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.ok) {
        if (data.error?.includes('not_found') || data.error?.includes('calendarId')) {
          saveStatus('error', null);
          toast('Calendar not found. Make sure the service account email has been shared your calendar.', 'error');
          return;
        }
        throw new Error(data.error || 'Unknown error');
      }
      const imported = mergeEvents(data.events || []);
      saveStatus('syncing', imported, 'inbound');
      const flushRes = await flushOutboundQueue();
      if (flushRes && flushRes.remaining) {
        saveStatus('syncing', imported, 'outbound');
      } else {
        saveStatus('synced', imported, 'outbound');
      }
    } catch (err) {
      saveStatus('error', null);
      toast(`Service account sync failed: ${err.message}`, 'error');
    }
  }

  function mergeEvents(gEvents) {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    let created = 0, updated = 0;
    const now = new Date().toISOString();

    for (const g of gEvents) {
      if (g.status === 'cancelled') continue;
      const gcalId = g.id;
      const title = g.summary || '(No title)';
      const description = g.description || '';
      const start = g.start?.date || g.start?.dateTime;
      const end = g.end?.date || g.end?.dateTime;
      if (!start) continue;
      const dateStr = start.slice(0, 10);
      let startTime = '';
      let endTime = '';
      if (g.start?.dateTime) startTime = start.slice(11, 16);
      if (g.end?.dateTime) endTime = (g.end?.dateTime || '').slice(11, 16);
      const existing = stored.find(e => e.gcalId === gcalId);
      if (existing) {
        const googleUpdated = new Date(g.updated || g.created || Date.now()).getTime();
        const lastSync = existing.lastSyncedAt || 0;
        const localModified = existing.lastModifiedAt || existing.updatedAt || 0;
        if (lastSync && googleUpdated > lastSync && localModified > lastSync) {
          existing.conflict = true;
        } else {
          existing.conflict = false;
          let dirty = false;
          if (existing.title !== title) { existing.title = title; dirty = true; }
          if (existing.date !== dateStr) { existing.date = dateStr; dirty = true; }
          if (existing.start !== startTime) { existing.start = startTime; dirty = true; }
          if (existing.end !== endTime) { existing.end = endTime; dirty = true; }
          if (existing.description !== description) { existing.description = description; dirty = true; }
          if (dirty) updated++;
        }
        existing.lastSyncedAt = Date.now();
        existing.updatedAt = Date.now();
      } else {
        stored.push({
          id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9),
          gcalId,
          title,
          date: dateStr,
          start: startTime,
          end: endTime,
          category: 'other',
          recurrence: 'none',
          description,
          source: 'google',
          importedAt: now,
          updatedAt: now,
          lastSyncedAt: Date.now(),
        });
        created++;
      }
    }

    stored.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    window.dispatchEvent(new CustomEvent('ncc-cal-updated'));
    return { created, updated };
  }

  function saveStatus(status, importResult, phase) {
    const c = loadSettings().calendarSync || {};
    if (c.status === 'error' && status === 'syncing') {
      c.lastStatusAt = new Date().toISOString();
      saveSettings({ calendarSync: c });
      return;
    }
    c.status = status;
    c.lastStatusAt = new Date().toISOString();
    // Set mode if it hasn't been explicitly chosen yet
    if (!c.mode) c.mode = 'service_account';
    if (status === 'synced') c.lastSynced = new Date().toISOString();
    saveSettings({ calendarSync: c });

    const badge = document.getElementById('sync-status-badge');
    const dot = document.getElementById('calendar-sync-dot');
    const map = {
      none: { text: 'Not linked', cls: '' },
      linked: { text: 'Linked (OAuth)', cls: 'linked' },
      syncing: { text: 'Merging…', cls: 'syncing' },
      synced: { text: importResult ? `Synced (+${importResult.created} / ~${importResult.updated})` : 'Synced', cls: 'synced' },
      error: { text: 'Sync error', cls: 'error' },
      'paused-offline': { text: 'Paused — offline', cls: '' },
    };
    const m = map[status] || map.none;
    if (badge) {
      badge.className = 'sync-status-badge';
      if (m.cls) badge.classList.add(m.cls);
      badge.textContent = m.text;
    }
    if (dot) {
      dot.className = 'calendar-sync-dot';
      if (m.cls) dot.classList.add(m.cls);
      const modeText = isServiceAccount() ? 'Service Account' : 'OAuth';
      dot.title = `Google Calendar (via ${modeText}): ${m.text}`;
    }
    if (status === 'synced' && phase === 'outbound') {
      toast(importResult ? `Imported ${importResult.created} new, updated ${importResult.updated} events` : 'Calendar synced');
    } else if (status === 'error') {
      toast('Calendar sync failed', 'error');
    }
  }

  window.addEventListener('nexusOffline', () => {
    stopAutoSync();
    const c = loadSettings().calendarSync || {};
    if (c.status !== 'none') {
      c.status = 'paused-offline';
      saveSettings({ calendarSync: c });
      toast('Calendar sync paused — offline');
    }
  });

  window.addEventListener('nexusOnline', () => {
    const c = loadSettings().calendarSync || {};
    if (c.status !== 'none') {
      toast('Back online — resuming calendar sync');
      startAutoSync();
      doSync();
    }
  });
}
