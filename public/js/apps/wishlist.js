const LS_KEY = 'ncc-wishlist-v2';
const LS_KEY_V1 = 'ncc-wishlist-v1';

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

/* ═══════════════════════════════════════════
   DATA LAYER
   ═══════════════════════════════════════════ */

function loadData() {
  try {
    // Attempt migration from v1
    const v2 = JSON.parse(localStorage.getItem(LS_KEY));
    if (v2) return v2;

    const v1 = JSON.parse(localStorage.getItem(LS_KEY_V1));
    if (v1 && Array.isArray(v1.items)) {
      const generalId = uuid();
      const migrated = {
        projects: [{
          id: generalId,
          name: 'General',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          pinned: false
        }],
        items: v1.items.map(i => ({
          ...i,
          projectId: generalId,
          updated: i.updated || i.created || new Date().toISOString()
        })),
        activeProjectId: generalId
      };
      saveDataRaw(migrated);
      localStorage.removeItem(LS_KEY_V1);
      return migrated;
    }
    return {};
  } catch { return {}; }
}

function saveDataRaw(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function saveData(patch) {
  const d = loadData();
  saveDataRaw({ ...d, ...patch });
}

function ensureData() {
  const d = loadData();
  if (!Array.isArray(d.items)) d.items = [];
  if (!Array.isArray(d.projects)) d.projects = [];
  if (!d.activeProjectId && d.projects.length) d.activeProjectId = d.projects[0].id;

  if (!d.projects.length) {
    const generalId = uuid();
    d.projects = [{
      id: generalId,
      name: 'General',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      pinned: false
    }];
    d.activeProjectId = generalId;
    (d.items || []).forEach(i => { i.projectId = generalId; });
  }

  // Ensure all items belong to a valid project
  const validIds = new Set(d.projects.map(p => p.id));
  (d.items || []).forEach(i => {
    if (!i.projectId || !validIds.has(i.projectId)) {
      i.projectId = d.projects[0].id;
    }
  });

  // Ensure active project is valid
  if (!validIds.has(d.activeProjectId)) d.activeProjectId = d.projects[0]?.id;

  saveDataRaw(d);
  return d;
}

export function initWishlist() {
  ensureData();
  renderWishlist();
  bindEvents();
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

function currencySymbol(cur) {
  const map = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', JPY: '¥', Other: '' };
  return map[cur] || map.USD;
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

/* ═══════════════════════════════════════════
   PROJECT MANAGEMENT
   ═══════════════════════════════════════════ */

function createProject(name) {
  const d = ensureData();
  const proj = {
    id: uuid(),
    name: name.trim().slice(0, 60),
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    pinned: false
  };
  d.projects.push(proj);
  d.activeProjectId = proj.id;
  saveDataRaw(d);
  renderWishlist();
  showToast('Project created');
  return proj;
}

function renameProject(id, newName) {
  const d = ensureData();
  const p = d.projects.find(pr => pr.id === id);
  if (!p || id === 'ALL') return;
  p.name = newName.trim().slice(0, 60);
  p.updated = new Date().toISOString();
  saveDataRaw(d);
  renderWishlist();
  showToast('Project renamed');
}

function deleteProject(id) {
  const d = ensureData();
  if (d.projects.length <= 1) {
    showToast('You need at least one project');
    return;
  }
  const fallback = d.projects.find(p => p.id !== id)?.id;
  d.items = d.items.filter(i => i.projectId !== id);
  d.items.forEach(i => { if (i.projectId === id) i.projectId = fallback; });
  d.projects = d.projects.filter(p => p.id !== id);
  d.activeProjectId = fallback;
  saveDataRaw(d);
  renderWishlist();
  showToast('Project deleted');
}

function setActiveProject(id) {
  const d = ensureData();
  d.activeProjectId = id;
  saveDataRaw(d);
  renderWishlist();
}

function getActiveProject() {
  const d = ensureData();
  if (!d.activeProjectId) return d.projects[0] || null;
  return d.projects.find(p => p.id === d.activeProjectId) || d.projects[0] || null;
}

function formatMoney(value, currency) {
  if (value == null || Number.isNaN(value)) return '—';
  const sym = currencySymbol(currency);
  return sym + Number(value).toFixed(2);
}

function computeProjectTotal(projectId, items) {
  const projectItems = items.filter(i =>
    i.projectId === projectId &&
    i.price != null &&
    !Number.isNaN(Number(i.price))
  );
  if (!projectItems.length) return { total: 0, currency: 'USD' };

  // Group by currency
  const byCurrency = {};
  projectItems.forEach(i => {
    const cur = i.currency || 'USD';
    byCurrency[cur] = (byCurrency[cur] || 0) + Number(i.price);
  });

  // Prefer USD, then first currency
  const mainCur = byCurrency.USD ? 'USD' : Object.keys(byCurrency)[0];
  return { total: byCurrency[mainCur] || 0, currency: mainCur };
}

/* ═══════════════════════════════════════════
   RENDERING
   ═══════════════════════════════════════════ */

function getFilteredSortedItems() {
  const d = ensureData();
  let list = [...(d.items || [])];
  const activeProj = d.activeProjectId;

  if (activeProj && activeProj !== 'ALL') {
    list = list.filter(i => i.projectId === activeProj);
  }

  const query = (document.getElementById('wishlist-search')?.value || '').toLowerCase().trim();
  const sort = document.getElementById('wishlist-sort')?.value || 'created-desc';
  const statusFilter = document.getElementById('wishlist-filter')?.value || '';
  const priorityFilter = document.getElementById('wishlist-filter-priority')?.value || '';
  const tagFilter = document.getElementById('wishlist-filter-tag')?.value || '';
  const showArchived = document.getElementById('wishlist-show-archived')?.checked;

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
      return (new Date(a.updated || a.created) - new Date(b.updated || b.created)) * desc;
    }
    return 0;
  });
  return list;
}

function renderWishlist() {
  const d = ensureData();
  const grid = document.getElementById('wishlist-grid');
  const empty = document.getElementById('wishlist-empty');
  const toolbar = document.getElementById('wishlist-toolbar');
  const projectBar = document.getElementById('wishlist-project-bar');
  const totalEl = document.getElementById('wishlist-project-total');

  // Render project bar
  if (projectBar) projectBar.innerHTML = renderProjectBar(d);
  bindProjectBarEvents();

  // Show/hide toolbar
  const hasItems = (d.items || []).length > 0;
  if (toolbar) toolbar.classList.toggle('active', hasItems);

  // Project total
  const activeProj = getActiveProject();
  if (totalEl && activeProj) {
    const { total, currency } = computeProjectTotal(activeProj.id, d.items);
    if (total > 0) {
      totalEl.innerHTML = `<span class="wishlist-total-label">Total:</span> <span class="wishlist-total-value">${formatMoney(total, currency)}</span> <sup>(${d.items.filter(i => i.projectId === activeProj.id && i.price != null).length} item${d.items.filter(i => i.projectId === activeProj.id && i.price != null).length !== 1 ? 's' : ''})</sup>`;
      totalEl.style.display = 'flex';
    } else {
      totalEl.style.display = 'none';
    }
  }

  const visible = getFilteredSortedItems();

  if (!visible.length) {
    if (grid) grid.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    if (grid) grid.innerHTML = '';
    const countEl = document.getElementById('wishlist-count');
    if (countEl) countEl.textContent = '0 items';
    return;
  }

  if (grid) grid.style.display = 'grid';
  if (empty) empty.style.display = 'none';
  if (grid) grid.innerHTML = visible.map(item => renderCard(item)).join('');

  const countEl = document.getElementById('wishlist-count');
  if (countEl) {
    const total = (d.items || []).length;
    countEl.textContent = `Showing ${visible.length} of ${total}`;
  }

  // Attach card handlers
  if (grid) {
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

  populateTagFilter();
}

function renderProjectBar(d) {
  const activeId = d.activeProjectId;
  let html = '';

  d.projects.forEach(p => {
    const isActive = p.id === activeId;
    const count = d.items.filter(i => i.projectId === p.id).length;
    const { total, currency } = computeProjectTotal(p.id, d.items);
    html += `
      <button class="wishlist-project-chip${isActive ? ' active' : ''}" data-id="${escapeHtml(p.id)}" title="${escapeHtml(p.name)}">
        <span class="chip-name">${escapeHtml(p.name)}</span>
        ${total > 0 ? `<span class="chip-price">${formatMoney(total, currency)}</span>` : ''}
        <span class="chip-count">${count}</span>
        ${d.projects.length > 1 ? `<span class="chip-del" title="Delete project">×</span>` : ''}
      </button>
    `;
  });

  html += `
    <button class="wishlist-project-chip add" id="wishlist-new-project-btn" title="New project">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
    </button>
    <button class="wishlist-project-chip all${activeId === 'ALL' ? ' active' : ''}" data-id="ALL" title="All projects">
      <span class="chip-name">All</span>
      <span class="chip-count">${d.items.length}</span>
    </button>
  `;

  return html;
}

function bindProjectBarEvents() {
  document.querySelectorAll('#wishlist-project-bar .wishlist-project-chip').forEach(chip => {
    const del = chip.querySelector('.chip-del');

    chip.addEventListener('click', (e) => {
      if (e.target === del || del?.contains(e.target)) {
        e.stopPropagation();
        const id = chip.dataset.id;
        if (confirm('Delete this project and all its items?')) deleteProject(id);
        return;
      }
      const id = chip.dataset.id;
      if (id === 'ALL' || id) setActiveProject(id);
    });
  });

  const newBtn = document.getElementById('wishlist-new-project-btn');
  if (newBtn && !newBtn._bound) {
    newBtn._bound = true;
    newBtn.addEventListener('click', () => {
      const name = prompt('Project name:')?.trim();
      if (name) createProject(name);
    });
  }
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

function populateTagFilter() {
  const sel = document.getElementById('wishlist-filter-tag');
  if (!sel) return;
  const d = ensureData();
  const current = sel.value;
  const all = new Set();

  const activeId = d.activeProjectId;
  (d.items || []).forEach(i => {
    if (activeId && activeId !== 'ALL' && i.projectId !== activeId) return;
    (i.tags || []).forEach(t => all.add(t));
  });

  sel.innerHTML = '<option value="">All Tags</option>' + [...all].sort().map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  sel.value = all.has(current) ? current : '';
}

/* ═══════════════════════════════════════════
   DETAIL PANEL
   ═══════════════════════════════════════════ */

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

  const proj = d.projects.find(pr => pr.id === item.projectId);
  const metaEl = panel.querySelector('.wishlist-detail-meta');
  metaEl.innerHTML = `
    ${priceStr ? `<span class="wishlist-detail-price">${priceStr}</span>` : ''}
    <span class="wishlist-detail-priority" style="color:${p.color}">${p.label}</span>
    <span class="wishlist-detail-status ${s.class}">${escapeHtml(item.status)}</span>
    ${proj ? `<span class="wishlist-detail-project">${escapeHtml(proj.name)}</span>` : ''}
    ${(item.tags || []).length ? `<div class="wishlist-detail-tags">${item.tags.map(t => `<span class="wishlist-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
  `;

  const notesEl = panel.querySelector('.wishlist-detail-notes');
  notesEl.value = item.notes || '';
  notesEl.dataset.id = id;

  const urlEl = panel.querySelector('.wishlist-detail-url');
  if (urlEl) {
    if (item.url) {
      urlEl.href = item.url;
      urlEl.textContent = item.url.replace(/^https?:\/\//, '').substring(0, 40);
      urlEl.style.display = 'inline-block';
    } else { urlEl.style.display = 'none'; }
  }

  const editBtn = panel.querySelector('.wishlist-detail-edit');
  if (editBtn) editBtn.dataset.id = id;

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
  saveDataRaw(d);
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
  saveDataRaw(d);
  renderWishlist();
  openDetailModal(id);
}

/* ═══════════════════════════════════════════
   ADD / EDIT MODAL
   ═══════════════════════════════════════════ */

function openAddModal() {
  const modal = document.getElementById('wishlist-modal');
  const form = document.getElementById('wishlist-form');
  if (!modal || !form) return;
  form.reset();
  delete form.dataset.editingId;
  document.getElementById('wishlist-modal-title').textContent = 'Add Item';
  document.getElementById('wishlist-modal-save').textContent = 'Add Item';

  // Populate project select
  populateProjectSelect();

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('wishlist-title')?.focus(), 50);
}

function populateProjectSelect() {
  const sel = document.getElementById('wishlist-project');
  if (!sel) return;
  const d = ensureData();
  const activeProj = getActiveProject();
  sel.innerHTML = d.projects.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
  if (activeProj) sel.value = activeProj.id;
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

  populateProjectSelect();
  const projSel = document.getElementById('wishlist-project');
  if (projSel && item.projectId) projSel.value = item.projectId;

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
  document.getElementById('wishlist-add-btn')?.focus();
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
  const projectId = document.getElementById('wishlist-project')?.value;

  const d = ensureData();
  if (editingId) {
    const idx = d.items.findIndex(i => i.id === editingId);
    if (idx === -1) { showToast('Item not found'); return; }
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
      projectId: projectId || d.activeProjectId || d.projects[0].id,
      updated: new Date().toISOString()
    };
    saveDataRaw(d);
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
    projectId: projectId || d.activeProjectId || d.projects[0].id,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  d.items.unshift(item);
  saveDataRaw(d);
  renderWishlist();
  closeModal();
  showToast('Added to wishlist');
}

/* ═══════════════════════════════════════════
   EVENT BINDING
   ═══════════════════════════════════════════ */

function bindEvents() {
  document.getElementById('wishlist-add-btn')?.addEventListener('click', openAddModal);

  document.getElementById('wishlist-modal-backdrop')?.addEventListener('click', closeModal);
  document.getElementById('wishlist-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('wishlist-modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('wishlist-form')?.addEventListener('submit', onFormSubmit);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('wishlist-modal');
      if (modal?.classList.contains('open')) {
        e.preventDefault();
        closeModal();
      } else {
        closeDetailModal();
      }
    }
  });

  document.getElementById('wishlist-search')?.addEventListener('input', renderWishlist);
  document.getElementById('wishlist-sort')?.addEventListener('change', renderWishlist);
  document.getElementById('wishlist-filter')?.addEventListener('change', renderWishlist);
  document.getElementById('wishlist-filter-priority')?.addEventListener('change', renderWishlist);
  document.getElementById('wishlist-filter-tag')?.addEventListener('change', renderWishlist);
  document.getElementById('wishlist-show-archived')?.addEventListener('change', renderWishlist);

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

let _fetchAbort = null;
function attemptFetchLink(url) {
  if (!url || !url.startsWith('http')) return;
  const modal = document.getElementById('wishlist-modal');
  if (!modal?.classList.contains('open')) return;

  const titleInput = document.getElementById('wishlist-title');
  const imageInput = document.getElementById('wishlist-image');
  const priceInput = document.getElementById('wishlist-price');
  if (!titleInput || !imageInput || !priceInput) return;

  const modalTitle = document.getElementById('wishlist-modal-title');
  const oldTitle = modalTitle?.textContent;
  if (modalTitle && !oldTitle.includes('Fetching')) modalTitle.textContent = oldTitle + ' (Fetching…)';

  if (_fetchAbort) _fetchAbort.abort();
  _fetchAbort = new AbortController();

  fetch(`/api/fetch-link?url=${encodeURIComponent(url)}`, { signal: _fetchAbort.signal })
    .then(r => r.json())
    .then(data => {
      if (modalTitle && oldTitle) modalTitle.textContent = oldTitle;
      if (!data.ok) return;
      if (data.title && !titleInput.value.trim()) titleInput.value = data.title;
      if (data.image && !imageInput.value.trim()) imageInput.value = data.image;
      if (data.price != null && priceInput.value === '') priceInput.value = data.price;
    })
    .catch(() => { if (modalTitle && oldTitle) modalTitle.textContent = oldTitle; })
    .finally(() => { _fetchAbort = null; });
}

/* ═══════════════════════════════════════════
   CRUD
   ═══════════════════════════════════════════ */

function deleteItem(id) {
  const d = ensureData();
  const before = d.items.length;
  d.items = d.items.filter(i => i.id !== id);
  if (d.items.length < before) {
    saveDataRaw(d);
    renderWishlist();
    showToast('Item deleted');
  }
}

function copyLink(url) {
  if (!url) { showToast('No URL to copy'); return; }
  try {
    navigator.clipboard.writeText(url).then(() => showToast('Copied link'));
  } catch (_) { showToast('Could not copy'); }
}
