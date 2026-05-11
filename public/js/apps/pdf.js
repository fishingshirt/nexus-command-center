/**
 * Nexus Smart PDF Editor (T-025)
 * Upload, preview, text-extract, merge/split via natural language.
 */

const LS = 'ncc-pdf-editor';

function loadData() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } }
function saveData(p) { localStorage.setItem(LS, JSON.stringify({ ...loadData(), ...p })); }
function el(id) { return document.getElementById(id); }

// ─── State ───────────────────────────────────────────
let _currentFile = null; // { name, blobUrl, serverId }
let _serverFile = null;  // uploaded filename on server
let _originalPages = 0;

export function initPdfEditor() {
  bindEvents();
  renderHistory();
  updateStatusBadge('ready');
}

function updateStatusBadge(state) {
  const badge = el('pdf-status-badge');
  if (!badge) return;
  badge.className = 'pdf-status-badge';
  const map = {
    ready:   { cls: 'badge-ready',   text: 'Ready' },
    busy:    { cls: 'badge-busy',    text: 'Processing…' },
    done:    { cls: 'badge-done',    text: 'Done' },
    error:   { cls: 'badge-error',   text: 'Error' }
  };
  const s = map[state] || map.ready;
  badge.classList.add(s.cls);
  badge.textContent = s.text;
}

function bindEvents() {
  const drop = el('pdf-drop-zone');
  const input = el('pdf-upload-input');
  const browseBtn = el('pdf-browse-btn');
  const cmdInput = el('pdf-command-input');
  const cmdGo = el('pdf-command-go');
  const log = el('pdf-log');
  const preview = el('pdf-preview');

  if (!drop || !input) return;

  ['dragenter','dragover','dragleave','drop'].forEach(ev => {
    drop.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); });
  });
  ['dragenter','dragover'].forEach(ev => {
    drop.addEventListener(ev, () => drop.classList.add('drag-active'));
  });
  ['dragleave','drop'].forEach(ev => {
    drop.addEventListener(ev, () => drop.classList.remove('drag-active'));
  });
  drop.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length) handleFile(files[0]);
  });
  browseBtn?.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files.length) handleFile(input.files[0]);
  });

  cmdGo?.addEventListener('click', () => runCommand());
  cmdInput?.addEventListener('keydown', e => { if (e.key === 'Enter') runCommand(); });

  // Download result
  el('pdf-download-btn')?.addEventListener('click', downloadResult);
  el('pdf-clear-btn')?.addEventListener('click', clearEditor);
}

function log(msg, type = 'info') {
  const log = el('pdf-log');
  if (!log) return;
  const line = document.createElement('div');
  line.className = `pdf-log-line pdf-log-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    log('Only PDF files are supported.', 'error'); updateStatusBadge('error'); return;
  }
  updateStatusBadge('busy');
  log(`Selected: ${file.name} (${Math.round(file.size/1024)} KB)`);

  // Upload to server
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch('/api/pdf/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Upload failed');
    _serverFile = data.filename;
    _originalPages = data.pages || 0;
    log(`Uploaded to server (${data.pages} pages).`);
    updateStatusBadge('ready');
    // Build a local blob URL for immediate preview
    const blobUrl = URL.createObjectURL(file);
    _currentFile = { name: file.name, blobUrl };
    setPreview(blobUrl);
    saveHistoryEntry(file.name, 'uploaded', data.filename);
    renderHistory();
  } catch (err) {
    log(err.message, 'error'); updateStatusBadge('error');
  }
}

function setPreview(url) {
  const preview = el('pdf-preview');
  if (!preview) return;
  preview.innerHTML = `<iframe class="pdf-preview-frame" src="${url}" title="PDF Preview"></iframe>`;
}

async function runCommand() {
  const input = el('pdf-command-input');
  const cmd = input?.value.trim();
  if (!cmd) return;
  if (!_serverFile) { log('Upload a PDF first.', 'warn'); return; }

  log(`Running: “${cmd}”…`);
  updateStatusBadge('busy');
  try {
    const res = await fetch('/api/pdf/nlp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: _serverFile, command: cmd })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Command failed');

    if (data.action === 'extract_text') {
      log(`Extracted text (${data.textLength} chars).`);
      renderTextResult(data.text);
    } else if (data.action === 'extract_pages') {
      log(`Created new PDF with ${data.newPages} pages.`);
      _serverFile = data.newFilename;
      setPreview(`/api/pdf/file/${encodeURIComponent(data.newFilename)}?t=${Date.now()}`);
      saveHistoryEntry(data.newFilename, 'extract');
      renderHistory();
    } else if (data.action === 'merge_pdf') {
      log(`Merged into ${data.newFilename}.`);
      _serverFile = data.newFilename;
      setPreview(`/api/pdf/file/${encodeURIComponent(data.newFilename)}?t=${Date.now()}`);
      saveHistoryEntry(data.newFilename, 'merge');
      renderHistory();
    } else {
      log(`Action: ${data.action}`, 'done');
    }
    updateStatusBadge('done');
  } catch (err) {
    log(err.message, 'error');
    updateStatusBadge('error');
  }
}

function renderTextResult(text) {
  const out = el('pdf-text-output');
  if (!out) return;
  out.style.display = 'block';
  out.querySelector('.pdf-text-content').textContent = text;
}

function clearEditor() {
  _currentFile = null;
  _serverFile = null;
  _originalPages = 0;
  if (el('pdf-preview')) el('pdf-preview').innerHTML = '';
  if (el('pdf-text-output')) el('pdf-text-output').style.display = 'none';
  if (el('pdf-command-input')) el('pdf-command-input').value = '';
  log('Cleared.');
  updateStatusBadge('ready');
}

async function downloadResult() {
  if (!_serverFile) { log('Nothing to download.', 'warn'); return; }
  const a = document.createElement('a');
  a.href = `/api/pdf/file/${encodeURIComponent(_serverFile)}`;
  a.download = _serverFile;
  a.click();
}

function saveHistoryEntry(name, action, serverId = null) {
  const h = loadData().history || [];
  h.unshift({ name, action, serverId, time: Date.now() });
  if (h.length > 20) h.pop();
  saveData({ history: h });
}

function renderHistory() {
  const list = el('pdf-history-list');
  if (!list) return;
  const h = loadData().history || [];
  if (!h.length) { list.innerHTML = '<p class="pdf-empty">No uploads yet.</p>'; return; }
  list.innerHTML = h.map(entry => `
    <div class="pdf-history-item">
      <span class="pdf-history-name">${escapeHtml(entry.name)}</span>
      <span class="pdf-history-action">${entry.action}</span>
      <button class="btn-secondary" data-sid="${escapeHtml(entry.serverId || '')}">Load</button>
    </div>
  `).join('');
  list.querySelectorAll('button[data-sid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sid = btn.dataset.sid;
      if (sid) { _serverFile = sid; setPreview(`/api/pdf/file/${encodeURIComponent(sid)}?t=${Date.now()}`); log('Loaded from history.'); }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
