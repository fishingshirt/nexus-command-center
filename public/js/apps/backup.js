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

  document.getElementById('btn-backup-now').addEventListener('click', () => runBackup('full'));
  document.getElementById('btn-backup-local').addEventListener('click', () => runBackup('local'));
  document.getElementById('btn-backup-cloud').addEventListener('click', () => runBackup('cloud'));
  document.getElementById('backup-cloud-form').addEventListener('submit', saveCloudConfig);

  loadBackupConfig();
  loadBackupHistory();
  refreshUsbList();
}

/* ── Backup Logic ──────────────────────────── */
async function runBackup(type) {
  const btnId = type === 'full' ? 'btn-backup-now' : type === 'local' ? 'btn-backup-local' : 'btn-backup-cloud';
  const btn = document.getElementById(btnId);
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="backup-spinner"></span> Working...`;

  const config = loadBackupConfig();
  const body = { type, config };
  if (type === 'local') {
    const sel = document.querySelector('.backup-usb-item.selected');
    if (sel) body.target = sel.dataset.path;
  }

  try {
    const resp = await fetch('/api/backup/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (data.ok) {
      _toast(`Backup: ${data.summary || 'completed'}`);
      addBackupLog({ type, target: data.target || type, size: data.size, time: new Date().toISOString(), status: 'ok' });
    } else {
      _toast(`Backup failed: ${data.error || 'unknown'}`, 'error');
      addBackupLog({ type, target: type, time: new Date().toISOString(), status: 'error', error: data.error });
    }
  } catch (e) {
    _toast(`Backup error: ${e.message}`, 'error');
    addBackupLog({ type, target: type, time: new Date().toISOString(), status: 'error', error: e.message });
  }

  btn.disabled = false; btn.innerHTML = orig;
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
  localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(cfg));
  _toast('Cloud config saved');
  refreshStatusPanel();
}

function refreshStatusPanel() {
  const cfg = loadBackupConfig();
  const st = document.getElementById('backup-cloud-status');
  if (st) st.textContent = cfg.provider ? `${cfg.provider} — ${cfg.autoSync ? 'auto' : 'manual'}` : 'Not configured';
}

/* ── History ───────────────────────────────── */
function loadBackupHistory() {
  const list = document.getElementById('backup-history');
  const log = getBackupLog();
  if (!list) return;
  if (!log.length) { list.innerHTML = '<li class="backup-empty">No backups yet. Be safe — make one now.</li>'; return; }
  list.innerHTML = log.slice().reverse().map(entry => `
    <li class="backup-log-entry ${entry.status}">
      <span class="backup-log-type">${entry.type === 'full' ? '📦 Full' : entry.type === 'local' ? '💾 USB' : '☁️ Cloud'}</span>
      <span class="backup-log-target">${esc(entry.target)}</span>
      <span class="backup-log-size">${entry.size || '—'}</span>
      <span class="backup-log-time">${fmtTime(entry.time)}</span>
    </li>
  `).join('');

  const badge = document.getElementById('backup-badge');
  if (badge) {
    const ok = log.filter(e => e.status === 'ok').length;
    badge.textContent = ok;
    badge.style.display = ok ? 'flex' : 'none';
  }
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
