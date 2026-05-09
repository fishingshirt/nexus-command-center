/**
 * Nexus Phone Bridge — ADB Android integration
 * Dashboard: connection status, battery, signal, SMS inbox, compose
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

  // Polling
  refresh();
  const timer = setInterval(refresh, POLL_INTERVAL);

  // Compose
  const sendBtn = document.getElementById('phone-send-btn');
  const toInp = document.getElementById('phone-to');
  const bodyInp = document.getElementById('phone-body');
  sendBtn?.addEventListener('click', () => sendSms(toInp?.value?.trim() || '', bodyInp?.value?.trim() || ''));

  // View switchers
  view.querySelectorAll('.phone-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Cleanup on view hide (simple: leave interval running since view may reappear)
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

  if (cardDot) cardDot.className = `app-card-status ${statusColor}`;
  if (cardText) cardText.textContent = statusText;
}

async function refreshInbox() {
  try {
    const data = await fetchJson('/api/adb/sms/read');
    renderInbox(data.messages || []);
  } catch (e) {
    renderInbox([]);
  }
}

function renderInbox(messages) {
  const list = document.getElementById('phone-inbox');
  if (!list) return;
  if (!messages.length) {
    list.innerHTML = '<div class="phone-empty">No messages on device.</div>';
    return;
  }
  // Merge with local sent log
  const local = lsLoad().sentLog || [];
  const all = [...messages, ...local.map(s => ({ ...s, type: 'sent', from: s.to }))]
    .sort((a, b) => (b.date || b.time || 0) - (a.date || a.time || 0));

  // Group by thread (phone number)
  const threads = {};
  all.forEach(m => {
    const key = m.from || m.to || 'Unknown';
    threads[key] ||= [];
    threads[key].push(m);
  });

  list.innerHTML = Object.entries(threads).map(([num, msgs]) => {
    const last = msgs[0];
    const time = last.date ? fmtDate(last.date) : (last.time ? fmtDate(last.time) : '');
    return `
      <div class="phone-thread" onclick="window.__phoneOpenThread('${esc(num)}')">
        <div class="phone-thread-info">
          <span class="phone-thread-num">${esc(num)}</span>
          <span class="phone-thread-time">${esc(time)}</span>
        </div>
        <div class="phone-thread-preview">${esc((last.body || last.message || '').slice(0, 60))}</div>
        <span class="phone-thread-count">${msgs.length}</span>
      </div>`;
  }).join('');
}

window.__phoneOpenThread = function(num) {
  switchTab('thread');
  const header = document.getElementById('phone-thread-header');
  if (header) header.textContent = `Thread: ${num}`;
  const list = document.getElementById('phone-thread-list');
  if (!list) return;
  const local = lsLoad().sentLog || [];
  const all = [];
  // Server-side messages
  // We re-fetch if needed; for now show merged from localStorage cache
  // In a full implementation we'd keep a server-cache of inbox and merge with local sent
  const cachedInbox = lsLoad().inboxCache || [];
  const msgs = [...cachedInbox.filter(m => (m.from || '').includes(num) || (m.to || '').includes(num)),
                ...local.filter(s => (s.to || '').includes(num))];
  msgs.sort((a, b) => (b.date || b.time || 0) - (a.date || a.time || 0));
  list.innerHTML = msgs.map(m => {
    const isOut = m.type === 'sent' || m.to;
    return `<div class="phone-bubble ${isOut ? 'out' : 'in'}"><span>${esc(m.body || m.message || '')}</span></div>`;
  }).join('');
};

async function sendSms(to, body) {
  if (!to || !body) return;
  const btn = document.getElementById('phone-send-btn');
  if (btn) btn.textContent = 'Sending…';
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
      document.getElementById('phone-body').value = '';
      refreshInbox();
      if (typeof toast !== 'undefined') toast('SMS sent!');
    } else {
      if (typeof toast !== 'undefined') toast(json.error || 'Send failed');
    }
  } catch (e) {
    if (typeof toast !== 'undefined') toast('Send error: ' + e.message);
  }
  if (btn) btn.textContent = 'Send';
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
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function esc(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
