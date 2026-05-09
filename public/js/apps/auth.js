/* ─── PIN Auth — Opt-in per-app lock ─────────────── */
import { loadSettings, saveSettings, toast } from '../app.js';

const PIN_STORAGE = 'ncc-auth-pin-state';
const PIN_SESSION  = 'ncc-pin-verified';

export function initAuth() {
  initAuthSettings();
}

/* Ask server if PIN is configured. If yes and app locked → show overlay. */
export async function ensureAuthEnabled(appId) {
  const settings = loadSettings();
  const lockedApps = settings.lockedApps || {};
  if (!lockedApps[appId]) return true; // app not locked

  const verified = sessionStorage.getItem(`${PIN_SESSION}-${appId}`) === '1';
  if (verified) return true;

  const status = await fetch('/api/auth/status').then(r => r.json()).catch(() => ({ pinEnabled: false }));
  if (!status.pinEnabled) {
    // Server says no PIN, so nothing to block
    return true;
  }

  return new Promise(resolve => showPinOverlay(appId, resolve));
}

/* Settings UI injection */
function initAuthSettings() {
  const panel = document.getElementById('settings-panel');
  if (!panel || panel.querySelector('#auth-settings-section')) return;

  const dataSection = panel.querySelector('.settings-section:last-of-type');
  const section = document.createElement('section');
  section.className = 'settings-section';
  section.id = 'auth-settings-section';
  section.innerHTML = `
    <h3>Security 🔐</h3>
    <div class="settings-row auth-status-row">
      <span class="auth-status-label">PIN Lock</span>
      <span class="auth-status-badge" id="auth-status-badge">Checking…</span>
    </div>
    <div class="settings-row" id="auth-pin-row" style="display:none">
      <label for="auth-pin-input">4–6 digit PIN</label>
      <input type="password" id="auth-pin-input" inputmode="numeric" maxlength="6" pattern="[0-9]*" placeholder="Create PIN" autocomplete="off">
    </div>
    <div class="settings-row" id="auth-confirm-row" style="display:none">
      <label for="auth-pin-confirm">Confirm PIN</label>
      <input type="password" id="auth-pin-confirm" inputmode="numeric" maxlength="6" pattern="[0-9]*" placeholder="Re-enter PIN" autocomplete="off">
    </div>
    <div class="settings-row" id="auth-apps-row" style="display:none">
      <span>Lock these apps</span>
      <div class="auth-app-locks">
        <label><input type="checkbox" data-lock-app="calendar" id="lock-calendar"> Calendar</label>
        <label><input type="checkbox" data-lock-app="notes" id="lock-notes"> Notes</label>
        <label><input type="checkbox" data-lock-app="todo" id="lock-todo"> To-Do</label>
      </div>
    </div>
    <div class="settings-row" id="auth-enable-actions" style="display:none">
      <button class="btn-primary" id="btn-auth-enable">Set PIN</button>
      <button class="btn-danger" id="btn-auth-disable" style="display:none">Remove PIN</button>
    </div>
    <p class="settings-hint" id="auth-hint">No PIN required by default. This will hash your PIN on the server and never store it in the browser.</p>
  `;
  dataSection.parentNode.insertBefore(section, dataSection);

  refreshAuthUI();

  document.getElementById('btn-auth-enable').addEventListener('click', async () => {
    const pin = document.getElementById('auth-pin-input').value.trim();
    const confirm = document.getElementById('auth-pin-confirm').value.trim();
    if (!pin || !confirm) { toast('Enter and confirm PIN', 'error'); return; }
    if (pin !== confirm) { toast('PINs do not match', 'error'); return; }
    if (!/^\d{4,6}$/.test(pin)) { toast('PIN must be 4–6 digits', 'error'); return; }
    try {
      const resp = await fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pin}) });
      const data = await resp.json();
      if (data.ok) {
        toast('PIN set successfully');
        refreshAuthUI();
      } else {
        toast(data.error || 'Failed', 'error');
      }
    } catch (e) { toast('Server error', 'error'); }
  });

  document.getElementById('btn-auth-disable').addEventListener('click', async () => {
    const pin = prompt('Enter current PIN to remove lock:');
    if (!pin) return;
    const resp = await fetch('/api/auth/remove', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pin}) });
    const data = await resp.json().catch(() => ({}));
    if (data.ok) {
      saveSettings({ lockedApps: {} });
      toast('PIN lock disabled');
      refreshAuthUI();
    } else {
      toast(data.error || 'Incorrect PIN', 'error');
    }
  });

  section.querySelectorAll('input[data-lock-app]').forEach(cb => {
    cb.addEventListener('change', () => {
      const lockedApps = {};
      section.querySelectorAll('input[data-lock-app]').forEach(c => { if (c.checked) lockedApps[c.dataset.lockApp] = true; });
      saveSettings({ lockedApps });
      toast(lockedApps[cb.dataset.lockApp] ? 'App locked' : 'App unlocked');
    });
  });
}

async function refreshAuthUI() {
  const badge = document.getElementById('auth-status-badge');
  const pinRow = document.getElementById('auth-pin-row');
  const confirmRow = document.getElementById('auth-confirm-row');
  const appsRow = document.getElementById('auth-apps-row');
  const actionsRow = document.getElementById('auth-enable-actions');
  const enableBtn = document.getElementById('btn-auth-enable');
  const disableBtn = document.getElementById('btn-auth-disable');
  const hint = document.getElementById('auth-hint');

  if (!badge) return;
  const settings = loadSettings();
  const lockedApps = settings.lockedApps || {};

  const status = await fetch('/api/auth/status').then(r => r.json()).catch(() => ({ pinEnabled: false }));
  if (status.pinEnabled) {
    badge.textContent = 'On';
    badge.className = 'auth-status-badge enabled';
    pinRow.style.display = 'none';
    confirmRow.style.display = 'none';
    appsRow.style.display = '';
    actionsRow.style.display = '';
    enableBtn.style.display = 'none';
    disableBtn.style.display = '';
    hint.textContent = 'PIN is active. Choose which apps require unlocking.';
    document.querySelectorAll('input[data-lock-app]').forEach(cb => {
      cb.checked = !!lockedApps[cb.dataset.lockApp];
    });
  } else {
    badge.textContent = 'Off';
    badge.className = 'auth-status-badge disabled';
    pinRow.style.display = '';
    confirmRow.style.display = '';
    appsRow.style.display = '';
    actionsRow.style.display = '';
    enableBtn.style.display = '';
    disableBtn.style.display = 'none';
    hint.textContent = 'No PIN required by default. Create one to lock specific apps.';
  }
}

/* PIN overlay for locked apps */
function showPinOverlay(appId, onComplete) {
  if (document.getElementById('nexus-pin-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'nexus-pin-overlay';
  overlay.className = 'nexus-pin-overlay';
  overlay.innerHTML = `
    <div class="nexus-pin-panel">
      <div class="nexus-pin-icon">🔐</div>
      <h3>${esc(appName(appId))} Locked</h3>
      <p>Enter your PIN to unlock</p>
      <input inputmode="numeric" maxlength="6" pattern="[0-9]*" autocomplete="off" placeholder="••••" aria-label="PIN" id="nexus-pin-input" type="password">
      <div class="nexus-pin-error" id="nexus-pin-error"></div>
      <button class="btn-primary" id="nexus-pin-submit">Unlock</button>
      <button class="btn-secondary" id="nexus-pin-cancel" style="margin-top:0.5rem">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('nexus-pin-input');
  const submit = document.getElementById('nexus-pin-submit');
  const cancel = document.getElementById('nexus-pin-cancel');
  const error = document.getElementById('nexus-pin-error');

  setTimeout(() => input.focus(), 50);

  submit.addEventListener('click', async () => {
    const pin = input.value.trim();
    if (!/^\d{4,6}$/.test(pin)) { error.textContent = 'PIN must be 4–6 digits'; return; }
    try {
      const resp = await fetch('/api/auth/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pin}) });
      const data = await resp.json().catch(() => ({}));
      if (data.ok) {
        sessionStorage.setItem(`${PIN_SESSION}-${appId}`, '1');
        overlay.remove();
        onComplete(true);
      } else {
        error.textContent = 'Incorrect PIN';
        input.value = '';
        input.focus();
      }
    } catch { error.textContent = 'Server error'; }
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit.click(); });

  cancel.addEventListener('click', () => {
    overlay.remove();
    onComplete(false);
    location.hash = 'dashboard';
  });
}

function appName(id) {
  const map = { calendar: 'Calendar', notes: 'Notes', todo: 'To-Do' };
  return map[id] || id;
}

function esc(s) { return (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
