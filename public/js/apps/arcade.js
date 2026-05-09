/* ===== ARCADE APP SHELL ===== */
const GAMES = [
  { id: 'snake', name: 'Snake', desc: 'Classic snake. Eat, grow, don\'t crash.', icon: '🐍', comingSoon: true },
  { id: 'pong', name: 'Pong', desc: 'VS CPU paddle battle.', icon: '🏓', comingSoon: true },
  { id: 'tetromino', name: 'Tetromino', desc: 'Block stacking with hold + preview.', icon: '🧱', comingSoon: true },
  { id: 'minesweeper', name: 'Minesweeper', desc: 'Find all mines. Flag carefully.', icon: '💣', comingSoon: true },
  { id: 'two048', name: '2048', desc: 'Merge tiles to reach 2048.', icon: '🔢', comingSoon: true },
  { id: 'typing', name: 'Typing Speed', desc: 'Words per minute test.', icon: '⌨️', comingSoon: true },
  { id: 'reaction', name: 'Reaction', desc: 'Click when green. Measure ms.', icon: '⚡', comingSoon: true },
];

const STORAGE_KEY = 'ncc-arcade-highscores';

export function initArcade() {
  renderGrid();
  bindEvents();
}

/* ---- HIGH SCORES ---- */
function getHighScores() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveHighScore(gameId, score) {
  const scores = getHighScores();
  const current = scores[gameId] || 0;
  if (score > current) {
    scores[gameId] = score;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    return true;
  }
  return false;
}

/* ---- RENDER ---- */
function renderGrid() {
  const grid = document.getElementById('arcade-grid');
  if (!grid) return;

  const scores = getHighScores();

  grid.innerHTML = GAMES.map(g => {
    const best = scores[g.id] || 0;
    const bestLabel = best? `Best ${formatNumber(best)}` : 'No score';
    return `
      <div class="arcade-card ${g.comingSoon ? 'soon' : ''}" data-game="${g.id}">
        <div class="arcade-card-icon">${g.icon}</div>
        <div class="arcade-card-info">
          <h3>${g.name}${g.comingSoon ? ' <span class="arcade-soon-badge">Soon</span>' : ''}</h3>
          <p>${g.desc}</p>
        </div>
        <div class="arcade-card-score" data-score-for="${g.id}">${bestLabel}</div>
        <button class="arcade-play-btn" ${g.comingSoon ? 'disabled' : ''}>
          ${g.comingSoon ? 'Locked' : 'Play'}
        </button>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.arcade-card[data-game]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.arcade-play-btn')) {
        const gameId = card.dataset.game;
        launchGame(gameId);
        return;
      }
      // Click anywhere on card also triggers if coming-soon not set
      const gameId = card.dataset.game;
      if (!card.classList.contains('soon')) launchGame(gameId);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const gameId = card.dataset.game;
        if (!card.classList.contains('soon')) launchGame(gameId);
      }
    });
  });
}

function formatNumber(n) {
  return n.toLocaleString();
}

/* ---- LAUNCH ---- */
function launchGame(gameId) {
  const game = GAMES.find(g => g.id === gameId);
  if (!game || game.comingSoon) return;

  const panel = document.getElementById('arcade-game-panel');
  const title = document.getElementById('arcade-game-title');
  const canvas = document.getElementById('arcade-game-canvas');

  if (!panel || !title || !canvas) return;

  title.textContent = game.name;
  panel.style.display = 'block';

  // Resize canvas to container
  resizeCanvas(canvas);

  // Placeholder: show "Game Under Construction" screen on canvas
  drawPlaceholder(canvas, game);

  // Back button
  document.getElementById('arcade-game-back').onclick = () => {
    panel.style.display = 'none';
  };
}

function resizeCanvas(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(rect.width));
  canvas.height = Math.max(240, Math.floor(rect.height || canvas.width * 0.75));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
  canvas.width = Math.floor(canvas.width * dpr);
  canvas.height = Math.floor(canvas.height * dpr);
}

function drawPlaceholder(canvas, game) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;

  // Dark background
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  // Scanlines
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 2);
  }

  // Game icon
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillText(game.icon, w / 2, h / 2 - 30);

  // Message
  ctx.font = `bold ${16 * dpr}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`${game.name} — Coming in next cycle`, w / 2, h / 2 + 30);

  // Decorative line
  ctx.strokeStyle = 'var(--accent)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 60, h / 2 + 50);
  ctx.lineTo(w / 2 + 60, h / 2 + 50);
  ctx.stroke();
}

/* ---- EVENTS ---- */
function bindEvents() {
  window.addEventListener('resize', () => {
    const canvas = document.getElementById('arcade-game-canvas');
    if (canvas && canvas.parentElement.style.display !== 'none') {
      resizeCanvas(canvas);
      const game = GAMES.find(g => g.id === canvas.dataset.currentGame);
      if (game) drawPlaceholder(canvas, game);
    }
  });
}

/* Public API for game modules */
export function arcadeReportScore(gameId, score) {
  if (saveHighScore(gameId, score)) {
    const el = document.querySelector(`.arcade-card-score[data-score-for="${gameId}"]`);
    if (el) el.textContent = `Best ${formatNumber(score)}`;
  }
}
