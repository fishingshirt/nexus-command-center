import { toast } from '../app.js';

// ===== CALENDAR APP =====
// Handles month view grid, event CRUD, and localStorage persistence.
// All events stored under key: ncc-calendar-events

const STORAGE_KEY = 'ncc-calendar-events';
const CATEGORY_COLORS = {
  personal: { bg: 'rgba(99,102,241,0.15)', text: '#6366f1' },
  work:     { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
  health:   { bg: 'rgba(236,72,153,0.15)', text: '#ec4899' },
  social:   { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  other:    { bg: 'rgba(100,116,139,0.15)', text: '#64748b' },
};

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
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

function saveEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  updateCalendarBadge();
}

function generateId() {
  return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

// ---- Badge ----
function updateCalendarBadge() {
  const events = loadEvents();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const count = events.filter(e => e.date === todayStr).length;
  const badge = document.getElementById('calendar-badge');
  if (badge) badge.textContent = count;
}

// ---- Grid Renderer ----
function renderCalendar() {
  const monthYearEl = document.getElementById('cal-month-year');
  const gridEl = document.getElementById('cal-grid');
  const events = loadEvents();

  monthYearEl.textContent = new Date(currentYear, currentMonth, 1)
    .toLocaleDateString(undefined, { year: 'numeric', month: 'long' });

  const firstOfMonth = new Date(currentYear, currentMonth, 1);
  const firstDayIndex = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startPrev = new Date(currentYear, currentMonth, 0).getDate();

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
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
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
      eventsHtml += `<div class="calendar-event-chip ${ev.category || 'other'}" style="background:${cat.bg};color:${cat.text}" title="${escapeHtml(ev.title)}">${escapeHtml(truncate(ev.title, 14))}</div>`;
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
  const totalCells = firstDayIndex + daysInMonth;
  const nextPadding = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= nextPadding; d++) {
    html += `<div class="calendar-day other-month" data-date=""><span class="calendar-day-num">${d}</span></div>`;
  }

  gridEl.innerHTML = html;

  // Day click
  gridEl.querySelectorAll('.calendar-day[data-date]').forEach(cell => {
    cell.addEventListener('click', () => openModal(cell.dataset.date));
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(cell.dataset.date);
      }
    });
  });

  renderLegend();
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
const elDesc = document.getElementById('event-desc');

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
    elDesc.value = ev.description || '';
  } else {
    modalTitle.textContent = 'New Event';
    modalForm.reset();
    elDate.value = dateStr;
    elId.value = '';
  }

  // Focus title after transition
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
  const events = loadEvents().filter(e => e.id !== editingEventId);
  saveEvents(events);
  closeModal();
  renderCalendar();
  toast('Event deleted');
}

function saveEvent(e) {
  e.preventDefault();
  const events = loadEvents();
  const payload = {
    id: editingEventId || generateId(),
    title: elTitle.value.trim(),
    date: elDate.value,
    start: elStart.value || '',
    end: elEnd.value || '',
    category: elCategory.value,
    description: elDesc.value.trim(),
    updatedAt: Date.now(),
  };

  if (editingEventId) {
    const idx = events.findIndex(e => e.id === editingEventId);
    if (idx !== -1) events[idx] = payload;
    else events.push(payload);
  } else {
    events.push(payload);
  }

  saveEvents(events);
  closeModal();
  renderCalendar();
  toast(editingEventId ? 'Event updated' : 'Event added');
}

// ---- Listeners ----
export function initCalendar() {
  // Nav
  document.getElementById('cal-prev').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });
  document.getElementById('cal-today').addEventListener('click', () => {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    renderCalendar();
    // Scroll to grid
    document.getElementById('cal-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('calendar-add-btn').addEventListener('click', () => {
    const today = new Date();
    const str = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    openModal(str);
  });

  // Modal
  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  modalDeleteBtn.addEventListener('click', deleteEvent);
  modalBackdrop.addEventListener('click', closeModal);
  modalForm.addEventListener('submit', saveEvent);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  updateCalendarBadge();
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
