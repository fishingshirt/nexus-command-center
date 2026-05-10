import { toast } from '../app.js';
import { syncEventToGoogle, deleteEventFromGoogle, flushOutboundQueue } from './gcal-outbound.js';
import { notify } from '../notifications.js';

// ===== CALENDAR APP =====
// Handles month/week/day views, event CRUD, and localStorage persistence.
// All events stored under key: ncc-calendar-events

const STORAGE_KEY = 'ncc-calendar-events';
const CATEGORY_COLORS = {
  personal: { bg: 'rgba(99,102,241,0.15)', text: '#6366f1' },
  work:     { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
  health:   { bg: 'rgba(236,72,153,0.15)', text: '#ec4899' },
  social:   { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  other:    { bg: 'rgba(100,116,139,0.15)', text: '#64748b' },
};

let anchorDate = new Date();
let currentView = 'month';
let selectedDate = null;
let editingEventId = null;

// ---- Storage ----
function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function getVisibleEvents(rangeStart, rangeEnd) {
  const raw = loadEvents();
  const visible = [];
  for (const ev of raw) {
    if (!ev.recurrence || ev.recurrence === 'none') {
      visible.push(ev);
      continue;
    }
    // Add the master event itself if it falls in range
    const evDate = new Date(ev.date + 'T00:00:00');
    if (evDate >= rangeStart && evDate <= rangeEnd) {
      visible.push(ev);
    }
    // Add generated occurrences
    const occs = getOccurrences(ev, rangeStart, rangeEnd);
    visible.push(...occs);
  }
  // Deduplicate by generated id
  const seen = new Set();
  return visible.filter(o => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

function getOccurrences(ev, rangeStart, rangeEnd) {
  const occurrences = [];
  const masterDate = new Date(ev.date + 'T00:00:00');
  const rule = ev.recurrence;
  const maxOccurrences = 366; // safety cap

  let cursor = new Date(masterDate);
  let count = 0;
  while (count < maxOccurrences) {
    if (cursor > rangeEnd) break;
    if (cursor >= rangeStart && cursor > masterDate) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      occurrences.push({
        ...ev,
        id: `${ev.id}_occ_${dateStr}`,
        masterId: ev.id,
        date: dateStr,
        isOccurrence: true,
      });
    }
    // Advance cursor
    if (rule === 'daily') {
      cursor.setDate(cursor.getDate() + 1);
    } else if (rule === 'weekly') {
      cursor.setDate(cursor.getDate() + 7);
    } else if (rule === 'monthly') {
      const day = masterDate.getDate();
      const nextMonth = cursor.getMonth() + 1;
      const year = cursor.getFullYear() + Math.floor(nextMonth / 12);
      const month = ((nextMonth % 12) + 12) % 12;
      cursor.setFullYear(year, month, 1);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      cursor.setDate(Math.min(day, daysInMonth));
    } else if (rule === 'yearly') {
      cursor.setFullYear(cursor.getFullYear() + 1);
    } else {
      break;
    }
    count++;
  }
  return occurrences;
}

function saveEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  updateCalendarBadge();
}

function generateId() {
  // Include a random suffix to reduce collision probability across fast successive calls
  return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

// ---- Badge ----
function updateCalendarBadge() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  // Use visible events for today so recurring events count
  const start = new Date(todayStr + 'T00:00:00');
  const end = new Date(todayStr + 'T23:59:59');
  const events = getVisibleEvents(start, end);
  const count = events.filter(e => e.date === todayStr).length;
  const badge = document.getElementById('calendar-badge');
  if (badge) badge.textContent = count;
}

// ---- View Switcher ----
function setView(view) {
  currentView = view;
  document.querySelectorAll('#calendar-view-switcher .view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  renderCalendar();
}

// ---- Render Dispatcher ----
function renderCalendar() {
  if (currentView === 'month') renderMonth();
  else if (currentView === 'week') renderWeek();
  else if (currentView === 'day') renderDay();
  renderLegend();
  updateConflictCount();
}

function conflictBadge(ev) {
  return ev.conflict ? '<span class="conflict-dot" aria-label="Conflict" title="Modified on both sides since last sync">●</span> ' : '';
}

function updateConflictCount() {
  const events = loadEvents();
  const count = events.filter(e => e.conflict).length;
  const el = document.getElementById('calendar-conflict-count');
  if (el) el.textContent = count ? `${count} conflict${count > 1 ? 's' : ''}` : '';
}

// ---- Month View ----
function renderMonth() {
  const monthYearEl = document.getElementById('cal-month-year');
  const gridEl = document.getElementById('cal-grid');

  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  monthYearEl.textContent = new Date(year, month, 1)
    .toLocaleDateString(undefined, { year: 'numeric', month: 'long' });

  const firstOfMonth = new Date(year, month, 1);
  const firstDayIndex = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPrev = new Date(year, month, 0).getDate();

  // Compute visible range for recurring events
  const prevPadding = firstDayIndex;
  const totalCells = firstDayIndex + daysInMonth;
  const nextPadding = (7 - (totalCells % 7)) % 7;
  const rangeStart = new Date(year, month, 1 - prevPadding);
  const rangeEnd = new Date(year, month + 1, nextPadding, 23, 59, 59);
  const events = getVisibleEvents(rangeStart, rangeEnd);

  let html = '';
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = startPrev - i;
    html += `<div class="calendar-day other-month" data-date=""><span class="calendar-day-num">${d}</span></div>`;
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const dayEvents = events
      .filter(e => e.date === dateStr)
      .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

    let eventsHtml = '<div class="calendar-events">';
    const maxChips = 2;
    const chips = dayEvents.slice(0, maxChips);
    const more = dayEvents.length - maxChips;

    chips.forEach(ev => {
      const cat = CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.other;
      const recCls = ev.recurrence && ev.recurrence !== 'none' ? 'recurring' : '';
      const cfl = conflictBadge(ev);
      eventsHtml += `<div class="calendar-event-chip ${ev.category || 'other'} ${recCls}" style="background:${cat.bg};color:${cat.text}" title="${escapeHtml(ev.title)}">${cfl}${recCls ? '↻ ' : ''}${escapeHtml(truncate(ev.title, 14))}</div>`;
    });
    if (more > 0) {
      eventsHtml += `<div class="calendar-more">+${more} more</div>`;
    }
    eventsHtml += '</div>';

    html += `<div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}" role="button" tabindex="0" aria-label="${d} ${monthYearEl.textContent}. ${dayEvents.length} events.">
      <span class="calendar-day-num">${d}</span>
      ${eventsHtml}
    </div>`;
  }

  // Next month trailing days
  for (let d = 1; d <= nextPadding; d++) {
    html += `<div class="calendar-day other-month" data-date=""><span class="calendar-day-num">${d}</span></div>`;
  }

  gridEl.innerHTML = html;
  attachDayClicks(gridEl);
}

// ---- Week View ----
function renderWeek() {
  const monthYearEl = document.getElementById('cal-month-year');
  const gridEl = document.getElementById('cal-grid');

  const weekStart = new Date(anchorDate);
  weekStart.setDate(anchorDate.getDate() - anchorDate.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const fmt = { month: 'short', day: 'numeric' };
  monthYearEl.textContent = `${weekStart.toLocaleDateString(undefined, fmt)} – ${weekEnd.toLocaleDateString(undefined, fmt)}`;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const rangeEnd = new Date(weekEnd);
  rangeEnd.setHours(23,59,59,999);
  const events = getVisibleEvents(weekStart, rangeEnd);

  let headerHtml = '';
  let bodyHtml = '';

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const dayEvents = events
      .filter(e => e.date === dateStr)
      .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

    headerHtml += `<div class="calendar-week-header-cell ${isToday ? 'today' : ''}">
      <span>${dayNames[i]}</span>
      <span class="wk-day-num">${d.getDate()}</span>
    </div>`;

    let evHtml = '';
    dayEvents.forEach(ev => {
      const cat = CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.other;
      const cfl = conflictBadge(ev);
      evHtml += `<div class="calendar-week-event ${ev.category || 'other'}" style="background:${cat.bg};color:${cat.text}" data-id="${ev.id}">${cfl}${escapeHtml(truncate(ev.title, 28))}</div>`;
    });

    bodyHtml += `<div class="day-column ${isToday ? 'today' : ''}" data-date="${dateStr}">${evHtml}</div>`;
  }

  gridEl.innerHTML = `<div class="calendar-week">${headerHtml}${bodyHtml}</div>`;
  attachDayClicks(gridEl);
}

// ---- Day View ----
function renderDay() {
  const monthYearEl = document.getElementById('cal-month-year');
  const gridEl = document.getElementById('cal-grid');

  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const day = anchorDate.getDate();
  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const isToday = dateStr === todayStr;

  monthYearEl.textContent = anchorDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const start = new Date(dateStr + 'T00:00:00');
  const end = new Date(dateStr + 'T23:59:59');
  const events = getVisibleEvents(start, end);

  const dayEvents = events
    .filter(e => e.date === dateStr)
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  const untimed = dayEvents.filter(e => !e.start);
  const timed = dayEvents.filter(e => e.start);

  let timelineHtml = '';
  for (let h = 0; h < 24; h++) {
    const hourLabel = String(h).padStart(2, '0') + ':00';
    const slotEvents = timed.filter(e => {
      if (!e.start) return false;
      const eh = parseInt(e.start.split(':')[0], 10);
      return eh === h;
    });
    let slotContent = '';
    if (slotEvents.length) {
      slotEvents.forEach(ev => {
        const cat = CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.other;
        const cfl = conflictBadge(ev);
        slotContent += `<div class="calendar-day-event ${ev.category || 'other'}" style="background:${cat.bg};color:${cat.text}" data-id="${ev.id}">${cfl}${escapeHtml(ev.title)} ${ev.start ? `<small>${ev.start}${ev.end ? '–'+ev.end : ''}</small>` : ''}</div>`;
      });
    }
    timelineHtml += `<div class="time-slot">
      <div class="slot-time">${hourLabel}</div>
      <div class="slot-content">${slotContent}</div>
    </div>`;
  }

  let untimedHtml = '';
  if (untimed.length) {
    untimedHtml = `<div style="padding:var(--space-2) var(--space-4);border-bottom:1px solid var(--border);background:var(--bg);">
      <span style="font-size:var(--font-size-xs);color:var(--text-muted);font-weight:600;">ALL-DAY / UNTIMED</span>
      <div style="margin-top:var(--space-1);">
        ${untimed.map(ev => {
          const cat = CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.other;
          const cfl = conflictBadge(ev);
          return `<span class="calendar-day-event ${ev.category || 'other'}" style="display:inline-block;margin-right:4px;background:${cat.bg};color:${cat.text}" data-id="${ev.id}">${cfl}${escapeHtml(ev.title)}</span>`;
        }).join('')}
      </div>
    </div>`;
  }

  const noMsg = (!timed.length && !untimed.length) ? '<div class="no-events-msg">No events today</div>' : '';

  gridEl.innerHTML = `<div class="calendar-day-view">
    <div class="calendar-day-view-header">
      <h3>${anchorDate.toLocaleDateString(undefined, { weekday: 'long' })}</h3>
      <div class="day-sub">${anchorDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} ${isToday ? '• Today' : ''}</div>
    </div>
    ${untimedHtml}
    <div class="calendar-day-timeline">${timelineHtml}</div>
    ${noMsg}
  </div>`;
  attachDayClicks(gridEl);
}

// ---- Helper: attach clicks to day cells or event chips ----
function attachDayClicks(container) {
  container.querySelectorAll('[data-date]').forEach(cell => {
    const date = cell.dataset.date;
    if (!date) return;
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.calendar-event-chip, .calendar-week-event, .calendar-day-event')) return;
      openModal(date);
    });
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(date);
      }
    });
  });
  container.querySelectorAll('.calendar-event-chip, .calendar-week-event, .calendar-day-event').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = chip.dataset.id;
      if (!id) return;
      if (chip.querySelector('.conflict-dot')) {
        openConflictPanel(chip.closest('[data-date]')?.dataset.date, id);
        return;
      }
      openModal(chip.closest('[data-date]')?.dataset.date, id);
    });
  });
}

function renderLegend() {
  const legend = document.getElementById('cal-legend');
  const cats = [
    { key: 'personal', label: 'Personal', color: '#6366f1' },
    { key: 'work',     label: 'Work',     color: '#10b981' },
    { key: 'health',   label: 'Health',   color: '#ec4899' },
    { key: 'social',   label: 'Social',   color: '#f59e0b' },
    { key: 'other',    label: 'Other',    color: '#64748b' },
  ];
  legend.innerHTML = cats.map(c => `
    <div class="calendar-legend-item">
      <span class="calendar-legend-dot ${c.key}" style="background:${c.color}"></span>
      <span>${c.label}</span>
    </div>
  `).join('');
}

// ---- Modal ----
const modal = document.getElementById('event-modal');
const modalBackdrop = document.getElementById('event-modal-backdrop');
const modalCloseBtn = document.getElementById('event-modal-close');
const modalCancelBtn = document.getElementById('event-cancel');
const modalDeleteBtn = document.getElementById('event-delete');
const modalForm = document.getElementById('event-form');
const modalTitle = document.getElementById('event-modal-title');

const elId = document.getElementById('event-id');
const elTitle = document.getElementById('event-title');
const elDate = document.getElementById('event-date');
const elStart = document.getElementById('event-start');
const elEnd = document.getElementById('event-end');
const elCategory = document.getElementById('event-category');
const elRecurrence = document.getElementById('event-recurrence');
const elDesc = document.getElementById('event-desc');

// Conflict panel elements
let conflictEventId = null;
const conflictPanel = document.getElementById('conflict-panel');
const conflictBackdrop = document.getElementById('conflict-panel-backdrop');
const conflictPanelCloseBtn = document.getElementById('conflict-panel-close');
const conflictBtnMine = document.getElementById('conflict-use-mine');
const conflictBtnGoogle = document.getElementById('conflict-use-google');

function openModal(dateStr, eventId = null) {
  selectedDate = dateStr;
  editingEventId = eventId;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  modal.dataset.mode = eventId ? 'edit' : 'new';

  if (eventId) {
    const ev = loadEvents().find(e => e.id === eventId);
    modalTitle.textContent = 'Edit Event';
    elId.value = ev.id;
    elTitle.value = ev.title || '';
    elDate.value = ev.date;
    elStart.value = ev.start || '';
    elEnd.value = ev.end || '';
    elCategory.value = ev.category || 'other';
    elRecurrence.value = ev.recurrence || 'none';
    elDesc.value = ev.description || '';
  } else {
    modalTitle.textContent = 'New Event';
    modalForm.reset();
    elDate.value = dateStr;
    elId.value = '';
  }

  setTimeout(() => elTitle.focus(), 50);
}

function closeModal() {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  editingEventId = null;
  selectedDate = null;
}

function deleteEvent() {
  if (!editingEventId) return;
  if (!confirm('Delete this event?')) return;
  const events = loadEvents();
  const ev = events.find(e => e.id === editingEventId);
  const evTitle = ev?.title || 'Untitled event';
  deleteEventFromGoogle(ev?.gcalId).catch(() => {});
  const filtered = events.filter(e => e.id !== editingEventId);
  saveEvents(filtered);
  closeModal();
  renderCalendar();
  toast('Event deleted');
  notify({ title: 'Event deleted', body: evTitle, app: 'calendar', priority: 'low' });
}

async function saveEvent(e) {
  e.preventDefault();
  const events = loadEvents();
  const payload = {
    id: editingEventId || generateId(),
    title: elTitle.value.trim(),
    date: elDate.value,
    start: elStart.value || '',
    end: elEnd.value || '',
    category: elCategory.value,
    recurrence: elRecurrence.value || 'none',
    description: elDesc.value.trim(),
    updatedAt: Date.now(),
    lastModifiedAt: Date.now(),
  };

  let action = 'create';
  if (editingEventId) {
    const idx = events.findIndex(e => e.id === editingEventId);
    if (idx !== -1) {
      payload.gcalId = events[idx].gcalId; // preserve mapping
      payload.lastSyncedAt = events[idx].lastSyncedAt;
      payload.lastModifiedAt = Date.now();
      payload.conflict = events[idx].conflict;
      events[idx] = payload;
      action = payload.gcalId ? 'update' : 'create';
    } else {
      events.push(payload);
    }
  } else {
    events.push(payload);
  }

  saveEvents(events);
  closeModal();
  renderCalendar();
  toast(editingEventId ? 'Event updated' : 'Event added');
  notify({
    title: editingEventId ? 'Event updated' : 'Event added',
    body: payload.title || 'Untitled event',
    app: 'calendar',
    priority: 'normal'
  });

  // Background outbound sync — don't block UI
  const result = await syncEventToGoogle(payload, action);
  if (result.ok && !result.skipped && !result.queued) {
    const fresh = loadEvents();
    const ev = fresh.find(e => e.id === payload.id);
    if (ev) {
      if (result.gcalId && !ev.gcalId) ev.gcalId = result.gcalId;
      ev.lastSyncedAt = Date.now();
      ev.conflict = false;
      saveEvents(fresh);
    }
  }
}

// ---- Listeners ----
export function initCalendar() {
  // Nav
  document.getElementById('cal-prev').addEventListener('click', () => {
    navigate(-1);
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    navigate(1);
  });
  document.getElementById('cal-today').addEventListener('click', () => {
    anchorDate = new Date();
    renderCalendar();
  });

  document.getElementById('calendar-add-btn').addEventListener('click', () => {
    const today = new Date();
    const str = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    openModal(str);
  });

  // View switcher
  document.querySelectorAll('#calendar-view-switcher .view-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  // Modal
  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  modalDeleteBtn.addEventListener('click', deleteEvent);
  modalBackdrop.addEventListener('click', closeModal);
  modalForm.addEventListener('submit', saveEvent);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    if (e.key === 'Escape' && conflictPanel.classList.contains('active')) closeConflictPanel();
  });

  // Conflict panel listeners
  conflictPanelCloseBtn.addEventListener('click', closeConflictPanel);
  conflictBackdrop.addEventListener('click', closeConflictPanel);
  conflictBtnMine.addEventListener('click', resolveKeepMine);
  conflictBtnGoogle.addEventListener('click', resolveUseGoogle);

  updateCalendarBadge();
  renderCalendar();
  _checkCalendarReminders();
  window.__calendarReminderTimer = setInterval(_checkCalendarReminders, 60 * 60 * 1000);
  window.addEventListener('beforeunload', () => {
    if (window.__calendarReminderTimer) { clearInterval(window.__calendarReminderTimer); window.__calendarReminderTimer = null; }
  });

  // Re-render when external sync merges events
  window.addEventListener('ncc-cal-updated', () => {
    renderCalendar();
    updateCalendarBadge();
  });
}

function _checkCalendarReminders() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const events = loadEvents();
  let pushed = 0;
  for (const ev of events) {
    if (ev.date !== todayStr || ev._notifiedReminder) continue;
    if (!ev.start) {
      notify({ title: 'Event today', body: ev.title, app: 'calendar', priority: 'normal' });
      ev._notifiedReminder = true; pushed++;
    } else {
      const [hh, mm] = ev.start.split(':');
      const evTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hh||0,10), parseInt(mm||0,10));
      const diffMin = Math.floor((evTime - now) / 60000);
      if (diffMin > 0 && diffMin <= 15) {
        notify({ title: 'Upcoming event', body: `${ev.title} at ${ev.start}`, app: 'calendar', priority: 'high' });
        ev._notifiedReminder = true; pushed++;
      }
    }
    if (pushed >= 5) break; // limit per check
  }
  if (pushed) saveEvents(events);
}

async function openConflictPanel(dateStr, eventId) {
  conflictEventId = eventId;
  const events = loadEvents();
  const ev = events.find(e => e.id === eventId);
  if (!ev || !ev.conflict) return;
  document.getElementById('conflict-local-title').textContent = ev.title || '(no title)';
  document.getElementById('conflict-local-date').textContent = ev.date || '—';
  document.getElementById('conflict-local-time').textContent = (ev.start ? `${ev.start}${ev.end ? '–' + ev.end : ''}` : '-') || '—';
  document.getElementById('conflict-local-desc').textContent = ev.description || '—';
  // Reset remote column
  document.getElementById('conflict-remote-title').textContent = 'Loading…';
  document.getElementById('conflict-remote-date').textContent = '—';
  document.getElementById('conflict-remote-time').textContent = '—';
  document.getElementById('conflict-remote-desc').textContent = '—';
  conflictPanel.classList.add('active');
  conflictPanel.setAttribute('aria-hidden', 'false');
  // Fetch fresh remote version
  if (ev.gcalId) {
    try {
      const res = await fetch(`/api/calendar/events/${encodeURIComponent(ev.gcalId)}`);
      const data = await res.json();
      if (data.summary !== undefined) {
        document.getElementById('conflict-remote-title').textContent = data.summary || '(no title)';
        const startD = data.start?.date || data.start?.dateTime?.slice(0,10) || '—';
        const endD = data.end?.date || data.end?.dateTime?.slice(0,10) || '—';
        document.getElementById('conflict-remote-date').textContent = (startD === endD) ? startD : `${startD} – ${endD}`;
        const startT = data.start?.dateTime?.slice(11,16) || '';
        const endT = data.end?.dateTime?.slice(11,16) || '';
        document.getElementById('conflict-remote-time').textContent = (startT ? `${startT}${endT ? '–' + endT : ''}` : '—');
        document.getElementById('conflict-remote-desc').textContent = data.description || '—';
      } else {
        document.getElementById('conflict-remote-title').textContent = data.error ? 'Error loading' : 'Not found';
      }
    } catch (e) {
      document.getElementById('conflict-remote-title').textContent = 'Unavailable';
    }
  } else {
    document.getElementById('conflict-remote-title').textContent = 'No Google mapping';
  }
}

function closeConflictPanel() {
  conflictPanel.classList.remove('active');
  conflictPanel.setAttribute('aria-hidden', 'true');
  conflictEventId = null;
}

async function resolveKeepMine() {
  if (!conflictEventId) return;
  const events = loadEvents();
  const ev = events.find(e => e.id === conflictEventId);
  if (!ev) { closeConflictPanel(); return; }
  // Patch remote with local data
  if (ev.gcalId) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const body = {
        summary: ev.title,
        description: ev.description || '',
        start: ev.start
          ? { dateTime: `${ev.date}T${ev.start}:00`, timeZone: tz }
          : { date: ev.date },
        end: ev.end
          ? { dateTime: `${ev.date}T${ev.end}:00`, timeZone: tz }
          : { date: ev.date },
      };
      await fetch(`/api/calendar/events/${encodeURIComponent(ev.gcalId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      toast('Could not update Google Calendar — will retry later.', 'warning');
    }
  }
  ev.conflict = false;
  ev.lastSyncedAt = Date.now();
  saveEvents(events);
  closeConflictPanel();
  renderCalendar();
  toast('Conflict resolved: kept local version');
}

async function resolveUseGoogle() {
  if (!conflictEventId) return;
  const events = loadEvents();
  const ev = events.find(e => e.id === conflictEventId);
  if (!ev) { closeConflictPanel(); return; }
  // Fetch fresh remote data again
  if (ev.gcalId) {
    try {
      const res = await fetch(`/api/calendar/events/${encodeURIComponent(ev.gcalId)}`);
      if (res.ok) {
        const data = await res.json();
        ev.title = data.summary || ev.title;
        ev.description = data.description || '';
        const s = data.start?.date || data.start?.dateTime?.slice(0,10);
        const eD = data.end?.date || data.end?.dateTime?.slice(0,10);
        if (s) ev.date = s;
        ev.start = data.start?.dateTime?.slice(11,16) || '';
        ev.end = data.end?.dateTime?.slice(11,16) || '';
      }
    } catch (e) {
      toast('Could not fetch Google version.', 'warning');
    }
  }
  ev.conflict = false;
  ev.lastSyncedAt = Date.now();
  saveEvents(events);
  closeConflictPanel();
  renderCalendar();
  toast('Conflict resolved: used Google version');
}

function navigate(dir) {
  if (currentView === 'month') {
    anchorDate.setMonth(anchorDate.getMonth() + dir);
  } else if (currentView === 'week') {
    anchorDate.setDate(anchorDate.getDate() + dir * 7);
  } else if (currentView === 'day') {
    anchorDate.setDate(anchorDate.getDate() + dir);
  }
  renderCalendar();
}

// ---- Utilities ----
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}
