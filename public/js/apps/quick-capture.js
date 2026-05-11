/**
 * Quick Capture App — T-043-a
 * FAB + radial menu + capture modal shell.
 * Save / voice logic deferred to T-043-b / T-043-c.
 */

const MODAL_ID = 'capture-modal';
const FAB_ID = 'quick-capture-fab';
const MENU_ID = 'quick-capture-menu';

let menuOpen = false;
let modalOpen = false;
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
    btn.addEventListener('click', (e) => {
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
  menu.classList.toggle('open', menuOpen);
}

function closeMenu() {
  const fab = document.getElementById(FAB_ID);
  const menu = document.getElementById(MENU_ID);
  if (!fab || !menu) return;
  menuOpen = false;
  fab.classList.remove('open');
  menu.classList.remove('open');
}

/* ── Capture Modal ── */
function wireModal() {
  const modal = document.getElementById(MODAL_ID);
  const backdrop = document.getElementById('capture-modal-backdrop');
  const closeBtn = document.getElementById('capture-modal-close');
  const cancelBtn = document.getElementById('capture-cancel');
  const saveBtn = document.getElementById('capture-save');

  if (!modal) return;

  if (backdrop) backdrop.addEventListener('click', closeCapture);
  if (closeBtn) closeBtn.addEventListener('click', closeCapture);
  if (cancelBtn) cancelBtn.addEventListener('click', closeCapture);
  if (saveBtn) saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // Placeholder: save delegated to T-043-b
    console.log('[QuickCapture] save placeholder');
    closeCapture();
  });
}

function openCapture(mode) {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
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
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  // Clear inputs
  modal.querySelectorAll('input, textarea').forEach(el => { el.value = ''; });
}

/* ── Keyboard Shortcuts ── */
function wireKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Space toggles menu
    if (e.code === 'Space' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleMenu();
      return;
    }
    // Escape closes modal then menu
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
