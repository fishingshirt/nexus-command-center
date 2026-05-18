const loadSettings = window.loadSettings || (() => ({}));
const saveSettings = window.saveSettings || (() => {});
const toast = (...args) => (window.toast ? window.toast(...args) : undefined);

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
    { id: 'it-network',title: 'Network / Tailscale', icon: '🌐' },
    { id: 'it-deps',   title: 'Service Matrix', icon: '🔗' },
    { id: 'it-logs',   title: 'Logs & Debug', icon: '📋' },
    { id: 'it-auth',   title: 'Auth & Session', icon: '🔐' },
    { id: 'it-db',     title: 'Database Backups', icon: '💾' },
  ];
  grid.innerHTML = '\
    <div class="it-hub-actions">\
      <button class="it-hub-refresh" id="it-refresh-all" aria-label="Refresh all cards">\
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>\
        Refresh All\
      </button>\
      <button class="it-hub-refresh" id="it-export-status" aria-label="Copy status report">\
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>\
        Copy Status Report\
      </button>\
    </div>' +
  cards.map(c => `
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

  document.getElementById('it-refresh-all')?.addEventListener('click', () => {
    refreshAll();
    if (typeof toast !== 'undefined') toast('IT Hub refreshed');
  });

  document.getElementById('it-export-status')?.addEventListener('click', () => {
    copyStatusReport();
  });

  grid.querySelectorAll('.it-hub-refresh[data-card]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.card;
      refreshCard(id);
    });
  });
}

function refreshAll() {
  ['it-server', 'it-health', 'it-network', 'it-deps', 'it-logs', 'it-auth', 'it-db'].forEach(refreshCard);
}

/* ── Network / Tailscale ───────────────────— */
async function loadNetwork(dot, rows) {
  const data = await fetchJson('/api/system/network');
  const ok = data.tailscale_status === 'up';
  dot.className = ok ? 'it-status-dot green' : data.tailscale_status === 'down' ? 'it-status-dot amber' : 'it-status-dot red';

  if (data.error && data.tailscale_status === 'not_installed') {
    rows.innerHTML = `
      <div class="it-row"><span class="it-label">Tailscale</span><span class="it-value">Not installed</span></div>
      <div class="it-row"><span class="it-label">Peers</span><span class="it-value">—</span></div>
    `;
    return;
  }

  rows.innerHTML = `
    <div class="it-row"><span class="it-label">Tailscale IP</span><span class="it-value">${esc(data.tailscale_ip || '—')}</span></div>
    <div class="it-row"><span class="it-label">Status</span><span class="it-value">${esc(data.tailscale_status)}</span></div>
    <div class="it-row"><span class="it-label">Peers</span><span class="it-value">${data.peers_count}</span></div>
    <div class="it-row"><span class="it-label">MagicDNS</span><span class="it-value">${data.magic_dns ? 'On' : 'Off'}</span></div>
  `;
}
async function loadAuth(dot, rows) {
  let status;
  try { status = await fetchJson('/api/auth/status'); } catch (e) { status = { pinEnabled: false }; }
  const pinOn = status.pinEnabled;
  const settings = loadSettings();
  const lockedApps = settings.lockedApps || {};
  const anyLocked = Object.values(lockedApps).some(Boolean);
  dot.className = pinOn ? (anyLocked ? 'it-status-dot amber' : 'it-status-dot green') : 'it-status-dot gray';

  rows.innerHTML = `
    <div class="it-row"><span class="it-label">PIN Auth</span><span class="it-value">${pinOn ? 'On' : 'Off'}</span></div>
    <div class="it-row"><span class="it-label">Calendar</span><span class="it-value">${lockedApps.calendar ? '🔒 Locked' : '—'}</span></div>
    <div class="it-row"><span class="it-label">Notes</span><span class="it-value">${lockedApps.notes ? '🔒 Locked' : '—'}</span></div>
    <div class="it-row"><span class="it-label">To-Do</span><span class="it-value">${lockedApps.todo ? '🔒 Locked' : '—'}</span></div>
  `;
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
    else if (id === 'it-auth') await loadAuth(dot, rows);
    else if (id === 'it-network') await loadNetwork(dot, rows);
    else if (id === 'it-db') await loadDbBackups(dot, rows);
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

function copyStatusReport() {
  const cards = ['it-server','it-health','it-network','it-deps','it-logs','it-auth','it-db'];
  let markdown = '| Card | Key | Value |\n|------|-----|-------|\n';
  cards.forEach(id => {
    const dot = document.getElementById(`${id}-dot`);
    const rows = document.getElementById(`${id}-rows`);
    if (!dot || !rows) return;
    const cardLabel = document.querySelector(`#${id} h4`)?.textContent?.trim() || id;
    const status = dot.classList.contains('green') ? 'ok' : dot.classList.contains('red') ? 'error' : 'warn';
    rows.querySelectorAll('.it-row').forEach(row => {
      const label = row.querySelector('.it-label')?.textContent?.trim() || '';
      const value = row.querySelector('.it-value')?.textContent?.trim() || '';
      if (label) markdown += `| ${cardLabel} | ${label} | ${value} |\n`;
    });
    if (!rows.querySelectorAll('.it-row').length) {
      markdown += `| ${cardLabel} | status | ${status} |\n`;
    }
  });
  navigator.clipboard.writeText(markdown).then(() => {
    if (typeof toast !== 'undefined') toast('Status report copied');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = markdown;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (typeof toast !== 'undefined') toast('Status report copied');
  });
}

/* ── Database Backups Card ──────────────────── */
async function loadDbBackups(dot, rows) {
  try {
    const data = await fetchJson('/api/db/backups');
    const backups = data.backups || [];
    const ok = backups.length > 0;
    dot.className = ok ? 'it-status-dot green' : 'it-status-dot amber';

    let html = '';
    if (!ok) {
      html = `
        <div class="it-row"><span class="it-label">Status</span><span class="it-value">No backups yet</span></div>
        <div class="it-row"><span class="it-label">Action</span><span class="it-value"><button id="it-db-trigger" class="it-hub-refresh" style="margin:0">Trigger Backup</button></span></div>
      `;
    } else {
      const latest = backups[0];
      const total = backups.length;
      const totalSize = backups.reduce((a, b) => a + (b.bytes || 0), 0);
      const sizeStr = totalSize < 1024**2 ? `${(totalSize/1024).toFixed(1)} KB` : `${(totalSize/1024**2).toFixed(1)} MB`;
      html = `
        <div class="it-row"><span class="it-label">Backups</span><span class="it-value">${total} (${sizeStr})</span></div>
        <div class="it-row"><span class="it-label">Latest</span><span class="it-value">${esc(latest.age_str)} • ${esc(latest.size)}</span></div>
        <div class="it-row"><span class="it-label">File</span><span class="it-value" style="font-size:0.75rem">${esc(latest.filename)}</span></div>
        <div class="it-row"><span class="it-label">Actions</span><span class="it-value"><button id="it-db-trigger" class="it-hub-refresh" style="margin:0 4px 0 0">New</button><button id="it-db-restore" class="it-hub-refresh" style="margin:0">Restore...</button></span></div>
      `;
    }
    rows.innerHTML = html;

    // Wire buttons
    rows.querySelector('#it-db-trigger')?.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/db/trigger-backup', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
        const j = await res.json();
        if (j.ok) { if (typeof toast !== 'undefined') toast('Backup created'); refreshCard('it-db'); }
        else { if (typeof toast !== 'undefined') toast(j.error || 'Backup failed', 'error'); }
      } catch (e) { if (typeof toast !== 'undefined') toast(e.message, 'error'); }
    });
    rows.querySelector('#it-db-restore')?.addEventListener('click', () => showRestoreDialog(backups));
  } catch (e) {
    dot.className = 'it-status-dot red';
    rows.innerHTML = `
      <div class="it-row"><span class="it-label">Error</span><span class="it-value">${esc(e.message)}</span></div>
      <div class="it-row"><span class="it-label">Action</span><span class="it-value"><button id="it-db-trigger" class="it-hub-refresh" style="margin:0">Trigger Backup</button></span></div>
    `;
    rows.querySelector('#it-db-trigger')?.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/db/trigger-backup', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
        const j = await res.json();
        if (j.ok) { if (typeof toast !== 'undefined') toast('Backup created'); refreshCard('it-db'); }
      } catch (err) {}
    });
  }
}

function showRestoreDialog(backups) {
  if (!backups || !backups.length) return;
  // Remove existing
  document.getElementById('it-db-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'it-db-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;justify-content:center;align-items:center;background:rgba(0,0,0,0.7);';
  modal.innerHTML = `
    <div style="background:var(--surface-1,#11111a);border:1px solid var(--border,#1f1f2e);border-radius:12px;padding:1.5rem;max-width:420px;width:90%;max-height:80vh;overflow:auto;">
      <h3 style="margin:0 0 1rem;color:var(--accent,#39d0f2);">↩️ Restore Database</h3>
      <p style="margin:0 0 1rem;color:#888;font-size:0.9rem;">⚠️ This will overwrite the current database with a backup copy. A safety backup of the current DB will be created first.</p>
      <div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem;">
        ${backups.slice(0,10).map((b,i) => `
          <label style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem;background:var(--surface-0,#0a0a0f);border-radius:8px;cursor:pointer;border:2px solid ${i===0?'var(--accent,#39d0f2)':'transparent'};">
            <input type="radio" name="it-db-restore-pick" value="${esc(b.filename)}" ${i===0?'checked':''} style="accent-color:var(--accent,#39d0f2);">
            <div style="flex:1">
              <div style="font-size:0.85rem;color:#e2e8f0;">${esc(b.filename)}</div>
              <div style="font-size:0.75rem;color:#64748b;">${esc(b.size)} • ${esc(b.age_str)}</div>
            </div>
          </label>
        `).join('')}
      </div>
      <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
        <button id="it-db-cancel" class="it-hub-refresh">Cancel</button>
        <button id="it-db-confirm" class="it-hub-refresh" style="background:var(--accent,#39d0f2);color:#000;font-weight:600;">Restore Now</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#it-db-cancel')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#it-db-confirm')?.addEventListener('click', async () => {
    const pick = modal.querySelector('input[name="it-db-restore-pick"]:checked');
    if (!pick) { if (typeof toast !== 'undefined') toast('Select a backup', 'error'); return; }
    const filename = pick.value;
    modal.remove();
    if (typeof toast !== 'undefined') toast('Restoring...');
    try {
      const res = await fetch('/api/db/restore-file', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ filename })
      });
      const j = await res.json();
      if (j.ok) {
        if (typeof toast !== 'undefined') toast(`Restored ${esc(filename)}. Restart server to ensure clean state.`);
        refreshCard('it-db');
      } else {
        if (typeof toast !== 'undefined') toast(j.error || 'Restore failed', 'error');
      }
    } catch (e) { if (typeof toast !== 'undefined') toast(e.message, 'error'); }
  });
}
