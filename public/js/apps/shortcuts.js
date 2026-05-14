export function initShortcuts() {
  const overlay = document.getElementById('shortcuts-overlay');
  const body    = document.getElementById('shortcuts-body');
  const closeBtn= document.getElementById('shortcuts-close');
  const backdrop= document.getElementById('shortcuts-backdrop');
  const toggle  = document.getElementById('shortcuts-toggle-enabled');
  if (!overlay || !body) return;

  /* ── Shortcut registry ─────────────────────────── */
  const groups = {
    'Global Navigation': [
      { keys: [['?']],   action: 'Toggle this shortcuts panel' },
      { keys: [['/']],   action: 'Open global search' },
      { keys: [['Esc']], action: 'Close any overlay / go back' },
      { keys: [['g','c']], action: 'Go to Calendar' },
      { keys: [['g','n']], action: 'Go to Notes' },
      { keys: [['g','t']], action: 'Go to To-Do' },
      { keys: [['g','d']], action: 'Go to Dashboard' },
      { keys: [['g','f']], action: 'Go to Feedback' },
      { keys: [['g','w']], action: 'Go to Weather' },
      { keys: [['g','s']], action: 'Go to Settings' },
    ],
    'Calendar': [
      { keys: [['n']], action: 'New event' },
      { keys: [['d']], action: 'Day view' },
      { keys: [['w']], action: 'Week view' },
      { keys: [['m']], action: 'Month view' },
    ],
    'Notes': [
      { keys: [['n']], action: 'New note' },
      { keys: [['s']], action: 'Save current note' },
      { keys: [['f']], action: 'Focus search' },
    ],
    'To-Do': [
      { keys: [['n']], action: 'New task' },
      { keys: [['1']], action: 'Set priority: Low' },
      { keys: [['2']], action: 'Set priority: Medium' },
      { keys: [['3']], action: 'Set priority: High' },
      { keys: [['4']], action: 'Set priority: Urgent' },
    ],
  };

  function render() {
    body.innerHTML = Object.entries(groups).map(([group, items]) => `
      <div class="shortcuts-group">
        <h3>${escapeHtml(group)}</h3>
        ${items.map(it => `
          <div class="shortcuts-row">
            <span>${escapeHtml(it.action)}</span>
            <span>${it.keys.map(chord => chord.map(k => `<kbd>${escapeHtml(k)}</kbd>`).join(' ')).join('  ')}</span>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  function open() {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden','false');
  }
  function close() {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden','true');
  }

  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);

  /* ── State ────────────────────────────────────── */
  const STORAGE_KEY = 'ncc-shortcuts-enabled';
  let enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
  if (toggle) {
    const onToggle = () => {
      enabled = toggle.checked;
      localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    };
    toggle.checked = enabled;
    toggle.addEventListener('change', onToggle);
  }

  /* ── Global listener ──────────────────────────── */
  let gChord = false;
  let lastKeyTime = 0;

  const keyHandler = e => {
    if (!enabled) return;
    const tag = document.activeElement?.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;

    /* Special: show shortcuts */
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (overlay.classList.contains('active')) { close(); }
      else { open(); }
      return;
    }

    /* Search */
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (isTyping) return;
      const searchOverlay = document.getElementById('search-overlay');
      if (searchOverlay && !searchOverlay.classList.contains('active')) {
        e.preventDefault();
        document.getElementById('header-search-btn')?.click();
      }
      return;
    }

    /* Escape */
    if (e.key === 'Escape') {
      if (overlay.classList.contains('active')) { close(); return; }
      const anyOpen = document.querySelector('.modal.active, .overlay.active, .panel.active, [role="dialog"].active');
      if (anyOpen) return; // let existing modal handlers run
      location.hash = 'dashboard';
      return;
    }

    if (isTyping) return;

    const now = Date.now();
    const withinWindow = now - lastKeyTime < 900;
    lastKeyTime = now;

    /* G-chord sequences */
    if (e.key.toLowerCase() === 'g' && !gChord && !withinWindow) {
      e.preventDefault();
      gChord = true;
      return;
    }
    if (gChord && withinWindow) {
      gChord = false;
      const map = { c:'calendar', n:'notes', t:'todo', d:'dashboard', f:'feedback', w:'weather', s:'settings' };
      const target = map[e.key.toLowerCase()];
      if (target) { e.preventDefault(); location.hash = target; }
      return;
    }
    gChord = false;

    /* Single-letter app shortcuts ( delegated per-view ) */
    const currentView = location.hash.replace('#','') || 'dashboard';
    if (currentView === 'calendar') {
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); document.getElementById('calendar-add-btn')?.click(); }
      // d/w/m handled by calendar app JS
    }
    if (currentView === 'notes') {
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); document.getElementById('notes-new-btn')?.click(); }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); document.getElementById('notes-save-btn')?.click(); }
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); document.getElementById('notes-search')?.focus(); }
    }
    if (currentView === 'todo') {
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); document.getElementById('todo-new-btn')?.click(); }
      // 1-2-3-4 priority handled by todo app JS
    }
  };

  document.addEventListener('keydown', keyHandler);

  /* Unified cleanup */
  const cleanupAll = () => {
    closeBtn?.removeEventListener('click', close);
    backdrop?.removeEventListener('click', close);
    toggle?.removeEventListener('change', onToggle);
    document.removeEventListener('keydown', keyHandler);
  };
  window.addEventListener('beforeunload', cleanupAll, { once: true });

  /* Helper */
  function escapeHtml(str) {
    return (str||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  render();

  /* First-run hint */
  if (!localStorage.getItem('ncc-shortcuts-hint-shown')) {
    setTimeout(() => {
      const toast = (typeof window.toast === 'function') ? window.toast : (msg) => console.log('[Shortcuts]', msg);
      toast('💡 Press ? anytime for keyboard shortcuts');
      localStorage.setItem('ncc-shortcuts-hint-shown', '1');
    }, 3500);
  }
}
