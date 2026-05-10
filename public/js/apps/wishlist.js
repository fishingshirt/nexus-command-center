const LS_KEY = 'ncc-wishlist-v1';

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
}

function renderWishlist() {
  const grid = document.getElementById('wishlist-grid');
  const empty = document.getElementById('wishlist-empty');
  if (!grid || !empty) return;

  const { items } = ensureData();
  const showArchived = document.getElementById('wishlist-show-archived')?.checked;
  const visible = showArchived ? items : items.filter(i => i.status !== 'Archived');

  if (!visible.length) {
    grid.style.display = 'none';
    empty.style.display = 'flex';
    grid.innerHTML = '';
    return;
  }

  grid.style.display = 'grid';
  empty.style.display = 'none';

  grid.innerHTML = visible.map(item => renderCard(item)).join('');

  // Attach delete handlers
  grid.querySelectorAll('.wishlist-card-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      deleteItem(id);
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
    <article class="wishlist-card" data-id="${escapeHtml(item.id)}" style="border-left: 4px solid ${p.color}">
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
        <div class="wishlist-card-actions">
          <button class="wishlist-card-action-btn wishlist-card-delete" data-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    </article>
  `;
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
  document.getElementById('wishlist-modal-title').textContent = 'Add Item';
  document.getElementById('wishlist-modal-save').textContent = 'Add Item';
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
}

function onFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('wishlist-title')?.value.trim();
  if (!title) {
    showToast('Title is required');
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

  const d = ensureData();
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
