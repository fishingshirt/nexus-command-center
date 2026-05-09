import { initCalendar } from './apps/calendar.js';

const APP_REGISTRY = [
  { id: 'calendar', name: 'Calendar', icon: '📅', path: 'calendar' },
  { id: 'notes', name: 'Notes', icon: '📝', path: 'notes' },
  { id: 'todo', name: 'To-Do', icon: '✅', path: 'todo' },
  { id: 'chat', name: 'Hermes Chat', icon: '💬', path: 'chat' }
];

export function initApp() {
  initRouter();
  initNavigation();
  initTheme();
  initSettings();
  initWelcome();
  initChat();
  initCalendar();
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

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.log('SW failed', err));
  }
}
