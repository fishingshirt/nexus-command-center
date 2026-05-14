import { storage } from './lib/storage-adapter.js';
import { runMigration } from './lib/migrate-legacy.js';
import { initCalendar } from './apps/calendar.js';
import { initNotes } from './apps/notes.js';
import { calendarAddAttachment, calendarFindByTitle, calendarShowAttachments } from './apps/calendar.js';
import { noteAddAttachment, noteFindByTitle, noteShowAttachments } from './apps/notes.js';
import { initTodo } from './apps/todo.js';
import { initGoogleSync } from './apps/gcal-sync.js';
import { initBackup } from './apps/backup.js';
import { initWeather } from './apps/weather.js';
import { initITHub } from './apps/it-hub.js';
import { initAuth, ensureAuthEnabled } from './apps/auth.js';
import { initPhoneBridge } from './apps/phone-bridge.js';
import { initArcade } from './apps/arcade.js';
import { initFinance } from './apps/finance.js';
import { initPomodoro } from './apps/pomodoro.js';
import { initWorldClock } from './apps/worldclock.js';
import { initNews, openNews } from './apps/news.js';
import { initRss } from './apps/rss.js';
import { initPdfEditor } from './apps/pdf.js';
import { initVault } from './apps/vault.js';
import { initWishlist } from './apps/wishlist.js';
import { initRecipe } from './apps/recipe.js';
import { initSuggester, openSuggester } from './apps/ai-suggester.js';
import { initShortcuts } from './apps/shortcuts.js';
import { initEmail } from './apps/email.js';
import { initBookmarks } from './apps/bookmarks.js';
import { initFinanceTracker } from './apps/finance-tracker.js';
import { initQuickCapture } from './apps/quick-capture.js';
import { WidgetGrid } from './widgets/grid.js';
import { registerWidgetFactories } from './widgets/factories.js';
import { initThemeAutoSwitch, setThemeMode } from './theme-autoswitch.js';
import { initWelcome } from './welcome.js';
import { initNotifications, notify } from './notifications.js';

const APP_REGISTRY = [
  { id: 'calendar', name: 'Calendar', icon: '📅', path: 'calendar' },
  { id: 'notes', name: 'Notes', icon: '📝', path: 'notes' },
  { id: 'todo', name: 'To-Do', icon: '✅', path: 'todo' },
  { id: 'chat', name: 'Hermes Chat', icon: '💬', path: 'chat' },
  { id: 'weather', name: 'Weather', icon: '☀️', path: 'weather' },
  { id: 'phone', name: 'Phone Bridge', icon: '📱', path: 'phone' },
  { id: 'feedback', name: 'Feedback', icon: '💬', path: 'feedback' },
  { id: 'arcade', name: 'Arcade', icon: '🎮', path: 'arcade' },
  { id: 'finance', name: 'Finance', icon: '💰', path: 'finance' },
  { id: 'finance-tracker', name: 'Budget', icon: '📒', path: 'finance-tracker' },
  { id: 'worldclock', name: 'World Clock', icon: '🌍', path: 'worldclock' },
  { id: 'pomodoro', name: 'Focus', icon: '🍅', path: 'pomodoro' },
  { id: 'news', name: 'News Hub', icon: '📰', path: 'news' },
  { id: 'wishlist', name: 'Wishlist', icon: '❤️', path: 'wishlist' },
  { id: 'email', name: 'Email', icon: '✉️', path: 'email' },
  { id: 'rss', name: 'RSS Reader', icon: '📡', path: 'rss' },
  { id: 'pdf', name: 'PDF Editor', icon: '📄', path: 'pdf' },
  { id: 'vault', name: 'Vault', icon: '🔐', path: 'vault' },
  { id: 'recipe', name: 'Recipes', icon: '🍳', path: 'recipe' },
  { id: 'bookmarks', name: 'Bookmarks', icon: '🔖', path: 'bookmarks' },
  { id: 'ai-suggester', name: 'AI Suggester', icon: '💡', path: 'ai-suggester' }
];

export function initApp() {
  initRouter();
  initNavigation();
  initTheme();
  initThemeAutoSwitch();
  initSettings();
  initCalendarSync();
  /* === SAFEGUARD: Welcome overlay must not silently block the app === */
  try {
    initWelcome();
  } catch (e) {
    console.error('[Nexus] initWelcome crashed — forcing reveal', e);
    const overlay = document.getElementById('welcome-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
    }
    const app = document.getElementById('app');
    if (app) app.classList.add('welcome-ready');
  }
  runMigration();
  initNotifications();
  initAgentNotificationPoll();
  initChat();
  initFeedback();
  initAgentStats();
  initQualityPanel();
  initBackup();
  initITHub();
  initPhoneBridge();
  initArcade();
  initWidgetGrid();
  initQuickCapture();
  initFinance();
  initFinanceTracker();
  initPomodoro();
  initWorldClock();
  initNews();
  initRss();
  initWishlist();
  initPdfEditor();
  initVault();
  initRecipe();
  initBookmarks();
  initSuggester();
  initEmail();
  initWeather();
  initCalendar();
  initNotes();
  initTodo();
  initGoogleSync();
  initAuth();
  initHomeButton();
  updateDashboardDate();
  initOfflineMode();
  startOfflineWatcher();
  // renderFeedbackList and updateFeedbackBadge are already triggered inside initFeedback
  registerServiceWorker();
  initSearch();
  initShortcuts();
  initAppLauncher();

  /* Keyboard shortcuts */
  setTimeout(() => {
    const app = document.getElementById('app');
    if (app && getComputedStyle(app).display === 'none') {
      app.classList.add('welcome-ready');
      console.warn('[Nexus] Emergency reveal triggered — welcome overlay may have failed');
    }
  }, 2000);
}

/* ===== OFFLINE QUEUE FLUSH ===== */
let __offlineTimer = null;
function startOfflineWatcher() {
  if (typeof window === 'undefined') return;
  window.addEventListener('offline', () => {
    // no-op: indicator in initOfflineMode catches this
  });
  window.addEventListener('online', async () => {
    if (!window.__offlineQueue?.length) return;
    while (window.__offlineQueue.length) {
      const job = window.__offlineQueue.shift();
      try {
        const ok = await storage.write(job.app, job.data);
        if (!ok) { window.__offlineQueue.unshift(job); break; }
      } catch {
        window.__offlineQueue.unshift(job);
        break;
      }
    }
    if (!window.__offlineQueue.length) {
      window.__nexusOffline = false;
      const indicator = document.getElementById('offline-indicator');
      if (indicator) { indicator.style.display = 'none'; indicator.className = 'offline-indicator'; }
    }
  });
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
    if (viewId === 'news') openNews();
    if (viewId === 'ai-suggester') openSuggester();

    // Per-app theme override
    const settings = loadSettings();
    const perAppThemes = settings.perAppThemes || {};
    const perTheme = perAppThemes[viewId];
    if (perTheme) {
      if (!window._ncc_lastGlobalTheme) {
        window._ncc_lastGlobalTheme = document.body.getAttribute('data-theme') || settings.theme || 'jarvis';
      }
      applyTheme(perTheme);
    } else if (window._ncc_lastGlobalTheme) {
      applyTheme(window._ncc_lastGlobalTheme);
      window._ncc_lastGlobalTheme = null;
    }

    // Per-app auth check
    if (['calendar','notes','todo'].includes(viewId)) {
      if (typeof ensureAuthEnabled === 'function') {
        ensureAuthEnabled(viewId);
      }
    }
    if (viewId === 'pdf') {
      if (typeof initPdfEditor === 'function') initPdfEditor();
    }
  } else {
    document.getElementById('view-dashboard').classList.add('active');
  }
}

/* ===== HOME BUTTON ===== */
function initHomeButton() {
  const brand = document.getElementById('header-brand');
  if (!brand) return;
  brand.addEventListener('click', () => {
    location.hash = 'dashboard';
  });
  brand.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      location.hash = 'dashboard';
    }
  });
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
  if (!drawer || !backdrop || !openBtn || !closeBtn) return;

  let isOpen = false;

  function open() {
    if (isOpen) return;
    isOpen = true;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('visible');
    backdrop.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('visible');
    backdrop.setAttribute('aria-hidden', 'true');
    openBtn.focus();
  }

  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    open();
  });
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  backdrop.addEventListener('click', close);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) close();
  });

  // Nav links click → close drawer + route via hash (except settings which navigates to #settings)
  drawer.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const app = link.dataset.app;
      close();
      if (app) location.hash = app;
    });
  });
}

/* ===== THEME ===== */
export function initTheme() {
  const saved = loadSettings();
  applyTheme(saved.theme || 'jarvis');
  applyThemeMode(saved.themeMode ?? 'dark');
}

export function applyTheme(themeName) {
  const link = document.getElementById('theme-stylesheet');
  if (link) {
    link.href = `css/themes/${themeName}.css`;
  }
  document.body.setAttribute('data-theme', themeName);
  // Update meta theme-color
  setTimeout(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const meta = document.getElementById('theme-color');
    if (meta && accent) meta.content = accent;
  }, 100);
}

export function applyThemeMode(mode) {
  document.body.setAttribute('data-theme-mode', mode);
  // Update meta theme-color from body-inherited accent
  setTimeout(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const meta = document.getElementById('theme-color');
    if (meta && accent) meta.content = accent;
  }, 50);
}

/* ===== SETTINGS ===== */
function initSettings() {
  const themeSelect = document.getElementById('theme-select');
  const darkMode = document.getElementById('dark-mode');
  const reducedMotion = document.getElementById('reduced-motion');
  const showWelcome = document.getElementById('show-welcome');

  const settings = loadSettings();

  // Apply saved values
  themeSelect.value = settings.theme || 'jarvis';
  if (darkMode) darkMode.checked = (settings.themeMode ?? 'dark') === 'dark';
  reducedMotion.checked = settings.reducedMotion || false;
  showWelcome.checked = settings.showWelcomeOnBoot || false;

  // Theme change
  themeSelect.addEventListener('change', () => {
    const theme = themeSelect.value;
    applyTheme(theme);
    saveSettings({ theme });
    toast('Theme updated');
  });

  // Dark mode toggle
  if (darkMode) {
    darkMode.addEventListener('change', () => {
      const mode = darkMode.checked ? 'dark' : 'light';
      applyThemeMode(mode);
      saveSettings({ themeMode: mode });
      toast(darkMode.checked ? 'Dark mode on' : 'Dark mode off');
      // Manual toggle implicitly switches mode to manual
      const sel = document.getElementById('theme-mode-select');
      if (sel) sel.value = 'manual';
      setThemeMode('manual');
    });
  }

  // Theme mode auto-switcher wiring
  (function wireThemeMode() {
    const sel = document.getElementById('theme-mode-select');
    const timeRow = document.getElementById('time-range-row');
    const darkStart = document.getElementById('dark-start');
    const lightStart = document.getElementById('light-start');
    if (!sel) return;
    const storedMode = settings.themeAutoMode || 'manual';
    sel.value = storedMode;
    if (timeRow) timeRow.style.display = storedMode === 'auto-time' ? 'flex' : 'none';
    if (darkStart) darkStart.value = settings.darkStart || '20:00';
    if (lightStart) lightStart.value = settings.lightStart || '07:00';
    sel.addEventListener('change', () => {
      const mode = sel.value;
      if (timeRow) timeRow.style.display = mode === 'auto-time' ? 'flex' : 'none';
      saveSettings({ themeAutoMode: mode, darkStart: darkStart?.value, lightStart: lightStart?.value });
      setThemeMode(mode);
      toast(mode === 'manual' ? 'Manual theme mode' : 'Auto theme mode enabled');
    });
    if (darkStart) {
      darkStart.addEventListener('change', () => {
        saveSettings({ darkStart: darkStart.value });
        if (sel.value === 'auto-time') setThemeMode('auto-time');
      });
    }
    if (lightStart) {
      lightStart.addEventListener('change', () => {
        saveSettings({ lightStart: lightStart.value });
        if (sel.value === 'auto-time') setThemeMode('auto-time');
      });
    }
  })();

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

  // News Hub AI Digest
  const aiDigestToggle = document.getElementById('news-ai-digest');
  if (aiDigestToggle) {
    aiDigestToggle.checked = settings.newsHub?.aiDigestEnabled || false;
    aiDigestToggle.addEventListener('change', () => {
      const current = loadSettings();
      const hub = { ...(current.newsHub || {}), aiDigestEnabled: aiDigestToggle.checked };
      saveSettings({ newsHub: hub });
      toast(aiDigestToggle.checked ? 'AI Daily Digest enabled' : 'AI Daily Digest disabled');
    });
  }

  // News Hub full settings panel wiring
  (function wireNewsHub() {
    const defaultCat = document.getElementById('news-default-category');
    const youtubeToggle = document.getElementById('news-youtube-enabled');
    const cacheHours = document.getElementById('news-cache-hours');
    const chipWrap = document.getElementById('news-digest-categories');
    const hub = settings.newsHub || {};

    if (defaultCat) {
      defaultCat.value = hub.defaultCategory || 'all';
      defaultCat.addEventListener('change', () => {
        const cur = loadSettings();
        const next = { ...(cur.newsHub || {}), defaultCategory: defaultCat.value };
        saveSettings({ newsHub: next });
      });
    }

    if (youtubeToggle) {
      youtubeToggle.checked = hub.youtubeEnabled !== false;
      youtubeToggle.addEventListener('change', () => {
        const cur = loadSettings();
        const next = { ...(cur.newsHub || {}), youtubeEnabled: youtubeToggle.checked };
        saveSettings({ newsHub: next });
        toast(youtubeToggle.checked ? 'YouTube suggestions enabled' : 'YouTube suggestions disabled');
      });
    }

    if (cacheHours) {
      cacheHours.value = String(hub.articleCacheHours ?? 24);
      cacheHours.addEventListener('change', () => {
        const cur = loadSettings();
        const next = { ...(cur.newsHub || {}), articleCacheHours: Number(cacheHours.value) || 24 };
        saveSettings({ newsHub: next });
      });
    }

    if (chipWrap) {
      const categories = ['world','politics','technology','business','sports','entertainment','science','health'];
      const selected = new Set(hub.digestCategories || ['world','politics','technology']);
      chipWrap.innerHTML = categories.map(c => {
        const active = selected.has(c);
        return `<button class="settings-chip ${active ? 'active' : ''}" data-cat="${c}" type="button">${c.charAt(0).toUpperCase() + c.slice(1)}</button>`;
      }).join('');
      chipWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('.settings-chip');
        if (!btn) return;
        const cur = loadSettings();
        const set = new Set(cur.newsHub?.digestCategories || ['world','politics','technology']);
        if (set.has(btn.dataset.cat)) set.delete(btn.dataset.cat); else set.add(btn.dataset.cat);
        btn.classList.toggle('active', set.has(btn.dataset.cat));
        const next = { ...(cur.newsHub || {}), digestCategories: Array.from(set) };
        saveSettings({ newsHub: next });
      });
    }
  })();

  // Notification settings
  const notificationSound = document.getElementById('notification-sound');
  const browserPush = document.getElementById('browser-push');
  const notifyCalendar = document.getElementById('notify-calendar');
  const notifyTodo = document.getElementById('notify-todo');
  const notifyAgent = document.getElementById('notify-agent');
  const notifySystem = document.getElementById('notify-system');
  const dndStart = document.getElementById('dnd-start');
  const dndEnd = document.getElementById('dnd-end');

  if (notificationSound) {
    notificationSound.checked = settings.notificationSound !== false;
    notificationSound.addEventListener('change', () => {
      saveSettings({ notificationSound: notificationSound.checked });
      toast(notificationSound.checked ? 'Notification sound enabled' : 'Notification sound muted');
    });
  }
  if (browserPush) {
    browserPush.checked = settings.browserPush === true;
    browserPush.addEventListener('change', () => {
      if (browserPush.checked && 'Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission().then(perm => {
          if (perm !== 'granted') {
            browserPush.checked = false;
            toast('Push permission denied', 'error');
            return;
          }
          saveSettings({ browserPush: true });
          toast('Browser push enabled');
        });
      } else {
        saveSettings({ browserPush: browserPush.checked });
        toast(browserPush.checked ? 'Browser push enabled' : 'Browser push disabled');
      }
    });
  }
  // Per-app toggles
  function setupAppToggle(el, key) {
    if (!el) return;
    const map = settings.notifyApps || {};
    el.checked = map[key] !== false;
    el.addEventListener('change', () => {
      const next = { ...(loadSettings().notifyApps || {}), [key]: el.checked };
      saveSettings({ notifyApps: next });
      toast(`${key.charAt(0).toUpperCase() + key.slice(1)} notifications ${el.checked ? 'enabled' : 'disabled'}`);
    });
  }
  setupAppToggle(notifyCalendar, 'calendar');
  setupAppToggle(notifyTodo, 'todo');
  setupAppToggle(notifyAgent, 'agent');
  setupAppToggle(notifySystem, 'system');
  // DND hours
  if (dndStart) {
    dndStart.value = settings.dndStart || '22:00';
    dndStart.addEventListener('change', () => saveSettings({ dndStart: dndStart.value }));
  }
  if (dndEnd) {
    dndEnd.value = settings.dndEnd || '07:00';
    dndEnd.addEventListener('change', () => saveSettings({ dndEnd: dndEnd.value }));
  }

  // AI Suggester settings
  (function wireAISuggester() {
    const enabledEl = document.getElementById('ai-suggester-enabled');
    const modelEl = document.getElementById('ai-suggester-model');
    const freqEl = document.getElementById('ai-suggester-frequency');
    const clearEl = document.getElementById('ai-suggester-clear');
    const cfg = settings.aiSuggester || {};

    if (enabledEl) {
      enabledEl.checked = cfg.enabled !== false;
      enabledEl.addEventListener('change', () => {
        const cur = loadSettings();
        const next = { ...(cur.aiSuggester || {}), enabled: enabledEl.checked };
        saveSettings({ aiSuggester: next });
        toast(enabledEl.checked ? 'AI Suggester enabled' : 'AI Suggester disabled');
      });
    }
    if (modelEl) {
      modelEl.value = cfg.model || 'llama3.2';
      modelEl.addEventListener('change', () => {
        const cur = loadSettings();
        const next = { ...(cur.aiSuggester || {}), model: modelEl.value };
        saveSettings({ aiSuggester: next });
      });
    }
    if (freqEl) {
      freqEl.value = cfg.frequency || 'manual';
      freqEl.addEventListener('change', () => {
        const cur = loadSettings();
        const next = { ...(cur.aiSuggester || {}), frequency: freqEl.value };
        saveSettings({ aiSuggester: next });
      });
    }
    if (clearEl) {
      clearEl.addEventListener('click', () => {
        localStorage.removeItem('ncc-ai-suggester-dismissed');
        toast('Dismissed suggestions cleared');
      });
    }
  })();

  // Feedback Pipeline settings
  (function wireFeedbackSettings() {
    const autoEl = document.getElementById('feedback-auto-generate');
    const notifyEl = document.getElementById('feedback-notify');
    const cfg = settings.feedbackPipeline || {};

    if (autoEl) {
      autoEl.checked = cfg.autoGenerate !== false;
      autoEl.addEventListener('change', () => {
        const cur = loadSettings();
        const next = { ...(cur.feedbackPipeline || {}), autoGenerate: autoEl.checked };
        saveSettings({ feedbackPipeline: next });
        toast(autoEl.checked ? 'Auto-generate from feedback enabled' : 'Auto-generate from feedback disabled');
      });
    }
    if (notifyEl) {
      notifyEl.checked = cfg.notifyProcessed !== false;
      notifyEl.addEventListener('change', () => {
        const cur = loadSettings();
        const next = { ...(cur.feedbackPipeline || {}), notifyProcessed: notifyEl.checked };
        saveSettings({ feedbackPipeline: next });
      });
    }
  })();

  // Per-app theme settings
  (function wirePerAppTheme() {
    const list = document.getElementById('per-app-theme-list');
    if (!list) return;
    const themeOpts = [
      { v: '', l: 'Global' },
      { v: 'professional', l: 'Professional' },
      { v: 'midnight-hacker', l: 'Midnight Hacker' },
      { v: 'sakura-garden', l: 'Sakura Garden' },
      { v: 'space-odyssey', l: 'Space Odyssey' },
      { v: 'retro-arcade', l: 'Retro Arcade' },
      { v: 'ocean-breeze', l: 'Ocean Breeze' },
      { v: 'jarvis', l: 'Jarvis' }
    ];
    const apps = APP_REGISTRY.filter(a => a.id !== 'dashboard');
    const perApp = settings.perAppThemes || {};
    list.innerHTML = '';
    apps.forEach(app => {
      const row = document.createElement('div');
      row.className = 'settings-row';
      row.style = 'justify-content:space-between;';
      const label = document.createElement('span');
      label.textContent = app.icon + ' ' + app.name;
      const sel = document.createElement('select');
      sel.dataset.app = app.id;
      themeOpts.forEach(o => {
        const op = document.createElement('option');
        op.value = o.v;
        op.textContent = o.l;
        if (perApp[app.id] === o.v || (!perApp[app.id] && !o.v)) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', () => {
        const cur = loadSettings();
        const next = { ...(cur.perAppThemes || {}) };
        if (sel.value) next[app.id] = sel.value;
        else delete next[app.id];
        saveSettings({ perAppThemes: next });
        toast(`${app.name} theme updated`);
      });
      row.appendChild(label);
      row.appendChild(sel);
      list.appendChild(row);
    });
  })();

  // Theme transition slider
  (function wireThemeTransition() {
    const slider = document.getElementById('theme-transition');
    const val = document.getElementById('theme-transition-val');
    if (!slider) return;
    const ms = settings.themeTransitionMs ?? 300;
    slider.value = ms;
    if (val) val.textContent = ms;
    slider.addEventListener('input', () => {
      const v = parseInt(slider.value, 10);
      if (val) val.textContent = v;
      document.documentElement.style.setProperty('--theme-transition-duration', `${v}ms`);
    });
    slider.addEventListener('change', () => {
      saveSettings({ themeTransitionMs: parseInt(slider.value, 10) });
      toast('Transition duration saved');
    });
    document.documentElement.style.setProperty('--theme-transition-duration', `${ms}ms`);
  })();

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
  const clientSecretEl = document.getElementById('sync-client-secret');
  const badge = document.getElementById('sync-status-badge');
  const connectBtn = document.getElementById('btn-sync-connect');
  const syncNowBtn = document.getElementById('btn-sync-now');
  const unlinkBtn = document.getElementById('btn-sync-unlink');
  const hint = document.getElementById('sync-hint');
  const reauthBtn = document.getElementById('btn-sync-reauth');

  const settings = loadSettings();
  const sync = settings.calendarSync || {};
  if (clientIdEl) clientIdEl.value = sync.clientId || '';
  if (clientSecretEl) clientSecretEl.value = sync.clientSecret || '';

  function persist() {
    const next = {
      clientId: clientIdEl?.value.trim() || '',
      clientSecret: clientSecretEl?.value.trim() || '',
      status: (loadSettings().calendarSync || {}).status || 'none'
    };
    saveSettings({ calendarSync: next });
    toggleConnect();
  }

  function toggleConnect() {
    const hasId = clientIdEl?.value.trim();
    const hasSecret = clientSecretEl?.value.trim();
    if (connectBtn) connectBtn.style.display = (hasId && hasSecret) ? 'inline-flex' : 'none';
  }

  function updateBadge(status, extra) {
    if (!badge) return;
    badge.className = 'sync-status-badge';
    const map = {
      none: { text: 'Not linked', cls: '' },
      linked: { text: 'Linked', cls: 'linked' },
      syncing: { text: 'Syncing…', cls: 'syncing' },
      synced: { text: extra ? `Synced (${extra})` : 'Synced', cls: 'synced' },
      error: { text: 'Error', cls: 'error' }
    };
    const m = map[status] || map.none;
    badge.textContent = m.text;
    if (m.cls) badge.classList.add(m.cls);
    const dot = document.getElementById('calendar-sync-dot');
    if (dot) {
      dot.className = 'calendar-sync-dot';
      if (m.cls) dot.classList.add(m.cls);
      dot.title = `Google Calendar: ${m.text}`;
    }
    if (unlinkBtn) unlinkBtn.style.display = (status !== 'none' && status !== 'error') ? 'inline-flex' : 'none';
    if (reauthBtn) reauthBtn.style.display = (status === 'linked' && extra === 'read-only') ? 'inline-flex' : 'none';
    if (hint) {
      if (status === 'linked') {
        hint.textContent = 'Connected with full read/write access via OAuth 2.0.';
        if (extra === 'read-only') hint.textContent = 'Scope is read-only. Re-authorize for full access.';
      } else if (status === 'synced') {
        hint.textContent = 'Connected with full read/write access via OAuth 2.0.';
      } else if (status === 'error') {
        hint.textContent = 'Connection failed. Check credentials or re-authorize.';
      } else {
        hint.textContent = 'Enter your Client ID and Client Secret, then click Connect.';
      }
    }
  }

  async function checkStatus() {
    try {
      const res = await fetch('/api/calendar/status');
      const data = await res.json();
      if (data.linked) {
        updateBadge(data.readOnly ? 'linked' : 'synced', data.readOnly ? 'read-only' : 'read/write');
        if (data.readOnly && hint) hint.textContent = 'Scope is read-only. Re-authorize for full access.';
      } else {
        updateBadge('none');
      }
    } catch {
      updateBadge('none');
    }
  }

  connectBtn?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/calendar/oauth/start');
      const data = await res.json();
      if (data.ok && data.url) {
        const popup = window.open(data.url, 'gcal_oauth', 'width=500,height=600');
        if (!popup) toast('Popup blocked — allow popups for this site', 'error');
      } else {
        toast(data.error || 'Failed to start OAuth', 'error');
      }
    } catch {
      toast('Server error — check GOOGLE_CLIENT_ID in ~/.hermes/.env', 'error');
    }
  });

  syncNowBtn?.addEventListener('click', async () => {
    updateBadge('syncing');
    try {
      const res = await fetch('/api/calendar/sync');
      const data = await res.json();
      if (data.ok) {
        updateBadge('synced', `${data.events?.length || 0} events`);
        // Merge into local calendar via gcal-sync engine
        document.dispatchEvent(new CustomEvent('calendarSyncChanged'));
        toast(`Calendar synced — ${data.events?.length || 0} events fetched`);
      } else {
        updateBadge('error');
        toast(data.error || 'Sync failed', 'error');
      }
    } catch {
      updateBadge('error');
      toast('Sync failed — server offline?', 'error');
    }
  });

  unlinkBtn?.addEventListener('click', async () => {
    if (!confirm('Unlink Google Calendar?')) return;
    try { await fetch('/api/calendar/unlink'); } catch {}
    if (clientIdEl) clientIdEl.value = '';
    if (clientSecretEl) clientSecretEl.value = '';
    const cfg2 = loadSettings().calendarSync || {};
    cfg2.clientId = '';
    cfg2.clientSecret = '';
    cfg2.status = 'none';
    saveSettings({ calendarSync: cfg2 });
    updateBadge('none');
    toast('Calendar unlinked');
    document.dispatchEvent(new CustomEvent('calendarSyncChanged'));
  });

  reauthBtn?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/calendar/oauth/start');
      const data = await res.json();
      if (data.ok && data.url) {
        const popup = window.open(data.url, 'gcal_oauth', 'width=500,height=600');
        if (!popup) toast('Popup blocked — allow popups for this site', 'error');
      } else {
        toast(data.error || 'Failed to start OAuth', 'error');
      }
    } catch {
      toast('Server error — check GOOGLE_CLIENT_ID in ~/.hermes/.env', 'error');
    }
  });

  clientIdEl?.addEventListener('input', persist);
  clientSecretEl?.addEventListener('input', persist);

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'nexus-gcal-connected') {
      checkStatus();
      toast('Google Calendar connected');
    }
  });

  checkStatus();
  toggleConnect();
}

/* ===== WELCOME ===== */
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

  // Header controls
  const closeBtn = document.getElementById('chat-widget-close');
  const header   = widget.querySelector('.chat-widget-header');

  /* ---- Toggle open/close ---- */
  toggle.addEventListener('click', () => {
    widget.classList.toggle('open');
  });

  /* ---- Close button ---- */
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      widget.classList.remove('open');
    });
  }

  /* ---- Drag-to-move ---- */
  let isDragging = false, startX, startY, origBottom, origRight;
  const onPointerDown = (e) => {
    // Let close/send/input buttons work
    if (e.target.closest('button, input, a, textarea')) return;
    isDragging = true;
    widget.classList.add('dragging');
    startX = e.clientX;
    startY = e.clientY;
    const style = window.getComputedStyle(widget);
    origBottom = parseFloat(style.bottom);
    origRight  = parseFloat(style.right);
    header.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!isDragging) return;
    const dx = startX - e.clientX;
    const dy = startY - e.clientY;
    widget.style.bottom = `${origBottom + dy}px`;
    widget.style.right  = `${origRight  + dx}px`;
  };
  const onPointerUp = () => {
    if (!isDragging) return;
    isDragging = false;
    widget.classList.remove('dragging');
  };

  if (header) {
    header.addEventListener('pointerdown', onPointerDown);
    header.addEventListener('pointermove', onPointerMove);
    header.addEventListener('pointerup',   onPointerUp);
    header.addEventListener('pointercancel', onPointerUp);
  }

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

  // Load persisted history (skip bot messages if bridge responses)
  const history = JSON.parse(localStorage.getItem('ncc-chat-history') || '[]');
  history.forEach(msg => {
    const target = msg.source === 'widget' ? wMessages : fpHistory;
    // Avoid double-rendering bot placeholder messages after bridge build
    if (msg.role === 'bot' && msg.text && msg.text.includes('(Hermes bridge not yet connected')) return;
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

async function hermesSend(text) {
  try {
    const res = await fetch('/api/hermes/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.ok && data.chat_id) {
      // Remember numeric chat id so our own polls match
      const set = new Set(JSON.parse(localStorage.getItem('ncc-hermes-chat-ids') || '[]'));
      set.add(String(data.chat_id));
      localStorage.setItem('ncc-hermes-chat-ids', JSON.stringify(Array.from(set)));
    }
    return { ok: data.ok, message_id: data.message_id, error: data.error };
  } catch (e) {
    return { ok: false, error: 'network' };
  }
}

let _pollTimer = null;
let _pollFailCount = 0;

function getSeenIds() {
  try { return new Set(JSON.parse(localStorage.getItem('ncc-hermes-seen') || '[]')); }
  catch { return new Set(); }
}
function addSeenId(id) {
  if (!id) return;
  const s = getSeenIds();
  s.add(String(id));
  localStorage.setItem('ncc-hermes-seen', JSON.stringify(Array.from(s).slice(-500)));
}

function updateBridgeBanner(status, message) {
  const banners = [
    document.getElementById('chat-bridge-banner'),
    document.querySelector('.chat-widget-window .chat-widget-header')
  ];
  banners.forEach((target) => {
    if (!target) return;
    const existing = target.querySelector('.bridge-banner-alert');
    if (status === 'ok') {
      if (existing) existing.remove();
      return;
    }
    if (existing) { existing.textContent = message; return; }
    const div = document.createElement('div');
    div.className = 'bridge-banner-alert';
    div.textContent = message;
    div.style.cssText = 'background:rgba(196,68,68,.15);color:#c44;font-size:.8rem;padding:4px 8px;border-radius:6px;margin:6px 0;text-align:center;';
    target.appendChild(div);
  });
}

function startHermesPolling(container) {
  stopHermesPolling();
  _pollFailCount = 0;

  const warnSlow = () => {
    const msg = container.querySelector('.chat-msg-bot:last-child');
    if (msg && msg.textContent.includes('Waiting for a reply')) {
      msg.textContent = '⏳ Hermes may be busy, check Telegram if this persists';
    }
  };

  // Cancel any previous warnSlow timeout before creating a new one
  if (window._hermesWarnTimer) clearTimeout(window._hermesWarnTimer);
  window._hermesWarnTimer = setTimeout(warnSlow, 12000);

  _pollTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/hermes/poll');
      const data = await res.json();
      if (!res.ok || !data.ok) {
        _pollFailCount++;
        if (_pollFailCount >= 3) {
          updateBridgeBanner('error', data.error ? '⚠️ Bridge error: ' + data.error : '⚠️ Bridge offline');
        }
        return;
      }
      _pollFailCount = 0;
      updateBridgeBanner('ok');
      if (!Array.isArray(data.messages)) return;

      if (data.messages.length) {
        // We got real replies; cancel the slow-warning timeout early
        if (window._hermesWarnTimer) {
          clearTimeout(window._hermesWarnTimer);
          window._hermesWarnTimer = null;
        }
      }

      for (const m of data.messages) {
        const key = String(m.message_id || m.time);
        if (getSeenIds().has(key)) continue;
        addSeenId(key);
        // Remove placeholder waiting messages when a real reply arrives
        const waiting = container.querySelector('.chat-msg-bot:last-child');
        if (waiting && waiting.textContent.includes('Waiting for a reply')) {
          waiting.remove();
        }
        addMessage(container, m.text, 'bot');
      }
    } catch (e) {
      _pollFailCount++;
      if (_pollFailCount >= 3) {
        updateBridgeBanner('error', '⚠️ Bridge offline - check connection');
      }
    }
  }, 2000);
}

function stopHermesPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

function handleCommand(text, container) {
  const lower = text.toLowerCase().trim();
  if (lower === '/new') {
    localStorage.removeItem('ncc-chat-history');
    localStorage.removeItem('ncc-hermes-seen');
    localStorage.removeItem('ncc-hermes-chat-ids');
    container.innerHTML = '';
    stopHermesPolling();
    setTimeout(() => {
      addMessage(container, 'Fresh start. What can I do for you?', 'bot');
    }, 300);
    return;
  }
  if (lower === '/help') {
    addMessage(container, 'Commands:\n/new — start fresh conversation\n/help — show this message', 'bot');
    return;
  }

  // Quick attachment commands (T-049)
  const attachNoteMatch = lower.match(/^attach\s+(?:the\s+)?(.+?)\s+to\s+(?:my\s+)?(.+?)(?:\s+note)?$/);
  if (attachNoteMatch) {
    const [_full, fileNameHint, noteTitleHint] = attachNoteMatch;
    addMessage(container, `Searching note "${noteTitleHint}"...`, 'bot');
    const matches = noteFindByTitle(noteTitleHint);
    if (!matches.length) { addMessage(container, 'No matching note found.', 'bot'); return; }
    addMessage(container, `Found "${matches[0].title}". Drag the file onto the note editor or use the 📎 Attach button.`, 'bot');
    location.hash = 'notes';
    return;
  }
  const showAttMatch = lower.match(/^show\s+attachments\s+for\s+(?:event\s+)?(.+)$/);
  if (showAttMatch) {
    const q = showAttMatch[1];
    const events = calendarFindByTitle(q);
    if (!events.length) { addMessage(container, 'No matching event found.', 'bot'); return; }
    const atts = calendarShowAttachments(events[0].id);
    addMessage(container, `Event "${events[0].title}" has ${atts.length} attachment${atts.length !== 1 ? 's' : ''}.`, 'bot');
    location.hash = 'calendar';
    return;
  }

  const thinkingId = 'thinking-' + Date.now();
  const thinkingDiv = document.createElement('div');
  thinkingDiv.id = thinkingId;
  thinkingDiv.className = 'chat-msg chat-msg-bot chat-msg-thinking';
  thinkingDiv.textContent = 'Hermes is thinking…';
  container.appendChild(thinkingDiv);
  container.scrollTop = container.scrollHeight;

  hermesSend(text).then(result => {
    const t = document.getElementById(thinkingId);
    if (t) t.remove();
    if (!result.ok) {
      addMessage(container, "Couldn't reach Hermes. Bridge may be offline.", 'bot');
      updateBridgeBanner('error', result.error === 'network' ? '⚠️ Bridge offline' : '⚠️ Bridge error');
      // Add resend button next to the last user message
      const lastUserMsg = container.querySelector('.chat-msg-user:last-child');
      if (lastUserMsg && !lastUserMsg.querySelector('.chat-msg-resend')) {
        const btn = document.createElement('button');
        btn.className = 'chat-msg-resend';
        btn.textContent = '↻ Resend';
        btn.addEventListener('click', () => {
          btn.remove();
          handleCommand(text, container);
        });
        lastUserMsg.appendChild(btn);
      }
      return;
    }
    if (result.message_id) addSeenId(result.message_id);
    addMessage(container, 'Sent to Hermes. Waiting for a reply…', 'bot');
    startHermesPolling(container);
  });
}

/* ===== UTILITIES ===== */
export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('ncc-settings') || '{}');
  } catch {
    return {};
  }
}

/** Merge server settings over local cache when available (server wins on conflict). */
async function loadSettingsSync() {
  if (typeof storage !== 'undefined' && storage?.read) {
    try {
      const server = await storage.read('settings');
      if (server && Object.keys(server).length) {
        localStorage.setItem('ncc-settings', JSON.stringify(server));
        return server;
      }
    } catch { /* fallthrough */ }
  }
  return loadSettings();
}

export function saveSettings(patch) {
  const current = loadSettings();
  const next = { ...current, ...patch };
  localStorage.setItem('ncc-settings', JSON.stringify(next));
  // Background sync to server (fire-and-forget; keep localStorage as fast cache)
  if (typeof storage !== 'undefined' && storage?.write) {
    storage.write('settings', next).catch(() => {});
  }
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

  // Load existing from server
  (async () => {
    await renderFeedbackList();
    await updateFeedbackBadge();
  })();

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

  finalSubmit.addEventListener('click', async () => {
    const qs = questionSets[draft.type] || questionSets.other;
    const entry = {
      type: draft.type,
      title: draft.title,
      description: draft.desc,
      priority: draft.priority,
      answers: qs.map((q, i) => ({ question: q.text, answer: answers[i] || '' })),
      userId: localStorage.getItem('ncc-user-id')
    };
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast(data.error || 'Failed to submit feedback', 'error');
        return;
      }
      toast('Feedback submitted to agent board');
    } catch (err) {
      toast('Network error — feedback not sent', 'error');
      return;
    }

    // Reset UI
    form.reset();
    form.style.display = 'block';
    questionsBox.style.display = 'none';
    previewBox.style.display = 'none';
    draft = null;

    await renderFeedbackList();
    updateFeedbackBadge();
  });

  editBtn.addEventListener('click', () => {
    previewBox.style.display = 'none';
    questionsBox.style.display = 'flex';
    currentQIndex = 0;
    renderQuestion();
  });

  async function renderFeedbackList() {
    if (!list) return;
    let items = [];
    try {
      const res = await fetch('/api/feedback/list');
      if (res.ok) {
        const data = await res.json();
        items = data.items || [];
      }
    } catch {
      // fallback silent
    }
    if (items.length === 0) {
      list.innerHTML = '<div class="feedback-empty">No submissions yet. Shape the Nexus above. 💡</div>';
      return;
    }
    list.innerHTML = items.map((item, idx) => {
      const status = item.status || 'pending';
      const chipClass = 'chip-' + status;
      const typeIcon = { bug: '🐛', feature: '✨', improvement: '🔧', theme: '🎨', other: '💬' }[item.type] || '💬';
      return `
      <div class="feedback-item" data-id="${escapeHtml(item.id)}" data-idx="${idx}">
        <div class="feedback-item-header">
          <span class="feedback-item-title">${escapeHtml(item.title)}</span>
          <span class="feedback-item-type ${escapeHtml(item.type)}">${typeIcon} ${item.type}</span>
        </div>
        <div class="feedback-item-desc">${escapeHtml(item.description || item.desc || '')}</div>
        <div class="feedback-item-meta">
          <span>${fmtDate(item.timestamp || item.createdAt)}</span>
          <span class="feedback-tracker-status ${chipClass}">${status}</span>
        </div>
        <div class="feedback-tracker-detail" id="fb-detail-${idx}">
          <div class="feedback-tracker-detail-inner">
            ${(item.answers || []).length ? item.answers.map((a, i) => `
              <div class="feedback-tracker-answer">
                <b>Q${i + 1}:</b> ${escapeHtml(a.question)}
                <div class="feedback-tracker-answer-text">${escapeHtml(a.answer || '(no answer)')}</div>
              </div>
            `).join('') : '<div class="feedback-tracker-empty-detail">No answers recorded.</div>'}
          </div>
        </div>
      </div>`;
    }).join('');

    // wire expand
    list.querySelectorAll('.feedback-item').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const idx = row.dataset.idx;
        const detail = document.getElementById('fb-detail-' + idx);
        if (detail) detail.style.display = detail.style.display === 'block' ? 'none' : 'block';
      });
    });
  }

  async function updateFeedbackBadge() {
    const badge = document.getElementById('feedback-badge');
    if (!badge) return;
    let count = 0;
    try {
      const res = await fetch('/api/feedback/list');
      if (res.ok) {
        const data = await res.json();
        count = (data.items || []).filter(it => (it.status === 'pending' || it.status === 'review')).length;
      }
    } catch {
      // silent
    }
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
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

  // Pause / resume banner
  const pauseBanner = document.getElementById('agent-pause-banner');
  const resumeBtn = document.getElementById('btn-agent-resume');
  if (pauseBanner) {
    const paused = localStorage.getItem('ncc-agent-paused') === 'true';
    pauseBanner.style.display = paused ? 'block' : 'none';
  }
  if (resumeBtn) {
    resumeBtn.addEventListener('click', async () => {
      localStorage.removeItem('ncc-agent-paused');
      try {
        await fetch('/api/agent/pause', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paused: false }) });
      } catch (e) {}
      if (pauseBanner) pauseBanner.style.display = 'none';
      const indicator = document.getElementById('agent-indicator');
      if (indicator) {
        indicator.style.background = '#22c55e';
        indicator.title = 'Build agent active';
      }
      toast('Agent resumed');
    });
  }
}

function setStat(id, n) {
  const el = document.getElementById(id);
  if (el) el.textContent = n;
}

/* ===== AGENT NOTIFICATION POLL ===== */
function initAgentNotificationPoll() {
  const INTERVAL = 30000; // 30s
  let lastId = null;

  async function poll() {
    try {
      const res = await fetch('/api/agent/notifications');
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.notifications || []);
      if (!list.length) return;
      // Find new items since last poll
      let startIdx = 0;
      if (lastId) {
        const idx = list.findIndex(n => n.id === lastId);
        if (idx !== -1) startIdx = idx + 1;
      }
      for (let i = startIdx; i < list.length; i++) {
        const n = list[i];
        if (typeof notify === 'function') {
          notify({ title: n.title || 'Agent Update', body: n.message || '', app: 'agent', priority: n.type === 'error' ? 'high' : 'normal' });
        }
      }
      lastId = list[list.length - 1]?.id || lastId;
    } catch {
      // network hiccup — ignore
    }
  }

  poll();
  const timer = setInterval(poll, INTERVAL);
  window.addEventListener('beforeunload', () => clearInterval(timer));
}

async function fetchWhiteboard() {
  // Try loading WHITEBOARD.md from the server (same origin)
  try {
    const r = await fetch('WHITEBOARD.md');
    if (!r.ok) throw new Error('Not found');
    const text = await r.text();
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
  } catch {
    toast('Could not load WHITEBOARD.md — check server / repo', 'error');
  }
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
      if (online && !window.__nexusOffline) {
        indicator.style.display = 'none';
        indicator.textContent = '';
        indicator.className = 'offline-indicator';
      } else {
        indicator.style.display = 'inline-flex';
        indicator.textContent = window.__nexusOffline ? 'Offline — syncing when back' : 'Offline';
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

/* ===== QUALITY PANEL (Settings) ===== */
function initQualityPanel() {
  const badgeEl = document.getElementById('quality-badge');
  const countsEl = document.getElementById('quality-counts');
  const lastEl = document.getElementById('quality-last');
  const recentEl = document.getElementById('quality-recent-list');
  if (!badgeEl || !countsEl) return;

  async function refresh() {
    try {
      const res = await fetch('/api/quality/queue');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      if (!data.ok) throw new Error('not ok');
      render(data);
    } catch {
      badgeEl.textContent = 'Unavailable';
      badgeEl.className = 'quality-badge quality-warn';
    }
  }

  function render(data) {
    const counts = data.counts || {};
    const total = data.total || 0;
    const lastAudit = data.lastAudit;

    // Determine overall badge
    const fail = (counts['QC-FAILED'] || 0) + (counts['QA-FAILED'] || 0);
    if (fail > 0) {
      badgeEl.textContent = `${fail} Failed`;
      badgeEl.className = 'quality-badge quality-fail';
    } else if ((counts['QC-PENDING'] || 0) + (counts['QA-PENDING'] || 0) > 0) {
      badgeEl.textContent = 'In Progress';
      badgeEl.className = 'quality-badge quality-warn';
    } else {
      badgeEl.textContent = 'Healthy';
      badgeEl.className = 'quality-badge quality-pass';
    }

    // Count grid
    const labels = {
      'QC-PENDING': 'QC Pending',
      'QC-PASSED': 'QC Passed',
      'QC-FAILED': 'QC Failed',
      'QA-PENDING': 'QA Pending',
      'QA-PASSED': 'QA Passed',
      'QA-FAILED': 'QA Failed',
      'BACKLOG-PENDING': 'Backlog'
    };
    countsEl.innerHTML = Object.entries(labels).map(([key, label]) => {
      const n = counts[key] || 0;
      return `<div class="quality-count"><span class="qc-n">${n}</span><span class="qc-label">${escapeHtml(label)}</span></div>`;
    }).join('');

    // Last audit
    if (lastEl) {
      lastEl.textContent = lastAudit ? `Last audit: ${new Date(lastAudit).toLocaleString()}` : 'No audits yet';
    }

    // Recent list
    if (recentEl) {
      const recent = (data.recent || []).slice(0, 5);
      if (recent.length) {
        recentEl.innerHTML = recent.map(item => {
          const status = item.status || 'UNKNOWN';
          const statusClass = status.toLowerCase().replace(/ /g, '-');
          const files = (item.files || []).map(f => f.split('/').pop()).join(', ');
          return `<li><span>${escapeHtml(files || item.id || '—')}</span><span class="q-status ${statusClass}">${escapeHtml(status)}</span></li>`;
        }).join('');
      } else {
        recentEl.innerHTML = '<li>No recent items</li>';
      }
    }
  }

  refresh();
  // Refresh every 60s while settings is visible
  const timer = setInterval(refresh, 60000);
  window.addEventListener('beforeunload', () => clearInterval(timer));
}


/* ===== GLOBAL SEARCH ===== */
const SEARCH_REGISTRY = [
  { id: 'calendar', name: 'Calendar', icon: '📅', getter: () => (window.__calendarEvents || []) },
  { id: 'notes',    name: 'Notes',    icon: '📝', getter: () => (window.__notes || []) },
  { id: 'todo',     name: 'To-Do',    icon: '✅', getter: () => (window.__todos || []) },
  { id: 'app',      name: 'Apps',     icon: '◈', getter: () => APP_REGISTRY.map(a => ({ id: a.id, title: a.name, body: '', app: 'app', path: a.path })) }
];

function _lsParse(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function _normalize(arr, source) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    const title = item.title || item.summary || item.name || item.text || '';
    const body  = item.body || item.description || item.content || item.notes || '';
    const id    = item.id || item._id || String(Math.random()).slice(2,8);
    const ts    = item.updatedAt || item.createdAt || item.date || item.start || item.ts || '';
    return { source, id, title: String(title), body: String(body), ts };
  });
}

let __searchIndex = [];
let __searchTimer = null;
let __searchActive = false;
let __searchSelected = -1;

function buildSearchIndex() {
  const idx = [];
  for (const s of SEARCH_REGISTRY) {
    let data = s.getter();
    if (!data || !data.length) {
      if (s.id === 'calendar') data = _lsParse('ncc-calendar-events');
      if (s.id === 'notes')    data = _lsParse('ncc-notes');
      if (s.id === 'todo')     data = _lsParse('ncc-todo');
    }
    idx.push(..._normalize(data, s));
  }
  __searchIndex = idx;
}

function initSearch() {
  const overlay = document.getElementById('search-overlay');
  const input   = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const backdrop = document.getElementById('search-overlay-backdrop');
  if (!overlay || !input || !results) return;

  document.getElementById('header-search-btn')?.addEventListener('click', openSearch);

  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && __searchActive) closeSearch();
  });

  backdrop?.addEventListener('click', closeSearch);

  input.addEventListener('input', () => {
    clearTimeout(__searchTimer);
    __searchTimer = setTimeout(() => runSearch(input.value.trim()), 150);
  });

  input.addEventListener('keydown', e => {
    const rows = results.querySelectorAll('.search-result');
    if (e.key === 'ArrowDown') { e.preventDefault(); __searchSelected = Math.min(__searchSelected + 1, rows.length - 1); updateSelection(rows); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); __searchSelected = Math.max(__searchSelected - 1, 0); updateSelection(rows); }
    else if (e.key === 'Enter') { e.preventDefault(); const sel = rows[__searchSelected]; if (sel) activateResult(sel); }
  });

  results.addEventListener('click', e => {
    const row = e.target.closest('.search-result');
    if (row) activateResult(row);
  });

  if ('requestIdleCallback' in window) requestIdleCallback(buildSearchIndex, { timeout: 2000 });
  else setTimeout(buildSearchIndex, 500);
}

function openSearch() {
  const overlay = document.getElementById('search-overlay');
  const input   = document.getElementById('search-input');
  if (!overlay) return;
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  __searchActive = true;
  __searchSelected = -1;
  setTimeout(() => input?.focus(), 50);
  buildSearchIndex();
}

function closeSearch() {
  const overlay = document.getElementById('search-overlay');
  const input   = document.getElementById('search-input');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  __searchActive = false;
  __searchSelected = -1;
  if (input) input.value = '';
  const results = document.getElementById('search-results');
  if (results) results.innerHTML = '<div class="search-empty" id="search-empty">Type to search across notes, todos, calendar, and apps…</div>';
}

function _score(q, text) {
  const t = text.toLowerCase();
  const queries = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const word of queries) {
    if (t === word) score += 5;
    else if (t.startsWith(word)) score += 3;
    else if (t.includes(word)) score += 1;
  }
  return score;
}
function _highlight(q, text) {
  const queries = q.toLowerCase().split(/\s+/).filter(Boolean).filter(w => w.length > 0);
  let out = escapeHtml(text);
  for (const word of queries) {
    try {
      const re = new RegExp('(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    } catch { /* ignore bad regex */ }
  }
  return out;
}

function runSearch(q) {
  const resultsEl = document.getElementById('search-results');
  if (!resultsEl) return;
  if (!q) {
    resultsEl.innerHTML = '<div class="search-empty">Type to search across notes, todos, calendar, and apps…</div>';
    __searchSelected = -1;
    return;
  }
  const scored = __searchIndex.map(item => {
    const sTitle = _score(q, item.title);
    const sBody  = _score(q, item.body);
    return { item, score: sTitle + sBody * 0.5 };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 40);

  if (!scored.length) {
    resultsEl.innerHTML = `<div class="search-empty">No results for "${escapeHtml(q)}"</div>`;
    __searchSelected = -1;
    return;
  }
  const grouped = {};
  for (const { item } of scored) {
    const g = item.source?.name || item.source || 'Other';
    (grouped[g] ||= []).push(item);
  }
  const icons = { Calendar:'📅', Notes:'📝', 'To-Do':'✅', Apps:'◈', Other:'◈' };
  const frag = document.createElement('div');
  for (const [group, items] of Object.entries(grouped).slice(0, 4)) {
    const label = document.createElement('div');
    label.className = 'search-group-label';
    label.textContent = group;
    frag.appendChild(label);
    for (const item of items.slice(0, 6)) {
      const row = document.createElement('div');
      row.className = 'search-result';
      row.setAttribute('role', 'option');
      row.setAttribute('tabindex', '-1');
      row.dataset.view = item.source?.id || (item.path ? item.id : group.toLowerCase());
      row.dataset.id = typeof item.id !== 'undefined' ? item.id : '';
      const icon = icons[group] || '◈';
      const snippet = item.body ? item.body.slice(0, 90) : '';
      row.innerHTML = `
        <span class="search-result-icon">${icon}</span>
        <div class="search-result-meta">
          <div class="search-result-title">${_highlight(q, item.title || '(Untitled)')}</div>
          ${snippet ? `<div class="search-result-snippet">${_highlight(q, snippet)}</div>` : ''}
        </div>
        ${item.ts ? `<span class="search-result-chip">${new Date(item.ts).toLocaleDateString()}</span>` : ''}
      `;
      frag.appendChild(row);
    }
  }
  resultsEl.innerHTML = '';
  resultsEl.appendChild(frag);
  __searchSelected = 0;
  updateSelection(resultsEl.querySelectorAll('.search-result'));
}

function updateSelection(rows) {
  rows.forEach((r, i) => r.setAttribute('aria-selected', i === __searchSelected ? 'true' : 'false'));
  const sel = rows[__searchSelected];
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function activateResult(row) {
  const view = row.dataset.view;
  const id   = row.dataset.id;
  closeSearch();
  if (view) location.hash = view;
  if (id) {
    setTimeout(() => {
      const el = document.querySelector(`[data-id="${CSS.escape(String(id))}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList?.add('highlight-pulse');
      setTimeout(() => el?.classList?.remove('highlight-pulse'), 1500);
    }, 120);
  }
}

/* ===== EXPORTS ===== */
function initWidgetGrid() {
  const container = document.getElementById('widget-grid');
  if (!container) return;
  const wg = new WidgetGrid(container, null);
  // Register real widget factories (thin wrappers around app stores)
  registerWidgetFactories(wg);
  // Expose global for debug
  window.__widgetGrid = wg;
}
window.APP_REGISTRY = APP_REGISTRY;
window.toast = toast;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.initApp = initApp;
window.openSearch = openSearch;
window.closeSearch = closeSearch;

/* ===== APP LAUNCHER CUSTOMIZATION ===== */
function initAppLauncher() {
  const listEl = document.getElementById('app-launcher-list');
  const countEl = document.getElementById('app-launcher-count');
  const showAllBtn = document.getElementById('app-launcher-show-all');
  const resetBtn = document.getElementById('app-launcher-reset-order');
  if (!listEl) return;

  const VIS_KEY = 'ncc-app-visibility';
  const ORDER_KEY = 'ncc-app-order';

  function loadVisibility() {
    try { return JSON.parse(localStorage.getItem(VIS_KEY) || '{}'); } catch { return {}; }
  }
  function saveVisibility(map) { localStorage.setItem(VIS_KEY, JSON.stringify(map)); }
  function loadOrder() {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* fallthrough */ }
    return APP_REGISTRY.map(a => a.id);
  }
  function saveOrder(arr) { localStorage.setItem(ORDER_KEY, JSON.stringify(arr)); }

  function getOrderedRegistry() {
    const order = loadOrder();
    const vis = loadVisibility();
    const map = new Map(APP_REGISTRY.map(a => [a.id, a]));
    const ordered = [];
    for (const id of order) {
      const app = map.get(id);
      if (app) ordered.push(app);
    }
    for (const app of APP_REGISTRY) {
      if (!ordered.includes(app)) ordered.push(app);
    }
    return { ordered, vis };
  }

  function renderList() {
    const { ordered, vis } = getOrderedRegistry();
    const hiddenCount = ordered.filter(a => vis[a.id] === false).length;
    if (countEl) {
      const visible = ordered.length - hiddenCount;
      countEl.textContent = `${visible} visible, ${hiddenCount} hidden`;
    }
    listEl.innerHTML = '';
    ordered.forEach((app, idx) => {
      const row = document.createElement('div');
      row.className = 'app-launcher-item';
      row.draggable = true;
      row.dataset.app = app.id;
      row.dataset.index = String(idx);
      const isVisible = vis[app.id] !== false;
      row.innerHTML = `
        <span class="launcher-drag-handle" aria-label="Drag to reorder" title="Drag to reorder">⋮⋮</span>
        <div class="launcher-icon" style="--card-accent: ${getAppAccent(app.id)};">${app.icon}</div>
        <span class="launcher-name">${escapeHtml(app.name)}</span>
        <input type="checkbox" class="launcher-toggle" ${isVisible ? 'checked' : ''} aria-label="Show ${escapeHtml(app.name)}">
      `;
      const toggle = row.querySelector('.launcher-toggle');
      toggle.addEventListener('change', () => {
        const nextVis = loadVisibility();
        nextVis[app.id] = toggle.checked;
        saveVisibility(nextVis);
        renderLauncherGrid();
        renderList();
      });
      addDragHandlers(row);
      listEl.appendChild(row);
    });
  }

  function getAppAccent(id) {
    const card = document.querySelector(`.app-card[data-app="${CSS.escape(id)}"] .app-card-icon`);
    if (card) {
      const s = getComputedStyle(card);
      return s.getPropertyValue('--card-accent') || 'var(--accent)';
    }
    return 'var(--accent)';
  }

  let dragSrc = null;
  function addDragHandlers(row) {
    row.addEventListener('dragstart', e => {
      dragSrc = row;
      row.classList.add('dragging');
      e.dataTransfer.setData('text/plain', row.dataset.app);
      e.dataTransfer.effectAllowed = 'move';
      if ('vibrate' in navigator) navigator.vibrate(10);
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      document.querySelectorAll('.app-launcher-item').forEach(r => r.classList.remove('drag-over'));
      dragSrc = null;
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (row !== dragSrc) row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (!dragSrc || dragSrc === row) return;
      const items = Array.from(listEl.children);
      const fromIndex = items.indexOf(dragSrc);
      const toIndex = items.indexOf(row);
      if (fromIndex < 0 || toIndex < 0) return;
      const order = loadOrder();
      const moved = order.splice(fromIndex, 1)[0];
      order.splice(toIndex, 0, moved);
      saveOrder(order);
      renderList();
      renderLauncherGrid();
    });
    // Long-press for mobile drag
    let pressTimer = null;
    row.addEventListener('touchstart', e => {
      pressTimer = setTimeout(() => {
        if ('vibrate' in navigator) navigator.vibrate(20);
        row.draggable = true;
        // Trigger dragstart manually on mobile is tricky; user can then long-press and move
      }, 500);
    }, { passive: true });
    row.addEventListener('touchend', () => clearTimeout(pressTimer));
    row.addEventListener('touchmove', () => clearTimeout(pressTimer));
  }

  function renderLauncherGrid() {
    const grid = document.getElementById('app-grid');
    if (!grid) return;
    const { ordered, vis } = getOrderedRegistry();
    const visibleApps = ordered.filter(a => vis[a.id] !== false);
    // If all hidden, show empty state
    if (visibleApps.length === 0) {
      if (!grid.querySelector('.app-grid-empty')) {
        grid.innerHTML = `
          <div class="app-grid-empty">
            <div class="empty-icon">🙈</div>
            <h3>All apps hidden</h3>
            <p>All apps are hidden. <a onclick="location.hash='settings'">Tap the settings gear</a> to show some.</p>
          </div>
        `;
      }
      return;
    }
    // Reorder existing cards to match order, hide/show
    const cards = Array.from(grid.querySelectorAll('.app-card'));
    const cardMap = new Map(cards.map(c => [c.dataset.app, c]));
    // Remove empty state if present
    const empty = grid.querySelector('.app-grid-empty');
    if (empty) empty.remove();
    // Append in order
    for (const app of ordered) {
      const card = cardMap.get(app.id);
      if (!card) continue;
      if (vis[app.id] === false) {
        card.style.display = 'none';
      } else {
        card.style.display = '';
        grid.appendChild(card);
      }
    }
    syncNavDrawer(ordered, vis);
  }

  function syncNavDrawer(ordered, vis) {
    const drawer = document.getElementById('nav-drawer');
    if (!drawer) return;
    const body = drawer.querySelector('.nav-drawer-body');
    if (!body) return;
    const links = Array.from(body.querySelectorAll('.nav-link[data-app]'));
    const linkMap = new Map(links.map(l => [l.dataset.app, l]));
    // Hide/show links according to visibility (keep dividers, dashboard, settings untouched)
    for (const app of ordered) {
      const link = linkMap.get(app.id);
      if (!link) continue;
      if (vis[app.id] === false) {
        link.style.display = 'none';
      } else {
        link.style.display = '';
        body.appendChild(link);
      }
    }
    // Ensure dividers stay visible and settings stays at bottom
    const settingsLink = body.querySelector('.nav-settings-link');
    if (settingsLink) body.appendChild(settingsLink);
  }

  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      const next = {};
      for (const a of APP_REGISTRY) next[a.id] = true;
      saveVisibility(next);
      renderList();
      renderLauncherGrid();
      toast('All apps shown');
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(ORDER_KEY);
      renderList();
      renderLauncherGrid();
      toast('App order reset to default');
    });
  }

  renderList();
  renderLauncherGrid();
}
