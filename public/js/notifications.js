import { loadSettings } from './app.js';

const STORAGE_KEY = 'ncc-notifications';
const MAX_ITEMS = 100;
let _audioCtx = null;
let _lastDedupe = new Map(); // key -> timestamp

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _save(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_ITEMS)));
}

function _genId() {
  return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function _dedupeKey(n) {
  return `${n.app}::${n.title}::${n.body}`;
}

function _shouldPlaySound() {
  const s = loadSettings();
  if (s.notificationSound === false) return false;
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mediaQuery.matches) return false;
  return true;
}

function _shouldBrowserPush() {
  const s = loadSettings();
  return s.browserPush === true && 'Notification' in window && Notification.permission === 'granted';
}

function _playBeep() {
  if (!_shouldPlaySound()) return;
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    // ignore audio errors
  }
}

function _browserPush(title, body) {
  if (!_shouldBrowserPush()) return;
  try {
    new Notification(title, { body, icon: '/assets/icons/icon-192.png' });
  } catch (e) {
    // ignore push errors
  }
}

export function notify({ title = '', body = '', app = 'system', priority = 'normal' }) {
  const key = `${app}::${title}::${body}`;
  const now = Date.now();
  const last = _lastDedupe.get(key);
  if (last && now - last < 10000) return null; // 10s dedupe
  _lastDedupe.set(key, now);
  // Clean old dedupe entries every so often
  if (Math.random() < 0.1) {
    for (const [k, t] of _lastDedupe) {
      if (now - t > 30000) _lastDedupe.delete(k);
    }
  }

  const note = {
    id: _genId(),
    title,
    body,
    app,
    priority,
    read: false,
    timestamp: now
  };

  const list = _load();
  list.push(note);
  if (list.length > MAX_ITEMS) list.splice(0, list.length - MAX_ITEMS);
  _save(list);

  _playBeep();
  _browserPush(title, body);

  // Dispatch event so UI can react immediately
  document.dispatchEvent(new CustomEvent('nexusNotification', { detail: note }));

  return note;
}

export function getNotifications() {
  return _load();
}

export function markRead(id) {
  const list = _load();
  const n = list.find(x => x.id === id);
  if (n) { n.read = true; _save(list); }
  return n || null;
}

export function dismiss(id) {
  const list = _load().filter(x => x.id !== id);
  _save(list);
  return list;
}

export function clearAll() {
  _save([]);
  return [];
}

export function getUnreadCount() {
  return _load().filter(x => !x.read).length;
}
