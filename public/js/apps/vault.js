/**
 * Vault App — T-031-a frontend skeleton
 * Handles folder tree, file list, drag-drop upload, search, delete/move UI.
 * Server API wired to /api/vault/* — returns friendly errors until T-031-c lands.
 */

const LS_KEY = 'ncc-vault-meta';

const state = {
  files: [],
  folders: ['All Files', 'Documents', 'Images', 'Videos', 'Music', 'Archives', 'Other'],
  activeFolder: 'All Files',
  search: '',
};

/* --- helpers --- */
function load() {
  try { state.files = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { state.files = []; }
}
function save() { localStorage.setItem(LS_KEY, JSON.stringify(state.files)); }

function fmtBytes(b) {
  if (!b) return '0 B';
  const units = ['B','KB','MB','GB'];
  let i = 0; while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function iconFor(type = '', name = '') {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return '📄';
  if (type.includes('zip') || type.includes('compressed') || name.endsWith('.zip')) return '📦';
  if (name.match(/\.(js|ts|py|html|css|json|md|txt|csv|sh)$/i)) return '📜';
  return '📁';
}

function folderFor(type = '', name = '') {
  if (type.startsWith('image/')) return 'Images';
  if (type.startsWith('video/')) return 'Videos';
  if (type.startsWith('audio/')) return 'Music';
  if (type === 'application/pdf') return 'Documents';
  if (type.includes('zip') || type.includes('compressed')) return 'Archives';
  return 'Documents';
}

/* --- rendering --- */
export function initVault() {
  load();
  const view = document.getElementById('view-vault');
  if (!view) return;

  renderFolders();
  renderFiles();
  bindEvents();
}

function renderFolders() {
  const el = document.getElementById('vault-folder-list');
  if (!el) return;
  el.innerHTML = state.folders.map(f => {
    const count = f === 'All Files' ? state.files.length : state.files.filter(i => i.folder === f).length;
    const active = f === state.activeFolder ? 'active' : '';
    return `<button class="vault-folder-btn ${active}" data-folder="${f}">${f} <span class="vault-folder-count">${count}</span></button>`;
  }).join('');
}

function renderFiles() {
  const list = document.getElementById('vault-file-list');
  if (!list) return;
  let items = state.files;
  if (state.activeFolder !== 'All Files') items = items.filter(i => i.folder === state.activeFolder);
  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    items = items.filter(i => i.name.toLowerCase().includes(q));
  }
  if (!items.length) {
    list.innerHTML = `<div class="vault-empty">${state.search.trim() ? 'No matches.' : 'Drop files here or tap Upload.'}</div>`;
    return;
  }
  list.innerHTML = items.map((f, idx) => `
    <div class="vault-file-row" data-id="${f.id}">
      <span class="vault-file-icon">${iconFor(f.type, f.name)}</span>
      <span class="vault-file-name">${f.name}</span>
      <span class="vault-file-meta">${fmtBytes(f.size)} · ${f.date || ''}</span>
      <span class="vault-file-folder">${f.folder}</span>
      <div class="vault-file-actions">
        <button class="vault-btn-icon" data-action="download" data-id="${f.id}" aria-label="Download">⬇️</button>
        <button class="vault-btn-icon" data-action="move"   data-id="${f.id}" aria-label="Move">📂</button>
        <button class="vault-btn-icon" data-action="delete" data-id="${f.id}" aria-label="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

/* --- events --- */
function bindEvents() {
  const search = document.getElementById('vault-search');
  if (search) {
    search.addEventListener('input', e => { state.search = e.target.value; renderFiles(); });
  }

  const folderList = document.getElementById('vault-folder-list');
  if (folderList) {
    folderList.addEventListener('click', e => {
      const btn = e.target.closest('.vault-folder-btn');
      if (!btn) return;
      state.activeFolder = btn.dataset.folder;
      renderFolders();
      renderFiles();
    });
  }

  const fileList = document.getElementById('vault-file-list');
  if (fileList) {
    fileList.addEventListener('click', e => {
      const btn = e.target.closest('.vault-btn-icon');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      if (action === 'delete') onDelete(id);
      else if (action === 'download') onDownload(id);
      else if (action === 'move') onMove(id);
    });
  }

  const dropZone = document.getElementById('vault-drop-zone');
  const fileInput = document.getElementById('vault-file-input');
  const uploadBtn = document.getElementById('vault-upload-btn');

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
  }

  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput && fileInput.click());
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });
  }
}

/* --- actions --- */
async function handleFiles(fileList) {
  if (!fileList?.length) return;
  for (const file of fileList) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const item = {
      id, name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      folder: folderFor(file.type, file.name),
      date: new Date().toISOString().slice(0,10),
    };
    state.files.push(item);

    // optimistic server post (will succeed once T-031-c lands)
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/vault/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json().catch(() => ({}));
      if (json.id) item.remoteId = json.id;
    } catch {
      // silently queue for later; local state already updated
    }
  }
  save();
  renderFolders();
  renderFiles();
  window.toast && toast(`${fileList.length} file(s) added`);
}

function onDelete(id) {
  if (!window.confirm('Delete this file from Vault?')) return;
  state.files = state.files.filter(f => f.id !== id);
  save();
  renderFolders();
  renderFiles();
  window.toast && toast('File deleted');
}

function onDownload(id) {
  const file = state.files.find(f => f.id === id);
  if (!file) return;
  if (file.remoteId) {
    const a = document.createElement('a');
    a.href = `/api/vault/download?id=${file.remoteId}`;
    a.download = file.name;
    a.click();
  } else {
    window.toast && toast('File not yet synced to server', 'error');
  }
}

function onMove(id) {
  const file = state.files.find(f => f.id === id);
  if (!file) return;
  const opts = state.folders.filter(f => f !== 'All Files').map(f => `<option value="${f}">${f}</option>`).join('');
  const sel = document.createElement('select');
  sel.innerHTML = opts;
  sel.value = file.folder;
  const overlay = document.createElement('div');
  overlay.className = 'vault-move-overlay';
  overlay.innerHTML = `
    <div class="vault-move-panel" role="dialog" aria-modal="true" aria-label="Move file">
      <h4>Move “${file.name}”</h4>
      <div class="vault-move-field"><label>Folder</label></div>
      <div class="vault-move-actions">
        <button class="btn-secondary" id="vault-move-cancel">Cancel</button>
        <button class="btn-primary" id="vault-move-ok">Move</button>
      </div>
    </div>`;
  overlay.querySelector('.vault-move-field').appendChild(sel);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#vault-move-cancel').addEventListener('click', close);
  overlay.querySelector('#vault-move-ok').addEventListener('click', () => {
    file.folder = sel.value;
    save();
    renderFolders();
    renderFiles();
    close();
    window.toast && toast('File moved');
  });
}
