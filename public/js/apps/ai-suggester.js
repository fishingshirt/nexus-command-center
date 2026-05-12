const toast = (...args) => (window.toast ? window.toast(...args) : undefined);

const CACHE_KEY = 'ncc-ai-suggester-cache';
const DISMISSED_KEY = 'ncc-ai-suggester-dismissed';
const TODO_KEY = 'ncc-todo';
const CACHE_TTL_MS = 60 * 60 * 1000;

let suggestions = [];
let dismissedIds = new Set();
let isLoading = false;

function loadDismissed() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (raw) dismissedIds = new Set(JSON.parse(raw));
  } catch { dismissedIds = new Set(); }
}

function saveDismissed() {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(dismissedIds))); } catch {}
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.ts || Date.now() - data.ts > CACHE_TTL_MS) return null;
    return data.items || [];
  } catch { return null; }
}

function saveCache(items) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items })); } catch {}
}

function genId() {
  return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function buildContext() {
  let eventCount = 0;
  try {
    const cal = JSON.parse(localStorage.getItem('ncc-events') || '[]');
    const today = new Date().toISOString().slice(0, 10);
    eventCount = cal.filter(e => e.date >= today).length;
  } catch {}
  let pendingTodos = 0;
  try {
    const todos = JSON.parse(localStorage.getItem(TODO_KEY) || '[]');
    pendingTodos = todos.filter(t => !t.completed).length;
  } catch {}
  let notesCount = 0;
  try {
    const notes = JSON.parse(localStorage.getItem('ncc-notes') || '[]');
    notesCount = notes.length;
  } catch {}
  return { recentEvents: eventCount, pendingTodos, notesCount };
}

export async function openSuggester() {
  const view = document.getElementById('view-ai-suggester');
  if (!view) return;
  const body = view.querySelector('.suggester-view-body') || view;
  renderShell(body);
  loadDismissed();
  await fetchSuggestions();
  renderSuggestions();
}

export function initSuggester() {
  // Nothing persistent to set up; openSuggester renders on demand.
}

function renderShell(container) {
  container.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'suggester-header';
  card.innerHTML = `
    <div class="suggester-title-wrap">
      <h2>AI Suggester</h2>
      <p class="suggester-subtitle">Smart suggestions based on your calendar, to-dos, and notes</p>
    </div>
    <div class="suggester-actions">
      <button class="suggester-btn secondary" id="sg-refresh" aria-label="Refresh suggestions">Refresh</button>
      <button class="suggester-btn icon" id="sg-settings" aria-label="Open AI suggester settings">⚙️</button>
    </div>
  `;
  container.appendChild(card);

  const grid = document.createElement('div');
  grid.className = 'suggestion-grid';
  grid.id = 'sg-grid';
  container.appendChild(grid);

  const empty = document.createElement('div');
  empty.className = 'suggestion-empty';
  empty.id = 'sg-empty';
  empty.style.display = 'none';
  empty.innerHTML = `
    <div class="suggestion-empty-icon">💡</div>
    <h3>No suggestions right now</h3>
    <p>Tap refresh to ask the AI.</p>
  `;
  container.appendChild(empty);

  card.querySelector('#sg-refresh').addEventListener('click', async () => {
    await fetchSuggestions(true);
    renderSuggestions();
  });
  card.querySelector('#sg-settings').addEventListener('click', () => {
    toast('AI Suggester settings coming in T-020-d');
  });
}

async function fetchSuggestions(force = false) {
  if (!force) {
    const cached = loadCache();
    if (cached && cached.length) {
      suggestions = cached;
      return;
    }
  }

  isLoading = true;
  renderSkeleton();

  try {
    const body = JSON.stringify({ context: buildContext() });
    const res = await fetch('/api/ai/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    saveCache(suggestions);
  } catch {
    const cached = loadCache();
    suggestions = cached || [];
  }

  isLoading = false;
}

function renderSkeleton() {
  const grid = document.getElementById('sg-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const el = document.createElement('div');
    el.className = 'suggestion-card skeleton';
    el.innerHTML = `
      <div class="suggestion-stripe shimmer"></div>
      <div class="suggestion-card-body">
        <div class="suggestion-title shimmer"></div>
        <div class="suggestion-desc shimmer"></div>
        <div class="suggestion-meta shimmer"></div>
      </div>
    `;
    grid.appendChild(el);
  }
}

function renderSuggestions() {
  const grid = document.getElementById('sg-grid');
  const empty = document.getElementById('sg-empty');
  if (!grid) return;

  const visible = suggestions.filter(s => s.id && !dismissedIds.has(s.id));

  if (isLoading) return; // skeleton already shown

  grid.innerHTML = '';

  if (!visible.length) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  visible.forEach(s => {
    const card = document.createElement('div');
    card.className = 'suggestion-card';
    const priority = (s.priority || 'LOW').toUpperCase();
    const stripeColor = priority === 'HIGH' ? 'var(--danger)' : priority === 'MEDIUM' ? 'var(--warning)' : 'var(--success)';
    card.innerHTML = `
      <div class="suggestion-stripe" style="background:${stripeColor}"></div>
      <div class="suggestion-card-body">
        <div class="suggestion-card__title">${escapeHtml(s.title || 'Suggestion')}</div>
        <div class="suggestion-card__desc">${escapeHtml(s.description || '')}</div>
        <div class="suggestion-card__meta">
          <span class="suggestion-tag">${escapeHtml(s.category || 'General')}</span>
          <span class="suggestion-priority ${priority.toLowerCase()}">${priority}</span>
        </div>
        <div class="suggestion-card__actions">
          <button class="suggester-btn primary" data-action="todo" data-id="${escapeHtml(s.id || '')}">Add to To-Do</button>
          <button class="suggester-btn secondary" data-action="dismiss" data-id="${escapeHtml(s.id || '')}">Dismiss</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('button[data-action="todo"]').forEach(btn => {
    btn.addEventListener('click', () => addToTodo(btn.dataset.id));
  });
  grid.querySelectorAll('button[data-action="dismiss"]').forEach(btn => {
    btn.addEventListener('click', () => dismissSuggestion(btn.dataset.id));
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function addToTodo(id) {
  const s = suggestions.find(x => x.id === id);
  if (!s) return;
  try {
    const raw = localStorage.getItem(TODO_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push({
      id: genId(),
      text: s.title || 'AI suggested task',
      priority: (s.priority || 'low').toLowerCase(),
      due: '',
      completed: false,
      createdAt: Date.now()
    });
    localStorage.setItem(TODO_KEY, JSON.stringify(list));
    toast('Added to To-Do');
    // Update todo badge if available
    const badge = document.getElementById('todo-badge');
    if (badge) badge.textContent = String(list.filter(t => !t.completed).length);
  } catch {
    toast('Failed to add to To-Do', 'error');
  }
}

function dismissSuggestion(id) {
  dismissedIds.add(id);
  saveDismissed();
  renderSuggestions();
}
