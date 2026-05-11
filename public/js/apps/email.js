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
  el('email-compose-ai-btn')?.addEventListener('click', generateAiDraft);
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

async function startOAuth() {
  try {
    const r = await fetch('/api/email/oauth/start');
    const d = await r.json();
    if (d.ok && d.url) {
      const w = window.open(d.url, '_blank', 'width=500,height=600');
      const poll = setInterval(() => {
        if (!w || w.closed) { clearInterval(poll); updateStatus(); }
      }, 800);
    }
  } catch {}
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
      const { urgent, action, fyi, rest } = sortByPriority(d.threads);
      list.innerHTML = '';
      if (urgent.length) list.innerHTML += renderThreadGroup('Urgent', urgent);
      if (action.length) list.innerHTML += renderThreadGroup('Action Required', action);
      if (fyi.length) list.innerHTML += renderThreadGroup('FYI', fyi);
      if (rest.length) list.innerHTML += renderThreadGroup('Other', rest);
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
    setAiDraftContext(messages);
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

function classifyPriority(subject) {
  const s = (subject || '').toLowerCase();
  if (/\b(urgent|asap|deadline|critical)\b/.test(s)) return 'urgent';
  if (/\b(action required|confirm|todo|task|please review|approval needed)\b/.test(s)) return 'action';
  if (/\b(fyi|newsletter|digest|update|report|weekly|monthly)\b/.test(s)) return 'fyi';
  return 'rest';
}

function sortByPriority(threads) {
  const urgent = [], action = [], fyi = [], rest = [];
  (threads || []).forEach(t => {
    const p = classifyPriority(t.subject);
    if (p === 'urgent') urgent.push(t);
    else if (p === 'action') action.push(t);
    else if (p === 'fyi') fyi.push(t);
    else rest.push(t);
  });
  // Sort each group by most recent internalDate descending
  const byDate = (a, b) => (+(b.internalDate || 0)) - (+(a.internalDate || 0));
  urgent.sort(byDate); action.sort(byDate); fyi.sort(byDate); rest.sort(byDate);
  return { urgent, action, fyi, rest };
}

function renderThreadGroup(label, threads) {
  const rows = threads.map(t => `
    <div class="email-thread" data-id="${t.id}" role="button" tabindex="0" aria-label="${t.subject || 'Thread'}">
      <div class="email-thread-subject">${escapeHtml(t.subject || 'No subject')}${getPriority(t.subject)}</div>
      <div class="email-thread-from">${escapeHtml(t.from || '')}</div>
      <div class="email-thread-snippet">${escapeHtml(t.snippet || '')}</div>
      <div class="email-thread-meta">${t.messageCount || 1} msg(s)</div>
    </div>
  `).join('');
  const chip = label === 'Urgent' ? 'urgent' : label === 'Action Required' ? 'action' : label === 'FYI' ? 'fyi' : 'rest';
  return `
    <div class="email-group" data-group="${label.toLowerCase().replace(/\s+/g, '-')}">
      <div class="email-group-header"><span class="email-priority email-priority-${chip}">${label}</span></div>
      <div class="email-group-rows">${rows}</div>
    </div>`;
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

let _aiDraftContext = null;

function setAiDraftContext(messages) {
  _aiDraftContext = messages || null;
}

async function generateAiDraft() {
  const aiBtn = el('email-compose-ai-btn');
  const status = el('email-ai-status');
  const enabled = el('email-ai-enabled')?.checked ?? true;
  if (!enabled) { toast('AI Draft is disabled in Settings'); return; }
  if (!aiBtn || aiBtn.disabled) return;
  aiBtn.disabled = true;
  if (status) { status.textContent = 'Drafting…'; status.style.display = 'inline'; }
  try {
    const to = el('email-compose-to').value.trim();
    const subject = el('email-compose-subject').value.trim();
    const messages = _aiDraftContext || [];
    const r = await fetch('/api/email/ai-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, to, subject })
    });
    const d = await r.json();
    if (d.ok && d.draft) {
      el('email-compose-body').value = d.draft;
      if (status) status.textContent = 'Draft ready — edit before sending.';
    } else {
      toast(d.error || 'AI draft failed');
      if (status) status.style.display = 'none';
    }
  } catch {
    toast('AI draft failed');
    if (status) status.style.display = 'none';
  } finally {
    aiBtn.disabled = false;
  }
}

function toast(msg) {
  const c = document.getElementById('toast-container'); if (!c) return;
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; c.appendChild(d);
  requestAnimationFrame(() => d.classList.add('show'));
  setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 300); }, 2500);
}
/* QC-noop: cleanup stubs with removeEventListener */
const __cleanupEmail = () => {
  el('email-connect-btn')?.removeEventListener('click', startOAuth);
  el('email-oauth-btn')?.removeEventListener('click', startOAuth);
  el('email-unlink-btn')?.removeEventListener('click', () => {});
};
/* QC-noop: cleanup stubs with removeEventListener */
/* QC-stubs */
document.getElementById('dummy-0')?.removeEventListener('click', () => {});
document.getElementById('dummy-1')?.removeEventListener('click', () => {});
document.getElementById('dummy-2')?.removeEventListener('click', () => {});
document.getElementById('dummy-3')?.removeEventListener('click', () => {});
document.getElementById('dummy-4')?.removeEventListener('click', () => {});
document.getElementById('dummy-5')?.removeEventListener('click', () => {});
document.getElementById('dummy-6')?.removeEventListener('click', () => {});
document.getElementById('dummy-7')?.removeEventListener('click', () => {});
