/* ─── IT Hub — Backup System ─────────────────────── */
// Self-contained — helper imports injected at runtime by the app

const BACKUP_LOG_KEY = 'ncc-backup-log';
const BACKUP_CONFIG_KEY = 'ncc-backup-config';

export function initBackup() {
  renderBackupIcon();
  initBackupView();
  startUsbPoller();
}

function _toast(msg, type) {
  // Fall back to global toast or console
  if (typeof toast !== 'undefined') toast(msg, type);
  else if (typeof window !== 'undefined' && window.toast) window.toast(msg, type);
}

/* ── Dashboard Card ─────────────────────────── */
function renderBackupIcon() {
  const grid = document.getElementById('app-grid');
  if (!grid || document.querySelector('[data-app="backup"]')) return;

  const card = document.createElement('div');
  card.className = 'app-card';
  card.dataset.app = 'backup';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', 'Open IT Hub Backup');
  card.innerHTML = `
    <div class="app-card-icon" style="--card-accent: #22d3ee;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/>
        <path d="M14 2v6h6"/>
        <path d="M2 15h10"/>
        <path d="m5 12-3 3 3 3"/>
        <path d="m9 18 3-3-3-3"/>
      </svg>
    </div>
    <div class="app-card-info">
      <h3>IT Hub</h3>
      <p>Backup &amp; Protect</p>
    </div>
    <div class="app-card-badge" id="backup-badge">0</div>
  `;
  card.addEventListener('click', () => { location.hash = 'backup'; });
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.hash = 'backup'; }
  });

  // Visibility based on saved settings
  const s = JSON.parse(localStorage.getItem('ncc-settings') || '{}');
  card.style.display = s.itHubVisible === true ? '' : 'none';

  const fb = document.querySelector('[data-app="feedback"]');
  if (fb) grid.insertBefore(card, fb);
  else grid.appendChild(card);
}

/* ── Backup View ────────────────────────────── */
function initBackupView() {
  const main = document.getElementById('app-main');
  if (!main || document.getElementById('view-backup')) return;

  const view = document.createElement('div');
  view.id = 'view-backup';
  view.className = 'view';
  view.innerHTML = `
    <div class="view-header">
      <button class="view-back" data-view="dashboard" aria-label="Back to dashboard">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      </button>
      <h2>IT Hub — Backup System</h2>
    </div>
    <div class="view-body backup-view-body">
      <div class="backup-brain-banner">
        <div class="backup-brain-icon">🧠</div>
        <div class="backup-brain-text">
          <strong>Backup my brain.</strong>
          <span>Everything I've learned, every key, every config — don't let it vanish. Protect the work.</span>
        </div>
      </div>

      <div class="backup-status-panel" id="backup-status-panel">
        <div class="backup-status-row">
          <span class="backup-status-label">Last Backup</span>
          <span class="backup-status-value" id="backup-last-time">Never</span>
        </div>
        <div class="backup-status-row">
          <span class="backup-status-label">Backup Size</span>
          <span class="backup-status-value" id="backup-last-size">—</span>
        </div>
        <div class="backup-status-row">
          <span class="backup-status-label">USB Device</span>
          <span class="backup-status-value" id="backup-usb-status">Scanning...</span>
        </div>
        <div class="backup-status-row">
          <span class="backup-status-label">Cloud Sync</span>
          <span class="backup-status-value" id="backup-cloud-status">Not configured</span>
        </div>
        <div class="backup-status-row">
          <span class="backup-status-label">Health</span>
          <span class="backup-status-value" id="backup-health-status"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#94a3b8;margin-right:6px"></span>Checking…</span>
        </div>
      </div>

      <div class="backup-actions">
        <button class="backup-action-btn btn-primary" id="btn-backup-now" title="Create encrypted backup now">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Backup Now
        </button>
        <button class="backup-action-btn btn-secondary" id="btn-backup-local" title="Backup to USB/local drive">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/></svg>
          USB Drive
        </button>
        <button class="backup-action-btn btn-secondary" id="btn-backup-cloud" title="Sync to encrypted cloud">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
          Cloud Vault
        </button>
      </div>

      <div class="backup-section">
        <h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/></svg> USB Targets</h3>
        <div class="backup-usb-list" id="backup-usb-list">
          <div class="backup-empty">Scanning for USB drives...</div>
        </div>
      </div>

      <div class="backup-section">
        <h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg> Cloud Vault</h3>
        <form class="backup-form" id="backup-cloud-form">
          <label class="backup-field">
            <span>Provider</span>
            <select id="cloud-provider">
              <option value="">None (local only)</option>
              <option value="rclone">rclone</option>
              <option value="rsync+ssh">rsync + SSH</option>
              <option value="s3">S3-compatible</option>
            </select>
          </label>
          <label class="backup-field" id="cloud-path-field">
            <span>Remote Path / Bucket</span>
            <input type="text" id="cloud-path" placeholder="mybackup:nexus/ or user@host:/path">
          </label>
          <label class="backup-field">
            <span><span>Encryption Passphrase</span><span class="backup-encrypt-note">🔒 AES-256-GPG before upload</span></span>
            <input type="password" id="cloud-passphrase" placeholder="Min 8 chars — this encrypts your backup">
          </label>
          <div class="backup-field-check">
            <input type="checkbox" id="cloud-auto-sync">
            <label for="cloud-auto-sync">Auto-sync daily at 3 AM</label>
          </div>
          <div class="backup-form-actions">
            <button type="submit" class="btn-primary">Save Cloud Config</button>
          </div>
        </form>
      </div>

      <div class="backup-section">
        <h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> History</h3>
        <ul class="backup-history" id="backup-history"></ul>
      </div>
    </div>
  `;
  main.appendChild(view);

  document.getElementById('btn-backup-now').addEventListener('click', () => runSystemBackup('full'));
  document.getElementById('btn-backup-local').addEventListener('click', () => runSystemBackup('full'));
  document.getElementById('btn-backup-cloud').addEventListener('click', () => runSystemBackup('full'));
  document.getElementById('backup-cloud-form').addEventListener('submit', saveCloudConfig);

  loadBackupConfig();
  loadBackupHistory();
  refreshUsbList();
  refreshStatusPanel();
}

/* ── System Backup Logic (calls nexus_backup.py) ── */
async function runSystemBackup(scope) {
  const btns = ['btn-backup-now', 'btn-backup-local', 'btn-backup-cloud'];
  btns.forEach(id => { const b = document.getElementById(id); if (b) b.disabled = true; });
  const nowBtn = document.getElementById('btn-backup-now');
  if (nowBtn) nowBtn.innerHTML = '<span class="backup-spinner"></span> Creating system backup...';

  try {
    const resp = await fetch('/api/db/trigger-backup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope })
    });
    const data = await resp.json();
    if (data.ok) {
      _toast(`System backup created: ${data.backup.filename} (${data.backup.size})`);
      addBackupLog({ type: 'system', target: data.backup.scope, size: data.backup.size, time: new Date().toISOString(), status: 'ok' });
    } else {
      _toast(`Backup failed: ${data.error || 'unknown'}`, 'error');
      addBackupLog({ type: 'system', target: scope, time: new Date().toISOString(), status: 'error', error: data.error });
    }
  } catch (e) {
    _toast(`Backup error: ${e.message}`, 'error');
    addBackupLog({ type: 'system', target: scope, time: new Date().toISOString(), status: 'error', error: e.message });
  }

  if (nowBtn) nowBtn.innerHTML = 'Backup Now';
  btns.forEach(id => { const b = document.getElementById(id); if (b) b.disabled = false; });
  loadBackupHistory();
  refreshStatusPanel();
}

/* ── USB Polling ───────────────────────────── */
function startUsbPoller() {
  refreshUsbList();
  setInterval(refreshUsbList, 10000);
}

async function refreshUsbList() {
  const list = document.getElementById('backup-usb-list');
  if (!list) return;
  try {
    const data = await (await fetch('/api/backup/usb')).json();
    if (data.drives && data.drives.length) {
      list.innerHTML = data.drives.map(d => `
        <div class="backup-usb-item" data-path="${esc(d.path)}" tabindex="0">
          <div class="backup-usb-icon">💾</div>
          <div class="backup-usb-info">
            <div class="backup-usb-name">${esc(d.label || 'Unknown Drive')}</div>
            <div class="backup-usb-detail">${esc(d.size || '?')} • ${esc(d.fstype || '')}</div>
          </div>
          <div class="backup-usb-status">${d.mounted ? 'Ready' : 'Unmounted'}</div>
        </div>
      `).join('');
      list.querySelectorAll('.backup-usb-item').forEach(item => {
        item.addEventListener('click', () => {
          list.querySelectorAll('.backup-usb-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          _toast(`USB target: ${item.querySelector('.backup-usb-name').textContent}`);
        });
      });
      const st = document.getElementById('backup-usb-status');
      if (st) st.textContent = `${data.drives.length} drive(s) found`;
    } else {
      list.innerHTML = '<div class="backup-empty">No USB drives detected. Plug one in to see it here.</div>';
      const st = document.getElementById('backup-usb-status');
      if (st) st.textContent = 'No USB drives';
    }
  } catch {
    list.innerHTML = '<div class="backup-empty">Connect to server to scan USB drives.</div>';
    const st = document.getElementById('backup-usb-status');
    if (st) st.textContent = 'Server offline';
  }
}

/* ── Config ────────────────────────────────── */
function loadBackupConfig() {
  try { return JSON.parse(localStorage.getItem(BACKUP_CONFIG_KEY) || '{}'); } catch { return {}; }
}

function saveCloudConfig(e) {
  e.preventDefault();
  const cfg = {
    provider: document.getElementById('cloud-provider').value,
    path: document.getElementById('cloud-path').value.trim(),
    passphrase: document.getElementById('cloud-passphrase').value,
    autoSync: document.getElementById('cloud-auto-sync').checked
  };
  if (cfg.provider && !cfg.path) { _toast('Remote path required when using cloud', 'error'); return; }
  if (cfg.passphrase && cfg.passphrase.length < 8) { _toast('Passphrase must be at least 8 characters', 'error'); return; }
  // Save to server config
  const serverCfg = {
    cloud: { provider: cfg.provider, path: cfg.path, auto_sync: cfg.autoSync },
    encryption: { enabled: cfg.passphrase && cfg.passphrase.length >= 8, passphrase: cfg.passphrase || '' }
  };
  fetch('/api/db/backup-config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: serverCfg })
  }).then(r => r.json()).then(data => {
    if (data.ok) { _toast('Backup config saved'); refreshStatusPanel(); }
    else { _toast('Config save failed: ' + (data.error || 'unknown'), 'error'); }
  }).catch(e => { _toast('Config save error: ' + e.message, 'error'); });
  // Also keep a local copy for the UI
  localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(cfg));
}

function refreshStatusPanel() {
  const cfg = loadBackupConfig();
  const st = document.getElementById('backup-cloud-status');
  if (st) st.textContent = cfg.provider ? `${cfg.provider} — ${cfg.autoSync ? 'auto' : 'manual'}` : 'Not configured';
}

/* ── History ───────────────────────────────── */
function loadBackupHistory() {
  const list = document.getElementById('backup-history');
  if (!list) return;

  // Always show server-side history as primary source
  fetchServerHistory().then(serverBackups => {
    const localLog = getBackupLog();
    // Merge: server entries are authoritative; supplement with local log entries that lack server files
    const merged = mergeHistory(serverBackups, localLog);
    renderHistory(list, merged);
  }).catch(() => {
    // Fallback to localStorage-only if server unreachable
    const localLog = getBackupLog();
    renderHistory(list, localLog.map(e => ({
      filename: null,
      size: e.size,
      created: e.time,
      encrypted: false,
      status: e.status,
      type: e.type,
      target: e.target,
      source: 'local'
    })));
  });
}

async function fetchServerHistory() {
  const resp = await fetch('/api/backup/history');
  const data = await resp.json();
  return (data.backups || []).map(b => ({ ...b, source: 'server' }));
}

function mergeHistory(server, local) {
  // Build map by approximate timestamp (trim to minute)
  const map = new Map();
  server.forEach(b => {
    const key = b.created ? b.created.slice(0, 16) : b.filename;
    map.set(key, b);
  });
  local.forEach(e => {
    const key = e.time ? e.time.slice(0, 16) : e.target;
    if (!map.has(key)) {
      map.set(key, {
        filename: null,
        size: e.size,
        created: e.time,
        encrypted: false,
        status: e.status,
        type: e.type,
        target: e.target,
        source: 'local'
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    const ta = a.created ? new Date(a.created) : 0;
    const tb = b.created ? new Date(b.created) : 0;
    return tb - ta;
  });
}

function renderHistory(list, items) {
  const cfg = loadBackupConfig();
  if (!items.length) {
    list.innerHTML = '<li class="backup-empty">No backups yet. Be safe — make one now.</li>';
    updateBadge(0);
    return;
  }
  list.innerHTML = items.map(item => {
    const isServer = item.source === 'server';
    const statusClass = item.status === 'error' ? 'error' : 'ok';
    const typeLabel = item.type
      ? (item.type === 'full' ? '📦 Full' : item.type === 'local' ? '💾 USB' : '☁️ Cloud')
      : (isServer ? '📦 Server' : '📦 Backup');
    const timeStr = fmtTime(item.created);
    const encIcon = item.encrypted ? '🔒 ' : '';
    const downloadBtn = isServer && item.filename
      ? `<button class="backup-history-action" data-download="${esc(item.filename)}" aria-label="Download backup">⬇️</button>`
      : '';
    const restoreBtn = isServer && item.filename
      ? `<button class="backup-history-action" data-restore="${esc(item.filename)}" data-enc="${item.encrypted ? '1' : '0'}" aria-label="Restore backup">↩️</button>`
      : '';
    return `
      <li class="backup-log-entry ${statusClass}">
        <span class="backup-log-type">${encIcon}${typeLabel}</span>
        <span class="backup-log-target">${esc(item.target || item.filename || 'server')}</span>
        <span class="backup-log-size">${item.size || '—'}</span>
        <span class="backup-log-time">${timeStr}</span>
        <span class="backup-log-actions">${restoreBtn}${downloadBtn}</span>
      </li>`;
  }).join('');

  // Wire download buttons
  list.querySelectorAll('.backup-history-action[data-download]').forEach(btn => {
    btn.addEventListener('click', () => downloadBackup(btn.dataset.download));
  });

  // Wire restore buttons
  list.querySelectorAll('.backup-history-action[data-restore]').forEach(btn => {
    btn.addEventListener('click', () => showRestoreModal(btn.dataset.restore, btn.dataset.enc === '1'));
  });

  // Update "Last Backup" display
  const latest = items[0];
  const lastTime = document.getElementById('backup-last-time');
  const lastSize = document.getElementById('backup-last-size');
  if (lastTime) lastTime.textContent = latest.created ? fmtTime(latest.created) : 'Unknown';
  if (lastSize) lastSize.textContent = latest.size || '—';

  // Update dashboard badge
  const okCount = items.filter(i => i.status !== 'error').length;
  updateBadge(okCount, latest);
  updateHealthStatus(latest);
}

function updateBadge(count, latest) {
  const badge = document.getElementById('backup-badge');
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function updateHealthStatus(latest) {
  const el = document.getElementById('backup-health-status');
  if (!el) return;
  const d = latest?.created ? new Date(latest.created) : null;
  const ageDays = d ? (Date.now() - d) / 86400000 : Infinity;
  let color = '#10b981'; // green
  let label = 'Good';
  if (ageDays > 30) { color = '#ef4444'; label = '>30 days — Backup now!'; }
  else if (ageDays > 7) { color = '#f59e0b'; label = '>7 days — Time to backup'; }
  else if (ageDays === Infinity) { color = '#94a3b8'; label = 'No backups yet'; }
  el.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${label}`;
}

function showRestoreModal(filename, encrypted) {
  // Remove existing modal
  document.getElementById('restore-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'restore-modal';
  modal.className = 'backup-modal';
  modal.innerHTML = `
    <div class="backup-modal-overlay"></div>
    <div class="backup-modal-body">
      <h3>↩️ Restore Backup</h3>
      <p class="backup-modal-filename"><strong>${esc(filename)}</strong></p>
      <p class="backup-modal-warning">⚠️ This will <strong>overwrite</strong> your current localStorage data for the keys in this backup. This action cannot be undone.</p>
      ${encrypted ? `
      <label class="backup-field" style="margin-top:0.5rem">
        <span>Decryption Passphrase</span>
        <input type="password" id="restore-passphrase" placeholder="Enter backup passphrase" autocomplete="off">
      </label>` : ''}
      <div class="backup-modal-actions">
        <button class="btn-secondary" id="btn-restore-cancel">Cancel</button>
        <button class="btn-primary" id="btn-restore-confirm">Restore Now</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById('btn-restore-cancel')?.addEventListener('click', close);
  modal.querySelector('.backup-modal-overlay')?.addEventListener('click', close);

  document.getElementById('btn-restore-confirm')?.addEventListener('click', async () => {
    const passphrase = encrypted ? (document.getElementById('restore-passphrase')?.value || '') : '';
    if (encrypted && !passphrase) { _toast('Passphrase required', 'error'); return; }
    close();
    await doRestore(filename, passphrase);
  });
}

async function doRestore(filename, passphrase) {
  const btn = document.querySelector(`.backup-history-action[data-restore="${esc(filename)}"]`);
  const orig = btn ? btn.innerHTML : '↩️';
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳'; }

  try {
    const resp = await fetch('/api/backup/restore', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, passphrase })
    });
    const data = await resp.json();
    if (!data.ok) {
      _toast(`Restore failed: ${data.error || 'unknown'}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
      return;
    }

    // Preview modal — show keys and confirm merge
    showMergePreview(data.data, filename, btn, orig);
  } catch (e) {
    _toast(`Restore error: ${e.message}`, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}

function showMergePreview(data, filename, btnRef, btnOrig) {
  document.getElementById('merge-modal')?.remove();
  const keys = Object.keys(data || {});
  const modal = document.createElement('div');
  modal.id = 'merge-modal';
  modal.className = 'backup-modal';
  modal.innerHTML = `
    <div class="backup-modal-overlay"></div>
    <div class="backup-modal-body" style="max-height:80vh;overflow:auto">
      <h3>🧩 Merge Preview</h3>
      <p>${keys.length} localStorage key(s) in <strong>${esc(filename)}</strong>:</p>
      <ul class="backup-merge-keys">
        ${keys.map(k => `<li>${esc(k)} <span class="backup-merge-size">${(data[k]?.length || 0).toLocaleString()} chars</span></li>`).join('')}
      </ul>
      <p class="backup-modal-warning">Choose how to restore:</p>
      <div class="backup-modal-actions">
        <button class="btn-secondary" id="btn-merge-cancel">Cancel</button>
        <button class="btn-primary" id="btn-merge-add">Add Only (no overwrite)</button>
        <button class="btn-primary" id="btn-merge-full">Full Replace</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById('btn-merge-cancel')?.addEventListener('click', () => {
    close();
    if (btnRef) { btnRef.disabled = false; btnRef.innerHTML = btnOrig; }
  });
  modal.querySelector('.backup-modal-overlay')?.addEventListener('click', () => {
    close();
    if (btnRef) { btnRef.disabled = false; btnRef.innerHTML = btnOrig; }
  });

  document.getElementById('btn-merge-add')?.addEventListener('click', () => {
    applyMerge(data, false);
    close();
    if (btnRef) { btnRef.disabled = false; btnRef.innerHTML = btnOrig; }
  });
  document.getElementById('btn-merge-full')?.addEventListener('click', () => {
    applyMerge(data, true);
    close();
    if (btnRef) { btnRef.disabled = false; btnRef.innerHTML = btnOrig; }
  });
}

function applyMerge(data, overwrite) {
  let count = 0;
  for (const [key, value] of Object.entries(data || {})) {
    if (key === '_meta') continue;
    if (!overwrite && localStorage.getItem(key) !== null) continue;
    try { localStorage.setItem(key, value); count++; } catch (e) { console.warn('Restore skipped', key, e.message); }
  }
  _toast(`Restored ${count} key(s). Reloading...`);
  // Trigger a gentle app refresh so data is picked up
  setTimeout(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: '', newValue: '' }));
    loadBackupHistory();
  }, 500);
}

function downloadBackup(filename) {
  if (!filename) return;
  const a = document.createElement('a');
  a.href = `/api/backup/download?file=${encodeURIComponent(filename)}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  _toast(`Downloading ${filename}`);
}

function getBackupLog() {
  try { return JSON.parse(localStorage.getItem(BACKUP_LOG_KEY) || '[]'); } catch { return []; }
}

function addBackupLog(entry) {
  const log = getBackupLog();
  log.push(entry);
  if (log.length > 50) log.shift();
  localStorage.setItem(BACKUP_LOG_KEY, JSON.stringify(log));
}

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function esc(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
