import requests
base = 'http://localhost:8080'

r = requests.get(f'{base}/', timeout=5)
print(f'Dashboard loads: {r.status_code == 200}')

r_css = requests.get(f'{base}/css/apps/wishlist.css', timeout=5)
print(f'Wishlist CSS served: {r_css.status_code == 200}')

r_js = requests.get(f'{base}/js/apps/wishlist.js', timeout=5)
js = r_js.text
print(f'Wishlist JS served: {r_js.status_code == 200}')

html = r.text
checks = [
  ('wishlist modal', 'id="wishlist-modal"' in html),
  ('wishlist detail panel', 'id="wishlist-detail-panel"' in html),
  ('wishlist toolbar', 'id="wishlist-toolbar"' in html),
  ('wishlist search', 'id="wishlist-search"' in html),
  ('wishlist sort', 'id="wishlist-sort"' in html),
  ('wishlist filter status', 'id="wishlist-filter"' in html),
  ('wishlist filter priority', 'id="wishlist-filter-priority"' in html),
  ('wishlist filter tag', 'id="wishlist-filter-tag"' in html),
  ('wishlist show archived', 'id="wishlist-show-archived"' in html),
  ('wishlist add btn', 'id="wishlist-add-btn"' in html),
  ('wishlist form', 'id="wishlist-form"' in html),
  ('wishlist title input', 'id="wishlist-title"' in html),
  ('wishlist url input', 'id="wishlist-url"' in html),
  ('wishlist price input', 'id="wishlist-price"' in html),
  ('wishlist currency select', 'id="wishlist-currency"' in html),
  ('wishlist image input', 'id="wishlist-image"' in html),
  ('wishlist priority', 'id="wishlist-priority"' in html),
  ('wishlist tags', 'id="wishlist-tags"' in html),
  ('wishlist notes', 'id="wishlist-notes"' in html),
  ('wishlist backdrop', 'id="wishlist-modal-backdrop"' in html),
  ('wishlist detail close', 'id="wishlist-detail-close"' in html),
  ('wishlist detail edit', 'id="wishlist-detail-edit"' in html),
  ('nav link', 'href="#wishlist"' in html and 'Wishlist' in html),
  ('app card', 'data-app="wishlist"' in html),
]
for name, ok in checks:
  print(f'  {name}: {"OK" if ok else "MISSING"}')

print(f'\nJS exports initWishlist: {"export function initWishlist" in js}')
print(f'Has auto-fetch: {"attemptFetchLink" in js}')
print(f'Has status transitions: {"onStatusChange" in js}')
print(f'Has detail modal: {"openDetailModal" in js}')
print(f'Has edit modal: {"openEditModal" in js}')
print(f'Has delete: {"deleteItem" in js}')
print(f'Has search/filter: {"getFilteredSortedItems" in js}')
print(f'Has copy link: {"copyLink" in js}')
print(f'Has paste handler: {"clipboardData" in js}')
print(f'Uses storage adapter: {"storage.read" in js or "storage.write" in js}')
