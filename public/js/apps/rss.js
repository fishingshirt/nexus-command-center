/* ===== RSS Reader ===== */
const RSS_KEY = 'ncc-rss-v1';

const DEFAULT_FEEDS = [
  { id: 'rss_bbc', title: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml', category: 'world', enabled: true },
  { id: 'rss_techcrunch', title: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'technology', enabled: true },
  { id: 'rss_wsj', title: 'Wall Street Journal', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', category: 'business', enabled: false },
  { id: 'rss_hn', title: 'Hacker News', url: 'https://news.ycombinator.com/rss', category: 'technology', enabled: true },
  { id: 'rss_nyt', title: 'NYT Technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', category: 'technology', enabled: false },
];

let rssState = {
  feeds: [],
  articles: [],
  selectedFeed: 'all',
  loading: false,
  expandedArticle: null,
};

function loadRssData() {
  try {
    const raw = localStorage.getItem(RSS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { feeds: [...DEFAULT_FEEDS], lastRefresh: 0 };
}
function saveRssData(data) {
  localStorage.setItem(RSS_KEY, JSON.stringify(data));
}

function uuid() {
  return 'rss_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

export function initRss() {
  const data = loadRssData();
  rssState.feeds = data.feeds || DEFAULT_FEEDS;
  renderRssShell();
  bindEvents();
  refreshFeeds();
  updateRssBadge();
}

function renderRssShell() {
  const view = document.getElementById('view-rss');
  if (!view || view.dataset.shell) return;
  view.dataset.shell = '1';
  const body = view.querySelector('.rss-view-body');
  if (!body) return;
  body.innerHTML = `
    <div class="rss-toolbar">
      <button class="btn-secondary rss-add-btn" id="rss-add-btn" aria-label="Add feed">＋ Add Feed</button>
      <button class="rss-refresh-btn" id="rss-refresh-btn" aria-label="Refresh all feeds">↻ Refresh</button>
    </div>
    <div class="rss-feed-bar" id="rss-feed-bar" role="tablist" aria-label="RSS feeds">
      <button class="rss-chip active" data-feed="all" role="tab" aria-selected="true">All Feeds</button>
    </div>
    <div class="rss-list" id="rss-list" role="feed" aria-busy="false" aria-live="polite">
      <div class="rss-skeleton">Loading articles…</div>
    </div>
    <div class="rss-empty" id="rss-empty" style="display:none;">
      <div class="rss-empty-icon">📡</div>
      <p>No articles yet.</p>
      <span>Tap “Refresh” to load your feeds.</span>
    </div>
    <div class="rss-add-panel" id="rss-add-panel" style="display:none;" role="dialog" aria-label="Add RSS feed">
      <div class="rss-add-backdrop" id="rss-add-backdrop"></div>
      <div class="rss-add-card">
        <div class="rss-add-header">
          <h3>Add RSS Feed</h3>
          <button class="rss-add-close" id="rss-add-close" aria-label="Close">✕</button>
        </div>
        <div class="rss-add-body">
          <label class="rss-field">
            <span>Feed URL</span>
            <input type="url" id="rss-add-url" placeholder="https://example.com/feed.xml" required>
          </label>
          <label class="rss-field">
            <span>Feed name (optional)</span>
            <input type="text" id="rss-add-title" placeholder="My Blog">
          </label>
          <div class="rss-add-actions">
            <button type="button" class="btn-secondary" id="rss-add-cancel">Cancel</button>
            <button type="button" class="btn-primary" id="rss-add-save">Add Feed</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindEvents() {
  const view = document.getElementById('view-rss');
  if (!view) return;
  view.addEventListener('click', onRssClick);

  // Enter key on add inputs
  const urlInput = document.getElementById('rss-add-url');
  if (urlInput) urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') addFeed(); });
}

function onRssClick(e) {
  const chip = e.target.closest('.rss-chip');
  if (chip) { setFeed(chip.dataset.feed); return; }

  const refresh = e.target.closest('#rss-refresh-btn');
  if (refresh) { refreshFeeds(); return; }

  const addBtn = e.target.closest('#rss-add-btn');
  if (addBtn) { showAddPanel(true); return; }

  const closeAdd = e.target.closest('#rss-add-close, #rss-add-backdrop, #rss-add-cancel');
  if (closeAdd) { showAddPanel(false); return; }

  const saveAdd = e.target.closest('#rss-add-save');
  if (saveAdd) { addFeed(); return; }

  const delFeed = e.target.closest('.rss-feed-delete');
  if (delFeed) { removeFeed(delFeed.dataset.id); return; }

  const item = e.target.closest('.rss-item');
  if (item) { toggleArticle(item.dataset.id); return; }

  const link = e.target.closest('.rss-item-link');
  if (link) { window.open(link.href, '_blank', 'noopener,noreferrer'); return; }
}

function setFeed(feedId) {
  rssState.selectedFeed = feedId;
  document.querySelectorAll('.rss-chip').forEach(c => c.classList.toggle('active', c.dataset.feed === feedId));
  renderArticles();
}

function showAddPanel(show) {
  const panel = document.getElementById('rss-add-panel');
  if (panel) panel.style.display = show ? 'block' : 'none';
  if (show) { document.getElementById('rss-add-url')?.focus(); }
}

async function addFeed() {
  const urlInput = document.getElementById('rss-add-url');
  const titleInput = document.getElementById('rss-add-title');
  const url = (urlInput?.value || '').trim();
  const title = (titleInput?.value || '').trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) { toast('Please enter a valid URL'); return; }
  const btn = document.getElementById('rss-add-save');
  if (btn) btn.textContent = 'Adding…';
  try {
    const r = await fetch(`/api/rss/fetch?url=${encodeURIComponent(url)}`);
    const d = await r.json();
    if (!d.ok) { toast(d.error || 'Could not fetch feed'); return; }
    const feedTitle = title || d.feed?.title || 'Untitled Feed';
    const newFeed = { id: uuid(), title: feedTitle, url, category: 'custom', enabled: true };
    rssState.feeds.push(newFeed);
    saveRssData({ feeds: rssState.feeds, lastRefresh: Date.now() });
    renderFeedChips();
    // Immediately fetch this feed's articles
    const articles = (d.feed?.items || []).map(it => normalizeItem(it, newFeed.id, newFeed.title));
    rssState.articles = articles.concat(rssState.articles).sort((a, b) => b.timestamp - a.timestamp);
    renderArticles();
    updateRssBadge();
    showAddPanel(false);
    urlInput.value = '';
    titleInput.value = '';
    toast(`Added “${feedTitle}”`);
  } catch {
    toast('Failed to add feed');
  } finally {
    if (btn) btn.textContent = 'Add Feed';
  }
}

function removeFeed(id) {
  const feed = rssState.feeds.find(f => f.id === id);
  if (!feed) return;
  if (!confirm(`Remove “${feed.title}”?`)) return;
  rssState.feeds = rssState.feeds.filter(f => f.id !== id);
  rssState.articles = rssState.articles.filter(a => a.feedId !== id);
  saveRssData({ feeds: rssState.feeds, lastRefresh: Date.now() });
  renderFeedChips();
  renderArticles();
  updateRssBadge();
}

async function refreshFeeds() {
  const list = document.getElementById('rss-list');
  const enabled = rssState.feeds.filter(f => f.enabled);
  if (!enabled.length) {
    list.innerHTML = '<div class="rss-skeleton">No feeds enabled. Add one above.</div>';
    return;
  }
  list.innerHTML = '<div class="rss-skeleton">Loading articles…</div>';
  rssState.loading = true;
  rssState.articles = [];
  let anySuccess = false;

  for (const feed of enabled) {
    try {
      const r = await fetch(`/api/rss/fetch?url=${encodeURIComponent(feed.url)}`);
      const d = await r.json();
      if (d.ok && d.feed?.items) {
        anySuccess = true;
        const parsed = (d.feed.items || []).map(it => normalizeItem(it, feed.id, feed.title));
        rssState.articles = rssState.articles.concat(parsed);
      }
    } catch (_) {}
  }

  rssState.articles.sort((a, b) => b.timestamp - a.timestamp);
  rssState.loading = false;
  saveRssData({ feeds: rssState.feeds, lastRefresh: Date.now() });
  renderFeedChips();
  renderArticles();
  updateRssBadge();
  if (!anySuccess) toast('Could not refresh feeds. Check your connection.');
}

function normalizeItem(it, feedId, feedTitle) {
  const ts = it.published ? Date.parse(it.published) : Date.now();
  return {
    id: (it.link || it.id || '') + '_' + feedId,
    title: it.title || 'Untitled',
    description: it.description || it.summary || '',
    link: it.link || it.url || '',
    published: isNaN(ts) ? Date.now() : ts,
    timestamp: isNaN(ts) ? Date.now() : ts,
    feedId,
    feedTitle,
    image: it.image || it.enclosure?.url || null,
  };
}

function renderFeedChips() {
  const bar = document.getElementById('rss-feed-bar');
  if (!bar) return;
  const enabled = rssState.feeds.filter(f => f.enabled);
  const chips = [`<button class="rss-chip ${rssState.selectedFeed === 'all' ? 'active' : ''}" data-feed="all" role="tab" aria-selected="${rssState.selectedFeed === 'all' ? 'true' : 'false'}">All Feeds</button>`];
  for (const f of enabled) {
    chips.push(`<button class="rss-chip ${rssState.selectedFeed === f.id ? 'active' : ''}" data-feed="${f.id}" role="tab" aria-selected="${rssState.selectedFeed === f.id ? 'true' : 'false'}">
      <span class="rss-chip-title">${escapeHtml(f.title)}</span>
      <span class="rss-feed-delete" data-id="${f.id}" title="Remove feed" aria-label="Remove ${escapeHtml(f.title)}">×</span>
    </button>`);
  }
  bar.innerHTML = chips.join('');
}

function renderArticles() {
  const list = document.getElementById('rss-list');
  const empty = document.getElementById('rss-empty');
  if (!list) return;

  let arts = rssState.articles;
  if (rssState.selectedFeed !== 'all') {
    arts = arts.filter(a => a.feedId === rssState.selectedFeed);
  }

  if (!arts.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = arts.map(a => {
    const isExpanded = rssState.expandedArticle === a.id;
    const dateStr = fmtRel(a.published);
    return `
      <article class="rss-item ${isExpanded ? 'expanded' : ''}" data-id="${a.id}" tabindex="0" role="article" aria-label="${escapeHtml(a.title)}">
        ${a.image ? `<div class="rss-item-image"><img src="${escapeHtml(a.image)}" alt="" loading="lazy"></div>` : ''}
        <div class="rss-item-content">
          <div class="rss-item-meta">
            <span class="rss-item-feed">${escapeHtml(a.feedTitle)}</span>
            <span class="rss-item-date">${dateStr}</span>
          </div>
          <h3 class="rss-item-title">${escapeHtml(a.title)}</h3>
          <div class="rss-item-desc">${escapeHtml(stripHtml(a.description).slice(0, 200))}${(stripHtml(a.description).length > 200 ? '…' : '')}</div>
          <div class="rss-item-actions">
            <a class="rss-item-link" href="${escapeHtml(a.link)}" target="_blank" rel="noopener noreferrer">Read more →</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function toggleArticle(id) {
  rssState.expandedArticle = rssState.expandedArticle === id ? null : id;
  renderArticles();
}

function updateRssBadge() {
  const badge = document.getElementById('rss-badge');
  const cardText = document.getElementById('rss-card-text');
  const newCount = rssState.articles.length;
  if (badge) badge.textContent = newCount > 99 ? '99+' : newCount;
  if (cardText) cardText.textContent = newCount ? `${newCount} articles` : 'Your feeds';
}

function fmtRel(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
}
function toast(msg) {
  const c = document.getElementById('toast-container'); if (!c) return;
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; c.appendChild(d);
  requestAnimationFrame(() => d.classList.add('show'));
  setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 300); }, 2500);
}
