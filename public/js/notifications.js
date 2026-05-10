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

/* ===== UI WIRING ===== */
const APP_ICONS = {
  calendar: '📅', notes: '📝', todo: '✅', chat: '💬',
  weather: '☀️', phone: '📱', feedback: '💬', arcade: '🎮',
  finance: '💰', pomodoro: '🍅', system: '◈', agent: '🤖'
};

function _relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 7200) return '1 hour ago';
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return 'Yesterday';
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function _groupLabel(ts) {
  const now = new Date();
  const d = new Date(ts);
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (sameDay) return 'Today';
  const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (d.getDate() === yest.getDate() && d.getMonth() === yest.getMonth() && d.getFullYear() === yest.getFullYear()) return 'Yesterday';
  return 'Earlier';
}

export function initNotifications() {
  const bell = document.getElementById('header-bell-btn');
  const badge = document.getElementById('notification-badge');
  const panel = document.getElementById('notification-panel');
  const backdrop = document.getElementById('notification-backdrop');
  const closeBtn = document.getElementById('notification-close');
  const clearBtn = document.getElementById('notification-clear-all');
  const gearBtn = document.getElementById('notification-gear');
  const list = document.getElementById('notification-list');

  if (!bell || !panel || !list) return;

  function updateBadge() {
    const count = getUnreadCount();
    if (badge) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.toggle('hidden', count === 0);
    }
  }

  function open() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    bell.setAttribute('aria-expanded', 'true');
    document.body.classList.add('panel-open');
    renderList();
    // focus first focusable item or close button
    setTimeout(() => {
      const first = panel.querySelector('.notification-close, .notification-item, .notification-clear');
      if (first) first.focus();
    }, 50);
  }

  function close() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    bell.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('panel-open');
    bell.focus();
  }

  function renderList() {
    const items = getNotifications().slice().reverse();
    if (!items.length) {
      list.innerHTML = '<div class="notification-empty">All caught up 🎉</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    let lastGroup = null;
    items.forEach(n => {
      const group = _groupLabel(n.timestamp);
      if (group !== lastGroup) {
        const lbl = document.createElement('div');
        lbl.className = 'notification-group-label';
        lbl.textContent = group;
        frag.appendChild(lbl);
        lastGroup = group;
      }
      const row = document.createElement('div');
      row.className = 'notification-item' + (n.read ? '' : ' unread');
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-label', `${n.title}. ${n.body}`);
      const icon = APP_ICONS[n.app] || APP_ICONS.system;
      row.innerHTML = `
        <span class="notification-icon">${icon}</span>
        <div class="notification-body">
          <div class="notification-title">
            ${n.read ? '' : '<span class="notification-blue-dot" aria-hidden="true"></span>'}
            <span class="notification-title-text">${escapeHtml(n.title)}</span>
          </div>
          <div class="notification-desc">${escapeHtml(n.body)}</div>
          <div class="notification-meta">${_relativeTime(n.timestamp)}</div>
        </div>
        <button class="notification-dismiss" data-id="${n.id}" aria-label="Dismiss notification">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
      // Mark read on click / Enter
      row.addEventListener('click', e => {
        if (e.target.closest('.notification-dismiss')) return;
        markRead(n.id);
        row.classList.remove('unread');
        const dot = row.querySelector('.notification-blue-dot');
        if (dot) dot.remove();
        updateBadge();
      });
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          row.click();
        }
      });
      // Dismiss button
      const dismissBtn = row.querySelector('.notification-dismiss');
      dismissBtn.addEventListener('click', e => {
        e.stopPropagation();
        dismiss(n.id);
        row.remove();
        updateBadge();
        if (!getNotifications().length) renderList();
      });
      frag.appendChild(row);
    });
    list.innerHTML = '';
    list.appendChild(frag);
  }

  bell.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
  clearBtn?.addEventListener('click', () => {
    clearAll();
    renderList();
    updateBadge();
  });
  gearBtn?.addEventListener('click', () => {
    close();
    location.hash = 'settings';
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('open')) close();
  });

  document.addEventListener('nexusNotification', () => {
    updateBadge();
    if (panel.classList.contains('open')) renderList();
  });

  updateBadge();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
