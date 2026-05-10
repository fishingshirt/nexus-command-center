/* ===== News & Media Hub ===== */
let newsState = {
  category: 'all',
  query: '',
  articles: [],
  videos: [],
  digest: null,
  loading: false,
};

const NEWS_CATEGORIES = ['all','world','politics','technology','business','sports','entertainment','science','health'];
const NEWS_CACHE_KEY = 'ncc-news-cache';
const NEWS_CACHE_HOURS = 24;

export function initNews() {
  renderNewsShell();
  bindNewsEvents();
}

function getCachedNews() {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.cachedAt && (Date.now() - data.cachedAt) < NEWS_CACHE_HOURS * 3600 * 1000) {
      return data.articles || [];
    }
  } catch (_) {}
  return null;
}

function setCachedNews(articles) {
  try {
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), articles }));
  } catch (_) {}
}

function _fmtRel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function renderNewsShell() {
  const view = document.getElementById('view-news');
  if (!view || view.dataset.shell) return;
  view.dataset.shell = '1';

  const body = view.querySelector('.news-view-body');
  if (!body) return;

  body.innerHTML = `
    <div class="news-search-bar">
      <input type="text" id="news-search-input" placeholder="Search news..." aria-label="Search news">
      <button id="news-search-btn" aria-label="Search">🔍</button>
    </div>
    <div class="news-chip-bar" id="news-chip-bar" role="tablist" aria-label="News categories">
      ${NEWS_CATEGORIES.map(c => `
        <button class="news-chip ${c === 'all' ? 'active' : ''}" data-cat="${c}" role="tab" aria-selected="${c === 'all' ? 'true' : 'false'}">
          ${c.charAt(0).toUpperCase() + c.slice(1)}
        </button>
      `).join('')}
    </div>
    <div class="news-digest-banner" id="news-digest-banner" style="display:none;" role="region" aria-label="Daily digest">
      <div class="digest-header">
        <strong>📰 Daily Digest</strong>
        <button class="digest-dismiss" id="digest-dismiss" aria-label="Dismiss digest">×</button>
      </div>
      <div class="digest-body" id="digest-body"></div>
    </div>
    <div class="news-list" id="news-list" role="feed" aria-busy="false" aria-label="News articles">
      <div class="news-skeleton">Loading headlines…</div>
    </div>
    <div class="news-youtube-section">
      <div class="youtube-header">
        <h3>🎬 Suggested for You</h3>
        <button class="youtube-refresh" id="youtube-refresh" aria-label="Refresh suggestions">↻</button>
      </div>
      <div class="youtube-strip" id="youtube-strip">
        <div class="youtube-empty">No suggestions loaded.</div>
      </div>
    </div>
  `;
}

function bindNewsEvents() {
  const view = document.getElementById('view-news');
  if (!view) return;

  view.addEventListener('click', (e) => {
    const chip = e.target.closest('.news-chip');
    if (chip) {
      setNewsCategory(chip.dataset.cat);
      return;
    }
    const dismiss = e.target.closest('#digest-dismiss');
    if (dismiss) {
      const banner = document.getElementById('news-digest-banner');
      if (banner) banner.style.display = 'none';
      return;
    }
    const refresh = e.target.closest('#youtube-refresh');
    if (refresh) {
      loadYouTubeSuggestions();
      return;
    }
    const searchBtn = e.target.closest('#news-search-btn');
    if (searchBtn) {
      const input = document.getElementById('news-search-input');
      newsState.query = input ? input.value.trim() : '';
      loadNews();
      return;
    }
    const retry = e.target.closest('#news-retry');
    if (retry) {
      loadNews();
      return;
    }
  });

  const input = view.querySelector('#news-search-input');
  if (input) {
    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        newsState.query = input.value.trim();
        loadNews();
      }, 300);
    });
  }

  const refreshBtn = document.getElementById('news-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadNews);
  }
}

function setNewsCategory(cat) {
  newsState.category = cat;
  document.querySelectorAll('.news-chip').forEach(btn => {
    const active = btn.dataset.cat === cat;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  loadNews();
}

async function loadNews() {
  const list = document.getElementById('news-list');
  if (!list) return;
  list.setAttribute('aria-busy', 'true');
  list.innerHTML = '<div class="news-skeleton">Loading headlines…</div>';

  try {
    const params = new URLSearchParams();
    if (newsState.category !== 'all') params.set('category', newsState.category);
    if (newsState.query) params.set('q', newsState.query);
    const res = await fetch('/api/news?' + params.toString());
    const data = await res.json();
    newsState.articles = data.articles || [];
    if (newsState.articles.length) {
      setCachedNews(newsState.articles);
    }
    renderNewsList(newsState.articles);
  } catch (err) {
    const cached = getCachedNews();
    if (cached && cached.length) {
      newsState.articles = cached;
      renderNewsList(cached, true);
    } else {
      list.innerHTML = '<div class="news-error">Failed to load news. <button id="news-retry">Retry</button></div>';
    }
  } finally {
    list.setAttribute('aria-busy', 'false');
  }
}

function renderNewsList(articles, offline=false) {
  const list = document.getElementById('news-list');
  if (!list) return;
  if (!articles.length) {
    list.innerHTML = '<div class="news-empty">📭 No articles found.</div>';
    return;
  }
  list.innerHTML = articles.map(a => `
    <article class="news-card" tabindex="0" role="article" aria-label="${escapeHtml(a.title || 'Article')}">
      ${a.urlToImage ? `<img class="news-thumb" src="${escapeHtml(a.urlToImage)}" alt="">` : ''}
      <div class="news-meta">
        <span class="news-source">${escapeHtml(a.source?.name || 'News')}</span>
        <span class="news-time">${escapeHtml(_fmtRel(a.publishedAt))}</span>
        ${offline ? '<span class="news-offline-chip">Offline</span>' : ''}
      </div>
      <h4 class="news-title">${escapeHtml(a.title || 'Untitled')}</h4>
      <p class="news-snippet">${escapeHtml(a.description || '')}</p>
      <a class="news-link" href="${escapeHtml(a.url || '#')}" target="_blank" rel="noopener">Read more →</a>
    </article>
  `).join('');
}

async function loadYouTubeSuggestions() {
  const strip = document.getElementById('youtube-strip');
  if (!strip) return;
  strip.innerHTML = '<div class="youtube-skeleton">Loading suggestions…</div>';
  try {
    const res = await fetch('/api/youtube/daily');
    const data = await res.json();
    newsState.videos = data.videos || [];
    if (!newsState.videos.length) {
      strip.innerHTML = '<div class="youtube-empty">No videos found.</div>';
      return;
    }
    strip.innerHTML = newsState.videos.map(v => `
      <a class="youtube-card" href="${escapeHtml(v.url || '#')}" target="_blank" rel="noopener" aria-label="${escapeHtml(v.title || 'Video')}">
        <img class="youtube-thumb" src="${escapeHtml(v.thumbnail || '')}" alt="" loading="lazy">
        <div class="youtube-info">
          <div class="youtube-title">${escapeHtml(v.title || '')}</div>
          <div class="youtube-channel">${escapeHtml(v.channel || '')}</div>
        </div>
      </a>
    `).join('');
  } catch (err) {
    strip.innerHTML = '<div class="youtube-error">Failed to load suggestions.</div>';
  }
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function openNews() {
  const view = document.getElementById('view-news');
  if (view && view.dataset.inited !== '1') {
    view.dataset.inited = '1';
    loadNews();
    loadYouTubeSuggestions();
  }
}
