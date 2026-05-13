const LS_KEY = 'ncc-bookmarks-v1';

function loadData() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}
function saveData(patch) {
  const d = loadData();
  localStorage.setItem(LS_KEY, JSON.stringify({ ...d, ...patch }));
}
function ensureData() {
  const d = loadData();
  if (!Array.isArray(d.items)) d.items = [];
  saveData(d);
  return d;
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseTags(input) {
  if (!input) return [];
  return input.split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

function faviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
  } catch { return ''; }
}

let _fetchAbort = null;
function attemptFetchLink(url) {
  if (!url || !url.startsWith('http')) return;
  const titleInput = document.getElementById('bm-title');
  const descInput = document.getElementById('bm-desc');
  if (!titleInput || !descInput) return;

  const oldTitle = document.getElementById('bm-modal-title')?.textContent;
  const mt = document.getElementById('bm-modal-title');
  if (mt) mt.textContent = (oldTitle || 'Add Bookmark') + ' (Fetching…)';

  if (_fetchAbort) _fetchAbort.abort();
  _fetchAbort = new AbortController();

  fetch(`/api/fetch-link?url=${encodeURIComponent(url)}`, { signal: _fetchAbort.signal })
    .then(r => r.json())
    .then(data => {
      if (mt) mt.textContent = oldTitle || 'Add Bookmark';
      if (!data.ok) return;
      if (data.title && !titleInput.value.trim()) titleInput.value = data.title;
      if (data.description && !descInput.value.trim()) descInput.value = data.description;
    })
    .catch(() => { if (mt) mt.textContent = oldTitle || 'Add Bookmark'; })
    .finally(() => { _fetchAbort = null; });
}

export function initBookmarks() {
  ensureData();
  renderBookmarks();
  bindEvents();
}

function bindEvents() {
  document.getElementById('bm-add-btn')?.addEventListener('click', () => openAddModal());
  document.getElementById('bm-modal-backdrop')?.addEventListener('click', closeModal);
  document.getElementById('bm-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('bm-modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('bm-form')?.addEventListener('submit', onFormSubmit);
  document.getElementById('bm-search')?.addEventListener('input', () => { renderBookmarks(); });
  document.getElementById('bm-folder-filter')?.addEventListener('change', () => { renderBookmarks(); });
  document.getElementById('bm-tag-filter')?.addEventListener('change', () => { renderBookmarks(); });
  document.getElementById('bm-import-btn')?.addEventListener('click', importBookmarks);
  document.getElementById('bm-export-btn')?.addEventListener('click', exportBookmarks);

  const urlInput = document.getElementById('bm-url');
  if (urlInput) {
    let debounceTimer = null;
    urlInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => attemptFetchLink(urlInput.value.trim()), 800);
    });
    urlInput.addEventListener('paste', (e) => {
      const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      if (pasted.startsWith('http')) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => attemptFetchLink(pasted.trim()), 400);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('bm-modal')?.classList.contains('open')) {
      closeModal();
    }
  });

  populateFilters();
}

function populateFilters() {
  const folderSel = document.getElementById('bm-folder-filter');
  const tagSel = document.getElementById('bm-tag-filter');
  if (!folderSel || !tagSel) return;
  const d = ensureData();
  const currentFolder = folderSel.value;
  const currentTag = tagSel.value;

  const folders = new Set(d.items.map(i => i.folder || 'Unfiled'));
  folderSel.innerHTML = '<option value="">All Folders</option>' +
    [...folders].sort().map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
  folderSel.value = folders.has(currentFolder) ? currentFolder : '';

  const tags = new Set();
  d.items.forEach(i => (i.tags || []).forEach(t => tags.add(t)));
  tagSel.innerHTML = '<option value="">All Tags</option>' +
    [...tags].sort().map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  tagSel.value = tags.has(currentTag) ? currentTag : '';
}

function getFilteredItems() {
  const d = ensureData();
  const query = (document.getElementById('bm-search')?.value || '').toLowerCase().trim();
  const folderFilter = document.getElementById('bm-folder-filter')?.value || '';
  const tagFilter = document.getElementById('bm-tag-filter')?.value || '';

  let list = [...d.items];
  if (folderFilter) list = list.filter(i => (i.folder || 'Unfiled') === folderFilter);
  if (tagFilter) list = list.filter(i => (i.tags || []).includes(tagFilter));
  if (query) {
    list = list.filter(i => {
      const hay = [i.title, i.description, i.url, ...(i.tags || [])].join(' ').toLowerCase();
      return hay.includes(query);
    });
  }
  return list;
}

function getGroupedByFolder(items) {
  const groups = {};
  for (const item of items) {
    const f = item.folder || 'Unfiled';
    (groups[f] ||= []).push(item);
  }
  return groups;
}

function renderBookmarks() {
  const grid = document.getElementById('bm-grid');
  const empty = document.getElementById('bm-empty');
  const toolbar = document.getElementById('bm-toolbar');
  if (!grid || !empty) return;

  const d = ensureData();
  const hasItems = d.items.length > 0;
  if (toolbar) toolbar.classList.toggle('active', hasItems);

  const visible = getFilteredItems();
  populateFilters();

  if (!visible.length) {
    grid.style.display = 'none';
    empty.style.display = 'flex';
    grid.innerHTML = '';
    return;
  }

  grid.style.display = 'grid';
  empty.style.display = 'none';

  const groups = getGroupedByFolder(visible);
  grid.innerHTML = Object.entries(groups).map(([folder, items]) => {
    return `
      <div class="bm-folder-group">
        <div class="bm-folder-header">
          <span class="bm-folder-name">${escapeHtml(folder)}</span>
          <span class="bm-folder-count">${items.length}</span>
        </div>
        <div class="bm-folder-grid">
          ${items.map(item => renderCard(item)).join('')}
        </div>
      </div>
    `;
  }).join('');

  const countEl = document.getElementById('bm-count');
  if (countEl) countEl.textContent = `${visible.length} of ${d.items.length}`;

  // Wire actions
  grid.querySelectorAll('.bm-card-delete').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteItem(btn.dataset.id); });
  });
  grid.querySelectorAll('.bm-card-edit').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(btn.dataset.id); });
  });
  grid.querySelectorAll('.bm-card').forEach(card => {
    card.addEventListener('click', () => { window.open(card.dataset.url, '_blank'); });
  });
}

function renderCard(item) {
  const fav = item.faviconUrl || faviconUrl(item.url) || '';
  const domain = (() => { try { return new URL(item.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  return `
    <div class="bm-card" data-id="${escapeHtml(item.id)}" data-url="${escapeHtml(item.url)}" role="button" tabindex="0">
      <img class="bm-card-favicon" src="${escapeHtml(fav)}" alt="" loading="lazy" onerror="this.style.display='none'">
      <div class="bm-card-body">
        <div class="bm-card-title">${escapeHtml(item.title || '(Untitled)')}</div>
        <div class="bm-card-url">${escapeHtml(domain)}</div>
        ${item.description ? `<div class="bm-card-desc">${escapeHtml(item.description.substring(0, 120))}${item.description.length > 120 ? '…' : ''}</div>` : ''}
        ${item.tags?.length ? `<div class="bm-card-tags">${item.tags.map(t => `<span class="bm-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="bm-card-actions">
        <button class="bm-card-action-btn bm-card-edit" data-id="${escapeHtml(item.id)}" title="Edit" aria-label="Edit">✎</button>
        <button class="bm-card-action-btn bm-card-delete" data-id="${escapeHtml(item.id)}" title="Delete" aria-label="Delete">🗑</button>
      </div>
    </div>
  `;
}

function openAddModal() {
  const modal = document.getElementById('bm-modal');
  const form = document.getElementById('bm-form');
  if (!modal || !form) return;
  form.reset();
  delete form.dataset.editingId;
  document.getElementById('bm-modal-title').textContent = 'Add Bookmark';
  document.getElementById('bm-modal-save').textContent = 'Add';
  document.getElementById('bm-folder').value = document.getElementById('bm-folder-filter')?.value || '';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('bm-url')?.focus(), 50);
}

function openEditModal(id) {
  const d = ensureData();
  const item = d.items.find(i => i.id === id);
  if (!item) return;
  const modal = document.getElementById('bm-modal');
  const form = document.getElementById('bm-form');
  if (!modal || !form) return;
  form.dataset.editingId = id;
  document.getElementById('bm-url').value = item.url || '';
  document.getElementById('bm-title').value = item.title || '';
  document.getElementById('bm-desc').value = item.description || '';
  document.getElementById('bm-folder').value = item.folder || '';
  document.getElementById('bm-tags').value = (item.tags || []).join(', ');
  document.getElementById('bm-modal-title').textContent = 'Edit Bookmark';
  document.getElementById('bm-modal-save').textContent = 'Save';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('bm-title')?.focus(), 50);
}

function closeModal() {
  const modal = document.getElementById('bm-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  const form = document.getElementById('bm-form');
  if (form) delete form.dataset.editingId;
}

function onFormSubmit(e) {
  e.preventDefault();
  const url = document.getElementById('bm-url')?.value.trim();
  const title = document.getElementById('bm-title')?.value.trim();
  if (!url || !title) {
    showToast('URL and Title are required');
    return;
  }

  const form = document.getElementById('bm-form');
  const editingId = form?.dataset.editingId;
  const d = ensureData();

  const folderVal = document.getElementById('bm-folder')?.value.trim() || 'Unfiled';
  const payload = {
    url,
    title,
    description: document.getElementById('bm-desc')?.value.trim() || '',
    folder: folderVal,
    tags: parseTags(document.getElementById('bm-tags')?.value),
    faviconUrl: faviconUrl(url),
    updatedAt: new Date().toISOString()
  };

  if (editingId) {
    const idx = d.items.findIndex(i => i.id === editingId);
    if (idx === -1) { showToast('Item not found'); return; }
    d.items[idx] = { ...d.items[idx], ...payload };
    saveData(d);
    renderBookmarks();
    closeModal();
    showToast('Bookmark updated');
    return;
  }

  d.items.unshift({ id: uuid(), ...payload, createdAt: new Date().toISOString(), visitCount: 0 });
  saveData(d);
  renderBookmarks();
  closeModal();
  showToast('Bookmark saved');
}

function deleteItem(id) {
  const d = ensureData();
  d.items = d.items.filter(i => i.id !== id);
  saveData(d);
  renderBookmarks();
  showToast('Bookmark deleted');
}

function exportBookmarks() {
  const d = ensureData();
  const items = d.items || [];
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;
  const folders = {};
  for (const item of items) {
    const f = item.folder || 'Unfiled';
    (folders[f] ||= []).push(item);
  }
  for (const [folder, fitems] of Object.entries(folders)) {
    html += `  <DT><H3>${escapeHtml(folder)}</H3>\n  <DL><p>\n`;
    for (const item of fitems) {
      const addDate = Math.floor(new Date(item.createdAt || Date.now()).getTime() / 1000);
      html += `    <DT><A HREF="${escapeHtml(item.url)}" ADD_DATE="${addDate}">${escapeHtml(item.title)}</A>\n`;
    }
    html += `  </DL><p>\n`;
  }
  html += `</DL><p>\n`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nexus-bookmarks-${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Bookmarks exported');
}

function importBookmarks() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.html,.htm';
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const links = [];
    // Parse Netscape HTML format
    const regex = /<DT>\s*<A\s+[^>]*HREF=["']([^"']+)["'][^>]*>(.*?)<\/A>/gi;
    let m;
    while ((m = regex.exec(text)) !== null) {
      links.push({ url: m[1], title: m[2].replace(/<[^>]+>/g, '').trim() });
    }
    if (!links.length) { showToast('No bookmarks found in file', 'error'); return; }
    const d = ensureData();
    const added = [];
    for (const link of links) {
      if (d.items.some(i => i.url === link.url)) continue;
      added.push({
        id: uuid(),
        url: link.url,
        title: link.title || '(Untitled)',
        description: '',
        folder: 'Imported',
        tags: [],
        faviconUrl: faviconUrl(link.url),
        createdAt: new Date().toISOString(),
        visitCount: 0
      });
    }
    d.items.unshift(...added);
    saveData(d);
    renderBookmarks();
    showToast(`Imported ${added.length} bookmarks`);
  });
  input.click();
}

function showToast(msg, type = 'success') {
  if (typeof window.toast === 'function') window.toast(msg, type);
  else {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.textContent = msg;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }
}
