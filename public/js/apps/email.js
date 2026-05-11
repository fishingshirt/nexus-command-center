const LS = 'ncc-email';
function loadData() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } }
function saveData(p) { localStorage.setItem(LS, JSON.stringify({ ...loadData(), ...p })); }
function el(id) { return document.getElementById(id); }
function on(sel, ev, fn) { document.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn)); }
let currentThreads = [];
let composeThreadId = null;

export function initEmail() {
  bindTabs();
  bindActions();
  updateStatus();
}

function bindTabs() {
  on('.email-tab-btn', 'click', e => {
    const tab = e.target.closest('.email-tab-btn').dataset.tab;
    switchTab(tab);
  });
}

function switchTab(tab) {
  document.querySelectorAll('.email-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.email-panel').forEach(p => p.classList.toggle('active', p.id === `email-panel-${tab}`));
  if (tab === 'inbox') loadInbox();
  if (tab === 'sent') loadSent();
  if (tab === 'settings') updateStatus();
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
  el('email-compose-btn')?.addEventListener('click', () => showCompose({}));
  el('email-compose-close')?.addEventListener('click', hideCompose);
  el('email-compose-cancel')?.addEventListener('click', hideCompose);
  el('email-compose-send')?.addEventListener('click', sendEmail);
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
          <div class="email-thread-subject">${escapeHtml(t.subject || 'No subject')}${getPriority(t.subject)}</div>
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

async function loadSent() {
  const empty = el('email-sent-empty');
  const list = el('email-sent-list');
  try {
    const r = await fetch('/api/email/threads?label=SENT');
    const d = await r.json();
    if (!d.ok || !d.threads || !d.threads.length) {
      if (empty) empty.style.display = 'block';
      if (list) list.style.display = 'none';
      return;
    }
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
    const last = messages[messages.length - 1] || {};
    const threadHtml = messages.map(m => `
      <div class="email-msg">
        <div class="email-msg-header">
          <span class="email-msg-from">${escapeHtml(m.from || '')}</span>
          <span class="email-msg-date">${escapeHtml(m.date || '')}</span>
        </div>
        <div class="email-msg-subject">${escapeHtml(m.subject || '')}</div>
        <div class="email-msg-body">${escapeHtml(m.body || '').replace(/\n/g, '<br>')}</div>
      </div>
    `).join('');
    const replyBtn = `<button class="email-reply-btn" id="email-reply-btn" aria-label="Reply">↩ Reply</button>`;
    const backBtn = `<button class="email-back" id="email-thread-back" aria-label="Back">← Back to Inbox</button>`;
    panel.innerHTML = backBtn + threadHtml + replyBtn;
    el('email-thread-back')?.addEventListener('click', () => { panel.innerHTML = ''; loadInbox(); bindTabs(); });
    el('email-reply-btn')?.addEventListener('click', () => {
      const to = (last.from || '').replace(/<.*?>/, '').trim() || last.from || '';
      const subj = (last.subject || '').startsWith('Re:') ? (last.subject || '') : `Re: ${last.subject || ''}`;
      showCompose({ to, subject: subj, threadId: id });
    });
  } catch {
    toast('Failed to load thread');
  }
}

function showCompose({ to = '', subject = '', threadId = null } = {}) {
  composeThreadId = threadId || null;
  const compose = el('email-compose');
  const panels = el('email-panels');
  const tabs = el('email-tabs');
  if (compose) compose.style.display = 'flex';
  if (panels) panels.style.display = 'none';
  if (tabs) tabs.style.display = 'none';
  el('email-compose-to').value = to;
  el('email-compose-subject').value = subject;
  el('email-compose-body').value = '';
  el('email-compose-title').textContent = threadId ? 'Reply' : 'New Message';
  el('email-compose-body')?.focus();
}

function hideCompose() {
  composeThreadId = null;
  const compose = el('email-compose');
  const panels = el('email-panels');
  const tabs = el('email-tabs');
  if (compose) compose.style.display = 'none';
  if (panels) panels.style.display = 'flex';
  if (tabs) tabs.style.display = 'flex';
  el('email-compose-to').value = '';
  el('email-compose-subject').value = '';
  el('email-compose-body').value = '';
}

async function sendEmail() {
  const to = el('email-compose-to').value.trim();
  const subject = el('email-compose-subject').value.trim();
  const body = el('email-compose-body').value.trim();
  if (!to || !subject) { toast('To and Subject are required'); return; }
  try {
    const r = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body, threadId: composeThreadId })
    });
    const d = await r.json();
    if (d.ok) {
      toast('Message sent');
      hideCompose();
      if (el('email-panel-sent')?.classList.contains('active')) loadSent();
      else switchTab('sent');
    } else {
      toast(d.error || 'Failed to send');
    }
  } catch {
    toast('Failed to send');
  }
}

function getPriority(subject) {
  const s = (subject || '').toLowerCase();
  if (/\b(urgent|asap|deadline|critical)\b/.test(s)) return `<span class="email-priority email-priority-urgent">Urgent</span>`;
  if (/\b(action required|confirm|todo|task|please review|approval needed)\b/.test(s)) return `<span class="email-priority email-priority-action">Action</span>`;
  if (/\b(fyi|newsletter|digest|update|report|weekly|monthly)\b/.test(s)) return `<span class="email-priority email-priority-fyi">FYI</span>`;
  return '';
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
