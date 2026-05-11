/* ===== FINANCE TRACKER (T-019) — Personal Budget & Transactions ===== */
const LS_KEY = 'ncc-finance-transactions';
let trackerInit = false;

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadTransactions() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}
function saveTransactions(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

function currentMonthFilter(t) {
  const now = new Date();
  const [y,m] = (t.date || '').split('-');
  return y === String(now.getFullYear()) && m === String(now.getMonth()+1).padStart(2,'0');
}

function renderSummary(list) {
  const monthList = list.filter(currentMonthFilter);
  const income = monthList.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const expense = monthList.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const net = income - expense;

  const incEl = document.getElementById('ft-summary-income');
  const expEl = document.getElementById('ft-summary-expense');
  const netEl = document.getElementById('ft-summary-net');
  if (incEl) incEl.textContent = fmtMoney(income);
  if (expEl) expEl.textContent = fmtMoney(expense);
  if (netEl) {
    netEl.textContent = (net >= 0 ? '+' : '') + fmtMoney(net);
    netEl.classList.toggle('positive', net >= 0);
    netEl.classList.toggle('negative', net < 0);
  }
}

function renderCategoryBar(list) {
  const wrap = document.getElementById('ft-category-bar');
  if (!wrap) return;
  const monthList = list.filter(t => t.type === 'expense').filter(currentMonthFilter);
  if (!monthList.length) { wrap.innerHTML = '<div class="ft-empty-bar">No expenses this month</div>'; return; }

  const totals = {};
  monthList.forEach(t => { totals[t.category] = (totals[t.category] || 0) + (parseFloat(t.amount) || 0); });
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  const colors = {
    Food: '#ef4444', Transport: '#f97316', Housing: '#eab308',
    Entertainment: '#8b5cf6', Health: '#10b981', Shopping: '#ec4899',
    Income: '#3b82f6', Other: '#6b7280'
  };

  wrap.innerHTML = Object.entries(totals).map(([cat, amt]) => {
    const pct = total ? ((amt / total) * 100).toFixed(1) : '0.0';
    return `<div class="ft-bar-segment" style="width:${pct}%;background:${colors[cat] || colors.Other}" title="${escapeHtml(cat)}: ${fmtMoney(amt)} (${pct}%)"></div>`;
  }).join('');

  const legend = document.getElementById('ft-category-legend');
  if (legend) {
    legend.innerHTML = Object.entries(totals).map(([cat, amt]) => {
      const pct = total ? ((amt / total) * 100).toFixed(1) : '0.0';
      return `<div class="ft-legend-item"><span class="ft-legend-dot" style="background:${colors[cat] || colors.Other}"></span><span class="ft-legend-label">${escapeHtml(cat)}</span><span class="ft-legend-pct">${pct}%</span></div>`;
    }).join('');
  }
}

function renderList(list) {
  const wrap = document.getElementById('ft-transactions');
  if (!wrap) return;
  if (!list.length) { wrap.innerHTML = '<div class="ft-empty">No transactions yet. Add your first one above.</div>'; return; }
  // Sort newest first
  const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || '').localeCompare(a.id || ''));
  wrap.innerHTML = sorted.map(t => {
    const isInc = t.type === 'income';
    return `<div class="ft-row" data-id="${escapeHtml(t.id)}">
      <div class="ft-row-main">
        <div class="ft-row-meta">
          <span class="ft-row-cat">${escapeHtml(t.category || 'Other')}</span>
          <span class="ft-row-date">${escapeHtml(fmtDate(t.date))}</span>
        </div>
        <div class="ft-row-note">${escapeHtml(t.note || '')}</div>
      </div>
      <div class="ft-row-amount ${isInc ? 'positive' : 'negative'}">${isInc ? '+' : '-'}${fmtMoney(t.amount || 0)}</div>
      <button class="ft-row-del" aria-label="Delete transaction">✕</button>
    </div>`;
  }).join('');

  wrap.querySelectorAll('.ft-row-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = e.target.closest('.ft-row');
      const id = row?.dataset.id;
      if (!id) return;
      let data = loadTransactions();
      data = data.filter(t => t.id !== id);
      saveTransactions(data);
      renderAll(data);
    });
  });
}

function renderAll(list) {
  if (!list) list = loadTransactions();
  renderSummary(list);
  renderCategoryBar(list);
  renderList(list);
}

function bindForm() {
  const form = document.getElementById('ft-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('ft-amount')?.value || 0);
    const type = document.getElementById('ft-type')?.value || 'expense';
    const category = document.getElementById('ft-category')?.value || 'Other';
    const note = document.getElementById('ft-note')?.value || '';
    const date = document.getElementById('ft-date')?.value || todayStr();
    if (!amount || amount <= 0) return;

    const data = loadTransactions();
    data.unshift({ id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`, date, amount, type, category, note });
    saveTransactions(data);
    renderAll(data);
    form.reset();
    const dateInput = document.getElementById('ft-date');
    if (dateInput) dateInput.value = todayStr();
  });
}

function bindExport() {
  const btn = document.getElementById('ft-export');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const data = loadTransactions();
    if (!data.length) { showFtToast('No transactions to export'); return; }
    const header = 'Date,Type,Category,Amount,Note';
    const rows = data.map(t => {
      const note = (t.note || '').replace(/"/g, '""');
      return `${t.date || ''},${t.type || ''},${t.category || ''},${t.amount || 0},"${note}"`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus-finance.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showFtToast('CSV exported');
  });
}

function showFtToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2500);
}

export function initFinanceTracker() {
  if (trackerInit) return;
  trackerInit = true;
  bindForm();
  bindExport();
  renderAll();
}
