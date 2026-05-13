const toast = (...args) => (window.toast ? window.toast(...args) : undefined);

import { AttachmentStore, attachStrip, wireAttachmentDrop } from '../lib/attachment-store.js';

const KEY = 'ncc-notes';
let notes = [];
let activeId = null;
let autoSaveTimer = null;

function load() {
  try { notes = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { notes = []; }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(notes));
  updateBadge();
}
function genId() {
  return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}
function byDate(a, b) { return b.updatedAt - a.updatedAt; }

export function initNotes() {
  load();
  cacheDOM();
  bindEvents();
  bindAttachmentEvents();
  renderList();
  updateBadge();
  if (notes.length) selectNote(notes[0].id);
  // Orphan scan after short delay so other modules have loaded
  setTimeout(() => _runOrphanScan(), 3000);
}

let els = {};
function cacheDOM() {
  els = {
    list: document.getElementById('notes-list'),
    search: document.getElementById('notes-search'),
    newBtn: document.getElementById('notes-new-btn'),
    title: document.getElementById('note-title'),
    content: document.getElementById('note-content'),
    deleteBtn: document.getElementById('note-delete-btn'),
    empty: document.getElementById('notes-empty'),
    editor: document.getElementById('notes-editor'),
    meta: document.getElementById('note-meta'),
    attachStrip: document.getElementById('note-attachments'),
    attachBtn: document.getElementById('note-attach-btn'),
    attachInput: document.getElementById('note-attach-input'),
    dragOverlay: document.getElementById('note-drag-overlay'),
  };
}

function bindEvents() {
  els.newBtn.addEventListener('click', createNote);
  els.deleteBtn.addEventListener('click', deleteActive);
  els.search.addEventListener('input', () => renderList(els.search.value.trim()));
  els.title.addEventListener('input', scheduleAutoSave);
  els.content.addEventListener('input', scheduleAutoSave);
}

function bindAttachmentEvents() {
  if (els.attachBtn && els.attachInput) {
    els.attachBtn.addEventListener('click', () => els.attachInput.click());
  }
  wireAttachmentDrop(document.body, {
    input: els.attachInput,
    onFiles: (files) => attachFiles(files)
  });

  // Drag overlay toggle
  window.addEventListener('dragenter', (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      els.dragOverlay?.classList.add('attachment-dragover');
    }
  });
  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) els.dragOverlay?.classList.remove('attachment-dragover');
  });
  window.addEventListener('drop', () => {
    els.dragOverlay?.classList.remove('attachment-dragover');
  });
}

async function attachFiles(files) {
  if (!activeId) {
    toast('Select a note first', 'warning');
    return;
  }
  const n = notes.find(x => x.id === activeId);
  if (!n) return;
  n.attachments = n.attachments || [];
  let okCount = 0;
  for (const file of files) {
    try {
      const result = await AttachmentStore.saveFile(file, n.id);
      if (result.ok) {
        n.attachments.push(result.meta);
        okCount++;
      } else {
        toast(result.error || 'Failed to attach file', 'error');
      }
    } catch (e) {
      toast('Attach failed: ' + (e.message || e), 'error');
    }
  }
  if (okCount) {
    save();
    renderAttachments(n);
    renderList(els.search?.value?.trim());
    toast(`${okCount} file${okCount > 1 ? 's' : ''} attached`);
  }
}

function renderAttachments(note) {
  if (!els.attachStrip) return;
  attachStrip(els.attachStrip, note.attachments || [], {
    onDelete: (att) => removeNoteAttachment(att),
    onDownload: (att) => AttachmentStore.download(att)
  });
}

async function removeNoteAttachment(att) {
  const n = notes.find(x => x.id === activeId);
  if (!n || !n.attachments) return;
  if (!confirm(`Remove "${att.name || 'file'}"?`)) return;
  try {
    await AttachmentStore.deleteFile(att);
  } catch (e) { console.warn('Blob delete failed', e); }
  n.attachments = n.attachments.filter(a => a.id !== att.id);
  save();
  renderAttachments(n);
  renderList(els.search?.value?.trim());
  toast('Attachment removed');
}

function createNote() {
  const note = { id: genId(), title: '', content: '', folder: '', tags: [], attachments: [], createdAt: Date.now(), updatedAt: Date.now() };
  notes.unshift(note);
  save();
  renderList(els.search?.value?.trim());
  selectNote(note.id);
  toast('New note created');
}

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(autoSave, 600);
}

function autoSave() {
  if (!activeId) return;
  const n = notes.find(x => x.id === activeId);
  if (!n) return;
  const t = els.title.value.trim();
  const c = els.content.value;
  if (n.title === t && n.content === c) return;
  n.title = t || 'Untitled';
  n.content = c;
  n.updatedAt = Date.now();
  save();
  renderList(els.search?.value?.trim());
}

function deleteActive() {
  if (!activeId) return;
  if (!confirm('Delete this note?')) return;
  const n = notes.find(x => x.id === activeId);
  if (n && n.attachments?.length) {
    // Clean up blobs
    n.attachments.forEach(att => {
      AttachmentStore.deleteFile(att).catch(() => {});
    });
  }
  notes = notes.filter(n => n.id !== activeId);
  save();
  activeId = null;
  renderList(els.search?.value?.trim());
  showEditor(false);
  toast('Note deleted');
}

function selectNote(id) {
  activeId = id;
  const n = notes.find(x => x.id === id);
  if (!n) return;
  els.title.value = n.title === 'Untitled' ? '' : n.title;
  els.content.value = n.content;
  const d = new Date(n.updatedAt);
  els.meta.textContent = 'Edited ' + d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  showEditor(true);
  renderAttachments(n);
  renderList(els.search?.value?.trim());
}

function showEditor(show) {
  els.empty.style.display = show ? 'none' : 'flex';
  els.editor.style.display = show ? 'flex' : 'none';
  els.deleteBtn.style.display = show ? 'inline-flex' : 'none';
  if (!show && els.attachStrip) els.attachStrip.innerHTML = '';
}

function renderList(query = '') {
  const q = query.toLowerCase();
  const filtered = notes.filter(n =>
    (n.title || '').toLowerCase().includes(q) ||
    (n.content || '').toLowerCase().includes(q)
  ).sort(byDate);

  const badge = (n) => (n.attachments?.length ? ` 📎${n.attachments.length}` : '');

  if (!filtered.length) {
    els.list.innerHTML = `<div class="notes-empty-list">${query ? 'No notes match' : 'No notes yet'}</div>`;
    return;
  }

  els.list.innerHTML = filtered.map(n => {
    const active = n.id === activeId ? 'active' : '';
    const preview = (n.content || '').replace(/\s+/g, ' ').slice(0, 60);
    const title = n.title || 'Untitled';
    const d = new Date(n.updatedAt);
    const time = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<button class="notes-item ${active}" data-id="${n.id}">
      <div class="notes-item-title">${esc(title)}${badge(n)}</div>
      <div class="notes-item-preview">${esc(preview)}</div>
      <div class="notes-item-meta">${time}</div>
    </button>`;
  }).join('');

  els.list.querySelectorAll('.notes-item').forEach(btn => {
    btn.addEventListener('click', () => selectNote(btn.dataset.id));
  });
}

function updateBadge() {
  const badge = document.getElementById('notes-badge');
  if (badge) { badge.textContent = notes.length; badge.style.display = notes.length ? 'flex' : 'none'; }
}

function esc(s) {
  return (s || '').replace(/[&<>"]/g, c => ({&:'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

/* ===== AGENT HELPERS ===== */
export function noteFindByTitle(q) {
  const low = q.toLowerCase();
  return notes.filter(n => (n.title || '').toLowerCase().includes(low));
}

export function noteAddAttachment(noteId, file) {
  const n = notes.find(x => x.id === noteId);
  if (!n) return { ok: false, error: 'Note not found' };
  n.attachments = n.attachments || [];
  return AttachmentStore.saveFile(file, n.id).then(result => {
    if (result.ok) {
      n.attachments.push(result.meta);
      save();
      if (activeId === n.id) renderAttachments(n);
      renderList(els.search?.value?.trim());
    }
    return result;
  });
}

export function noteShowAttachments(noteId) {
  const n = notes.find(x => x.id === noteId);
  if (!n) return [];
  return n.attachments || [];
}

/* ===== ORPHAN SCAN ===== */
function _runOrphanScan() {
  try {
    const used = new Set();
    notes.forEach(n => {
      (n.attachments || []).forEach(a => used.add(a.key));
    });
    AttachmentStore.orphanScan(Array.from(used)).then(count => {
      if (count > 0) console.log(`[AttachmentStore] Cleaned ${count} orphaned blobs`);
    }).catch(() => {});
  } catch { /* silent */ }
}
