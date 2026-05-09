import { loadSettings, saveSettings, toast } from '../app.js';

const LS_KEY = 'ncc-it-hub';
const REFRESH_INTERVAL = 10000;

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function lsSave(patch) {
  localStorage.setItem(LS_KEY, JSON.stringify({ ...lsLoad(), ...patch }));
}

export function initITHub() {
  const view = document.getElementById('view-backup');
  if (!view) return;
  const body = view.querySelector('.backup-view-body');
  if (!body) return;

  // If IT Hub grid already injected, skip
  if (body.querySelector('.it-hub-grid')) return;

  const grid = document.createElement('div');
  grid.className = 'it-hub-grid';
  grid.id = 'it-hub-grid';
  body.insertBefore(grid, body.firstChild);

  renderCards(grid);
  refreshAll();

  // Auto-refresh
  setInterval(refreshAll, REFRESH_INTERVAL);
}

function renderCards(grid) {
  const cards = [
    { id: 'it-server', title: 'Server Status', icon: '🖥️' },
    { id: 'it-health', title: 'System Health', icon: '⚡' },
    { id: 'it-deps',   title: 'Service Matrix', icon: '🔗' },
    { id: 'it-logs',   title: 'Logs & Debug', icon: '📋' },
  ];
  grid.innerHTML = cards.map(c => `
    <div class="it-card" id="${c.id}">
      <div class="it-card-header">
        <span class="it-status-dot gray" id="${c.id}-dot"></span>
        <h4>${c.icon} ${esc(c.title)}</h4>
      </div>
      <div class="it-card-rows" id="${c.id}-rows">
        <div class="it-card-placeholder">Loading...</div>
      </div>
      <button class="it-hub-refresh" data-card="${c.id}" aria-label="Refresh ${c.title}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        Refresh
      </button>
    </div>
  `).join('');

  grid.querySelectorAll('.it-hub-refresh').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.card;
      refreshCard(id);
    });
  });
}

function refreshAll() {
  ['it-server', 'it-health', 'it-deps', 'it-logs'].forEach(refreshCard);
}

async function refreshCard(id) {
  const dot = document.getElementById(`${id}-dot`);
  const rows = document.getElementById(`${id}-rows`);
  if (!dot || !rows) return;

  dot.className = 'it-status-dot amber';
  rows.innerHTML = '<div class="it-card-placeholder">Loading...</div>';

  try {
    if (id === 'it-server') await loadServerStatus(dot, rows);
    else if (id === 'it-health') await loadHealth(dot, rows);
    else if (id === 'it-deps') await loadDeps(dot, rows);
    else if (id === 'it-logs') await loadLogs(dot, rows);
  } catch (e) {
    dot.className = 'it-status-dot red';
    rows.innerHTML = `<div class="it-card-placeholder">Error: ${esc(e.message)}</div>`;
  }
}

/* ── Server Status ─────────────────────────── */
async function loadServerStatus(dot, rows) {
  const data = await fetchJson('/api/server/status');
  dot.className = 'it-status-dot green';
  rows.innerHTML = `
    <div class="it-row"><span class="it-label">PID</span><span class="it-value">${esc(data.pid)}</span></div>
    <div class="it-row"><span class="it-label">Port</span><span class="it-value">${esc(data.port)}</span></div>
    <div class="it-row"><span class="it-label">Uptime</span><span class="it-value">${fmtDuration(data.uptime_seconds)}</span></div>
    <div class="it-row"><span class="it-label">Branch</span><span class="it-value">${esc(data.git_branch)}</span></div>
    <div class="it-row"><span class="it-label">Commit</span><span class="it-value">${esc(data.last_commit)}</span></div>
    <div class="it-row"><span class="it-label">Uncommitted</span><span class="it-value">${data.uncommitted_count}</span></div>
  `;
}

/* ── System Health ─────────────────────────── */
async function loadHealth(dot, rows) {
  const data = await fetchJson('/api/system/health');
  dot.className = 'it-status-dot green';
  rows.innerHTML = `
    <div class="it-row"><span class="it-label">CPU</span><span class="it-value">${data.cpu_percent ?? '—'}%</span></div>
    <div class="it-row"><span class="it-label">RAM</span><span class="it-value">${data.ram_percent ?? '—'}%</span></div>
    <div class="it-row"><span class="it-label">Disk</span><span class="it-value">${data.disk_percent ?? '—'}%</span></div>
    <div class="it-row"><span class="it-label">Load 1m</span><span class="it-value">${data.load_avg_1m ?? '—'}</span></div>
    <div class="it-row"><span class="it-label">Uptime</span><span class="it-value">${fmtDuration(data.uptime_seconds)}</span></div>
  `;
}

/* ── Service Matrix ────────────────────────── */
async function loadDeps(dot, rows) {
  const data = await fetchJson('/api/system/deps');
  if (!data.services) { dot.className = 'it-status-dot gray'; rows.innerHTML = '<div class="it-card-placeholder">No data</div>'; return; }

  const allOk = data.services.every(s => s.status === 'ok');
  const anyErr = data.services.some(s => s.status === 'error');
  dot.className = anyErr ? 'it-status-dot red' : allOk ? 'it-status-dot green' : 'it-status-dot amber';

  rows.innerHTML = `
    <div class="it-dep-grid">
      ${data.services.map(s => `
        <div class="it-dep-cell ${s.status}" title="${esc(s.message)}">
          <span class="it-dep-icon">${s.status === 'ok' ? '✓' : s.status === 'warn' ? '⚠' : '✗'}</span>
          <span>${esc(s.name)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/* ── Logs ──────────────────────────────────── */
async function loadLogs(dot, rows) {
  const data = await fetchJson('/api/system/logs');
  dot.className = 'it-status-dot green';
  const lines = (data.errors_log_tail || []).map(l => `<div class="it-row" style="font-size:0.75rem;opacity:0.9;">${esc(l)}</div>`).join('');
  rows.innerHTML = lines || '<div class="it-card-placeholder">No recent errors</div>';
}

/* ── Helpers ───────────────────────────────── */
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`HTTP ${res.status} ${t}`); }
  return res.json();
}

function fmtDuration(sec) {
  if (!sec && sec !== 0) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function esc(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
