const LS_KEY = 'ncc-weather';

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

export function initWeather() {
  const view = document.getElementById('view-weather');
  if (!view) return;
  const input = document.getElementById('weather-city');
  const search = document.getElementById('weather-search');
  const currentWrap = document.getElementById('weather-current');
  const forecastWrap = document.getElementById('weather-forecast');
  const cardIcon = document.getElementById('weather-card-icon');
  const cardCity = document.getElementById('weather-card-city');

  const data = loadData();
  if (data.city) {
    if (input) input.value = data.city;
    if (cardCity) cardCity.textContent = data.city;
    if (cardIcon && data.current) cardIcon.textContent = wmoIcon(data.current.code);
  }

  if (search) {
    search.addEventListener('click', () => fetchWeather(input?.value.trim() || 'New York'));
  }
  if (input) {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') fetchWeather(input.value.trim() || 'New York'); });
  }

  async function fetchWeather(city) {
    if (!currentWrap || !forecastWrap) return;
    currentWrap.innerHTML = '<div class="weather-loading">Loading…</div>';
    forecastWrap.innerHTML = '';
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      const geoJson = await geo.json();
      if (!geoJson.results || !geoJson.results[0]) {
        currentWrap.innerHTML = '<div class="weather-loading">City not found.</div>';
        return;
      }
      const { latitude, longitude, name } = geoJson.results[0];
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

      saveData({ city: name, current, forecast, updated: Date.now() });
      render(current, forecast, name);
      if (cardCity) cardCity.textContent = name;
      if (cardIcon) cardIcon.textContent = wmoIcon(current.code);
    } catch (err) {
      currentWrap.innerHTML = '<div class="weather-loading">Failed to load weather.</div>';
    }
  }

  function render(current, forecast, city) {
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

  if (data.current && data.city) {
    render(data.current, data.forecast || [], data.city);
  } else {
    fetchWeather('New York');
  }
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
