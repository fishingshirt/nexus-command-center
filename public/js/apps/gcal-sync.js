import { toast, loadSettings, saveSettings } from '../app.js';

/* ===== GOOGLE CALENDAR SYNC ENGINE ===== */
// One-way import from Google Calendar into localStorage events.
// Uses Google Calendar API (read-only) with an API key.
// Auth via OAuth2 client not yet wired; API key is the quick path.

export function initGoogleSync() {
  const STORAGE_KEY = 'ncc-calendar-events';
  const cfg = loadSettings().calendarSync || {};
  let syncTimer = null;

  // On init, if autoSync is already on, start the loop
  if (cfg.autoSync) startAutoSync();

  document.addEventListener('calendarSyncChanged', () => {
    const c = loadSettings().calendarSync || {};
    if (c.autoSync) startAutoSync();
    else stopAutoSync();
  });

  // Listen for manual sync button
  const syncNowBtn = document.getElementById('btn-sync-now');
  syncNowBtn?.addEventListener('click', async () => {
    await doSync();
  });

  function startAutoSync() {
    stopAutoSync();
    const c = loadSettings().calendarSync || {};
    if (!c.apiKey?.trim()) return; // can't auto without key
    const ms = (c.intervalMin || 60) * 60_000;
    syncTimer = setInterval(doSync, ms);
    // Also run immediately
    doSync();
  }

  function stopAutoSync() {
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  }

  async function doSync() {
    const c = loadSettings().calendarSync || {};
    const apiKey = c.apiKey?.trim();
    if (!apiKey) {
      // If clientId is set but no apiKey, just mark linked
      if (c.clientId?.trim()) {
        saveStatus('linked', null);
          return;
      }
      saveStatus('none', null);
      return;
    }

    saveStatus('syncing', null);

    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 1);
    const timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 3);

    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('timeMin', timeMin.toISOString());
    url.searchParams.set('timeMax', timeMax.toISOString());
    url.searchParams.set('maxResults', '250');

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data.items)) throw new Error('Unexpected response format');
      const imported = mergeEvents(data.items);
      saveStatus('synced', imported);
    } catch (err) {
      console.error('[CalendarSync]', err);
      saveStatus('error', null);
    }
  }

  function mergeEvents(gEvents) {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    let created = 0;
    let updated = 0;

    const now = new Date().toISOString();

    for (const g of gEvents) {
      if (g.status === 'cancelled') continue;
      const gcalId = g.id;
      const title = g.summary || '(No title)';
      const description = g.description || '';
      const start = g.start?.date || g.start?.dateTime;
      const end = g.end?.date || g.end?.dateTime;
      if (!start) continue;

      const dateStr = start.slice(0, 10); // YYYY-MM-DD
      let startTime = '';
      let endTime = '';
      if (g.start?.dateTime) {
        startTime = start.slice(11, 16);
      }
      if (g.end?.dateTime) {
        endTime = (g.end?.dateTime || '').slice(11, 16);
      }

      const existing = stored.find(e => e.gcalId === gcalId);
      if (existing) {
        let dirty = false;
        if (existing.title !== title) { existing.title = title; dirty = true; }
        if (existing.date !== dateStr) { existing.date = dateStr; dirty = true; }
        if (existing.start !== startTime) { existing.start = startTime; dirty = true; }
        if (existing.end !== endTime) { existing.end = endTime; dirty = true; }
        if (existing.description !== description) { existing.description = description; dirty = true; }
        // Preserve local overrides (category, recurrence) — Google wins on core fields only
        existing.updatedAt = Date.now();
        if (dirty) updated++;
      } else {
        stored.push({
          id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
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
        });
        created++;
      }
    }

    stored.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    // Notify calendar to re-render if open
    window.dispatchEvent(new CustomEvent('ncc-cal-updated'));

    return { created, updated };
  }

  function saveStatus(status, importResult) {
    const c = loadSettings().calendarSync || {};
    c.status = status;
    c.lastStatusAt = new Date().toISOString();
    if (status === 'synced') {
      c.lastSynced = new Date().toISOString();
    }
    saveSettings({ calendarSync: c });

    // Update UI
    const badge = document.getElementById('sync-status-badge');
    const dot = document.getElementById('calendar-sync-dot');
    const map = {
      none: { text: 'Not linked', cls: '' },
      linked: { text: 'Linked', cls: 'linked' },
      syncing: { text: 'Syncing…', cls: 'syncing' },
      synced: { text: importResult ? `Synced (+${importResult.created} / ~${importResult.updated})` : 'Synced', cls: 'synced' },
      error: { text: 'Sync error', cls: 'error' },
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
      dot.title = `Google Calendar: ${m.text}`;
    }

    if (status === 'synced') {
      toast(importResult
        ? `Imported ${importResult.created} new, updated ${importResult.updated} events`
        : 'Calendar synced');
    } else if (status === 'error') {
      toast('Calendar sync failed — check API key', 'error');
    }
  }

  // Cleanup on unload
  window.addEventListener('beforeunload', stopAutoSync);
}
