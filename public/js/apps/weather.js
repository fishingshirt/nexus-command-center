const LS_KEY = 'ncc-weather';
const LOC_KEY = 'ncc-weather-locations';
import { storage } from '../lib/storage-adapter.js';
const SETTINGS_KEY = 'ncc-weather-settings';
const MAX_LOCS = 10;
const DEFAULT_REFRESH = 15;

const _MIGRATED = new Set();

// ── Helpers ─────────────────────────────────────
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}
function saveSettings(p) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...p }));
}
function getUnit() { return loadSettings().units || 'c'; }
function getRefreshMinutes() { return loadSettings().refresh || DEFAULT_REFRESH; }
function convertTemp(c) {
  return getUnit() === 'f' ? (c * 9 / 5) + 32 : c;
}
function formatTemp(c) { return `${Math.round(convertTemp(c))}°${getUnit().toUpperCase()}`; }
function formatVal(v) { return Math.round(convertTemp(v)); }
function genLocId() { return 'loc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6); }
function escapeHtml(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

const ICONS = {
  clear: '\u2600\uFE0F', partly: '\u26C5', cloudy: '\u2601\uFE0F', fog: '\uD83C\uDF2B\uFE0F',
  drizzle: '\uD83C\uDF26\uFE0F', rain: '\uD83C\uDF27\uFE0F', snow: '\uD83C\uDF28\uFE0F', thunder: '\u26C8\uFE0F', sleet: '\uD83C\uDF28\uFE0F'
};

function wmoIcon(code) {
  if (code === 0) return ICONS.clear;
  if (code === 1 || code === 2) return ICONS.partly;
  if (code === 3) return ICONS.cloudy;
  if (code >= 45 && code <= 48) return ICONS.fog;
  if (code >= 51 && code <= 57) return ICONS.drizzle;
  if (code >= 61 && code <= 67) return ICONS.rain;
  if (code >= 71 && code <= 77) return ICONS.snow;
  if (code >= 80 && code <= 82) return ICONS.rain;
  if (code >= 85 && code <= 86) return ICONS.sleet;
  if (code >= 95) return ICONS.thunder;
  return ICONS.cloudy;
}

function wmoText(code) {
  const map = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    80: 'Rain showers', 81: 'Moderate showers', 82: 'Violent showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Heavy hail'
  };
  return map[code] || 'Unknown';
}

// ── Database persistence ──────────────────────────

async function _migrateIfNeeded() {
  if (_MIGRATED.has('weather')) return;
  const hasNexusDB = typeof NexusDB !== 'undefined';
  if (!hasNexusDB) { _MIGRATED.add('weather'); return; }
  try {
    const rows = await NexusDB.list('weather_locations');
    if (rows.data && rows.data.length > 0) { _MIGRATED.add('weather'); return; }
    // Migrate from localStorage
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) { _MIGRATED.add('weather'); return; }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) { _MIGRATED.add('weather'); return; }
    for (const l of arr) {
      const row = {
        id: l.id || genLocId(), name: l.name, lat: l.lat, lon: l.lon,
        country: l.country || '', is_home: l.isHome ? 1 : 0,
        current: l.current || null, forecast: l.forecast || null,
        updated: l.updated || l.addedAt || Date.now(),
        added_at: l.addedAt || Date.now(), sort_order: 0
      };
      await NexusDB.create('weather_locations', row);
    }
  } catch (e) { /* silent fail, keep using localStorage */ }
  _MIGRATED.add('weather');
}

async function loadLocations() {
  await _migrateIfNeeded();
  if (typeof NexusDB !== 'undefined') {
    try {
      const res = await NexusDB.list('weather_locations', { sort: 'sort_order', order: 'asc' });
      if (res.data && res.data.length) {
        return res.data.map(r => ({
          id: r.id, name: r.name, lat: r.lat, lon: r.lon,
          country: r.country || '', isHome: !!r.is_home,
          current: r.current, forecast: r.forecast,
          updated: r.updated, addedAt: r.added_at
        }));
      }
    } catch (e) { /* fall through */ }
  }
  // Fallback
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function saveLocations(arr) {
  storage.write('weather-locations', arr).catch(() => {});
  if (typeof NexusDB !== 'undefined') {
    try {
      // Fetch existing rows so we can decide create vs update
      const res = await NexusDB.list('weather_locations');
      const existing = new Set((res.data || []).map(r => r.id));
      for (let i = 0; i < arr.length; i++) {
        const l = arr[i];
        const row = {
          id: l.id, name: l.name, lat: l.lat, lon: l.lon,
          country: l.country || '', is_home: l.isHome ? 1 : 0,
          current: l.current || null, forecast: l.forecast || null,
          updated: l.updated || Date.now(), added_at: l.addedAt || Date.now(),
          sort_order: i
        };
        if (existing.has(l.id)) {
          await NexusDB.update('weather_locations', l.id, row);
        } else {
          await NexusDB.create('weather_locations', row);
        }
      }
      // Delete removed rows
      const keep = new Set(arr.map(l => l.id));
      for (const r of (res.data || [])) {
        if (!keep.has(r.id)) await NexusDB.delete('weather_locations', r.id);
      }
    } catch (e) { /* fall through to localStorage */ }
  }
  localStorage.setItem(LOC_KEY, JSON.stringify(arr.slice(0, MAX_LOCS)));
}

let _refreshTimer = null;

// ── Entry point ───────────────────────────────────

export async function initWeather() {
  const view = document.getElementById('view-weather');
  if (!view) return;

  const input = document.getElementById('weather-city');
  const search = document.getElementById('weather-search');
  const addBtn = document.getElementById('weather-add-btn');

  if (search) {
    search.addEventListener('click', () => {
      const q = input?.value.trim() || 'New York';
      fetchWeather(q, { silent: false });
    });
  }
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = input.value.trim() || 'New York';
        fetchWeather(q, { silent: false });
      }
    });
  }
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const q = input?.value.trim();
      if (!q) { if (typeof toast === 'function') toast('Enter a city name first'); return; }
      addLocationFromSearch(q);
    });
  }

  const locs = await loadLocations();
  if (locs.length === 0) {
    await ensureDefaultLocation();
  } else {
    const home = locs.find(l => l.isHome) || locs[0];
    if (home) renderFromStored(home.id);
    renderLocationsList();
    renderPillRow();
  }

  startAutoRefresh();
  initWeatherSettings();
  _registerWeatherWidgetStub();
}

function startAutoRefresh() {
  if (_refreshTimer) clearInterval(_refreshTimer);
  const ms = getRefreshMinutes() * 60 * 1000;
  _refreshTimer = setInterval(refreshAllLocations, ms);
}

async function ensureDefaultLocation() {
  const locs = await loadLocations();
  if (locs.length) return;
  const id = genLocId();
  const def = { id, name: 'New York', lat: 40.7128, lon: -74.006, country: 'US', isHome: true, addedAt: Date.now() };
  await saveLocations([def]);
  fetchWeather('New York', { silent: false }).then(() => {
    renderLocationsList();
    renderPillRow();
  });
}

async function tryZipToCity(q) {
  if (/^\d{5}$/.test(q)) {
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${q}`);
      if (res.ok) {
        const data = await res.json();
        const place = data?.places?.[0];
        if (place) return `${place['place name']}, ${place['state abbreviation']}`;
      }
    } catch { /* fall through */ }
  }
  return q;
}

async function fetchWeather(city, opts = {}) {
  const currentWrap = document.getElementById('weather-current');
  const forecastWrap = document.getElementById('weather-forecast');
  const cardCity = document.getElementById('weather-card-city');
  const cardIcon = document.getElementById('weather-card-icon');

  const resolvedCity = await tryZipToCity(city);

  if (!opts.silent && currentWrap) {
    currentWrap.innerHTML = '<div class="weather-loading">Loading…</div>';
    if (forecastWrap) forecastWrap.innerHTML = '';
  }

  try {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(resolvedCity)}&count=1`);
    const geoJson = await geo.json();
    if (!geoJson.results || !geoJson.results[0]) {
      if (!opts.silent && currentWrap) currentWrap.innerHTML = '<div class="weather-loading">City not found.</div>';
      return null;
    }
    const { latitude, longitude, name, country } = geoJson.results[0];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relative_humidity_2m,apparent_temperature&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const res = await fetch(url);
    const json = await res.json();
    const hour = new Date().getHours();
    const current = {
      temp: json.current_weather.temperature,
      code: json.current_weather.weathercode,
      wind: json.current_weather.windspeed,
      humidity: json.hourly.relative_humidity_2m?.[hour] || 50,
      feels: json.hourly.apparent_temperature?.[hour] || json.current_weather.temperature
    };
    const forecast = (json.daily.time || []).slice(0, 5).map((t, i) => ({
      date: t,
      max: json.daily.temperature_2m_max[i],
      min: json.daily.temperature_2m_min[i],
      code: json.daily.weathercode[i]
    }));

    const locs = await loadLocations();
    const idx = locs.findIndex(l => l.name === name || (Math.abs((l.lat || 0) - latitude) < 0.01 && Math.abs((l.lon || 0) - longitude) < 0.01));
    if (idx >= 0) {
      locs[idx].current = current;
      locs[idx].forecast = forecast;
      locs[idx].updated = Date.now();
      await saveLocations(locs);
    }

    if (!opts.silent) {
      render(current, forecast, name);
      if (cardCity) cardCity.textContent = name;
      if (cardIcon) cardIcon.textContent = wmoIcon(current.code);
    }

    renderPillRow();
    return { current, forecast, name, latitude, longitude, country };
  } catch (err) {
    if (!opts.silent && currentWrap) currentWrap.innerHTML = '<div class="weather-loading">Failed to load weather.</div>';
    return null;
  }
}

async function renderFromStored(locId) {
  const locs = await loadLocations();
  const loc = locs.find(l => l.id === locId) || locs[0];
  if (!loc) return;
  if (loc.current) {
    render(loc.current, loc.forecast || [], loc.name);
    const cardCity = document.getElementById('weather-card-city');
    const cardIcon = document.getElementById('weather-card-icon');
    if (cardCity) cardCity.textContent = loc.name;
    if (cardIcon) cardIcon.textContent = wmoIcon(loc.current.code);
  } else {
    fetchWeather(loc.name, { silent: false });
  }
}

function render(current, forecast, city) {
  const currentWrap = document.getElementById('weather-current');
  const forecastWrap = document.getElementById('weather-forecast');
  if (!currentWrap || !forecastWrap) return;
  currentWrap.innerHTML = `
    <div class="weather-hero">
      <div class="weather-hero-icon">${wmoIcon(current.code)}</div>
      <div class="weather-hero-temp">${formatTemp(current.temp)}</div>
      <div class="weather-hero-condition">${wmoText(current.code)}</div>
      <div class="weather-hero-city">${escapeHtml(city)}</div>
    </div>
    <div class="weather-details">
      <div class="weather-detail"><span>Feels like</span><b>${formatTemp(current.feels)}</b></div>
      <div class="weather-detail"><span>Humidity</span><b>${current.humidity}%</b></div>
      <div class="weather-detail"><span>Wind</span><b>${current.wind} km/h</b></div>
    </div>`;

  forecastWrap.innerHTML = forecast.map(f => {
    const d = new Date(f.date);
    const day = d.toLocaleDateString(undefined, { weekday: 'short' });
    return `
      <div class="weather-day">
        <span class="weather-day-name">${day}</span>
        <span class="weather-day-icon">${wmoIcon(f.code)}</span>
        <span class="weather-day-range">${formatVal(f.max)}° / ${formatVal(f.min)}°</span>
      </div>`;
  }).join('');
}

async function addLocationFromSearch(city) {
  const data = await fetchWeather(city, { silent: false });
  if (!data) { if (typeof toast === 'function') toast('Could not find city'); return; }
  const locs = await loadLocations();
  if (locs.length >= MAX_LOCS) { if (typeof toast === 'function') toast('Max 10 saved locations'); return; }
  if (locs.some(l => l.name === data.name)) { if (typeof toast === 'function') toast('Location already saved'); return; }
  const id = genLocId();
  locs.push({
    id, name: data.name, lat: data.latitude, lon: data.longitude,
    country: data.country || '', isHome: locs.length === 0, addedAt: Date.now(),
    current: data.current, forecast: data.forecast, updated: Date.now()
  });
  await saveLocations(locs);
  renderLocationsList();
  renderPillRow();
  if (typeof toast === 'function') toast(`Added ${data.name}`);
}

async function removeLocation(id) {
  let locs = await loadLocations();
  const wasHome = locs.find(l => l.id === id)?.isHome;
  locs = locs.filter(l => l.id !== id);
  if (wasHome && locs.length) locs[0].isHome = true;
  await saveLocations(locs);
  renderLocationsList();
  renderPillRow();
  const home = locs.find(l => l.isHome) || locs[0];
  if (home) renderFromStored(home.id);
}

async function setHome(id) {
  const locs = await loadLocations();
  locs.forEach(l => l.isHome = (l.id === id));
  await saveLocations(locs);
  renderLocationsList();
  renderPillRow();
  renderFromStored(id);
}

async function renameLocation(id, newName) {
  if (!newName.trim()) return;
  const locs = await loadLocations();
  const idx = locs.findIndex(l => l.id === id);
  if (idx >= 0) {
    locs[idx].name = newName.trim();
    locs[idx].updated = Date.now();
    await saveLocations(locs);
    renderLocationsList();
    renderPillRow();
    if (locs[idx].isHome) renderFromStored(id);
  }
}

async function renderLocationsList() {
  const container = document.getElementById('weather-locations');
  const countEl = document.getElementById('weather-loc-count');
  const locs = await loadLocations();
  if (countEl) countEl.textContent = `${locs.length} / ${MAX_LOCS}`;
  if (!container) return;
  if (!locs.length) {
    container.innerHTML = '<div class="weather-loc-empty">No saved locations. Search above and tap + to add.</div>';
    return;
  }
  container.innerHTML = locs.map((l, i) => `
    <div class="weather-loc-item" draggable="true" data-id="${l.id}" data-index="${i}">
      <div class="weather-loc-drag" aria-label="Drag to reorder">⋮⋮</div>
      <button class="weather-loc-name" data-id="${l.id}" title="Tap to view" aria-label="View ${escapeHtml(l.name)}">
        <span class="weather-loc-icon">${l.current ? wmoIcon(l.current.code) : '🌡️'}</span>
        <span class="weather-loc-label">${escapeHtml(l.name)}${l.country ? `, ${escapeHtml(l.country)}` : ''}</span>
        ${l.isHome ? '<span class="weather-loc-home">Home</span>' : ''}
      </button>
      <div class="weather-loc-actions">
        <button class="weather-loc-action" data-action="rename" data-id="${l.id}" title="Rename" aria-label="Rename ${escapeHtml(l.name)}">✎</button>
        <button class="weather-loc-action" data-action="home" data-id="${l.id}" title="Set as home" aria-label="Set ${escapeHtml(l.name)} as home">🏠</button>
        <button class="weather-loc-action" data-action="remove" data-id="${l.id}" title="Remove" aria-label="Remove ${escapeHtml(l.name)}">✕</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.weather-loc-name').forEach(btn => {
    btn.addEventListener('click', () => renderFromStored(btn.dataset.id));
  });
  container.querySelectorAll('.weather-loc-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'home') setHome(id);
      else if (btn.dataset.action === 'remove') removeLocation(id);
      else if (btn.dataset.action === 'rename') showRenameModal(id);
    });
  });

  // Drag-and-drop reorder
  let dragSrc = null;
  container.querySelectorAll('.weather-loc-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.index);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      dragSrc = null;
      container.querySelectorAll('.weather-loc-item').forEach(el => el.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (item !== dragSrc) item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', async e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (!dragSrc || dragSrc === item) return;
      const from = Number(dragSrc.dataset.index);
      const to = Number(item.dataset.index);
      let locs = await loadLocations();
      const [moved] = locs.splice(from, 1);
      locs.splice(to, 0, moved);
      await saveLocations(locs);
      renderLocationsList();
      renderPillRow();
    });
  });
}

function showRenameModal(id) {
  (async () => {
    const locs = await loadLocations();
    const loc = locs.find(l => l.id === id);
    if (!loc) return;
    let modal = document.getElementById('weather-rename-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'weather-rename-modal';
      modal.className = 'weather-modal-overlay';
      modal.setAttribute('aria-hidden', 'true');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
        <div class="weather-box" role="document">
          <h4>Rename location</h4>
          <input type="text" id="weather-rename-input" placeholder="New display name" autocomplete="off">
          <div class="weather-box-row">
            <button class="btn-secondary" id="weather-rename-cancel">Cancel</button>
            <button class="btn-primary" id="weather-rename-save">Save</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      document.getElementById('weather-rename-cancel')?.addEventListener('click', hideRenameModal);
      document.getElementById('weather-rename-save')?.addEventListener('click', () => {
        const val = document.getElementById('weather-rename-input')?.value || '';
        const targetId = modal.dataset.targetId;
        if (targetId && val.trim()) renameLocation(targetId, val.trim());
        hideRenameModal();
      });
      document.getElementById('weather-rename-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('weather-rename-save')?.click();
        if (e.key === 'Escape') hideRenameModal();
      });
    }
    modal.setAttribute('aria-hidden', 'false');
    modal.dataset.targetId = id;
    const inp = document.getElementById('weather-rename-input');
    if (inp) { inp.value = loc.name; inp.focus(); inp.select(); }
  })();
}

function hideRenameModal() {
  const modal = document.getElementById('weather-rename-modal');
  if (modal) modal.setAttribute('aria-hidden', 'true');
}

async function renderPillRow() {
  const row = document.getElementById('weather-pill-row');
  if (!row) return;
  const locs = await loadLocations();
  if (!locs.length) { row.innerHTML = ''; return; }
  row.innerHTML = locs.map(l => {
    const temp = l.current ? `${Math.round(convertTemp(l.current.temp))}°` : '';
    const icon = l.current ? wmoIcon(l.current.code) : '🌡️';
    const active = l.isHome ? 'active' : '';
    return `
      <button class="weather-pill ${active}" data-id="${l.id}" title="${escapeHtml(l.name)}" aria-label="${escapeHtml(l.name)} ${temp}">
        <span class="weather-pill-icon">${icon}</span>
        <span class="weather-pill-city">${escapeHtml(l.name)}</span>
        <span class="weather-pill-temp">${temp}</span>
      </button>`;
  }).join('');
  row.querySelectorAll('.weather-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      location.hash = 'weather';
      renderFromStored(btn.dataset.id);
    });
  });
}

async function refreshAllLocations() {
  const locs = await loadLocations();
  for (const l of locs) {
    await fetchWeather(l.name, { silent: true });
  }
  renderPillRow();
  renderLocationsList();
  const home = locs.find(l => l.isHome) || locs[0];
  const activeView = location.hash.slice(1);
  if (activeView === 'weather' && home) renderFromStored(home.id);
}

/* ===== SETTINGS INTEGRATION ===== */
export function initWeatherSettings() {
  const unitsSel = document.getElementById('weather-units');
  const refreshSel = document.getElementById('weather-refresh');
  const wrap = document.getElementById('settings-weather-locs');
  const countEl = document.getElementById('settings-weather-count');

  const settings = loadSettings();
  if (unitsSel) unitsSel.value = settings.units || 'c';
  if (refreshSel) refreshSel.value = String(settings.refresh || DEFAULT_REFRESH);

  unitsSel?.addEventListener('change', async () => {
    saveSettings({ units: unitsSel.value });
    renderPillRow();
    const locs = await loadLocations();
    const home = locs.find(l => l.isHome) || locs[0];
    if (home && location.hash === '#weather') renderFromStored(home.id);
    const container = document.getElementById('weather-locations');
    if (container) renderLocationsList();
  });

  refreshSel?.addEventListener('change', () => {
    saveSettings({ refresh: Number(refreshSel.value) });
    startAutoRefresh();
  });

  async function renderSettingsLocs() {
    const locs = await loadLocations();
    if (countEl) countEl.textContent = `${locs.length} / ${MAX_LOCS}`;
    if (!wrap) return;
    if (!locs.length) { wrap.innerHTML = '<div class="settings-loc-item" style="color:var(--text-muted);">No saved locations.</div>'; return; }
    wrap.innerHTML = locs.map(l => `
      <div class="settings-loc-item">
        <span class="weather-loc-icon">${l.current ? wmoIcon(l.current.code) : '🌡️'}</span>
        <span>${escapeHtml(l.name)}${l.isHome ? ' (Home)' : ''}</span>
        <div class="settings-loc-actions">
          ${!l.isHome ? `<button data-action="home" data-id="${l.id}" title="Set home">🏠</button>` : '<button disabled style="opacity:.3;" title="Home">🏠</button>'}
          <button data-action="remove" data-id="${l.id}" title="Remove">✕</button>
        </div>
      </div>
    `).join('');
    wrap.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.action === 'home') setHome(btn.dataset.id);
        else if (btn.dataset.action === 'remove') removeLocation(btn.dataset.id);
        renderSettingsLocs();
      });
    });
  }

  renderSettingsLocs();
  window.addEventListener('hashchange', () => {
    if (location.hash === '#settings') renderSettingsLocs();
  });
}

/* ---- Widget stubs ---- */
function _registerWeatherWidgetStub() {
  if (window.widgetRegistry) {
    window.widgetRegistry.registerWidget('weather', (el) => {
      let html = '<span class="widget-placeholder">No data</span>';
      try {
        const raw = localStorage.getItem(LOC_KEY);
        if (raw) {
          const locs = JSON.parse(raw);
          const loc = (Array.isArray(locs) ? locs : []).find(l => l.isHome) || locs[0];
          if (loc && loc.current) {
            html = `<div class="widget-metric"><span class="widget-metric__value">${Math.round(convertTemp(loc.current.temp))}°</span><span class="widget-metric__label"></span></div>`;
            // set label safely
            requestAnimationFrame(() => {
              const lbl = el.querySelector('.widget-metric__label');
              if (lbl) lbl.textContent = loc.name || 'Local';
            });
          }
        }
      } catch {}
      el.innerHTML = html;
    });
  }
}

export function getWeatherWidgetData() {
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) return null;
    const locs = JSON.parse(raw);
    const loc = (Array.isArray(locs) ? locs : []).find(l => l.isHome) || locs[0];
    if (!loc || !loc.current) return null;
    return {
      city: loc.name || 'Local',
      temp: loc.current.temp,
      code: loc.current.code,
      icon: wmoIcon(loc.current.code),
      condition: wmoText(loc.current.code)
    };
  } catch { return null; }
}
