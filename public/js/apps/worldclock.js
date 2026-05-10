const LS_KEY = 'ncc-worldclock';

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

function loadData() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function saveData(patch) {
  const d = loadData();
  localStorage.setItem(LS_KEY, JSON.stringify({ ...d, ...patch }));
}
function ensureDefault() {
  const d = loadData();
  if (!d.cities) {
    d.cities = [
      { id: 'ny', name: 'New York', country: 'USA', tz: 'America/New_York', label: 'NYC' },
      { id: 'ldn', name: 'London', country: 'UK', tz: 'Europe/London', label: 'London' },
      { id: 'tyo', name: 'Tokyo', country: 'Japan', tz: 'Asia/Tokyo', label: 'Tokyo' },
      { id: 'dxb', name: 'Dubai', country: 'UAE', tz: 'Asia/Dubai', label: 'Dubai' }
    ];
    saveData(d);
  }
  return d;
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

export function initWorldClock() {
  const data = ensureDefault();
  const fmt24 = data.format24 === true;
  const showDate = data.showDate !== false;
  const showSeconds = data.showSeconds === true;

  const pillRow = document.getElementById('clock-pill-row');
  const viewBody = document.querySelector('.worldclock-view-body');
  const search = document.getElementById('clock-search');
  const results = document.getElementById('clock-results');
  const fmtBtn = document.getElementById('clock-fmt-btn');
  const dateBtn = document.getElementById('clock-date-btn');
  const secBtn = document.getElementById('clock-sec-btn');

  // Settings buttons
  if (fmtBtn) {
    fmtBtn.textContent = fmt24 ? '24h' : '12h';
    fmtBtn.addEventListener('click', () => { saveData({ format24: !fmt24 }); refresh(); });
  }
  if (dateBtn) {
    dateBtn.textContent = showDate ? 'Date ✓' : 'Date';
    dateBtn.addEventListener('click', () => { saveData({ showDate: !showDate }); refresh(); });
  }
  if (secBtn) {
    secBtn.textContent = showSeconds ? 'Sec ✓' : 'Sec';
    secBtn.addEventListener('click', () => { saveData({ showSeconds: !showSeconds }); refresh(); });
  }

  // Initial render
  renderAll();

  // Search
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      if (!q) { results.innerHTML = ''; results.style.display = 'none'; return; }
      const matches = CITY_DB.filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)).slice(0, 8);
      results.innerHTML = matches.map(c => `
        <button class="clock-result-item" data-name="${escapeHtml(c.name)}" data-country="${escapeHtml(c.country)}" data-tz="${escapeHtml(c.tz)}">
          <span class="clock-result-name">${escapeHtml(c.name)}</span>
          <span class="clock-result-country">${escapeHtml(c.country)}</span>
        </button>`).join('');
      results.style.display = matches.length ? 'block' : 'none';
    });
    results.addEventListener('click', e => {
      const btn = e.target.closest('.clock-result-item');
      if (!btn) return;
      addCity(btn.dataset.name, btn.dataset.country, btn.dataset.tz);
      search.value = '';
      results.innerHTML = '';
      results.style.display = 'none';
    });
  }

  // Delegate delete from view body
  if (viewBody) {
    viewBody.addEventListener('click', e => {
      const del = e.target.closest('.clock-del');
      if (del) {
        const id = del.dataset.id;
        const d = loadData();
        d.cities = (d.cities || []).filter(c => c.id !== id);
        saveData(d);
        renderAll();
      }
    });
  }

  // Tick every minute (or every second if showSeconds)
  const tickMs = showSeconds ? 1000 : 60000;
  const timer = setInterval(renderAll, tickMs);

  // Cleanup on page hide if needed (SPA doesn't destroy, but good citizen)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderAll();
  });

  function refresh() {
    // re-read stored prefs
    initWorldClock();
  }

  function renderAll() {
    const d = loadData();
    const cities = d.cities || [];
    renderPills(cities);
    renderCards(cities);
  }

  function renderPills(cities) {
    if (!pillRow) return;
    pillRow.innerHTML = cities.map(c => {
      const day = isDayTime(c.tz);
      const icon = day ? '☀️' : '🌙';
      const t = formatTime(c.tz, loadData().format24 === true);
      return `<span class="clock-pill" title="${escapeHtml(c.name)}, ${escapeHtml(c.country)}">
        <span class="clock-pill-icon">${icon}</span>
        <span class="clock-pill-time">${escapeHtml(t)}</span>
        <span class="clock-pill-name">${escapeHtml(c.label || c.name)}</span>
      </span>`;
    }).join('');
  }

  function renderCards(cities) {
    if (!viewBody) return;
    // Keep the search section, only replace the grid part
    const grid = viewBody.querySelector('.clock-grid');
    if (!grid) return;
    grid.innerHTML = cities.map(c => {
      const day = isDayTime(c.tz);
      const icon = day ? '☀️' : '🌙';
      const t = formatTime(c.tz, loadData().format24 === true);
      const dt = formatDate(c.tz);
      const off = offsetText(c.tz);
      const d = loadData();
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
            ${d.showDate !== false ? `<span>${escapeHtml(dt)}</span>` : ''}
          </div>
          <div class="clock-card-offset">${escapeHtml(off)}</div>
        </div>`;
    }).join('');
  }

  function addCity(name, country, tz) {
    const d = loadData();
    const cities = d.cities || [];
    if (cities.length >= 8) {
      toastClock('Max 8 cities reached');
      return;
    }
    if (cities.some(c => c.tz === tz && c.name === name)) {
      toastClock('City already added');
      return;
    }
    const id = 'c_' + Date.now().toString(36);
    cities.push({ id, name, country, tz, label: name });
    saveData({ cities });
    renderAll();
    toastClock(`Added ${name}`);
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
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
