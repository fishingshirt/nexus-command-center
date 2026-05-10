import { toast } from '../app.js';

const SETTINGS_KEY = 'ncc-settings';
const QUEUE_KEY = 'ncc-calendar-sync-queue';

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

function isLinkedWritable() {
  const s = loadSettings().calendarSync || {};
  return s.status && s.status !== 'none' && s.status !== 'error' && s.status !== 'read-only';
}

function buildBody(payload) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = payload.start
    ? { dateTime: `${payload.date}T${payload.start}:00`, timeZone: tz }
    : { date: payload.date };
  const end = payload.end
    ? { dateTime: `${payload.date}T${payload.end}:00`, timeZone: tz }
    : { date: payload.date };
  return { summary: payload.title, description: payload.description || '', start, end };
}

export async function syncEventToGoogle(payload, action) {
  if (!isLinkedWritable()) return { ok: true, skipped: true };
  const path = action === 'create'
    ? '/api/calendar/events'
    : `/api/calendar/events/${encodeURIComponent(payload.gcalId || '')}`;
  const method = action === 'create' ? 'POST' : 'PATCH';
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody(payload)),
    });
    const data = await res.json();
    if (data.ok) return { ok: true, gcalId: data.eventId };
    throw new Error(data.error || `HTTP ${res.status}`);
  } catch (err) {
    queueMutation({ action, payload, timestamp: Date.now() });
    toast('Offline — event queued for sync', 'warning');
    return { ok: false, queued: true, error: err.message };
  }
}

export async function deleteEventFromGoogle(gcalId) {
  if (!gcalId || !isLinkedWritable()) return { ok: true, skipped: true };
  try {
    const res = await fetch(`/api/calendar/events/${encodeURIComponent(gcalId)}`, { method: 'DELETE' });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  } catch (err) {
    queueMutation({ action: 'delete', payload: { gcalId }, timestamp: Date.now() });
    toast('Offline — delete queued for sync', 'warning');
    return { ok: false, queued: true, error: err.message };
  }
}

function queueMutation(m) {
  const q = loadQueue();
  m.retryCount = (m.retryCount || 0);
  q.push(m);
  if (q.length > 100) q.shift();
  saveQueue(q);
}

export async function flushOutboundQueue() {
  const q = loadQueue();
  if (!q.length) return { flushed: 0, dropped: 0, remaining: 0 };
  let flushed = 0, dropped = 0;
  const remaining = [];
  for (const m of q) {
    let ok = false;
    try {
      if (m.action === 'create' || m.action === 'update') {
        const r = await syncEventToGoogle(m.payload, m.action);
        ok = r.ok && !r.queued;
      } else if (m.action === 'delete') {
        const r = await deleteEventFromGoogle(m.payload.gcalId);
        ok = r.ok && !r.queued;
      }
    } catch (e) { ok = false; }
    if (ok) {
      flushed++;
    } else {
      m.retryCount = (m.retryCount || 0) + 1;
      if (m.retryCount >= 3) {
        dropped++;
      } else {
        remaining.push(m);
      }
    }
  }
  saveQueue(remaining);
  if (flushed) toast(`${flushed} queued changes synced`);
  if (dropped) toast(`${dropped} queued items permanently failed after 3 retries`, 'error');
  if (remaining.length) toast(`${remaining.length} items still queued — offline?`, 'warning');
  const detail = { flushed, dropped, remaining: remaining.length };
  window.dispatchEvent(new CustomEvent('ncc-calendar-outbound-flushed', { detail }));
  return detail;
}
