import { toast } from '../app.js';

const KEY = 'ncc-todo';
let tasks = [];
let filter = 'all';

function load() { try { tasks = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { tasks = []; } }
function save() { localStorage.setItem(KEY, JSON.stringify(tasks)); updateBadge(); }
function genId() { return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6); }

export function initTodo() {
  load();
  cacheDOM();
  bindEvents();
  render();
  updateBadge();
}

let els = {};
function cacheDOM() {
  els = {
    input: document.getElementById('todo-input'),
    priority: document.getElementById('todo-priority'),
    due: document.getElementById('todo-due'),
    addBtn: document.getElementById('todo-add-btn'),
    list: document.getElementById('todo-list'),
    filters: document.getElementById('todo-filters'),
    stats: document.getElementById('todo-stats'),
    clearCompleted: document.getElementById('todo-clear-completed'),
  };
}

function bindEvents() {
  els.addBtn.addEventListener('click', addTask);
  els.input.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
  els.filters.addEventListener('click', e => {
    const btn = e.target.closest('.todo-filter-btn');
    if (!btn) return;
    filter = btn.dataset.filter;
    render();
  });
  els.clearCompleted.addEventListener('click', () => {
    if (!confirm('Clear all completed tasks?')) return;
    tasks = tasks.filter(t => !t.completed);
    save(); render(); toast('Completed tasks cleared');
  });
}

function addTask() {
  const text = els.input.value.trim();
  if (!text) return toast('Enter a task', 'error');
  const task = {
    id: genId(),
    text,
    priority: els.priority.value,
    due: els.due.value || '',
    completed: false,
    createdAt: Date.now(),
  };
  tasks.unshift(task);
  save();
  els.input.value = '';
  els.due.value = '';
  render();
  toast('Task added');
}

function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  if (t) { t.completed = !t.completed; save(); render(); }
}

function deleteTask(id) {
  tasks = tasks.filter(x => x.id !== id);
  save(); render(); toast('Task deleted');
}

function fmtDue(d) {
  if (!d) return '';
  const today = new Date().toISOString().slice(0,10);
  if (d === today) return 'Today';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function render() {
  const filtered = tasks.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  if (!filtered.length) {
    els.list.innerHTML = `<div class="todo-empty">${filter === 'all' ? 'No tasks yet. Add one above!' : 'Nothing here.'}</div>`;
  } else {
    els.list.innerHTML = filtered.map(t => {
      const done = t.completed ? 'completed' : '';
      const pClass = `priority-${t.priority}`;
      const overdue = !t.completed && t.due && t.due < new Date().toISOString().slice(0,10);
      return `
      <div class="todo-item ${done}" data-id="${t.id}">
        <input type="checkbox" class="todo-check" aria-label="Toggle task" ${t.completed ? 'checked' : ''}>
        <div class="todo-item-body">
          <div class="todo-item-text">${esc(t.text)}</div>
          <div class="todo-item-meta">
            <span class="todo-pill ${pClass}">${t.priority}</span>
            ${t.due ? `<span class="todo-due ${overdue ? 'overdue' : ''}">${fmtDue(t.due)}</span>` : ''}
          </div>
        </div>
        <button class="todo-delete" aria-label="Delete task">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>`;
    }).join('');
  }

  els.list.querySelectorAll('.todo-check').forEach(cb => {
    cb.addEventListener('change', e => toggleTask(e.target.closest('.todo-item').dataset.id));
  });
  els.list.querySelectorAll('.todo-delete').forEach(btn => {
    btn.addEventListener('click', e => deleteTask(e.target.closest('.todo-item').dataset.id));
  });

  const activeCount = tasks.filter(t => !t.completed).length;
  els.stats.textContent = `${activeCount} active · ${tasks.length - activeCount} completed`;
  els.filters.querySelectorAll('.todo-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  els.clearCompleted.style.display = tasks.some(t => t.completed) ? 'inline-flex' : 'none';
}

function updateBadge() {
  const badge = document.getElementById('todo-badge');
  const activeCount = tasks.filter(t => !t.completed).length;
  if (badge) { badge.textContent = activeCount; badge.style.display = activeCount ? 'flex' : 'none'; }
}

function esc(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
