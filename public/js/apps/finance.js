/* ===== FINANCE APP (T-036) — Stocks, Crypto & Paper Trading ===== */
const LS_KEY = 'ncc-finance';
const PRICE_CACHE_KEY = 'ncc-finance-prices';
let PRICE_POLL_ID = null;

function loadData() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}
function saveData(patch) {
  const d = loadData();
  localStorage.setItem(LS_KEY, JSON.stringify({ ...d, ...patch }));
}
function ensureData() {
  const d = loadData();
  if (!d.balance && d.balance !== 0) d.balance = 100000;
  if (!d.holdings) d.holdings = [];
  if (!d.orders) d.orders = [];
  if (!d.watchlist) d.watchlist = [];
  saveData(d);
  return d;
}

// Fallback demo prices if API fails
const DEMO_PRICES = {
  AAPL: 192.50, MSFT: 332.10, GOOGL: 138.20, AMZN: 128.90,
  TSLA: 242.30, NVDA: 460.15, META: 298.40, BTC: 42300.00,
  ETH: 2280.00, SPY: 445.20, QQQ: 372.50, AMD: 104.30,
  NFLX: 445.60, DIS: 92.10, BA: 210.50, JPM: 145.80,
};

function fmtMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

/* ---- PRICE ENGINE ---- */
function getCachedPrices() {
  try {
    const raw = localStorage.getItem(PRICE_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.ts || Date.now() - data.ts > 10 * 60 * 1000) return null; // stale >10min
    return data.prices || null;
  } catch { return null; }
}

function setCachedPrices(prices) {
  localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({ ts: Date.now(), prices }));
}

function getPrice(sym) {
  const cached = getCachedPrices();
  if (cached && cached[sym] != null) return cached[sym];
  return DEMO_PRICES[sym] || 0;
}

function getChange(sym) {
  const cached = getCachedPrices();
  if (cached && cached[sym + '_change'] != null) return cached[sym + '_change'];
  // random fallback when no real data
  return (Math.random() * 6 - 3);
}

async function fetchRealPrices(symbols) {
  if (!symbols.length) return;
  try {
    const resp = await fetch(`/api/finance/prices?symbols=${encodeURIComponent(symbols.join(','))}`);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (!data.prices) return;
    const map = {};
    data.prices.forEach(p => {
      if (p.price != null) {
        map[p.symbol] = p.price;
        if (p.change != null) map[p.symbol + '_change'] = p.change;
      }
    });
    setCachedPrices(map);
    renderAll();
  } catch (e) {
    console.warn('Finance price fetch failed:', e);
  }
}

function schedulePricePoll() {
  if (PRICE_POLL_ID) { clearInterval(PRICE_POLL_ID); PRICE_POLL_ID = null; }
  const cfg = loadSettings();
  const fin = cfg.finance || {};
  if (!fin.livePrices) return;
  const intervalMin = fin.intervalMin || 5;
  const d = ensureData();
  if (!d.watchlist.length) return;
  // immediate fetch
  fetchRealPrices(d.watchlist);
  PRICE_POLL_ID = setInterval(() => {
    const d2 = ensureData();
    if (d2.watchlist.length) fetchRealPrices(d2.watchlist);
  }, intervalMin * 60 * 1000);
}

export function initFinance() {
  ensureData();
  bindTabs();
  bindPricesPanel();
  bindOrderModal();
  renderAll();
  schedulePricePoll();
}

/* ---- TABS ---- */
function bindTabs() {
  document.querySelectorAll('.finance-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.finance-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.finance-panel').forEach(p => p.classList.toggle('active', p.id === `finance-panel-${tab}`));
    });
  });
}

/* ---- PRICES PANEL ---- */
function bindPricesPanel() {
  const search = document.getElementById('finance-search');
  const addBtn = document.getElementById('finance-search-btn');
  if (!search || !addBtn) return;

  const add = () => {
    const sym = search.value.trim().toUpperCase();
    if (!sym) return;
    const d = ensureData();
    if (!d.watchlist.includes(sym)) {
      d.watchlist.push(sym);
      saveData({ watchlist: d.watchlist });
    }
    search.value = '';
    fetchRealPrices(d.watchlist);
    renderAll();
  };
  addBtn.addEventListener('click', add);
  search.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
}

/* ---- ORDER MODAL ---- */
function bindOrderModal() {
  const modal = document.getElementById('finance-order-modal');
  const backdrop = document.getElementById('finance-modal-backdrop');
  const closeBtn = document.getElementById('finance-modal-close');
  const cancelBtn = document.getElementById('finance-order-cancel');
  const form = document.getElementById('finance-order-form');
  const qtyInput = document.getElementById('finance-order-qty');
  const priceInput = document.getElementById('finance-order-price');
  const totalEl = document.getElementById('finance-order-total');

  if (!modal) return;

  const close = () => {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('open');
  };
  const open = () => {
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('open');
    qtyInput?.focus();
  };

  [backdrop, closeBtn, cancelBtn].forEach(el => el?.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });

  qtyInput?.addEventListener('input', () => {
    const p = parseFloat(priceInput?.value || 0);
    const q = parseInt(qtyInput?.value || 0, 10);
    totalEl.textContent = fmtMoney(p * q);
  });

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const sym = document.getElementById('finance-order-symbol')?.value || '';
    const side = document.getElementById('finance-order-side')?.value || 'buy';
    const price = parseFloat(priceInput?.value || 0);
    const qty = parseInt(qtyInput?.value || 0, 10);
    if (!sym || !price || !qty) return;
    executeOrder(sym, side, price, qty);
    close();
    renderAll();
  });

  window._openFinanceOrder = (sym, side, price) => {
    document.getElementById('finance-modal-title').textContent = `${side === 'buy' ? 'Buy' : 'Sell'} ${sym}`;
    document.getElementById('finance-order-symbol').value = sym;
    document.getElementById('finance-order-side').value = side;
    priceInput.value = price.toFixed(2);
    qtyInput.value = '1';
    totalEl.textContent = fmtMoney(price);
    open();
  };
}

function executeOrder(sym, side, price, qty) {
  const d = ensureData();
  const total = price * qty;
  if (side === 'buy') {
    if (total > d.balance) { showFinanceToast('Insufficient balance'); return; }
    d.balance -= total;
    const existing = d.holdings.find(h => h.symbol === sym);
    if (existing) {
      const oldTotal = existing.avgPrice * (existing.qty);
      existing.qty += qty;
      existing.avgPrice = (oldTotal + total) / existing.qty;
    }
    else { d.holdings.push({ symbol: sym, qty, avgPrice: price }); }
  } else {
    const existing = d.holdings.find(h => h.symbol === sym);
    if (!existing || existing.qty < qty) { showFinanceToast('Not enough shares'); return; }
    existing.qty -= qty;
    d.balance += total;
    if (existing.qty <= 0) d.holdings = d.holdings.filter(h => h.symbol !== sym);
  }
  d.orders.unshift({ id: `${Date.now()}`, symbol: sym, side, qty, price, total, time: new Date().toISOString() });
  saveData({ balance: d.balance, holdings: d.holdings, orders: d.orders });
  showFinanceToast(`${side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${sym} @ ${fmtMoney(price)}`);
}

/* ---- RENDER ---- */
function renderAll() {
  const d = ensureData();
  renderBalance(d);
  renderWatchlist(d);
  renderHoldings(d);
  renderOrders(d);
}

function renderBalance(d) {
  const balEl = document.getElementById('finance-balance');
  const pnlEl = document.getElementById('finance-pnl');
  if (balEl) balEl.textContent = fmtMoney(d.balance);
  if (pnlEl) {
    let pnl = 0;
    d.holdings.forEach(h => {
      const market = getPrice(h.symbol) || h.avgPrice;
      pnl += (market - h.avgPrice) * h.qty;
    });
    pnlEl.textContent = (pnl >= 0 ? '+' : '') + fmtMoney(pnl);
    pnlEl.classList.toggle('positive', pnl >= 0);
    pnlEl.classList.toggle('negative', pnl < 0);
  }
}

function renderWatchlist(d) {
  const wrap = document.getElementById('finance-watchlist');
  if (!wrap) return;
  if (!d.watchlist.length) { wrap.innerHTML = '<div class="finance-empty">Search a symbol above to start tracking prices.</div>'; return; }
  wrap.innerHTML = d.watchlist.map(sym => {
    const price = getPrice(sym);
    const change = getChange(sym);
    const up = change >= 0;
    return `
      <div class="finance-row">
        <div class="finance-row-info">
          <span class="finance-row-symbol">${sym}</span>
          <span class="finance-row-price">${price ? fmtMoney(price) : '—'}</span>
        </div>
        <span class="finance-row-change ${up ? 'up' : 'down'}" aria-label="Change ${up ? 'up' : 'down'} ${typeof change === 'number' && !Number.isNaN(change) ? change.toFixed(2) : '0.00'}%">${up ? '+' : ''}${typeof change === 'number' && !Number.isNaN(change) ? change.toFixed(2) : '0.00'}%</span>
        <div class="finance-row-actions">
          <button class="finance-btn-buy" onclick="window._openFinanceOrder('${sym}','buy',${price || 0})" aria-label="Buy ${sym}">Buy</button>
          <button class="finance-btn-sell" onclick="window._openFinanceOrder('${sym}','sell',${price || 0})" aria-label="Sell ${sym}">Sell</button>
          <button class="finance-btn-del" onclick="window._removeWatchlist('${sym}')" aria-label="Remove ${sym}">✕</button>
        </div>
      </div>`;
  }).join('');
}

window._removeWatchlist = (sym) => {
  const d = ensureData();
  d.watchlist = d.watchlist.filter(s => s !== sym);
  saveData({ watchlist: d.watchlist });
  renderAll();
};

function renderHoldings(d) {
  const wrap = document.getElementById('finance-holdings');
  const countEl = document.getElementById('finance-holdings-count');
  if (countEl) countEl.textContent = `${d.holdings.length} position${d.holdings.length === 1 ? '' : 's'}`;
  if (!wrap) return;
  if (!d.holdings.length) { wrap.innerHTML = '<div class="finance-empty">No positions yet. Buy from the Prices tab.</div>'; return; }
  wrap.innerHTML = d.holdings.map(h => {
    const market = getPrice(h.symbol) || h.avgPrice;
    const pnl = (market - h.avgPrice) * h.qty;
    const pnlPct = h.avgPrice ? ((market - h.avgPrice) / h.avgPrice * 100).toFixed(2) : '0.00';
    return `
      <div class="finance-row">
        <div class="finance-row-info">
          <span class="finance-row-symbol">${h.symbol}</span>
          <span class="finance-row-meta">${h.qty} @ ${fmtMoney(h.avgPrice)}</span>
        </div>
        <div class="finance-row-pnl ${pnl >= 0 ? 'up' : 'down'}">
          <span>${pnl >= 0 ? '+' : ''}${fmtMoney(pnl)}</span>
          <small>(${pnl >= 0 ? '+' : ''}${pnlPct}%)</small>
        </div>
        <div class="finance-row-actions">
          <button class="finance-btn-sell" onclick="window._openFinanceOrder('${h.symbol}','sell',${market})" aria-label="Sell ${h.symbol}">Sell</button>
        </div>
      </div>`;
  }).join('');
}

function renderOrders(d) {
  const wrap = document.getElementById('finance-orders');
  const countEl = document.getElementById('finance-orders-count');
  if (countEl) countEl.textContent = `${d.orders.length} order${d.orders.length === 1 ? '' : 's'}`;
  if (!wrap) return;
  if (!d.orders.length) { wrap.innerHTML = '<div class="finance-empty">No trades yet.</div>'; return; }
  wrap.innerHTML = d.orders.slice(0, 50).map(o => {
    const dt = new Date(o.time).toLocaleString();
    return `
      <div class="finance-order-row ${o.side}">
        <div class="finance-order-meta">
          <span class="finance-order-side">${o.side.toUpperCase()}</span>
          <span class="finance-order-symbol">${o.symbol}</span>
        </div>
        <div class="finance-order-detail">
          <span>${o.qty} @ ${fmtMoney(o.price)}</span>
          <span class="finance-order-total">${fmtMoney(o.total)}</span>
        </div>
        <div class="finance-order-time">${dt}</div>
      </div>`;
  }).join('');
}

function showFinanceToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2500);
}

/* ---- SETTINGS INTEGRATION ---- */
function loadSettings() {
  try { return JSON.parse(localStorage.getItem('ncc-settings')) || {}; }
  catch { return {}; }
}

export function initFinanceSettings() {
  // Called by settings.js when Settings view is opened
  const wrap = document.getElementById('finance-settings-wrap');
  if (!wrap) return;
  const cfg = loadSettings().finance || {};
  wrap.innerHTML = `
    <div class="settings-row">
      <label for="finance-live">Live prices</label>
      <input type="checkbox" id="finance-live" class="toggle" ${cfg.livePrices ? 'checked' : ''}>
    </div>
    <div class="settings-row">
      <label for="finance-interval">Price refresh interval</label>
      <select id="finance-interval">
        <option value="1" ${(cfg.intervalMin||5)==1 ? 'selected' : ''}>Every 1 min</option>
        <option value="5" ${(cfg.intervalMin||5)==5 ? 'selected' : ''}>Every 5 min</option>
        <option value="15" ${(cfg.intervalMin||5)==15 ? 'selected' : ''}>Every 15 min</option>
        <option value="30" ${(cfg.intervalMin||5)==30 ? 'selected' : ''}>Every 30 min</option>
      </select>
    </div>
    <p class="settings-hint">When enabled, prices are fetched from Yahoo Finance (stocks) and CoinGecko (crypto).</p>
  `;

  document.getElementById('finance-live')?.addEventListener('change', (e) => {
    const s = loadSettings();
    s.finance = { ...(s.finance || {}), livePrices: e.target.checked };
    localStorage.setItem('ncc-settings', JSON.stringify(s));
    showFinanceToast(e.target.checked ? 'Live prices enabled' : 'Live prices disabled');
    schedulePricePoll();
  });

  document.getElementById('finance-interval')?.addEventListener('change', (e) => {
    const s = loadSettings();
    s.finance = { ...(s.finance || {}), intervalMin: parseInt(e.target.value, 10) };
    localStorage.setItem('ncc-settings', JSON.stringify(s));
    schedulePricePoll();
  });
}

// Auto-init settings when view opens
window.addEventListener('hashchange', () => {
  if (location.hash === '#settings') initFinanceSettings();
});
