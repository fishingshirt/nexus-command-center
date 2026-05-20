/** Pomodoro / Focus Mode App */
const LS_KEY = 'ncc-pomodoro';
const LS_SESSIONS = 'ncc-pomodoro-sessions';
import { storage } from '../lib/storage-adapter.js';

const MODES = {
  pomodoro: { min: 25, label: 'Focus', sub: 'Stay on task' },
  short:    { min: 5,  label: 'Short Break', sub: 'Step away for a moment' },
  long:     { min: 15, label: 'Long Break', sub: 'Recharge properly' },
  custom:   { min: 25, label: 'Custom', sub: 'Set your own duration' }
};

let _timer = null;
let _state = { mode: 'pomodoro', running: false, paused: false, secondsLeft: 1500, totalSeconds: 1500, startTime: null };

function loadData() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveData(patch) {
  const merged = { ...loadData(), ...patch };
  localStorage.setItem(LS_KEY, JSON.stringify(merged));
  storage.write('pomodoro', merged).catch(() => {});
}
function loadSessions() {
  try { return JSON.parse(localStorage.getItem(LS_SESSIONS) || '[]'); } catch { return []; }
}
function saveSessions(sessions) {
  localStorage.setItem(LS_SESSIONS, JSON.stringify(sessions));
}

export function initPomodoro() {
  const saved = loadData();
  _state.mode = saved.mode || 'pomodoro';
  setMode(_state.mode, false);

  // Tabs
  document.querySelectorAll('.pomodoro-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (_state.running) { toast('Stop timer before switching modes'); return; }
      setMode(btn.dataset.mode);
    });
  });

  // Controls
  document.getElementById('pomodoro-play')?.addEventListener('click', startTimer);
  document.getElementById('pomodoro-pause')?.addEventListener('click', pauseTimer);
  document.getElementById('pomodoro-reset')?.addEventListener('click', resetTimer);
  document.getElementById('pomodoro-skip')?.addEventListener('click', skipSession);
  document.getElementById('pomodoro-fullscreen-btn')?.addEventListener('click', enterFocusOverlay);
  document.getElementById('pomodoro-overlay-exit')?.addEventListener('click', exitFocusOverlay);
  document.getElementById('pomodoro-overlay-backdrop')?.addEventListener('click', exitFocusOverlay);

  // Custom min
  document.getElementById('pomodoro-custom-min')?.addEventListener('change', () => {
    if (_state.mode === 'custom') {
      const mins = parseInt(document.getElementById('pomodoro-custom-min').value, 10) || 25;
      setDuration(mins * 60);
    }
  });

  populateTaskSelect();
  updateStats();
  renderHistory();
}

function setMode(mode, save = true) {
  _state.mode = mode;
  const cfg = MODES[mode];
  document.querySelectorAll('.pomodoro-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('pomodoro-custom-row').style.display = mode === 'custom' ? 'block' : 'none';
  const mins = mode === 'custom' ? (parseInt(document.getElementById('pomodoro-custom-min')?.value, 10) || 25) : cfg.min;
  setDuration(mins * 60);
  setLabel(cfg.label, cfg.sub);
  if (save) saveData({ mode });
}

function setDuration(seconds) {
  _state.totalSeconds = seconds;
  _state.secondsLeft = seconds;
  if (!_state.running) updateDisplay();
}

function setLabel(main, sub) {
  const label = document.getElementById('pomodoro-timer-label');
  if (label) label.innerHTML = `<strong>${esc(main)}</strong><br><span style="opacity:.8;font-size:.85rem">${esc(sub)}</span>`;
}

function updateDisplay() {
  const m = Math.floor(_state.secondsLeft / 60).toString().padStart(2, '0');
  const s = (_state.secondsLeft % 60).toString().padStart(2, '0');
  const text = `${m}:${s}`;
  const el = document.getElementById('pomodoro-timer-text');
  if (el) el.textContent = text;
  const overlay = document.getElementById('pomodoro-overlay-timer');
  if (overlay) overlay.textContent = text;

  // Ring progress
  const pct = _state.totalSeconds > 0 ? (_state.totalSeconds - _state.secondsLeft) / _state.totalSeconds : 0;
  const ring = document.getElementById('pomodoro-ring-progress');
  if (ring) {
    const circumference = 2 * Math.PI * 54;
    ring.style.strokeDasharray = `${circumference}`;
    ring.style.strokeDashoffset = `${circumference * (1 - pct)}`;
  }
}

function startTimer() {
  if (_state.running) return;
  if (_state.paused) {
    _state.running = true;
    _state.paused = false;
  } else {
    _state.running = true;
    _state.paused = false;
    _state.startTime = Date.now();
  }
  document.getElementById('pomodoro-play').style.display = 'none';
  document.getElementById('pomodoro-pause').style.display = 'inline-flex';
  setLabel(MODES[_state.mode].label, _state.mode === 'pomodoro' ? 'Stay on task' : 'Relax and breathe');

  tick(); // immediate
  _timer = setInterval(tick, 1000);
}

function tick() {
  if (!_state.running) return;
  if (_state.secondsLeft > 0) {
    _state.secondsLeft--;
    updateDisplay();
    return;
  }
  // Finished
  finishSession();
}

function pauseTimer() {
  _state.running = false;
  _state.paused = true;
  clearInterval(_timer);
  setLabel(MODES[_state.mode].label, 'Paused');
  document.getElementById('pomodoro-play').style.display = 'inline-flex';
  document.getElementById('pomodoro-pause').style.display = 'none';
}

function resetTimer() {
  stopAndClear();
  setMode(_state.mode, false);
}

function skipSession() {
  stopAndClear();
  toast('Session skipped');
}

function stopAndClear() {
  _state.running = false;
  _state.paused = false;
  clearInterval(_timer);
  document.getElementById('pomodoro-play').style.display = 'inline-flex';
  document.getElementById('pomodoro-pause').style.display = 'none';
}

function finishSession() {
  stopAndClear();
  playChime();
  toast(`${MODES[_state.mode].label} complete`);

  // Log session
  if (_state.mode === 'pomodoro') {
    const sessions = loadSessions();
    const taskSel = document.getElementById('pomodoro-task-select');
    sessions.unshift({
      mode: _state.mode,
      duration: _state.totalSeconds,
      task: taskSel?.value || '',
      time: new Date().toISOString()
    });
    saveSessions(sessions.slice(0, 300));
    updateStats();
    renderHistory();
  }

  // Auto-suggest break after pomodoro
  if (_state.mode === 'pomodoro') {
    setTimeout(() => {
      if (confirm('Session complete! Start a short break?')) {
        setMode('short');
        startTimer();
      }
    }, 400);
  }
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 523.25; // C5
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);
  } catch {
    // audio not available
  }
}

function enterFocusOverlay() {
  const overlay = document.getElementById('pomodoro-overlay');
  if (!overlay) return;
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('pomodoro-focus-active');
  const taskSel = document.getElementById('pomodoro-task-select');
  const taskName = taskSel?.options[taskSel.selectedIndex]?.text || '';
  const taskEl = document.getElementById('pomodoro-overlay-task');
  if (taskEl) taskEl.textContent = taskName;
}

function exitFocusOverlay() {
  const overlay = document.getElementById('pomodoro-overlay');
  if (overlay) overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('pomodoro-focus-active');
}

function populateTaskSelect() {
  const select = document.getElementById('pomodoro-task-select');
  if (!select) return;
  try {
    const todoData = JSON.parse(localStorage.getItem('ncc-todo') || '[]');
    const active = (todoData.list || todoData || []).filter(t => !t.completed);
    if (!active.length) return;
    select.innerHTML = '<option value="">— Select a task —</option>' +
      active.map(t => `<option value="${esc(t.id || t.text)}">${esc(t.text?.slice(0, 40) || '')}</option>`).join('');
  } catch {
    // ignore
  }
}

function updateStats() {
  const sessions = loadSessions();
  const today = new Date().toDateString();
  const todayCount = sessions.filter(s => new Date(s.time).toDateString() === today).length;

  // streak: consecutive days with at least one pomodoro
  const dates = [...new Set(sessions.map(s => new Date(s.time).toDateString()))];
  dates.sort((a, b) => new Date(b) - new Date(a));
  let streak = 0;
  const todayIndex = dates.indexOf(today);
  if (todayIndex !== -1) {
    streak = 1;
    for (let i = todayIndex + 1; i < dates.length; i++) {
      const d = new Date(dates[i]);
      const prev = new Date(dates[i - 1]);
      const diff = (prev - d) / 86400000;
      if (diff === 1) streak++; else break;
    }
  } else if (dates.length > 0) {
    const last = new Date(dates[0]);
    const now = new Date();
    const diff = Math.round((now - last) / 86400000);
    if (diff === 1) { streak = 1; for (let i = 1; i < dates.length; i++) { const d = new Date(dates[i]); const prev = new Date(dates[i - 1]); const dd = (prev - d) / 86400000; if (dd === 1) streak++; else break; }}
  }

  const totalMinutes = Math.round(sessions.filter(s => s.mode === 'pomodoro').reduce((a, s) => a + (s.duration || 0), 0) / 60);

  const elCount = document.getElementById('pomodoro-today-count');
  const elStreak = document.getElementById('pomodoro-streak');
  const elTime = document.getElementById('pomodoro-total-time');
  if (elCount) elCount.textContent = todayCount;
  if (elStreak) elStreak.textContent = streak;
  if (elTime) elTime.textContent = totalMinutes;
}

function renderHistory() {
  const list = document.getElementById('pomodoro-history-list');
  if (!list) return;
  const sessions = loadSessions().slice(0, 20);
  if (!sessions.length) {
    list.innerHTML = '<li class="pomodoro-empty">No sessions yet. Start your first focus block!</li>';
    return;
  }
  list.innerHTML = sessions.map(s => {
    const d = new Date(s.time);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const label = s.mode === 'pomodoro' ? '🍅 Focus' : s.mode === 'short' ? '☕ Short Break' : '🌴 Long Break';
    const task = s.task ? ` · ${esc(s.task.slice(0, 30))}` : '';
    return `<li class="pomodoro-history-item">
      <span class="pomodoro-history-label">${label}</span>
      <span class="pomodoro-history-task">${task}</span>
      <span class="pomodoro-history-time">${timeStr}</span>
    </li>`;
  }).join('');
}

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function toast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2500);
}
