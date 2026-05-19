// public/js/widgets/factories.js
// Real widget factories — thin wrappers around existing app stores

import { getWeatherWidgetData } from '../apps/weather.js';
import { getCalendarWidgetData } from '../apps/calendar.js';
import { getTodoWidgetData } from '../apps/todo.js';

function esc(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

export function weatherWidget(config = {}) {
  const el = document.createElement('div');
  el.className = 'widget-metric';
  el.dataset.widgetType = 'weather';
  const data = getWeatherWidgetData();
  if (!data) {
    el.innerHTML = '<span class="widget-placeholder">No weather data</span>';
    return el;
  }
  el.innerHTML = `
    <span class="widget-metric__value">${data.temp !== undefined ? Math.round(data.temp) : '--'}°</span>
    <span class="widget-metric__label">${esc(data.city)} ${data.icon || '🌤️'}</span>
  `;
  return el;
}

export function calendarTodayWidget(config = {}) {
  const el = document.createElement('div');
  el.className = 'widget-metric';
  el.dataset.widgetType = 'calendar-today';
  const data = getCalendarWidgetData();
  if (!data) {
    el.innerHTML = '<span class="widget-placeholder">No events</span>';
    return el;
  }
  const listHtml = data.events.length
    ? `<ul class="widget-list">${data.events.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '';
  el.innerHTML = `
    <span class="widget-metric__value">${data.count}</span>
    <span class="widget-metric__label">Events today</span>
    ${listHtml}
  `;
  return el;
}

export function todoCountWidget(config = {}) {
  const el = document.createElement('div');
  el.className = 'widget-metric';
  el.dataset.widgetType = 'todo-count';
  const data = getTodoWidgetData();
  if (!data) {
    el.innerHTML = '<span class="widget-placeholder">No tasks</span>';
    return el;
  }
  const listHtml = data.topThree.length
    ? `<ul class="widget-list">${data.topThree.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '';
  el.innerHTML = `
    <span class="widget-metric__value">${data.count}</span>
    <span class="widget-metric__label">Pending tasks</span>
    ${listHtml}
  `;
  return el;
}

export function agentStatsWidget(config = {}) {
  const el = document.createElement('div');
  el.className = 'widget-metric';
  el.dataset.widgetType = 'agent-stats';
  el.innerHTML = '<span class="widget-placeholder">Agent ready</span>';
  (async () => {
    try {
      const r = await fetch('/api/whiteboard/live');
      const data = await r.json();
      const pending = data.pending_tasks ?? 0;
      const total = data.total_tasks ?? 0;
      el.innerHTML = `
        <span class="widget-metric__value">${pending}</span>
        <span class="widget-metric__label">Active tasks · ${total} total</span>
      `;
    } catch {
      el.innerHTML = '<span class="widget-placeholder">Agent ready</span>';
    }
  })();
  return el;
}

export function registerWidgetFactories(gridOrRegistry) {
  const reg = gridOrRegistry;
  if (typeof reg.registerWidget === 'function') {
    reg.registerWidget('weather', (body) => body.appendChild(weatherWidget()));
    reg.registerWidget('calendar-today', (body) => body.appendChild(calendarTodayWidget()));
    reg.registerWidget('todo-count', (body) => body.appendChild(todoCountWidget()));
    reg.registerWidget('agent-stats', (body) => body.appendChild(agentStatsWidget()));
  } else if (typeof window.widgetRegistry !== 'undefined') {
    window.widgetRegistry.registerWidget('weather', (body) => body.appendChild(weatherWidget()));
    window.widgetRegistry.registerWidget('calendar-today', (body) => body.appendChild(calendarTodayWidget()));
    window.widgetRegistry.registerWidget('todo-count', (body) => body.appendChild(todoCountWidget()));
    window.widgetRegistry.registerWidget('agent-stats', (body) => body.appendChild(agentStatsWidget()));
  }
}
