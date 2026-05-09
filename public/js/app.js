import { initCalendar } from './apps/calendar.js';
import { initNotes } from './apps/notes.js';
import { initTodo } from './apps/todo.js';
import { initGoogleSync } from './apps/gcal-sync.js';
import { initBackup } from './apps/backup.js';
import { initWeather } from './apps/weather.js';
import { initITHub } from './apps/it-hub.js';
import { initAuth, ensureAuthEnabled } from './apps/auth.js';

const APP_REGISTRY = [
  { id: 'calendar', name: 'Calendar', icon: '📅', path: 'calendar' },
  { id: 'notes', name: 'Notes', icon: '📝', path: 'notes' },
  { id: 'todo', name: 'To-Do', icon: '✅', path: 'todo' },
  { id: 'chat', name: 'Hermes Chat', icon: '💬', path: 'chat' },
  { id: 'weather', name: 'Weather', icon: '☀️', path: 'weather' },
  { id: 'feedback', name: 'Feedback', icon: '💬', path: 'feedback' }
];

export function initApp() {
  initRouter();
  initNavigation();
  initTheme();
  initSettings();
  initCalendarSync();
  initWelcome();
  initChat();
  initFeedback();
  initAgentStats();
  initBackup();
  initITHub();
  initWeather();
  initCalendar();
  initNotes();
  initTodo();
  initGoogleSync();
  initAuth();
  updateDashboardDate();
  registerServiceWorker();
}

/* ===== ROUTER ===== */
function initRouter() {
  const handleHash = () => {
    const hash = location.hash.slice(1) || 'dashboard';
    switchView(hash);
    updateNavActive(hash);
  };

  window.addEventListener('hashchange', handleHash);
  handleHash();

  // App card clicks
  document.querySelectorAll('.app-card').forEach(card => {
    card.addEventListener('click', () => {
      const app = card.dataset.app;
      location.hash = app;
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        location.hash = card.dataset.app;
      }
    });
  });

  // View back buttons
  document.querySelectorAll('.view-back').forEach(btn => {
    btn.addEventListener('click', () => {
      location.hash = btn.dataset.view;
    });
  });
}

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${viewId}`);
  if (target) {
    target.classList.add('active');
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    // Per-app auth check
    if (['calendar','notes','todo'].includes(viewId)) {
      if (typeof ensureAuthEnabled === 'function') {
        ensureAuthEnabled(viewId);
      }
    }
  } else {
    document.getElementById('view-dashboard').classList.add('active');
  }
}

function updateNavActive(viewId) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.app === viewId);
  });
}

/* ===== NAVIGATION DRAWER ===== */
function initNavigation() {
  const drawer = document.getElementById('nav-drawer');
  const backdrop = document.getElementById('nav-backdrop');
  const openBtn = document.getElementById('header-menu-btn');
  const closeBtn = document.getElementById('nav-drawer-close');

  function open() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('visible');
    backdrop.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function close() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('visible');
    backdrop.setAttribute('aria-hidden', 'true');
    openBtn.focus();
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) close();
  });

  // Nav links close drawer
  drawer.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      close();
    });
  });
}

/* ===== THEME ===== */
export function initTheme() {
  const saved = loadSettings();
  applyTheme(saved.theme || 'professional');
}

export function applyTheme(themeName) {
  const link = document.getElementById('theme-stylesheet');
  if (link) {
    link.href = `css/themes/${themeName}.css`;
  }
  // Update meta theme-color
  const computed = getComputedStyle(document.documentElement);
  // Wait for CSS to load then update
  setTimeout(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const meta = document.getElementById('theme-color');
    if (meta && accent) meta.content = accent;
  }, 100);
}

/* ===== SETTINGS ===== */
function initSettings() {
  const panel = document.getElementById('settings-panel');
  const backdrop = document.getElementById('settings-backdrop');
  const openBtn = document.getElementById('header-settings-btn');
  const closeBtn = document.getElementById('settings-close');
  const themeSelect = document.getElementById('theme-select');
  const reducedMotion = document.getElementById('reduced-motion');
  const showWelcome = document.getElementById('show-welcome');

  const settings = loadSettings();

  // Apply saved values
  themeSelect.value = settings.theme || 'professional';
  reducedMotion.checked = settings.reducedMotion || false;
  showWelcome.checked = settings.showWelcomeOnBoot || false;

  function open() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('visible');
    backdrop.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function close() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('visible');
    backdrop.setAttribute('aria-hidden', 'true');
    openBtn.focus();
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('open')) close();
  });

  // Theme change
  themeSelect.addEventListener('change', () => {
    const theme = themeSelect.value;
    applyTheme(theme);
    saveSettings({ theme });
    toast('Theme updated');
  });

  // Reduced motion
  reducedMotion.addEventListener('change', () => {
    saveSettings({ reducedMotion: reducedMotion.checked });
    if (reducedMotion.checked) {
      document.documentElement.style.setProperty('--transition-fast', '0.01ms');
      document.documentElement.style.setProperty('--transition-base', '0.01ms');
      document.documentElement.style.setProperty('--transition-slow', '0.01ms');
    }
    toast(reducedMotion.checked ? 'Reduced motion enabled' : 'Animations restored');
  });

  // Show welcome
  showWelcome.addEventListener('change', () => {
    saveSettings({ showWelcomeOnBoot: showWelcome.checked });
    toast(showWelcome.checked ? 'Welcome screen will replay on next visit' : 'Welcome screen disabled');
  });

  // IT Hub visibility
  const itHubVisible = document.getElementById('it-hub-visible');
  if (itHubVisible) {
    itHubVisible.checked = settings.itHubVisible || false;
    itHubVisible.addEventListener('change', () => {
      saveSettings({ itHubVisible: itHubVisible.checked });
      toggleItHubGrid(itHubVisible.checked);
      toast(itHubVisible.checked ? 'IT Hub shown on main grid' : 'IT Hub hidden from main grid');
    });
  }

  // Export data
  document.getElementById('btn-export').addEventListener('click', () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      data[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Data exported');
  });

  // Import data
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
        toast('Data imported successfully. Refreshing...');
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        toast('Invalid backup file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Clear data
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('This will erase ALL data. Are you sure?')) {
      localStorage.clear();
      toast('All data cleared. Refreshing...');
      setTimeout(() => location.reload(), 1200);
    }
  });
}

/* ===== CALENDAR SYNC ===== */
function initCalendarSync() {
  const clientIdEl = document.getElementById('sync-client-id');
  const apiKeyEl = document.getElementById('sync-api-key');
  const autoEl = document.getElementById('sync-auto');
  const intervalEl = document.getElementById('sync-interval');
  const badge = document.getElementById('sync-status-badge');
  const syncNowBtn = document.getElementById('btn-sync-now');
  const unlinkBtn = document.getElementById('btn-sync-unlink');

  // Restore saved config
  const settings = loadSettings();
  const sync = settings.calendarSync || {};
  if (clientIdEl) clientIdEl.value = sync.clientId || '';
  if (apiKeyEl) apiKeyEl.value = sync.apiKey || '';
  if (autoEl) autoEl.checked = sync.autoSync || false;
  if (intervalEl) intervalEl.value = String(sync.intervalMin || 60);

  updateSyncBadge(sync.status || 'none');
  if (unlinkBtn) unlinkBtn.style.display = (sync.status === 'linked' || sync.status === 'synced') ? 'inline-flex' : 'none';

  function persist() {
    const next = {
      clientId: clientIdEl?.value.trim() || '',
      apiKey: apiKeyEl?.value.trim() || '',
      autoSync: autoEl?.checked || false,
      intervalMin: parseInt(intervalEl?.value || '60', 10),
      status: (loadSettings().calendarSync || {}).status || 'none'
    };
    saveSettings({ calendarSync: next });
  }

  clientIdEl?.addEventListener('input', () => {
    persist();
    if (clientIdEl.value.trim()) updateSyncBadge('linked');
    else updateSyncBadge('none');
    if (unlinkBtn) unlinkBtn.style.display = clientIdEl.value.trim() ? 'inline-flex' : 'none';
  });

  apiKeyEl?.addEventListener('input', () => { persist(); document.dispatchEvent(new CustomEvent('calendarSyncChanged')); });
  autoEl?.addEventListener('change', () => { persist(); document.dispatchEvent(new CustomEvent('calendarSyncChanged')); toast(autoEl.checked ? 'Auto-sync enabled' : 'Auto-sync disabled'); });
  intervalEl?.addEventListener('change', () => { persist(); document.dispatchEvent(new CustomEvent('calendarSyncChanged')); });

  syncNowBtn?.addEventListener('click', () => {
    if (!clientIdEl?.value.trim() && !apiKeyEl?.value.trim()) {
      toast('Enter an API key or OAuth client ID first', 'error');
      return;
    }
    // Actual sync logic lives in js/apps/gcal-sync.js — it listens to the same button
  });

  unlinkBtn?.addEventListener('click', () => {
    if (!confirm('Unlink Google Calendar?')) return;
    if (clientIdEl) clientIdEl.value = '';
    if (apiKeyEl) apiKeyEl.value = '';
    const cfg2 = loadSettings().calendarSync || {};
    cfg2.clientId = '';
    cfg2.apiKey = '';
    cfg2.status = 'none';
    cfg2.autoSync = false;
    saveSettings({ calendarSync: cfg2 });
    updateSyncBadge('none');
    unlinkBtn.style.display = 'none';
    toast('Calendar unlinked');
    document.dispatchEvent(new CustomEvent('calendarSyncChanged'));
  });

  function updateSyncBadge(status) {
    if (!badge) return;
    badge.className = 'sync-status-badge';
    const map = {
      none: { text: 'Not linked', cls: '' },
      linked: { text: 'Linked', cls: 'linked' },
      syncing: { text: 'Syncing…', cls: 'syncing' },
      synced: { text: 'Synced', cls: 'synced' },
      error: { text: 'Error', cls: 'error' }
    };
    const m = map[status] || map.none;
    badge.textContent = m.text;
    if (m.cls) badge.classList.add(m.cls);

    // Update toolbar dot in Calendar app
    const dot = document.getElementById('calendar-sync-dot');
    if (dot) {
      dot.className = 'calendar-sync-dot';
      if (m.cls) dot.classList.add(m.cls);
      dot.title = `Google Calendar: ${m.text}`;
    }
  }
}

/* ===== WELCOME ===== */
function initWelcome() {
  const settings = loadSettings();
  const overlay = document.getElementById('welcome-overlay');
  const tagline = document.getElementById('welcome-tagline');
  const cta = document.getElementById('welcome-cta');
  const skip = document.getElementById('welcome-skip');

  const hasSeenWelcome = localStorage.getItem('ncc-welcome-seen');
  const shouldShow = settings.showWelcomeOnBoot || !hasSeenWelcome;

  if (shouldShow) {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    typewriter(tagline, 'Adapt. Learn. Build.', 80);
  }

  function dismiss() {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    localStorage.setItem('ncc-welcome-seen', 'true');
    saveSettings({ showWelcomeOnBoot: false });
    document.getElementById('show-welcome').checked = false;
    // Focus management
    document.getElementById('app')?.focus();
  }

  cta.addEventListener('click', dismiss);
  skip.addEventListener('click', dismiss);
}

function typewriter(el, text, speed) {
  let i = 0;
  el.textContent = '';
  const tick = () => {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(tick, speed);
    }
  };
  tick();
}

/* ===== CHAT ===== */
function initChat() {
  // Widget
  const widget = document.getElementById('chat-widget');
  const toggle = document.getElementById('chat-widget-toggle');
  const wInput = document.getElementById('chat-widget-input');
  const wSend = document.getElementById('chat-widget-send');
  const wMessages = document.getElementById('chat-widget-messages');

  // Full-page chat
  const fpInput = document.getElementById('chat-input');
  const fpSend = document.getElementById('chat-send');
  const fpHistory = document.getElementById('chat-history');

  toggle.addEventListener('click', () => {
    widget.classList.toggle('open');
  });

  // Unified send handler
  function sendFromWidget() {
    const text = wInput.value.trim();
    if (!text) return;
    addMessage(wMessages, text, 'user');
    wInput.value = '';
    handleCommand(text, wMessages);
  }

  function sendFromFullpage() {
    const text = fpInput.value.trim();
    if (!text) return;
    addMessage(fpHistory, text, 'user');
    fpInput.value = '';
    handleCommand(text, fpHistory);
  }

  wSend.addEventListener('click', sendFromWidget);
  wInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendFromWidget();
  });

  fpSend.addEventListener('click', sendFromFullpage);
  fpInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendFromFullpage();
  });

  // Load persisted history
  const history = JSON.parse(localStorage.getItem('ncc-chat-history') || '[]');
  history.forEach(msg => {
    const target = msg.source === 'widget' ? wMessages : fpHistory;
    addMessage(target, msg.text, msg.role, false);
  });
}

function addMessage(container, text, role, persist = true) {
  if (!container) return;
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg-${role}`;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  if (persist) {
    const history = JSON.parse(localStorage.getItem('ncc-chat-history') || '[]');
    history.push({ text, role, source: container.id === 'chat-widget-messages' ? 'widget' : 'fullpage', time: Date.now() });
    // Keep last 200 messages
    if (history.length > 200) history.shift();
    localStorage.setItem('ncc-chat-history', JSON.stringify(history));
  }
}

function handleCommand(text, container) {
  const lower = text.toLowerCase().trim();
  if (lower === '/new') {
    localStorage.removeItem('ncc-chat-history');
    container.innerHTML = '';
    setTimeout(() => {
      addMessage(container, 'Fresh start. What can I do for you?', 'bot');
    }, 300);
    return;
  }
  if (lower === '/help') {
    addMessage(container, 'Commands:\n/new — start fresh conversation\n/help — show this message', 'bot');
    return;
  }

  // Placeholder echo (until Hermes bridge is wired)
  setTimeout(() => {
    addMessage(container, `Received: "${text}"\n\n(Hermes bridge not yet connected — this will be wired in T-012)`, 'bot');
  }, 600);
}

/* ===== UTILITIES ===== */
export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('ncc-settings') || '{}');
  } catch {
    return {};
  }
}

export function saveSettings(patch) {
  const current = loadSettings();
  const next = { ...current, ...patch };
  localStorage.setItem('ncc-settings', JSON.stringify(next));
  return next;
}

export function toast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = message;
  container.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function updateDashboardDate() {
  const el = document.getElementById('dashboard-date');
  if (el) {
    const now = new Date();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    el.textContent = now.toLocaleDateString(undefined, opts);
  }
}

function toggleItHubGrid(visible) {
  const card = document.querySelector('[data-app="backup"]');
  if (!card) return;
  card.style.display = visible ? '' : 'none';
}

/* ===== FEEDBACK ===== */
function initFeedback() {
  const form = document.getElementById('feedback-form');
  const list = document.getElementById('feedback-list');
  const questionsBox = document.getElementById('feedback-questions');
  const qText = document.getElementById('feedback-q-text');
  const qNum = document.getElementById('feedback-q-num');
  const qTotal = document.getElementById('feedback-q-total');
  const qAnswer = document.getElementById('feedback-q-answer');
  const qNext = document.getElementById('feedback-q-next');
  const qPrev = document.getElementById('feedback-q-prev');
  const qSkip = document.getElementById('feedback-skip-q');
  const previewBox = document.getElementById('feedback-preview');
  const previewCard = document.getElementById('feedback-preview-card');
  const finalSubmit = document.getElementById('feedback-final-submit');
  const editBtn = document.getElementById('feedback-edit-btn');
  if (!form) return;

  // State
  let draft = null;
  let currentQIndex = 0;
  let answers = [];

  // Load existing
  renderFeedbackList();
  updateFeedbackBadge();

  const questionSets = {
    feature: [
      {
        text: 'What problem does this feature solve for you?',
        placeholder: 'e.g., "I lose track of bill due dates and get late fees"'
      },
      {
        text: 'Who is this feature for — just you, your family, or a team?',
        placeholder: 'e.g., "My spouse and I both need to see it"'
      },
      {
        text: 'Can you name an existing app that does this well?',
        placeholder: 'e.g., "Notion does it, but it\'s too slow"'
      }
    ],
    improvement: [
      {
        text: 'What frustrates you most about the current behavior?',
        placeholder: 'e.g., "It takes 4 taps to open a note"'
      },
      {
        text: 'How would the ideal version of this look or feel?',
        placeholder: 'e.g., "A single button press, like in Apple Notes"'
      },
      {
        text: 'How often does this issue come up?',
        placeholder: 'e.g., "Every single day, five to ten times"'
      }
    ],
    bug: [
      {
        text: 'What exactly were you doing when the bug happened?',
        placeholder: 'e.g., "I switched themes while the calendar was open"'
      },
      {
        text: 'What did you expect to happen versus what actually happened?',
        placeholder: 'e.g., "Expected dark mode, got a blank screen"'
      },
      {
        text: 'Can you reproduce it reliably? If so, how?',
        placeholder: 'e.g., "Yes — every time I reload the page on mobile"'
      }
    ],
    theme: [
      {
        text: 'What mood or vibe should this theme evoke?',
        placeholder: 'e.g., "A calm forest at dawn"'
      },
      {
        text: 'Any specific colors, fonts, or references (movies, games, brands)?',
        placeholder: 'e.g., "Blade Runner 2049 orange and deep blue"'
      },
      {
        text: 'Should this be dark or light mode primarily?',
        placeholder: 'e.g., "Dark, but not harsh black — more of a deep navy"'
      }
    ],
    other: [
      {
        text: 'What\'s the main thing you want us to know?',
        placeholder: 'Say it however you like — no wrong answers.'
      },
      {
        text: 'Is there anything else that would help us understand?',
        placeholder: 'Screenshots, links, context — whatever helps.'
      }
    ]
  };

  form.addEventListener('submit', e => {
    e.preventDefault();
    const type = document.getElementById('feedback-type').value;
    const title = document.getElementById('feedback-title').value.trim();
    const desc = document.getElementById('feedback-desc').value.trim();
    const priority = document.querySelector('input[name="feedback-priority"]:checked')?.value || 'nice';

    draft = { type, title, desc, priority };
    const qs = questionSets[type] || questionSets.other;
    currentQIndex = 0;
    answers = new Array(qs.length).fill('');

    // Show question engine
    form.style.display = 'none';
    questionsBox.style.display = 'flex';
    previewBox.style.display = 'none';
    qTotal.textContent = qs.length;
    renderQuestion();
  });

  function renderQuestion() {
    const qs = questionSets[draft.type] || questionSets.other;
    const q = qs[currentQIndex];
    qNum.textContent = currentQIndex + 1;
    qText.textContent = q.text;
    qAnswer.value = answers[currentQIndex];
    qAnswer.placeholder = q.placeholder;

    qPrev.disabled = currentQIndex === 0;
    qNext.textContent = currentQIndex === qs.length - 1 ? 'Review' : 'Next';
  }

  qNext.addEventListener('click', () => {
    answers[currentQIndex] = qAnswer.value.trim();
    const qs = questionSets[draft.type] || questionSets.other;
    if (currentQIndex < qs.length - 1) {
      currentQIndex++;
      renderQuestion();
    } else {
      showPreview();
    }
  });

  qPrev.addEventListener('click', () => {
    answers[currentQIndex] = qAnswer.value.trim();
    if (currentQIndex > 0) {
      currentQIndex--;
      renderQuestion();
    }
  });

  qSkip.addEventListener('click', () => {
    answers = answers.map(() => '(skipped)');
    showPreview();
  });

  function showPreview() {
    questionsBox.style.display = 'none';
    previewBox.style.display = 'flex';
    const qs = questionSets[draft.type] || questionSets.other;
    let html = `<b>Type:</b> ${escapeHtml(draft.type)}<br>`;
    html += `<b>Title:</b> ${escapeHtml(draft.title)}<br>`;
    html += `<b>Description:</b> ${escapeHtml(draft.desc)}<br>`;
    html += `<b>Priority:</b> ${escapeHtml(draft.priority)}<br><br>`;
    html += '<b>Answers:</b><br>';
    qs.forEach((q, i) => {
      html += `<div style="margin-top:4px;"><u>Q${i + 1}</u> ${escapeHtml(q.text)}<br>`;
      html += `<span style="color:var(--text-muted)">${escapeHtml(answers[i] || '(no answer)')}</span></div>`;
    });
    previewCard.innerHTML = html;

    // Show Generate Whiteboard Task button if not already present
    if (!document.getElementById('feedback-generate-btn')) {
      const genBtn2 = document.createElement('button');
      genBtn2.id = 'feedback-generate-btn';
      genBtn2.type = 'button';
      genBtn2.className = 'btn-primary';
      genBtn2.innerHTML = '📋 Generate Whiteboard Task';
      genBtn2.style.marginTop = '8px';
      previewCard.appendChild(genBtn2);

      genBtn2.addEventListener('click', () => {
        const entry = {
          id: 'fb-' + Date.now(),
          type: draft.type,
          title: draft.title,
          desc: draft.desc,
          priority: draft.priority,
          answers: qs.map((q, i) => ({ question: q.text, answer: answers[i] || '' })),
          status: 'submitted',
          createdAt: new Date().toISOString()
        };
        showGeneratedTask(entry);
      });
    }
  }

  finalSubmit.addEventListener('click', () => {
    const qs = questionSets[draft.type] || questionSets.other;
    const entry = {
      id: 'fb-' + Date.now(),
      type: draft.type,
      title: draft.title,
      desc: draft.desc,
      priority: draft.priority,
      answers: qs.map((q, i) => ({ question: q.text, answer: answers[i] || '' })),
      status: 'submitted',
      createdAt: new Date().toISOString()
    };
    const stored = JSON.parse(localStorage.getItem('ncc-feedback') || '[]');
    stored.unshift(entry);
    localStorage.setItem('ncc-feedback', JSON.stringify(stored));

    // Reset UI
    form.reset();
    form.style.display = 'block';
    questionsBox.style.display = 'none';
    previewBox.style.display = 'none';
    draft = null;

    renderFeedbackList();
    updateFeedbackBadge();
    toast('Feedback submitted to agent board');
  });

  editBtn.addEventListener('click', () => {
    previewBox.style.display = 'none';
    questionsBox.style.display = 'flex';
    currentQIndex = 0;
    renderQuestion();
  });

  function renderFeedbackList() {
    if (!list) return;
    const items = JSON.parse(localStorage.getItem('ncc-feedback') || '[]');
    if (items.length === 0) {
      list.innerHTML = '<div class="feedback-empty">No submissions yet. Be the first to shape the Nexus!</div>';
      return;
    }
    list.innerHTML = items.map(item => `
      <div class="feedback-item" data-id="${escapeHtml(item.id)}">
        <div class="feedback-item-header">
          <span class="feedback-item-title">${escapeHtml(item.title)}</span>
          <span class="feedback-item-type ${item.type}">${item.type}</span>
        </div>
        <div class="feedback-item-desc">${escapeHtml(item.desc)}</div>
        <div class="feedback-item-meta">
          <span>${fmtDate(item.createdAt)}</span>
          <span class="feedback-item-priority">${item.priority}</span>
        </div>
        <div class="feedback-item-actions">
          <button type="button" class="feedback-gen-btn btn-secondary" data-id="${escapeHtml(item.id)}">📋 Generate Task</button>
        </div>
      </div>
    `).join('');

    // Wire gen-task buttons
    list.querySelectorAll('.feedback-gen-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const items = JSON.parse(localStorage.getItem('ncc-feedback') || '[]');
        const entry = items.find(it => it.id === id);
        if (entry) showGeneratedTask(entry);
      });
    });
  }

  function updateFeedbackBadge() {
    const badge = document.getElementById('feedback-badge');
    if (!badge) return;
    const items = JSON.parse(localStorage.getItem('ncc-feedback') || '[]');
    badge.textContent = items.length;
    badge.style.display = items.length > 0 ? 'flex' : 'none';
  }

  /* ── Whiteboard Task Generator ────────────────── */
  function generateTaskId() {
    const items = JSON.parse(localStorage.getItem('ncc-feedback') || '[]');
    const maxT = items.reduce((m, it) => {
      const match = (it.taskId || '').match(/T-(\d+)/);
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 21); // start past existing feedback-related tasks
    return `T-${String(maxT + 1).padStart(3, '0')}`;
  }

  function generateTaskMarkdown(entry) {
    const tid = generateTaskId();
    const priorityBadge = entry.priority === 'must' ? '🔴' : entry.priority === 'should' ? '🟡' : '🟢';
    const status = 'PENDING';
    const typeLabel = entry.type === 'bug' ? 'Bug' : entry.type === 'theme' ? 'Theme Idea' : entry.type === 'improvement' ? 'Improvement' : 'Feature';
    const answersBlock = (entry.answers || []).map((a, i) => {
      return `- **Q${i + 1}:** ${escapeMarkdown(a.question)}\n  - ${escapeMarkdown(a.answer || '(no answer)')}`;
    }).join('\n');

    return `| ID | Task | Status | Notes |\n|----|------|--------|-------|\n| \`${tid}\` | ${priorityBadge} ${escapeMarkdown(entry.title)} | \`${status}\` | **Type:** ${typeLabel}${entry.desc ? ` — ${escapeMarkdown(entry.desc.slice(0, 120))}` : ''}${entry.desc.length > 120 ? '...' : ''} |` +
           `\n\n**Generated Task Details**\n- **Task ID:** ${tid}\n- **Priority:** ${entry.priority}\n- **Submitted:** ${entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'now'}\n\n**Clarifying Answers**\n${answersBlock || '_No answers recorded._'}`;
  }

  function escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/[|\\]/g, '\\$&').trim();
  }

  function showGeneratedTask(entry) {
    const genBox = document.getElementById('feedback-generated');
    const pre = document.getElementById('feedback-generated-code');
    if (!genBox || !pre) return;

    const md = generateTaskMarkdown(entry);
    pre.textContent = md;

    // Inject generate + copy buttons into each history item if not already
    genBox.style.display = 'block';
    genBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* Wire up copy + close */
  const genClose = document.getElementById('feedback-close-gen');
  const genCopy = document.getElementById('feedback-copy-gen');
  if (genClose) {
    genClose.addEventListener('click', () => {
      document.getElementById('feedback-generated').style.display = 'none';
    });
  }
  if (genCopy) {
    genCopy.addEventListener('click', () => {
      const pre = document.getElementById('feedback-generated-code');
      if (!pre) return;
      const text = pre.textContent || '';
      navigator.clipboard.writeText(text).then(() => toast('Task markdown copied to clipboard'))
        .catch(() => {
          const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
          toast('Task markdown copied to clipboard');
        });
    });
  }
}
/* ===== AGENT STATS ===== */
export function liveAgentStatus(sessionId) {
  const indicator = document.getElementById('agent-indicator');
  if (!indicator) return;
  indicator.dataset.sessionId = sessionId || '';
  indicator.style.background = '#22c55e';
  indicator.style.opacity = '1';
}

export function initAgentStats() {
  // Indicator
  const indicator = document.getElementById('agent-indicator');
  if (indicator) {
    indicator.style.background = '#94a3b8';   // gray = no heartbeat yet
  }

  // Pull stats from settings or whiteboard fallback
  const settings = loadSettings();
  const stats = settings.agentStats || {};

  setStat('agent-stat-tasks', stats.tasksDone || 0);
  setStat('agent-stat-bugs', stats.bugsFixed || 0);
  setStat('agent-stat-commits', stats.commits || 0);
  setStat('agent-stat-wakes', stats.wakeCycles || 0);

  const lastRun = stats.lastRun ? fmtDate(stats.lastRun) : 'Never';
  const nextRun = stats.nextRun ? fmtDate(stats.nextRun) : '—';
  document.getElementById('agent-stat-last-run').textContent = lastRun;
  document.getElementById('agent-stat-next-run').textContent = nextRun;

  // Upcoming tasks (read from localStorage or show placeholder)
  const upcomingList = document.getElementById('agent-upcoming-list');
  if (upcomingList) {
    const whiteboard = localStorage.getItem('ncc-whiteboard-cache');
    if (whiteboard) {
      try {
        const wb = JSON.parse(whiteboard);
        const tasks = (wb.tasks || []).filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').slice(0, 6);
        if (tasks.length) {
          upcomingList.innerHTML = tasks.map(t => `<li>${escapeHtml(t.title || t.id)}</li>`).join('');
        } else {
          upcomingList.innerHTML = '<li class="agent-upcoming-empty">No upcoming tasks from whiteboard cache</li>';
        }
      } catch {
        upcomingList.innerHTML = '<li class="agent-upcoming-empty">Open Settings → Refresh Whiteboard to sync</li>';
      }
    }
  }

  // Refresh button
  const btn = document.getElementById('btn-sync-whiteboard');
  if (btn) {
    btn.addEventListener('click', () => {
      fetchWhiteboard();
    });
  }
}

function setStat(id, n) {
  const el = document.getElementById(id);
  if (el) el.textContent = n;
}

function fetchWhiteboard() {
  // Try loading WHITEBOARD.md from the server (same origin)
  fetch('WHITEBOARD.md')
    .then(r => r.ok ? r.text() : Promise.reject(new Error('Not found')))
    .then(text => {
      const parsed = parseWhiteboard(text);
      localStorage.setItem('ncc-whiteboard-cache', JSON.stringify(parsed));
      // Update upcoming list
      const upcomingList = document.getElementById('agent-upcoming-list');
      if (upcomingList) {
        const tasks = (parsed.tasks || []).filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').slice(0, 6);
        if (tasks.length) {
          upcomingList.innerHTML = tasks.map(t => `<li>${escapeHtml(t.title || t.id)}</li>`).join('');
        } else {
          upcomingList.innerHTML = '<li class="agent-upcoming-empty">All tasks are done</li>';
        }
      }
      toast('Whiteboard refreshed');
    })
    .catch(() => {
      toast('Could not load WHITEBOARD.md — check server / repo', 'error');
    });
}

function parseWhiteboard(md) {
  const tasks = [];
  const bugs = [];
  let inTasks = false;
  let inBugs = false;

  for (const line of md.split('\n')) {
    if (line.includes('## 🎯 TASK BOARD') || line.includes('## 🎯')) inTasks = true;
    if (line.includes('## 🔍 BUG TRACKER') || line.includes('## 🔍')) { inTasks = false; inBugs = true; }
    if (line.includes('## 🧠') || line.includes('## 📝')) { inTasks = false; inBugs = false; }

    const taskMatch = line.match(/\| `?T-\d+`? \| (.+?) \| `(DONE|IN_PROGRESS|PENDING)` \|/);
    if (taskMatch && inTasks) {
      tasks.push({ id: line.match(/T-\d+/)?.[0] || '', title: taskMatch[1], status: taskMatch[2] });
    }
  }
  return { tasks, bugs };
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

/* ===== OFFLINE MODE ===== */
function initOfflineMode() {
  const indicator = document.getElementById('offline-indicator');
  if (!indicator) return;

  function setOnline(online) {
    if (online) {
      indicator.style.display = 'none';
      indicator.textContent = '';
      indicator.className = 'offline-indicator';
    } else {
      indicator.style.display = 'inline-flex';
      indicator.textContent = 'Offline';
      indicator.className = 'offline-indicator visible';
    }
  }

  setOnline(navigator.onLine);

  if ('onLine' in window) {
    window.addEventListener('online', () => {
      setOnline(true);
      toast('You are back online');
      // Notify other modules that sync may resume
      document.dispatchEvent(new CustomEvent('nexusOnline'));
    });
    window.addEventListener('offline', () => {
      setOnline(false);
      toast('You are offline', 'error');
      document.dispatchEvent(new CustomEvent('nexusOffline'));
    });
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.log('SW failed', err));
  }
}
