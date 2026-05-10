const LS_KEY = 'ncc-wishlist-v1';

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
  if (!d.items) d.items = [];
  saveData(d);
  return d;
}

export function initWishlist() {
  ensureData();
  renderWishlist();
  document.getElementById('wishlist-add-btn')?.addEventListener('click', () => {
    showWishlistToast('Add item coming in T-061-b');
  });
}

function renderWishlist() {
  const grid = document.getElementById('wishlist-grid');
  const empty = document.getElementById('wishlist-empty');
  if (!grid || !empty) return;
  const d = loadData();
  if (!d.items || !d.items.length) {
    grid.style.display = 'none';
    empty.style.display = 'flex';
    return;
  }
  grid.style.display = 'grid';
  empty.style.display = 'none';
}

function showWishlistToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2500);
}
