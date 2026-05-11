const LS = 'ncc-email';
function loadData() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } }
function saveData(p) { localStorage.setItem(LS, JSON.stringify({ ...loadData(), ...p })); }
function el(id) { return document.getElementById(id); }
function on(sel, ev, fn) { document.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn)); }
let currentThreads = [];

export function initEmail() {
  bindTabs();
  bindActions();
  updateStatus();
}

function bindTabs() {
  on('.email-tab-btn', 'click', e => {
    const tab = e.target.closest('.email-tab-btn').dataset.tab;
    document.querySelectorAll('.email-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.email-panel').forEach(p => p.classList.toggle('active', p.id === `email-panel-${tab}`));
    if (tab === 'inbox') loadInbox();
    if (tab === 'settings') updateStatus();
  });
}

function bindActions() {
  el('email-connect-btn')?.addEventListener('click', startOAuth);
  el('email-oauth-btn')?.addEventListener('click', startOAuth);
  el('email-unlink-btn')?.addEventListener('click', async () => {
    await fetch('/api/email/unlink', { method: 'POST' });
    updateStatus();
    const list = el('email-inbox-list');
    if (list) list.innerHTML = '';
  });
}

async function updateStatus() {
  const statusEl = el('email-status');
  const unlinkBtn = el('email-unlink-btn');
  const connectBtn = el('email-oauth-btn');
  try {
    const r = await fetch('/api/email/status');
    const d = await r.json();
    if (d.linked) {
      statusEl.textContent = d.email ? `Connected: ${d.email}` : 'Connected';
      unlinkBtn.style.display = 'inline-block';
      connectBtn.style.display = 'none';
      loadInbox();
    } else {
      statusEl.textContent = 'Not connected';
      unlinkBtn.style.display = 'none';
      connectBtn.style.display = 'inline-block';
      const empty = el('email-inbox-empty');
      if (empty) empty.style.display = 'block';
      const list = el('email-inbox-list');
      if (list) { list.style.display = 'none'; list.innerHTML = ''; }
    }
  } catch {
    if (statusEl) statusEl.textContent = 'Offline';
  }
}

function startOAuth() {
  fetch('/api/email/oauth/start')
    .then(r => r.json())
    .then(d => {
      if (d.ok && d.url) {
        const w = window.open(d.url, '_blank', 'width=500,height=600');
        const poll = setInterval(() => {
          if (!w || w.closed) { clearInterval(poll); updateStatus(); }
        }, 800);
      }
    });
}

async function loadInbox() {
  const empty = el('email-inbox-empty');
  const list = el('email-inbox-list');
  try {
    const r = await fetch('/api/email/threads?label=INBOX');
    const d = await r.json();
    if (!d.ok || !d.threads || !d.threads.length) {
      if (empty) empty.style.display = 'block';
      if (list) list.style.display = 'none';
      return;
    }
    currentThreads = d.threads;
    if (empty) empty.style.display = 'none';
    if (list) {
      list.style.display = 'flex';
      list.innerHTML = d.threads.map(t => `
        <div class="email-thread" data-id="${t.id}" role="button" tabindex="0" aria-label="${t.subject || 'Thread'}">
          <div class="email-thread-subject">${escapeHtml(t.subject || 'No subject')}</div>
          <div class="email-thread-from">${escapeHtml(t.from || '')}</div>
          <div class="email-thread-snippet">${escapeHtml(t.snippet || '')}</div>
          <div class="email-thread-meta">${t.messageCount || 1} msg(s)</div>
        </div>
      `).join('');
      list.querySelectorAll('.email-thread').forEach(row => {
        row.addEventListener('click', () => openThread(row.dataset.id));
      });
      const badge = el('email-badge'); if (badge) badge.textContent = d.threads.length;
    }
  } catch {
    if (empty) empty.style.display = 'block';
    if (list) list.style.display = 'none';
  }
}

async function openThread(id) {
  const panel = document.getElementById('email-panel-inbox');
  try {
    const r = await fetch(`/api/email/threads/${encodeURIComponent(id)}`);
    const d = await r.json();
    if (!d.ok) return;
    const messages = d.messages || [];
    const threadHtml = messages.map(m => `
      <div class="email-msg">
        <div class="email-msg-header">
          <span class="email-msg-from">${escapeHtml(m.from || '')}</span>
          <span class="email-msg-date">${escapeHtml(m.date || '')}</span>
        </div>
        <div class="email-msg-subject">${escapeHtml(m.subject || '')}</div>
        <div class="email-msg-body">${escapeHtml(m.body || '').replace(/\\n/g, '\u003cbr\u003e')}</div>
      </div>
    `).join('');
    const backBtn = `<button class="email-back" id="email-thread-back" aria-label="Back"\u003e← Back to Inbox</button>`;
    panel.innerHTML = backBtn + threadHtml;
    el('email-thread-back')?.addEventListener('click', () => { panel.innerHTML = ''; loadInbox(); bindTabs(); });
  } catch {
    toast('Failed to load thread');
  }
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function toast(msg) {
  const c = document.getElementById('toast-container'); if (!c) return;
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; c.appendChild(d);
  requestAnimationFrame(() => d.classList.add('show'));
  setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 300); }, 2500);
}
