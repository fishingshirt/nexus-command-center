const LS_KEY = 'ncc-worldclock';
import { storage } from '../lib/storage-adapter.js';

const CITY_DB = [
  { name: 'New York', country: 'USA', tz: 'America/New_York' },
  { name: 'Los Angeles', country: 'USA', tz: 'America/Los_Angeles' },
  { name: 'Chicago', country: 'USA', tz: 'America/Chicago' },
  { name: 'London', country: 'UK', tz: 'Europe/London' },
  { name: 'Paris', country: 'France', tz: 'Europe/Paris' },
  { name: 'Berlin', country: 'Germany', tz: 'Europe/Berlin' },
  { name: 'Rome', country: 'Italy', tz: 'Europe/Rome' },
  { name: 'Madrid', country: 'Spain', tz: 'Europe/Madrid' },
  { name: 'Amsterdam', country: 'Netherlands', tz: 'Europe/Amsterdam' },
  { name: 'Zurich', country: 'Switzerland', tz: 'Europe/Zurich' },
  { name: 'Stockholm', country: 'Sweden', tz: 'Europe/Stockholm' },
  { name: 'Copenhagen', country: 'Denmark', tz: 'Europe/Copenhagen' },
  { name: 'Vienna', country: 'Austria', tz: 'Europe/Vienna' },
  { name: 'Warsaw', country: 'Poland', tz: 'Europe/Warsaw' },
  { name: 'Moscow', country: 'Russia', tz: 'Europe/Moscow' },
  { name: 'Dubai', country: 'UAE', tz: 'Asia/Dubai' },
  { name: 'Istanbul', country: 'Turkey', tz: 'Europe/Istanbul' },
  { name: 'Tokyo', country: 'Japan', tz: 'Asia/Tokyo' },
  { name: 'Osaka', country: 'Japan', tz: 'Asia/Tokyo' },
  { name: 'Seoul', country: 'South Korea', tz: 'Asia/Seoul' },
  { name: 'Beijing', country: 'China', tz: 'Asia/Shanghai' },
  { name: 'Shanghai', country: 'China', tz: 'Asia/Shanghai' },
  { name: 'Hong Kong', country: 'China', tz: 'Asia/Hong_Kong' },
  { name: 'Singapore', country: 'Singapore', tz: 'Asia/Singapore' },
  { name: 'Bangkok', country: 'Thailand', tz: 'Asia/Bangkok' },
  { name: 'Jakarta', country: 'Indonesia', tz: 'Asia/Jakarta' },
  { name: 'Manila', country: 'Philippines', tz: 'Asia/Manila' },
  { name: 'Taipei', country: 'Taiwan', tz: 'Asia/Taipei' },
  { name: 'Mumbai', country: 'India', tz: 'Asia/Kolkata' },
  { name: 'Delhi', country: 'India', tz: 'Asia/Kolkata' },
  { name: 'Sydney', country: 'Australia', tz: 'Australia/Sydney' },
  { name: 'Melbourne', country: 'Australia', tz: 'Australia/Melbourne' },
  { name: 'Brisbane', country: 'Australia', tz: 'Australia/Brisbane' },
  { name: 'Perth', country: 'Australia', tz: 'Australia/Perth' },
  { name: 'Auckland', country: 'New Zealand', tz: 'Pacific/Auckland' },
  { name: 'São Paulo', country: 'Brazil', tz: 'America/Sao_Paulo' },
  { name: 'Rio de Janeiro', country: 'Brazil', tz: 'America/Sao_Paulo' },
  { name: 'Buenos Aires', country: 'Argentina', tz: 'America/Argentina/Buenos_Aires' },
  { name: 'Mexico City', country: 'Mexico', tz: 'America/Mexico_City' },
  { name: 'Toronto', country: 'Canada', tz: 'America/Toronto' },
  { name: 'Vancouver', country: 'Canada', tz: 'America/Vancouver' },
  { name: 'Montreal', country: 'Canada', tz: 'America/Toronto' },
  { name: 'Cairo', country: 'Egypt', tz: 'Africa/Cairo' },
  { name: 'Lagos', country: 'Nigeria', tz: 'Africa/Lagos' },
  { name: 'Johannesburg', country: 'South Africa', tz: 'Africa/Johannesburg' },
  { name: 'Nairobi', country: 'Kenya', tz: 'Africa/Nairobi' },
  { name: 'Tel Aviv', country: 'Israel', tz: 'Asia/Tel_Aviv' },
  { name: 'Jerusalem', country: 'Israel', tz: 'Asia/Jerusalem' },
  { name: 'Athens', country: 'Greece', tz: 'Europe/Athens' },
  { name: 'Lisbon', country: 'Portugal', tz: 'Europe/Lisbon' },
  { name: 'Dublin', country: 'Ireland', tz: 'Europe/Dublin' },
  { name: 'Helsinki', country: 'Finland', tz: 'Europe/Helsinki' },
  { name: 'Oslo', country: 'Norway', tz: 'Europe/Oslo' },
  { name: 'Reykjavik', country: 'Iceland', tz: 'Atlantic/Reykjavik' },
  { name: 'Prague', country: 'Czechia', tz: 'Europe/Prague' },
  { name: 'Budapest', country: 'Hungary', tz: 'Europe/Budapest' },
  { name: 'Bucharest', country: 'Romania', tz: 'Europe/Bucharest' },
  { name: 'Sofia', country: 'Bulgaria', tz: 'Europe/Sofia' },
  { name: 'Kiev', country: 'Ukraine', tz: 'Europe/Kiev' },
  { name: 'Karachi', country: 'Pakistan', tz: 'Asia/Karachi' },
  { name: 'Dhaka', country: 'Bangladesh', tz: 'Asia/Dhaka' },
  { name: 'Kathmandu', country: 'Nepal', tz: 'Asia/Kathmandu' },
  { name: 'Colombo', country: 'Sri Lanka', tz: 'Asia/Colombo' },
  { name: 'Kuala Lumpur', country: 'Malaysia', tz: 'Asia/Kuala_Lumpur' },
  { name: 'Ho Chi Minh City', country: 'Vietnam', tz: 'Asia/Ho_Chi_Minh' },
  { name: 'Hanoi', country: 'Vietnam', tz: 'Asia/Ho_Chi_Minh' },
  { name: 'Phnom Penh', country: 'Cambodia', tz: 'Asia/Phnom_Penh' },
  { name: 'Yangon', country: 'Myanmar', tz: 'Asia/Yangon' },
  { name: 'Riyadh', country: 'Saudi Arabia', tz: 'Asia/Riyadh' },
  { name: 'Doha', country: 'Qatar', tz: 'Asia/Qatar' },
  { name: 'Kuwait City', country: 'Kuwait', tz: 'Asia/Kuwait' },
  { name: 'Baghdad', country: 'Iraq', tz: 'Asia/Baghdad' },
  { name: 'Tehran', country: 'Iran', tz: 'Asia/Tehran' },
  { name: 'Tashkent', country: 'Uzbekistan', tz: 'Asia/Tashkent' },
  { name: 'Almaty', country: 'Kazakhstan', tz: 'Asia/Almaty' },
  { name: 'Astana', country: 'Kazakhstan', tz: 'Asia/Almaty' },
  { name: 'Ulaanbaatar', country: 'Mongolia', tz: 'Asia/Ulaanbaatar' },
  { name: 'Havana', country: 'Cuba', tz: 'America/Havana' },
  { name: 'Lima', country: 'Peru', tz: 'America/Lima' },
  { name: 'Bogotá', country: 'Colombia', tz: 'America/Bogota' },
  { name: 'Caracas', country: 'Venezuela', tz: 'America/Caracas' },
  { name: 'Santiago', country: 'Chile', tz: 'America/Santiago' },
  { name: 'Quito', country: 'Ecuador', tz: 'America/Guayaquil' },
  { name: 'San Juan', country: 'Puerto Rico', tz: 'America/Puerto_Rico' },
  { name: 'Guadalajara', country: 'Mexico', tz: 'America/Mexico_City' },
  { name: 'Denver', country: 'USA', tz: 'America/Denver' },
  { name: 'Phoenix', country: 'USA', tz: 'America/Phoenix' },
  { name: 'Miami', country: 'USA', tz: 'America/New_York' },
  { name: 'Atlanta', country: 'USA', tz: 'America/New_York' },
  { name: 'Boston', country: 'USA', tz: 'America/New_York' },
  { name: 'Seattle', country: 'USA', tz: 'America/Los_Angeles' },
  { name: 'San Francisco', country: 'USA', tz: 'America/Los_Angeles' },
  { name: 'Las Vegas', country: 'USA', tz: 'America/Los_Angeles' },
  { name: 'Honolulu', country: 'USA', tz: 'Pacific/Honolulu' },
  { name: 'Anchorage', country: 'USA', tz: 'America/Anchorage' },
  { name: 'Edmonton', country: 'Canada', tz: 'America/Edmonton' },
  { name: 'Calgary', country: 'Canada', tz: 'America/Edmonton' },
  { name: 'Halifax', country: 'Canada', tz: 'America/Halifax' },
  { name: 'Winnipeg', country: 'Canada', tz: 'America/Winnipeg' }
];

const _MIGRATED_WC = { done: false };

// ── Persistence helpers ───────────────────────────

async function _migrateWorldClock() {
  if (_MIGRATED_WC.done) return;
  if (typeof NexusDB === 'undefined') { _MIGRATED_WC.done = true; return; }
  try {
    const res = await NexusDB.list('worldclock_cities');
    if (res.data && res.data.length > 0) { _MIGRATED_WC.done = true; return; }
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) { _MIGRATED_WC.done = true; return; }
    const d = JSON.parse(raw);
    const cities = d.cities || [];
    if (!cities.length) { _MIGRATED_WC.done = true; return; }
    for (let i = 0; i < cities.length; i++) {
      const c = cities[i];
      await NexusDB.create('worldclock_cities', {
        id: c.id || ('c_' + Date.now().toString(36) + '_' + i),
        name: c.name, country: c.country || '', tz: c.tz, label: c.label || c.name,
        sort_order: i
      });
    }
  } catch (e) { /* silent */ }
  _MIGRATED_WC.done = true;
}

async function loadClockCities() {
  await _migrateWorldClock();
  if (typeof NexusDB !== 'undefined') {
    try {
      const res = await NexusDB.list('worldclock_cities', { sort: 'sort_order', order: 'asc' });
      if (res.data && res.data.length) {
        return res.data.map(r => ({
          id: r.id, name: r.name, country: r.country || '', tz: r.tz, label: r.label || r.name
        }));
      }
    } catch (e) { /* fall through */ }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const d = JSON.parse(raw);
    return d.cities || [];
  } catch { return []; }
}

async function saveClockCities(cities) {
  storage.write('worldclock-cities', cities).catch(() => {});
  if (typeof NexusDB !== 'undefined') {
    try {
      const res = await NexusDB.list('worldclock_cities');
      const existing = new Set((res.data || []).map(r => r.id));
      for (let i = 0; i < cities.length; i++) {
        const c = cities[i];
        const row = { id: c.id, name: c.name, country: c.country || '', tz: c.tz, label: c.label || c.name, sort_order: i };
        if (existing.has(c.id)) await NexusDB.update('worldclock_cities', c.id, row);
        else await NexusDB.create('worldclock_cities', row);
      }
      const keep = new Set(cities.map(c => c.id));
      for (const r of (res.data || [])) {
        if (!keep.has(r.id)) await NexusDB.delete('worldclock_cities', r.id);
      }
    } catch (e) { /* fall through */ }
  }
  localStorage.setItem(LS_KEY, JSON.stringify({
    cities, format24: false, showDate: true, showSeconds: false
  }));
}

async function loadClockPrefs() {
  try {
    if (typeof NexusDB !== 'undefined') {
      try {
        const fmt = await NexusDB.settings.get('worldclock_format24', false);
        const date = await NexusDB.settings.get('worldclock_showDate', true);
        const sec = await NexusDB.settings.get('worldclock_showSeconds', false);
        return { format24: fmt, showDate: date, showSeconds: sec };
      } catch (e) { /* fall through */ }
    }
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const d = JSON.parse(raw);
    return { format24: d.format24, showDate: d.showDate, showSeconds: d.showSeconds };
  } catch { return {}; }
}

async function saveClockPrefs(prefs) {
  storage.write('worldclock-prefs', prefs).catch(() => {});
  try {
    if (typeof NexusDB !== 'undefined') {
      for (const [k, v] of Object.entries(prefs)) {
        await NexusDB.settings.set('worldclock_' + k, v);
      }
    }
  } catch (e) { /* fall through */ }
  const d = { ...loadClockData(), ...prefs };
  localStorage.setItem(LS_KEY, JSON.stringify(d));
}

function loadClockData() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

function nowFor(tz) {
  return new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
}

function isDayTime(tz) {
  const h = parseInt(new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10);
  return h >= 6 && h < 18;
}

function offsetText(tz) {
  const now = new Date();
  const local = now.getTime();
  const remote = new Date(now.toLocaleString('en-US', { timeZone: tz })).getTime();
  const diffMin = Math.round((remote - local) / 60000);
  const h = Math.floor(Math.abs(diffMin) / 60);
  const m = Math.abs(diffMin) % 60;
  const sign = diffMin >= 0 ? '+' : '-';
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

function formatTime(tz, fmt24) {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: !fmt24
  });
}

function formatDate(tz) {
  return new Date().toLocaleDateString('en-US', {
    timeZone: tz, weekday: 'short', month: 'short', day: 'numeric'
  });
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

export function initWorldClock() {
  const viewBody = document.querySelector('.worldclock-view-body');
  if (!viewBody) return;

  (async () => {
    const data = await loadClockPrefs();
    let fmt24 = data.format24 === true;
    let showDate = data.showDate !== false;
    let showSeconds = data.showSeconds === true;
    let activeTab = 'clocks';

    // Build tabs + tab panels if missing
    let tabBar = viewBody.querySelector('.clock-tabs');
    let content = viewBody.querySelector('.clock-tab-contents');
    if (!tabBar) {
      viewBody.innerHTML = '';
      tabBar = document.createElement('div');
      tabBar.className = 'clock-tabs';
      tabBar.innerHTML = `
        <button class="clock-tab-btn active" data-tab="clocks"><span class="clock-tab-icon">🕐</span> Clocks</button>
        <button class="clock-tab-btn" data-tab="add"><span class="clock-tab-icon">+</span> Add</button>
      `;
      content = document.createElement('div');
      content.className = 'clock-tab-contents';
      content.innerHTML = `
        <div class="clock-tab-panel active" data-panel="clocks">
          <div class="clock-settings-row">
            <button id="clock-fmt-btn">${fmt24 ? '24h' : '12h'}</button>
            <button id="clock-date-btn">${showDate ? 'Date ✓' : 'Date'}</button>
            <button id="clock-sec-btn">${showSeconds ? 'Sec ✓' : 'Sec'}</button>
          </div>
          <div class="clock-grid" id="clock-grid"></div>
        </div>
        <div class="clock-tab-panel" data-panel="add">
          <div class="clock-search-wrap">
            <input type="text" id="clock-add-search" placeholder="Search city (e.g. Dubai, Tokyo)..." aria-label="Search city">
          </div>
          <div class="clock-add-list" id="clock-add-list">
          <div class="clock-add-empty">All cities already added.</div>
          </div>
        </div>
      `;
      viewBody.appendChild(tabBar);
      viewBody.appendChild(content);
    }

    const pillRow = document.getElementById('clock-pill-row');
    const grid = document.getElementById('clock-grid');
    const fmtBtn = document.getElementById('clock-fmt-btn');
    const dateBtn = document.getElementById('clock-date-btn');
    const secBtn = document.getElementById('clock-sec-btn');
    const addSearch = document.getElementById('clock-add-search');
    const addList = document.getElementById('clock-add-list');

    function switchTab(tab) {
      activeTab = tab;
      tabBar.querySelectorAll('.clock-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      content.querySelectorAll('.clock-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
      if (tab === 'add') renderAddList(addSearch?.value?.trim().toLowerCase() || '');
    }

    tabBar.addEventListener('click', e => {
      const btn = e.target.closest('.clock-tab-btn');
      if (btn) switchTab(btn.dataset.tab);
    });

    if (fmtBtn) {
      fmtBtn.addEventListener('click', async () => {
        fmt24 = !fmt24;
        await saveClockPrefs({ format24: fmt24 });
        fmtBtn.textContent = fmt24 ? '24h' : '12h';
        renderAll();
      });
    }
    if (dateBtn) {
      dateBtn.addEventListener('click', async () => {
        showDate = !showDate;
        await saveClockPrefs({ showDate });
        dateBtn.textContent = showDate ? 'Date ✓' : 'Date';
        renderAll();
      });
    }
    if (secBtn) {
      secBtn.addEventListener('click', async () => {
        showSeconds = !showSeconds;
        await saveClockPrefs({ showSeconds });
        secBtn.textContent = showSeconds ? 'Sec ✓' : 'Sec';
        restartTick();
      });
    }

    // Add tab search
    if (addSearch) {
      addSearch.addEventListener('input', () => {
        renderAddList(addSearch.value.trim().toLowerCase());
      });
    }
    if (addList) {
      addList.addEventListener('click', async e => {
        const btn = e.target.closest('.clock-add-item');
        if (!btn) return;
        await addCity(btn.dataset.name, btn.dataset.country, btn.dataset.tz);
        renderAddList(addSearch?.value?.trim().toLowerCase() || '');
      });
    }

    // Delete from grid (event delegation on grid)
    if (grid) {
      grid.addEventListener('click', async e => {
        const del = e.target.closest('.clock-del');
        if (del) {
          const id = del.dataset.id;
          await removeCity(id);
        }
      });
    }

    // Render
    renderAll();
    switchTab('clocks');

    let _tickTimer = null;
    function restartTick() {
      if (_tickTimer) clearInterval(_tickTimer);
      const tickMs = showSeconds ? 1000 : 60000;
      _tickTimer = setInterval(renderAll, tickMs);
    }
    restartTick();

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) renderAll();
    });

    async function renderAll() {
      const cities = await loadClockCities();
      renderPills(cities);
      renderCards(cities);
    }

    function renderPills(cities) {
      if (!pillRow) return;
      pillRow.innerHTML = cities.map(c => {
        const day = isDayTime(c.tz);
        const icon = day ? '☀️' : '🌙';
        const t = formatTime(c.tz, fmt24);
        return `<span class="clock-pill" title="${escapeHtml(c.name)}, ${escapeHtml(c.country)}">
          <span class="clock-pill-icon">${icon}</span>
          <span class="clock-pill-time">${escapeHtml(t)}</span>
          <span class="clock-pill-name">${escapeHtml(c.label || c.name)}</span>
        </span>`;
      }).join('');
    }

    function renderCards(cities) {
      if (!grid) return;
      grid.innerHTML = cities.map(c => {
        const day = isDayTime(c.tz);
        const icon = day ? '☀️' : '🌙';
        const t = formatTime(c.tz, fmt24);
        const dt = formatDate(c.tz);
        const off = offsetText(c.tz);
        return `
          <div class="clock-card">
            <div class="clock-card-header">
              <span class="clock-card-icon">${icon}</span>
              <button class="clock-del" data-id="${escapeHtml(c.id)}" aria-label="Remove ${escapeHtml(c.name)}">✕</button>
            </div>
            <div class="clock-card-time">${escapeHtml(t)}</div>
            <div class="clock-card-name">${escapeHtml(c.label || c.name)}</div>
            <div class="clock-card-meta">
              <span>${escapeHtml(c.country)}</span>
              ${showDate ? `<span>${escapeHtml(dt)}</span>` : ''}
            </div>
            <div class="clock-card-offset">${escapeHtml(off)}</div>
          </div>`;
      }).join('');
    }

    async function renderAddList(q) {
      if (!addList) return;
      const cities = await loadClockCities();
      const added = new Set(cities.map(c => c.tz + '|' + c.name));
      let list = CITY_DB.filter(c => !added.has(c.tz + '|' + c.name));
      if (q) {
        list = list.filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q));
      }
      if (!list.length) {
        addList.innerHTML = '<div class="clock-add-empty">All matching cities already added.</div>';
        return;
      }
      addList.innerHTML = list.map(c => {
        const off = offsetText(c.tz);
        return `
          <button class="clock-add-item" data-name="${escapeHtml(c.name)}" data-country="${escapeHtml(c.country)}" data-tz="${escapeHtml(c.tz)}">
            <span class="clock-add-name">${escapeHtml(c.name)}</span>
            <span class="clock-add-country">${escapeHtml(c.country)}</span>
            <span class="clock-add-offset">${escapeHtml(off)}</span>
          </button>`;
      }).join('');
    }

    async function addCity(name, country, tz) {
      const cities = await loadClockCities();
      if (cities.length >= 8) { toastClock('Max 8 cities reached'); return; }
      if (cities.some(c => c.tz === tz && c.name === name)) { toastClock('City already added'); return; }
      const id = 'c_' + Date.now().toString(36);
      cities.push({ id, name, country, tz, label: name });
      await saveClockCities(cities);
      renderAll();
      toastClock(`Added ${name}`);
    }

    async function removeCity(id) {
      const cities = (await loadClockCities()).filter(c => c.id !== id);
      await saveClockCities(cities);
      renderAll();
      if (activeTab === 'add') renderAddList(addSearch?.value?.trim().toLowerCase() || '');
      toastClock('Removed city');
    }
  })();
}

function toastClock(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2500);
}
