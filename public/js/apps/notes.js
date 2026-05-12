const toast = (...args) => (window.toast ? window.toast(...args) : undefined);

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
  renderList();
  updateBadge();
  if (notes.length) selectNote(notes[0].id);
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
  };
}

function bindEvents() {
  els.newBtn.addEventListener('click', createNote);
  els.deleteBtn.addEventListener('click', deleteActive);
  els.search.addEventListener('input', () => renderList(els.search.value.trim()));
  els.title.addEventListener('input', scheduleAutoSave);
  els.content.addEventListener('input', scheduleAutoSave);
}

function createNote() {
  const note = { id: genId(), title: '', content: '', folder: '', tags: [], createdAt: Date.now(), updatedAt: Date.now() };
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
  renderList(els.search?.value?.trim());
}

function showEditor(show) {
  els.empty.style.display = show ? 'none' : 'flex';
  els.editor.style.display = show ? 'flex' : 'none';
  els.deleteBtn.style.display = show ? 'inline-flex' : 'none';
}

function renderList(query = '') {
  const q = query.toLowerCase();
  const filtered = notes.filter(n =>
    (n.title || '').toLowerCase().includes(q) ||
    (n.content || '').toLowerCase().includes(q)
  ).sort(byDate);

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
      <div class="notes-item-title">${esc(title)}</div>
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
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
