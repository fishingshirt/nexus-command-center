const LS_KEY = 'ncc-weather';
const LOC_KEY = 'ncc-weather-locations';
const MAX_LOCS = 10;
const REFRESH_MS = 15 * 60 * 1000;

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

function loadData() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveData(patch) {
  const d = loadData();
  localStorage.setItem(LS_KEY, JSON.stringify({ ...d, ...patch }));
}

function loadLocations() {
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveLocations(arr) {
  localStorage.setItem(LOC_KEY, JSON.stringify(arr.slice(0, MAX_LOCS)));
}
function genLocId() { return 'loc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6); }

let _refreshTimer = null;

export function initWeather() {
  const view = document.getElementById('view-weather');
  if (!view) return;

  const input = document.getElementById('weather-city');
  const search = document.getElementById('weather-search');
  const addBtn = document.getElementById('weather-add-btn');

  if (search) {
    search.addEventListener('click', () => {
      const q = input?.value.trim() || 'New York';
      fetchWeather(q);
    });
  }
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = input.value.trim() || 'New York';
        fetchWeather(q);
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

  // Init from saved locations
  const locs = loadLocations();
  if (locs.length === 0) {
    // bootstrap with a default
    ensureDefaultLocation();
  } else {
    // render all
    const home = locs.find(l => l.isHome) || locs[0];
    if (home) {
      renderFromStored(home.id);
    }
    renderLocationsList();
    renderPillRow();
  }

  // auto-refresh every 15m
  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(refreshAllLocations, REFRESH_MS);
  window.addEventListener('beforeunload', () => {
    if (_refreshTimer) clearInterval(_refreshTimer);
  });
}

function ensureDefaultLocation() {
  const locs = loadLocations();
  if (locs.length) return;
  const id = genLocId();
  const def = { id, name: 'New York', lat: 40.7128, lon: -74.006, country: 'US', isHome: true, addedAt: Date.now() };
  saveLocations([def]);
  fetchWeather('New York').then(() => {
    renderLocationsList();
    renderPillRow();
  });
}

async function fetchWeather(city, opts = {}) {
  const currentWrap = document.getElementById('weather-current');
  const forecastWrap = document.getElementById('weather-forecast');
  const cardCity = document.getElementById('weather-card-city');
  const cardIcon = document.getElementById('weather-card-icon');

  if (!opts.silent && currentWrap) {
    currentWrap.innerHTML = '<div class="weather-loading">Loading…</div>';
    if (forecastWrap) forecastWrap.innerHTML = '';
  }

  try {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
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

    // update stored loc entry with fresh data
    const locs = loadLocations();
    const idx = locs.findIndex(l => l.name === name || (Math.abs((l.lat || 0) - latitude) < 0.01 && Math.abs((l.lon || 0) - longitude) < 0.01));
    if (idx >= 0) {
      locs[idx].current = current;
      locs[idx].forecast = forecast;
      locs[idx].updated = Date.now();
      saveLocations(locs);
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

function renderFromStored(locId) {
  const locs = loadLocations();
  const loc = locs.find(l => l.id === locId) || locs[0];
  if (!loc) return;
  if (loc.current) {
    render(loc.current, loc.forecast || [], loc.name);
    const cardCity = document.getElementById('weather-card-city');
    const cardIcon = document.getElementById('weather-card-icon');
    if (cardCity) cardCity.textContent = loc.name;
    if (cardIcon) cardIcon.textContent = wmoIcon(loc.current.code);
  } else {
    fetchWeather(loc.name);
  }
}

function render(current, forecast, city) {
  const currentWrap = document.getElementById('weather-current');
  const forecastWrap = document.getElementById('weather-forecast');
  if (!currentWrap || !forecastWrap) return;
  currentWrap.innerHTML = `
    <div class="weather-hero">
      <div class="weather-hero-icon">${wmoIcon(current.code)}</div>
      <div class="weather-hero-temp">${Math.round(current.temp)}°C</div>
      <div class="weather-hero-condition">${wmoText(current.code)}</div>
      <div class="weather-hero-city">${escapeHtml(city)}</div>
    </div>
    <div class="weather-details">
      <div class="weather-detail"><span>Feels like</span><b>${Math.round(current.feels)}°</b></div>
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
        <span class="weather-day-range">${Math.round(f.max)}° / ${Math.round(f.min)}°</span>
      </div>`;
  }).join('');
}

async function addLocationFromSearch(city) {
  const data = await fetchWeather(city);
  if (!data) { if (typeof toast === 'function') toast('Could not find city'); return; }
  const locs = loadLocations();
  if (locs.length >= MAX_LOCS) { if (typeof toast === 'function') toast('Max 10 saved locations'); return; }
  if (locs.some(l => l.name === data.name)) { if (typeof toast === 'function') toast('Location already saved'); return; }
  const id = genLocId();
  locs.push({
    id, name: data.name, lat: data.latitude, lon: data.longitude,
    country: data.country || '', isHome: locs.length === 0, addedAt: Date.now(),
    current: data.current, forecast: data.forecast, updated: Date.now()
  });
  saveLocations(locs);
  renderLocationsList();
  renderPillRow();
  if (typeof toast === 'function') toast(`Added ${data.name}`);
}

function removeLocation(id) {
  let locs = loadLocations();
  const wasHome = locs.find(l => l.id === id)?.isHome;
  locs = locs.filter(l => l.id !== id);
  if (wasHome && locs.length) locs[0].isHome = true;
  saveLocations(locs);
  renderLocationsList();
  renderPillRow();
  const home = locs.find(l => l.isHome) || locs[0];
  if (home) renderFromStored(home.id);
}

function setHome(id) {
  const locs = loadLocations();
  locs.forEach(l => l.isHome = (l.id === id));
  saveLocations(locs);
  renderLocationsList();
  renderPillRow();
  renderFromStored(id);
}

function renderLocationsList() {
  const container = document.getElementById('weather-locations');
  const countEl = document.getElementById('weather-loc-count');
  const locs = loadLocations();
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
        <button class="weather-loc-action" data-action="home" data-id="${l.id}" title="Set as home" aria-label="Set ${escapeHtml(l.name)} as home">🏠</button>
        <button class="weather-loc-action" data-action="remove" data-id="${l.id}" title="Remove" aria-label="Remove ${escapeHtml(l.name)}">✕</button>
      </div>
    </div>
  `).join('');

  // click to view
  container.querySelectorAll('.weather-loc-name').forEach(btn => {
    btn.addEventListener('click', () => renderFromStored(btn.dataset.id));
  });
  // actions
  container.querySelectorAll('.weather-loc-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'home') setHome(id);
      else if (btn.dataset.action === 'remove') removeLocation(id);
    });
  });
  // drag-and-drop reorder
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
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (!dragSrc || dragSrc === item) return;
      const from = Number(dragSrc.dataset.index);
      const to = Number(item.dataset.index);
      let locs = loadLocations();
      const [moved] = locs.splice(from, 1);
      locs.splice(to, 0, moved);
      saveLocations(locs);
      renderLocationsList();
      renderPillRow();
    });
  });
}

function renderPillRow() {
  const row = document.getElementById('weather-pill-row');
  if (!row) return;
  const locs = loadLocations();
  if (!locs.length) { row.innerHTML = ''; return; }
  row.innerHTML = locs.map(l => {
    const temp = l.current ? `${Math.round(l.current.temp)}°` : '';
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
  const locs = loadLocations();
  for (const l of locs) {
    await fetchWeather(l.name, { silent: true });
  }
  renderPillRow();
  renderLocationsList();
  const home = locs.find(l => l.isHome) || locs[0];
  const activeView = location.hash.slice(1);
  if (activeView === 'weather' && home) renderFromStored(home.id);
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
