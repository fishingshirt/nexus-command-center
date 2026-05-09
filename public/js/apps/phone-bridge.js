/**
 * Nexus Phone Bridge — ADB Android integration
 * Dashboard: connection status, battery, signal, SMS inbox, compose, threads
 */
const LS_KEY = 'ncc-phone-bridge';
const POLL_INTERVAL = 10000;

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function lsSave(patch) {
  localStorage.setItem(LS_KEY, JSON.stringify({ ...lsLoad(), ...patch }));
}

export function initPhoneBridge() {
  const view = document.getElementById('view-phone');
  if (!view) return;

  refresh();
  const timer = setInterval(refresh, POLL_INTERVAL);

  // Compose
  const sendBtn = document.getElementById('phone-send-btn');
  const toInp = document.getElementById('phone-to');
  const bodyInp = document.getElementById('phone-body');
  sendBtn?.addEventListener('click', () => {
    sendSms(toInp?.value?.trim() || '', bodyInp?.value?.trim() || '');
  });

  // Character counter for compose
  bodyInp?.addEventListener('input', () => {
    const len = bodyInp.value.length;
    let counter = document.getElementById('phone-compose-counter');
    if (!counter) {
      counter = document.createElement('div');
      counter.id = 'phone-compose-counter';
      counter.className = 'phone-compose-counter';
      bodyInp.parentNode.insertBefore(counter, sendBtn);
    }
    counter.textContent = `${len}/160`;
    counter.classList.toggle('over-limit', len > 160);
  });

  // View switchers
  view.querySelectorAll('.phone-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Thread reply send
  const threadSendBtn = document.getElementById('phone-thread-send-btn');
  const threadBody = document.getElementById('phone-thread-body');
  threadSendBtn?.addEventListener('click', () => {
    const num = threadBody?.dataset?.threadNumber;
    const text = threadBody?.value?.trim();
    if (num && text) {
      sendSms(num, text, true);
    }
  });

  window.addEventListener('beforeunload', () => clearInterval(timer));
}

async function refresh() {
  try {
    const data = await fetchJson('/api/adb/status');
    updateStatus(data);
    if (data.connected) {
      await refreshInbox();
    }
  } catch (e) {
    updateStatus({ connected: false, error: 'Server error', adbInstalled: false });
  }
}

function updateStatus(data) {
  const dot = document.getElementById('phone-status-dot');
  const label = document.getElementById('phone-status-label');
  const serial = document.getElementById('phone-serial');
  const battery = document.getElementById('phone-battery-val');
  const signal = document.getElementById('phone-signal-val');
  const bar = document.getElementById('phone-battery-bar');
  const adbStatus = document.getElementById('phone-adb-status');

  // Dashboard card summary
  const cardDot = document.getElementById('phone-card-dot');
  const cardText = document.getElementById('phone-card-text');

  let statusColor = 'gray';
  let statusText = 'No device';

  if (!data.adbInstalled) {
    statusColor = 'red';
    statusText = 'ADB not installed';
  } else if (data.connected) {
    statusColor = 'green';
    statusText = 'Connected';
  } else if (data.error && data.error.includes('No device')) {
    statusColor = 'amber';
    statusText = 'Disconnected';
  } else {
    statusColor = 'red';
    statusText = data.error || 'Error';
  }

  if (dot) dot.className = `phone-dot ${statusColor}`;
  if (label) label.textContent = statusText;
  if (serial) serial.textContent = data.serial || '—';
  if (battery) battery.textContent = data.battery != null ? `${data.battery}%` : '—';
  if (signal) signal.textContent = data.signal != null ? `${data.signal} dBm` : '—';
  if (bar) {
    const pct = data.battery != null ? data.battery : 0;
    bar.style.width = `${pct}%`;
    bar.dataset.level = pct < 20 ? 'low' : pct < 50 ? 'mid' : 'good';
  }
  if (adbStatus) adbStatus.textContent = data.adbInstalled ? 'Ready' : 'Missing';

  if (cardDot) cardDot.className = `app-card-status ${statusColor}`;
  if (cardText) cardText.textContent = statusText;
}

async function refreshInbox() {
  try {
    const data = await fetchJson('/api/adb/sms/read');
    const messages = data.messages || [];
    lsSave({ inboxCache: messages });
    renderInbox(messages);
  } catch (e) {
    // If server fails, try cached
    renderInbox(lsLoad().inboxCache || []);
  }
}

function normalizeNumber(num) {
  return (num || '').replace(/\D/g, '').slice(-10);
}

function getDisplayName(num) {
  if (!num) return 'Unknown';
  // Try local contact map if ever stored
  const contacts = lsLoad().contacts || {};
  if (contacts[normalizeNumber(num)]) return contacts[normalizeNumber(num)];
  return num;
}

function renderInbox(messages) {
  const list = document.getElementById('phone-inbox');
  if (!list) return;

  const localSent = lsLoad().sentLog || [];
  const all = [...messages];

  // Merge sent messages into the all array
  localSent.forEach(s => {
    all.push({
      from: s.to,
      to: s.to,
      date: s.time,
      body: s.body,
      type: 'sent'
    });
  });

  if (!all.length) {
    list.innerHTML = '<div class="phone-empty">No messages on device.</div>';
    return;
  }

  // Sort newest first
  all.sort((a, b) => (b.date || 0) - (a.date || 0));

  // Group by phone number
  const threads = {};
  all.forEach(m => {
    const key = normalizeNumber(m.from || m.to);
    if (!key) return;
    threads[key] ||= { num: m.from || m.to, msgs: [] };
    threads[key].msgs.push(m);
  });

  list.innerHTML = Object.values(threads).map(thread => {
    const last = thread.msgs[0];
    const time = fmtDate(last.date);
    const preview = (last.body || '').slice(0, 70);
    const displayName = getDisplayName(thread.num);
    return `
      <div class="phone-thread" data-num="${esc(thread.num)}" role="button" tabindex="0" aria-label="Thread with ${esc(displayName)}">
        <div class="phone-thread-info">
          <span class="phone-thread-name">${esc(displayName)}</span>
          <span class="phone-thread-time">${esc(time)}</span>
        </div>
        <div class="phone-thread-preview">${esc(preview)}${preview.length >= 70 ? '…' : ''}</div>
        <span class="phone-thread-count">${thread.msgs.length}</span>
      </div>`;
  }).join('');

  // Wire click handlers
  list.querySelectorAll('.phone-thread').forEach(el => {
    const open = () => openThread(el.dataset.num);
    el.addEventListener('click', open);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });
}

function openThread(num) {
  switchTab('thread');
  const header = document.getElementById('phone-thread-header');
  if (header) header.textContent = getDisplayName(num);

  const list = document.getElementById('phone-thread-list');
  if (!list) return;

  // Update reply box target
  const replyBox = document.getElementById('phone-thread-body');
  if (replyBox) replyBox.dataset.threadNumber = num;

  const cachedInbox = lsLoad().inboxCache || [];
  const localSent = lsLoad().sentLog || [];
  const norm = normalizeNumber(num);

  const msgs = [
    ...cachedInbox.filter(m => normalizeNumber(m.from) === norm || normalizeNumber(m.to) === norm),
    ...localSent.filter(s => normalizeNumber(s.to) === norm).map(s => ({
      from: s.to,
      to: s.to,
      date: s.time,
      body: s.body,
      type: 'sent'
    }))
  ];

  msgs.sort((a, b) => (a.date || 0) - (b.date || 0));

  list.innerHTML = msgs.map(m => {
    const isOut = m.type === 'sent' || m.to;
    const time = fmtTime(m.date);
    return `
      <div class="phone-bubble-wrap ${isOut ? 'out' : 'in'}">
        <div class="phone-bubble ${isOut ? 'out' : 'in'}">
          <span>${esc(m.body || m.message || '')}</span>
          <span class="phone-bubble-time">${esc(time)}</span>
        </div>
      </div>`;
  }).join('');

  // Scroll to bottom
  const container = document.getElementById('phone-thread-scroll');
  (container || list).scrollTop = (container || list).scrollHeight;
}

async function sendSms(to, body, fromThread = false) {
  if (!to || !body) return;
  const btn = fromThread
    ? document.getElementById('phone-thread-send-btn')
    : document.getElementById('phone-send-btn');
  const originalText = btn?.textContent || 'Send';
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    const res = await fetch('/api/adb/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, body })
    });
    const json = await res.json();
    if (json.ok) {
      const log = lsLoad().sentLog || [];
      log.push({ to, body, time: Date.now() });
      lsSave({ sentLog: log.slice(-200) });

      // Clear inputs
      if (!fromThread) {
        const bodyInp = document.getElementById('phone-body');
        if (bodyInp) bodyInp.value = '';
        const counter = document.getElementById('phone-compose-counter');
        if (counter) counter.textContent = '0/160';
      } else {
        const replyBox = document.getElementById('phone-thread-body');
        if (replyBox) replyBox.value = '';
      }

      // Refresh views
      await refreshInbox();
      if (fromThread) openThread(to);

      if (typeof toast !== 'undefined') toast('SMS sent!');
    } else {
      if (typeof toast !== 'undefined') toast(json.error || 'Send failed', 'error');
    }
  } catch (e) {
    if (typeof toast !== 'undefined') toast('Send error: ' + e.message, 'error');
  }

  if (btn) { btn.disabled = false; btn.textContent = originalText; }
}

function switchTab(tab) {
  document.querySelectorAll('.phone-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.phone-tab-panel').forEach(p => p.classList.toggle('active', p.id === `phone-panel-${tab}`));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`HTTP ${res.status} ${t}`); }
  return res.json();
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now - 86400000).toDateString() === d.toDateString();
  if (isToday) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function esc(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
