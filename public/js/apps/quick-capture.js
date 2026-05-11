import { toast } from '../app.js';
import { notify } from '../notifications.js';

/**
 * Quick Capture App — T-043-b
 * FAB + radial menu + capture modal with save logic for note / event / todo.
 * Voice memo placeholder for T-043-c.
 */

const MODAL_ID = 'capture-modal';
const FAB_ID = 'quick-capture-fab';
const MENU_ID = 'quick-capture-menu';

let menuOpen = false;
let modalOpen = false;
let currentMode = '';
let touchStartY = 0;
let touchStartTime = 0;

/* ── Bootstrap ── */
export function initQuickCapture() {
  wireFab();
  wireMenu();
  wireModal();
  wireKeyboard();
  wireSwipe();
}

/* ── FAB ── */
function wireFab() {
  const fab = document.getElementById(FAB_ID);
  if (!fab) return;
  fab.addEventListener('click', toggleMenu);
}

/* ── Radial Menu ── */
function wireMenu() {
  const menu = document.getElementById(MENU_ID);
  if (!menu) return;
  menu.querySelectorAll('.capture-satellite').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-capture-mode');
      if (mode) openCapture(mode);
      closeMenu();
    });
  });
}

function toggleMenu() {
  const fab = document.getElementById(FAB_ID);
  const menu = document.getElementById(MENU_ID);
  if (!fab || !menu) return;
  menuOpen = !menuOpen;
  fab.classList.toggle('open', menuOpen);
  fab.setAttribute('aria-expanded', String(menuOpen));
  menu.classList.toggle('open', menuOpen);
  menu.setAttribute('aria-hidden', String(!menuOpen));
}

function closeMenu() {
  const fab = document.getElementById(FAB_ID);
  const menu = document.getElementById(MENU_ID);
  if (!fab || !menu) return;
  menuOpen = false;
  fab.classList.remove('open');
  fab.setAttribute('aria-expanded', 'false');
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
}

/* ── Capture Modal ── */
function wireModal() {
  const modal = document.getElementById(MODAL_ID);
  const backdrop = document.getElementById('capture-modal-backdrop');
  const closeBtn = document.getElementById('capture-modal-close');
  const cancelBtn = document.getElementById('capture-modal-cancel');
  const saveBtn = document.getElementById('capture-save');

  if (!modal) return;

  if (backdrop) backdrop.addEventListener('click', closeCapture);
  if (closeBtn) closeBtn.addEventListener('click', closeCapture);
  if (cancelBtn) cancelBtn.addEventListener('click', closeCapture);
  if (saveBtn) saveBtn.addEventListener('click', doSave);
}

function openCapture(mode) {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  currentMode = mode;
  modalOpen = true;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  // Switch visible field group
  modal.querySelectorAll('[data-capture-group]').forEach(g => {
    g.style.display = (g.getAttribute('data-capture-group') === mode) ? 'flex' : 'none';
  });

  // Update header title
  const titleMap = { note: 'Quick Note', event: 'Quick Event', todo: 'Quick To-Do', voice: 'Voice Memo' };
  const titleEl = document.getElementById('capture-modal-title');
  if (titleEl) titleEl.textContent = titleMap[mode] || 'Capture';

  // Focus first visible input
  const firstInput = modal.querySelector(`[data-capture-group="${mode}"] input, [data-capture-group="${mode}"] textarea`);
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeCapture() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  modalOpen = false;
  currentMode = '';
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  // Clear inputs
  modal.querySelectorAll('input, textarea').forEach(el => { el.value = ''; });
  modal.querySelectorAll('select').forEach(el => { el.selectedIndex = 0; });
}

/* ── Save Logic ── */
function doSave(e) {
  e.preventDefault();
  if (!currentMode) return;

  if (currentMode === 'note') saveNote();
  else if (currentMode === 'event') saveEvent();
  else if (currentMode === 'todo') saveTodo();
  else if (currentMode === 'voice') {
    toast('Voice recording coming soon', 'info');
    closeCapture();
  }
}

/* Helpers */
function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function readArray(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function writeArray(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

/* Note */
function saveNote() {
  const title = document.getElementById('capture-note-title')?.value.trim() || 'Untitled';
  const body = document.getElementById('capture-note-body')?.value || '';
  if (!body && title === 'Untitled') {
    toast('Note is empty', 'error');
    return;
  }
  const notes = readArray('ncc-notes');
  notes.unshift({
    id: genId('n'),
    title,
    content: body,
    folder: '',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  writeArray('ncc-notes', notes);
  toast('Note saved');
  notify({ title: 'Note saved', body: title, app: 'notes', priority: 'normal' });
  closeCapture();
}

/* Event */
function saveEvent() {
  const title = document.getElementById('capture-event-title')?.value.trim() || '';
  const date = document.getElementById('capture-event-date')?.value || '';
  const time = document.getElementById('capture-event-time')?.value || '';
  const desc = document.getElementById('capture-event-desc')?.value.trim() || '';

  if (!title) { toast('Event title is required', 'error'); return; }
  if (!date) { toast('Event date is required', 'error'); return; }

  const events = readArray('ncc-calendar-events');
  events.push({
    id: genId('ev'),
    title,
    date,
    start: time,
    end: '',
    category: 'personal',
    recurrence: 'none',
    description: desc,
    updatedAt: Date.now(),
    lastModifiedAt: Date.now(),
  });
  writeArray('ncc-calendar-events', events);
  toast('Event saved');
  notify({ title: 'Event saved', body: title, app: 'calendar', priority: 'normal' });
  closeCapture();
}

/* Todo */
function saveTodo() {
  const text = document.getElementById('capture-todo-title')?.value.trim() || '';
  if (!text) { toast('Task text is required', 'error'); return; }

  const due = document.getElementById('capture-todo-due')?.value || '';
  const priority = document.getElementById('capture-todo-priority')?.value || 'medium';

  const tasks = readArray('ncc-todo');
  tasks.unshift({
    id: genId('t'),
    text,
    priority,
    due,
    completed: false,
    createdAt: Date.now(),
  });
  writeArray('ncc-todo', tasks);
  toast('Task added');
  notify({ title: 'Task added', body: text, app: 'todo', priority: 'normal' });
  closeCapture();
}

/* ── Keyboard Shortcuts ── */
function wireKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleMenu();
      return;
    }
    if (e.key === 'Escape' && modalOpen) {
      closeCapture();
      return;
    }
    if (e.key === 'Escape' && menuOpen) {
      closeMenu();
    }
  });
}

/* ── Mobile Swipe-Up ── */
function wireSwipe() {
  document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const y = e.changedTouches[0].clientY;
    const deltaY = y - touchStartY;
    const startedNearBottom = touchStartY > (window.innerHeight - 50);
    const isSwipeUp = deltaY < -60;
    if (startedNearBottom && isSwipeUp) {
      openCapture('note');
    }
  }, { passive: true });
}
