/**
 * T-046-a: Auto Dark Mode — System Preference + Time-based Switcher
 * Enables smooth theme switching based on system preference and time.
 */

const THEME_MODE_KEY = 'ncc-theme-mode';
const THEME_KEY = 'ncc-settings';

let manualOverride = false;
let systemListener = null;
let timeCheckInterval = null;

export function initThemeAutoSwitch() {
  const mode = getThemeMode();
  if (mode === 'auto-system') {
    applySystemPreference();
    startSystemListener();
    stopTimeCheck();
  } else if (mode === 'auto-time') {
    applyTimeBased();
    startTimeCheck();
    stopSystemListener();
  } else {
    // manual — do nothing, respect existing body attribute
    stopSystemListener();
    stopTimeCheck();
  }
  updateHeaderIcon();
}

function getSettings() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // ncc-settings stores themeMode directly at top level
      return parsed;
    }
  } catch {}
  return {};
}

function getThemeMode() {
  const saved = localStorage.getItem(THEME_MODE_KEY);
  const settings = getSettings();
  // Migrate old settings: if no ncc-theme-mode key exists but settings has a themeMode,
  // treat saved one as manual if it was 'dark' or 'light'
  if (saved) return saved;
  // backward compat: ncc-settings used to store themeMode
  if (settings.themeMode === 'dark' || settings.themeMode === 'light') {
    return 'manual';
  }
  return 'manual';
}

export function setThemeMode(mode) {
  if (!['auto-system','auto-time','manual'].includes(mode)) return;
  localStorage.setItem(THEME_MODE_KEY, mode);
  initThemeAutoSwitch();
  window.dispatchEvent(new CustomEvent('themeModeChange', { detail: { mode } }));
}

function applySystemPreference() {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  setBodyMode(mql.matches ? 'dark' : 'light');
}

function startSystemListener() {
  stopSystemListener();
  systemListener = (e) => {
    setBodyMode(e.matches ? 'dark' : 'light');
    updateHeaderIcon();
  };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', systemListener);
}

function stopSystemListener() {
  if (systemListener) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemListener);
    } catch {}
    systemListener = null;
  }
}

function applyTimeBased() {
  const settings = getSettings();
  const darkStart = settings.darkStart ?? '20:00';
  const lightStart = settings.lightStart ?? '07:00';
  const now = new Date();
  const darkTime = parseTime(darkStart);
  const lightTime = parseTime(lightStart);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let isDark;
  if (darkTime > lightTime) {
    isDark = currentMinutes >= darkTime || currentMinutes < lightTime;
  } else {
    isDark = currentMinutes >= darkTime && currentMinutes < lightTime;
  }
  setBodyMode(isDark ? 'dark' : 'light');
  updateHeaderIcon();
}

function startTimeCheck() {
  stopTimeCheck();
  timeCheckInterval = setInterval(() => {
    applyTimeBased();
  }, 60_000);
}

function stopTimeCheck() {
  if (timeCheckInterval) {
    clearInterval(timeCheckInterval);
    timeCheckInterval = null;
  }
}

function parseTime(str) {
  const [h, m] = str.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function setBodyMode(mode) {
  document.body.setAttribute('data-theme-mode', mode);
  // mirror into settings so base framework sees it
  const settings = getSettings();
  settings.themeMode = mode;
  localStorage.setItem(THEME_KEY, JSON.stringify(settings));
  updateHeaderIcon();
}

/* ===== HEADER ICON ===== */
function updateHeaderIcon() {
  let icon = document.getElementById('theme-mode-indicator');
  if (!icon) {
    const hr = document.querySelector('.header-right');
    if (!hr) return;
    icon = document.createElement('span');
    icon.id = 'theme-mode-indicator';
    icon.className = 'theme-mode-indicator';
    icon.setAttribute('aria-hidden', 'true');
    icon.style.cssText = 'margin-right:8px;font-size:16px;line-height:1;cursor:pointer;user-select:none;';
    icon.title = 'Theme mode indicator';
    icon.addEventListener('click', () => {
      const btn = document.getElementById('header-settings-btn');
      if (btn) btn.click();
    });
    hr.insertBefore(icon, hr.firstChild);
  }
  const mode = document.body.getAttribute('data-theme-mode') || 'dark';
  const autoMode = getThemeMode();
  const autoBadge = autoMode !== 'manual' ? ' ⚡' : '';
  icon.textContent = (mode === 'dark' ? '🌙' : '☀️') + autoBadge;
}

export function getCurrentThemeMode() {
  return getThemeMode();
}
