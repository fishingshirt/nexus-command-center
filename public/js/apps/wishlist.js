const LS_KEY = 'ncc-wishlist-v1';

const PRIORITY_ORDER = { 'Must Buy': 4, High: 3, Normal: 2, Low: 1 };
const STATUS_ORDER = { Want: 1, Watching: 2, Purchased: 3, Archived: 4 };

const PRIORITY_META = {
  Low:    { color: '#22c55e', label: 'Low' },
  Normal: { color: '#3b82f6', label: 'Normal' },
  High:   { color: '#f59e0b', label: 'High' },
  'Must Buy': { color: '#ef4444', label: 'Must Buy' }
};

const STATUS_META = {
  Want:      { class: 'status-want' },
  Watching:  { class: 'status-watching' },
  Purchased: { class: 'status-purchased' },
  Archived:  { class: 'status-archived' }
};

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

function parseTags(input) {
  if (!input) return [];
  return input.split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let _fetchAbort = null;
function attemptFetchLink(url) {
  if (!url || !url.startsWith('http')) return;
  const titleInput = document.getElementById('wishlist-title');
  const imageInput = document.getElementById('wishlist-image');
  const priceInput = document.getElementById('wishlist-price');
  if (!titleInput || !imageInput || !priceInput) return;

  const modalTitle = document.getElementById('wishlist-modal-title');
  const oldTitle = modalTitle?.textContent;
  if (modalTitle) modalTitle.textContent = oldTitle + ' (Fetching…)';

  if (_fetchAbort) _fetchAbort.abort();
  _fetchAbort = new AbortController();

  fetch(`/api/fetch-link?url=${encodeURIComponent(url)}`, { signal: _fetchAbort.signal })
    .then(r => r.json())
    .then(data => {
      if (modalTitle) modalTitle.textContent = oldTitle;
      if (!data.ok) return;
      if (data.title && !titleInput.value.trim()) titleInput.value = data.title;
      if (data.image && !imageInput.value.trim()) imageInput.value = data.image;
      if (data.price != null && priceInput.value === '') priceInput.value = data.price;
    })
    .catch(() => { if (modalTitle) modalTitle.textContent = oldTitle; })
    .finally(() => { _fetchAbort = null; });
}

let _toolbarVisible = false;

export function initWishlist() {
  ensureData();
  renderWishlist();
  bindEvents();
}

function bindEvents() {
  const addBtn = document.getElementById('wishlist-add-btn');
  addBtn?.addEventListener('click', () => openAddModal());

  const modal = document.getElementById('wishlist-modal');
  const backdrop = document.getElementById('wishlist-modal-backdrop');
  const closeBtn = document.getElementById('wishlist-modal-close');
  const cancelBtn = document.getElementById('wishlist-modal-cancel');
  const form = document.getElementById('wishlist-form');

  backdrop?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  form?.addEventListener('submit', onFormSubmit);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('open')) {
      closeModal();
    }
  });

  document.getElementById('wishlist-search')?.addEventListener('input', renderWishlist);
  document.getElementById('wishlist-sort')?.addEventListener('change', renderWishlist);
  document.getElementById('wishlist-filter')?.addEventListener('change', renderWishlist);
  document.getElementById('wishlist-filter-priority')?.addEventListener('change', renderWishlist);
  document.getElementById('wishlist-filter-tag')?.addEventListener('change', renderWishlist);
  document.getElementById('wishlist-show-archived')?.addEventListener('change', renderWishlist);
  populateTagFilter();

  const urlInput = document.getElementById('wishlist-url');
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

  const detailClose = document.getElementById('wishlist-detail-close');
  const detailBackdrop = document.getElementById('wishlist-detail-backdrop');
  const detailEdit = document.getElementById('wishlist-detail-edit');
  const detailNotes = document.querySelector('.wishlist-detail-notes');
  detailClose?.addEventListener('click', closeDetailModal);
  detailBackdrop?.addEventListener('click', closeDetailModal);
  detailEdit?.addEventListener('click', () => {
    const id = detailEdit.dataset.id;
    closeDetailModal();
    if (id) openEditModal(id);
  });
  detailNotes?.addEventListener('change', onDetailNotesChange);
  detailNotes?.addEventListener('blur', onDetailNotesChange);
  document.querySelectorAll('.wishlist-detail-status-btn').forEach(b => {
    b.addEventListener('click', onStatusChange);
  });
}

function populateTagFilter() {
  const sel = document.getElementById('wishlist-filter-tag');
  if (!sel) return;
  const { items } = ensureData();
  const current = sel.value;
  const all = new Set();
  items.forEach(i => (i.tags || []).forEach(t => all.add(t)));
  sel.innerHTML = '<option value="">All Tags</option>' + [...all].sort().map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  sel.value = all.has(current) ? current : '';
}

function getFilteredSortedItems() {
  const { items } = ensureData();
  const query = (document.getElementById('wishlist-search')?.value || '').toLowerCase().trim();
  const sort = document.getElementById('wishlist-sort')?.value || 'created-desc';
  const statusFilter = document.getElementById('wishlist-filter')?.value || '';
  const priorityFilter = document.getElementById('wishlist-filter-priority')?.value || '';
  const tagFilter = document.getElementById('wishlist-filter-tag')?.value || '';
  const showArchived = document.getElementById('wishlist-show-archived')?.checked;

  let list = [...items];

  if (!showArchived) list = list.filter(i => i.status !== 'Archived');
  if (statusFilter) list = list.filter(i => i.status === statusFilter);
  if (priorityFilter) list = list.filter(i => i.priority === priorityFilter);
  if (tagFilter) list = list.filter(i => (i.tags || []).includes(tagFilter));

  if (query) {
    list = list.filter(i => {
      const hay = [i.title, i.notes, ...(i.tags || [])].join(' ').toLowerCase();
      return hay.includes(query);
    });
  }

  const [field, dir] = sort.split('-');
  const desc = dir === 'desc' ? -1 : 1;
  list.sort((a, b) => {
    if (field === 'price') {
      const av = a.price ?? -Infinity, bv = b.price ?? -Infinity;
      return (av - bv) * desc;
    }
    if (field === 'priority') {
      const av = PRIORITY_ORDER[a.priority] || 0, bv = PRIORITY_ORDER[b.priority] || 0;
      return (av - bv) * desc;
    }
    if (field === 'status') {
      const av = STATUS_ORDER[a.status] || 0, bv = STATUS_ORDER[b.status] || 0;
      return (av - bv) * desc;
    }
    if (field === 'created') {
      return (new Date(a.created) - new Date(b.created)) * desc;
    }
    if (field === 'updated') {
      return (new Date(a.updated) - new Date(b.updated)) * desc;
    }
    return 0;
  });
  return list;
}

function renderWishlist() {
  const grid = document.getElementById('wishlist-grid');
  const empty = document.getElementById('wishlist-empty');
  const toolbar = document.getElementById('wishlist-toolbar');
  if (!grid || !empty || !toolbar) return;

  const { items } = ensureData();
  const hasItems = items.length > 0;

  // Show/hide toolbar using class (CSS handles display)
  toolbar.classList.toggle('active', hasItems);

  const visible = getFilteredSortedItems();

  if (!visible.length) {
    grid.style.display = 'none';
    empty.style.display = 'flex';
    grid.innerHTML = '';
    return;
  }

  grid.style.display = 'grid';
  empty.style.display = 'none';

  grid.innerHTML = visible.map(item => renderCard(item)).join('');

  const countEl = document.getElementById('wishlist-count');
  if (countEl) {
    const total = (ensureData().items || []).length;
    countEl.textContent = `Showing ${visible.length} of ${total}`;
  }

  // Attach delete + edit handlers
  grid.querySelectorAll('.wishlist-card-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(btn.dataset.id);
    });
  });
  grid.querySelectorAll('.wishlist-card-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(btn.dataset.id);
    });
  });
  grid.querySelectorAll('.wishlist-card-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyLink(btn.dataset.url);
    });
  });
  grid.querySelectorAll('.wishlist-card').forEach(card => {
    card.addEventListener('click', () => openDetailModal(card.dataset.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') openDetailModal(card.dataset.id);
    });
  });
}

function renderCard(item) {
  const p = PRIORITY_META[item.priority] || PRIORITY_META.Normal;
  const s = STATUS_META[item.status] || STATUS_META.Want;
  const priceStr = item.price != null ? `${currencySymbol(item.currency)}${Number(item.price).toFixed(2)}` : '';
  const img = item.image || '';
  const placeholderSvg = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;

  return `
    <div class="wishlist-card" data-id="${escapeHtml(item.id)}" style="border-left: 4px solid ${p.color}" role="button" tabindex="0">
      <div class="wishlist-card-img-wrap">
        ${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">` : ''}
        <div class="wishlist-card-img-placeholder" style="display:${img ? 'none' : 'flex'}">${placeholderSvg}</div>
      </div>
      <div class="wishlist-card-body">
        <div class="wishlist-card-title">${escapeHtml(item.title)}</div>
        <div class="wishlist-card-meta">
          ${priceStr ? `<span class="wishlist-card-price">${priceStr}</span>` : ''}
          <span class="wishlist-card-status ${s.class}">${escapeHtml(item.status)}</span>
        </div>
        ${item.tags?.length ? `<div class="wishlist-card-tags">${item.tags.map(t => `<span class="wishlist-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${item.notes ? `<div class="wishlist-card-note-preview">${escapeHtml(item.notes.substring(0, 120))}${item.notes.length > 120 ? '…' : ''}</div>` : ''}
        <div class="wishlist-card-actions">
          <button class="wishlist-card-action-btn wishlist-card-copy" data-url="${escapeHtml(item.url || '')}" aria-label="Copy link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          </button>
          <button class="wishlist-card-action-btn wishlist-card-edit" data-id="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(item.title)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="wishlist-card-action-btn wishlist-card-delete" data-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function copyLink(url) {
  if (!url) { showToast('No URL to copy'); return; }
  try {
    navigator.clipboard.writeText(url).then(() => showToast('Copied link'));
  } catch (_) { showToast('Could not copy'); }
}

function openDetailModal(id) {
  const d = ensureData();
  const item = d.items.find(i => i.id === id);
  if (!item) return;
  const panel = document.getElementById('wishlist-detail-panel');
  if (!panel) { openEditModal(id); return; }
  const p = PRIORITY_META[item.priority] || PRIORITY_META.Normal;
  const s = STATUS_META[item.status] || STATUS_META.Want;
  const img = item.image || '';
  const priceStr = item.price != null ? `${currencySymbol(item.currency)}${Number(item.price).toFixed(2)}` : '';
  const placeholderSvg = panel.querySelector('.wishlist-detail-image')?.dataset?.placeholder || '';
  panel.querySelector('.wishlist-detail-header h3').textContent = item.title;
  panel.querySelector('.wishlist-detail-image').innerHTML = img ? `<img src="${escapeHtml(img)}" alt="" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">` : (placeholderSvg || '');
  const metaEl = panel.querySelector('.wishlist-detail-meta');
  metaEl.innerHTML = `
    ${priceStr ? `<span class="wishlist-detail-price">${priceStr}</span>` : ''}
    <span class="wishlist-detail-priority" style="color:${p.color}">${p.label}</span>
    <span class="wishlist-detail-status ${s.class}">${escapeHtml(item.status)}</span>
    ${(item.tags || []).length ? `<div class="wishlist-detail-tags">${item.tags.map(t => `<span class="wishlist-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
  `;
  const notesEl = panel.querySelector('.wishlist-detail-notes');
  notesEl.value = item.notes || '';
  notesEl.dataset.id = id;
  const urlEl = panel.querySelector('.wishlist-detail-url');
  if (item.url) {
    urlEl.href = item.url;
    urlEl.textContent = item.url.replace(/^https?:\/\//, '').substring(0, 40);
    urlEl.style.display = 'inline-block';
  } else { urlEl.style.display = 'none'; }
  panel.querySelector('.wishlist-detail-edit').dataset.id = id;
  panel.querySelectorAll('.wishlist-detail-status-btn').forEach(b => {
    b.dataset.id = id;
    b.disabled = item.status === b.dataset.status;
  });
  panel.classList.add('open');
  const bd = document.getElementById('wishlist-detail-backdrop');
  if (bd) bd.classList.add('open');
}

function closeDetailModal() {
  const panel = document.getElementById('wishlist-detail-panel');
  const backdrop = document.getElementById('wishlist-detail-backdrop');
  if (panel) panel.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

function onDetailNotesChange(e) {
  const id = e.target.dataset.id;
  const notes = e.target.value || '';
  if (!id) return;
  const d = ensureData();
  const idx = d.items.findIndex(i => i.id === id);
  if (idx === -1) return;
  d.items[idx].notes = notes;
  d.items[idx].updated = new Date().toISOString();
  saveData(d);
  renderWishlist();
}

function onStatusChange(e) {
  const id = e.target.dataset.id;
  const status = e.target.dataset.status;
  if (!id || !status) return;
  const d = ensureData();
  const idx = d.items.findIndex(i => i.id === id);
  if (idx === -1) return;
  d.items[idx].status = status;
  d.items[idx].updated = new Date().toISOString();
  saveData(d);
  renderWishlist();
  openDetailModal(id);
}

function currencySymbol(cur) {
  const map = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', JPY: '¥', Other: '' };
  return map[cur] || map.USD;
}

function openAddModal() {
  const modal = document.getElementById('wishlist-modal');
  const form = document.getElementById('wishlist-form');
  if (!modal || !form) return;
  form.reset();
  delete form.dataset.editingId;
  document.getElementById('wishlist-modal-title').textContent = 'Add Item';
  document.getElementById('wishlist-modal-save').textContent = 'Add Item';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('wishlist-title')?.focus(), 50);
}

function openEditModal(id) {
  const d = ensureData();
  const item = d.items.find(i => i.id === id);
  if (!item) return;

  const modal = document.getElementById('wishlist-modal');
  const form = document.getElementById('wishlist-form');
  if (!modal || !form) return;

  form.dataset.editingId = id;
  document.getElementById('wishlist-title').value = item.title || '';
  document.getElementById('wishlist-url').value = item.url || '';
  document.getElementById('wishlist-image').value = item.image || '';
  document.getElementById('wishlist-price').value = item.price != null ? item.price : '';
  document.getElementById('wishlist-currency').value = item.currency || 'USD';
  document.getElementById('wishlist-priority').value = item.priority || 'Normal';
  document.getElementById('wishlist-tags').value = (item.tags || []).join(', ');
  document.getElementById('wishlist-notes').value = item.notes || '';

  document.getElementById('wishlist-modal-title').textContent = 'Edit Item';
  document.getElementById('wishlist-modal-save').textContent = 'Save Changes';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('wishlist-title')?.focus(), 50);
}

function closeModal() {
  const modal = document.getElementById('wishlist-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  const trigger = document.getElementById('wishlist-add-btn');
  trigger?.focus();
  const form = document.getElementById('wishlist-form');
  if (form) delete form.dataset.editingId;
}

function onFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('wishlist-title')?.value.trim();
  if (!title) {
    showToast('Title is required');
    return;
  }

  const form = document.getElementById('wishlist-form');
  const editingId = form?.dataset.editingId;

  const d = ensureData();
  if (editingId) {
    const idx = d.items.findIndex(i => i.id === editingId);
    if (idx === -1) {
      showToast('Item not found');
      return;
    }
    d.items[idx] = {
      ...d.items[idx],
      title,
      url: document.getElementById('wishlist-url')?.value.trim() || '',
      image: document.getElementById('wishlist-image')?.value.trim() || '',
      price: parseFloat(document.getElementById('wishlist-price')?.value) || null,
      currency: document.getElementById('wishlist-currency')?.value || 'USD',
      priority: document.getElementById('wishlist-priority')?.value || 'Normal',
      tags: parseTags(document.getElementById('wishlist-tags')?.value),
      notes: document.getElementById('wishlist-notes')?.value.trim() || '',
      updated: new Date().toISOString()
    };
    saveData(d);
    renderWishlist();
    closeModal();
    showToast('Item updated');
    return;
  }

  const item = {
    id: uuid(),
    title,
    url: document.getElementById('wishlist-url')?.value.trim() || '',
    image: document.getElementById('wishlist-image')?.value.trim() || '',
    price: parseFloat(document.getElementById('wishlist-price')?.value) || null,
    currency: document.getElementById('wishlist-currency')?.value || 'USD',
    priority: document.getElementById('wishlist-priority')?.value || 'Normal',
    status: 'Want',
    tags: parseTags(document.getElementById('wishlist-tags')?.value),
    notes: document.getElementById('wishlist-notes')?.value.trim() || '',
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  d.items.unshift(item);
  saveData(d);
  renderWishlist();
  closeModal();
  showToast('Added to wishlist');
}

function deleteItem(id) {
  const d = ensureData();
  const before = d.items.length;
  d.items = d.items.filter(i => i.id !== id);
  if (d.items.length < before) {
    saveData(d);
    renderWishlist();
    showToast('Item deleted');
  }
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2500);
}
