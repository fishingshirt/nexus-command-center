/* ===== ARCADE APP SHELL ===== */
const GAMES = [
  { id: 'snake', name: 'Snake', desc: 'Classic snake. Eat, grow, don\'t crash.', icon: '🐍', comingSoon: false },
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
  panel.classList.add('active');

  // Resize canvas to container
  resizeCanvas(canvas);
  canvas.dataset.currentGame = gameId;

  if (gameId === 'snake') {
    startSnake(canvas);
  } else {
    drawPlaceholder(canvas, game);
  }

  // Back button
  const backBtn = document.getElementById('arcade-game-back');
  backBtn.onclick = () => {
    stopSnake();
    panel.classList.remove('active');
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
    const panel = document.getElementById('arcade-game-panel');
    if (canvas && panel && panel.classList.contains('active')) {
      resizeCanvas(canvas);
      const gameId = canvas.dataset.currentGame;
      if (gameId === 'snake') {
        // Snake handles its own resize via CSS + re-init on next frame
      } else {
        const game = GAMES.find(g => g.id === gameId);
        if (game) drawPlaceholder(canvas, game);
      }
    }
  });
}

/* ===== SNAKE GAME ===== */
let snakeRaf = 0;
let snakeInterval = 0;
let snakeState = null;

function startSnake(canvas) {
  stopSnake();
  const status = document.getElementById('arcade-game-status');
  const scoreEl = document.getElementById('arcade-game-score');

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = Math.floor(canvas.width / dpr);
  const H = Math.floor(canvas.height / dpr);
  const GS = Math.max(12, Math.floor(Math.min(W, H) / 24)); // grid size
  const COLS = Math.floor(W / GS);
  const ROWS = Math.floor(H / GS);
  const OFFX = Math.floor((W - COLS * GS) / 2);
  const OFFY = Math.floor((H - ROWS * GS) / 2);

  let snake = [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = spawnFood(snake, COLS, ROWS);
  let score = 0;
  let alive = false;
  let started = false;
  let speed = 140; // ms per tick
  let particles = [];

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(OFFX + x * GS, OFFY);
      ctx.lineTo(OFFX + x * GS, OFFY + ROWS * GS);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(OFFX, OFFY + y * GS);
      ctx.lineTo(OFFX + COLS * GS, OFFY + y * GS);
      ctx.stroke();
    }

    // Food
    ctx.fillStyle = '#ef4444';
    const fx = OFFX + food.x * GS + GS * 0.1;
    const fy = OFFY + food.y * GS + GS * 0.1;
    const fs = GS * 0.8;
    roundRect(ctx, fx, fy, fs, fs, GS * 0.2);
    ctx.fill();

    // Snake
    snake.forEach((seg, i) => {
      const sx = OFFX + seg.x * GS + 1;
      const sy = OFFY + seg.y * GS + 1;
      const ss = GS - 2;
      ctx.fillStyle = i === 0 ? 'var(--accent)' : 'rgba(59, 130, 246, 0.75)';
      roundRect(ctx, sx, sy, ss, ss, GS * 0.25);
      ctx.fill();
      // Eyes on head
      if (i === 0) {
        ctx.fillStyle = '#0a0a0a';
        const ex = GS * 0.25;
        const ey = GS * 0.25;
        const ew = Math.max(2, GS * 0.15);
        if (dir.x === 1) {
          ctx.fillRect(sx + ss - ex - ew, sy + ey, ew, ew);
          ctx.fillRect(sx + ss - ex - ew, sy + ss - ey - ew, ew, ew);
        } else if (dir.x === -1) {
          ctx.fillRect(sx + ex, sy + ey, ew, ew);
          ctx.fillRect(sx + ex, sy + ss - ey - ew, ew, ew);
        } else if (dir.y === -1) {
          ctx.fillRect(sx + ex, sy + ey, ew, ew);
          ctx.fillRect(sx + ss - ex - ew, sy + ey, ew, ew);
        } else {
          ctx.fillRect(sx + ex, sy + ss - ey - ew, ew, ew);
          ctx.fillRect(sx + ss - ex - ew, sy + ss - ey - ew, ew, ew);
        }
      }
    });

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= 0.04;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      p.x += p.vx;
      p.y += p.vy;
    }

    if (!alive && started) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 18);
      ctx.font = `${Math.floor(Math.min(W, H) * 0.035)}px sans-serif`;
      ctx.fillText(`Score ${score}`, W / 2, H / 2 + 18);
      ctx.font = `${Math.floor(Math.min(W, H) * 0.025)}px sans-serif`;
      ctx.fillStyle = 'var(--text-secondary, #94a3b8)';
      ctx.fillText('SPACE to restart', W / 2, H / 2 + 48);
    }

    if (!started) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.05)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SNAKE', W / 2, H / 2 - 10);
      ctx.font = `${Math.floor(Math.min(W, H) * 0.025)}px sans-serif`;
      ctx.fillStyle = 'var(--text-secondary, #94a3b8)';
      ctx.fillText('SPACE or TAP to start', W / 2, H / 2 + 22);
    }

    snakeRaf = requestAnimationFrame(draw);
  }

  function tick() {
    if (!alive || !started) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    // Wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      die(); return;
    }
    // Self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      die(); return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      scoreEl.textContent = score;
      arcadeReportScore('snake', score);
      spawnParticles(OFFX + head.x * GS + GS / 2, OFFY + head.y * GS + GS / 2);
      food = spawnFood(snake, COLS, ROWS);
      speed = Math.max(60, speed - 2);
      clearInterval(snakeInterval);
      snakeInterval = setInterval(tick, speed);
    } else {
      snake.pop();
    }
  }

  function die() {
    alive = false;
    if (status) status.textContent = 'Game Over — SPACE to restart';
    arcadeReportScore('snake', score);
  }

  function spawnParticles(cx, cy) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * (Math.random() * 2 + 1),
        vy: Math.sin(angle) * (Math.random() * 2 + 1),
        life: 1, r: Math.random() * 3 + 2,
        color: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'][Math.floor(Math.random() * 4)]
      });
    }
  }

  function reset() {
    snake = [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    food = spawnFood(snake, COLS, ROWS);
    score = 0;
    scoreEl.textContent = '0';
    alive = true;
    started = true;
    speed = 140;
    particles = [];
    if (status) status.textContent = 'Score ' + score;
    clearInterval(snakeInterval);
    snakeInterval = setInterval(tick, speed);
  }

  function onKey(e) {
    if (!alive && started && e.code === 'Space') { e.preventDefault(); reset(); return; }
    if (!started && e.code === 'Space') { e.preventDefault(); reset(); return; }
    if (!alive) return;
    if (['ArrowUp', 'KeyW'].includes(e.code) && dir.y !== 1) { nextDir = { x: 0, y: -1 }; e.preventDefault(); }
    if (['ArrowDown', 'KeyS'].includes(e.code) && dir.y !== -1) { nextDir = { x: 0, y: 1 }; e.preventDefault(); }
    if (['ArrowLeft', 'KeyA'].includes(e.code) && dir.x !== 1) { nextDir = { x: -1, y: 0 }; e.preventDefault(); }
    if (['ArrowRight', 'KeyD'].includes(e.code) && dir.x !== -1) { nextDir = { x: 1, y: 0 }; e.preventDefault(); }
    if (e.code === 'Escape') {
      e.preventDefault();
      stopSnake();
      document.getElementById('arcade-game-panel').classList.remove('active');
    }
  }

  let touchStartX = 0, touchStartY = 0;
  function onTouchStart(e) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }
  function onTouchEnd(e) {
    if (!started) { reset(); return; }
    if (!alive) { reset(); return; }
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 20) return; // too short
    if (absDx > absDy) {
      if (dx > 0 && dir.x !== -1) nextDir = { x: 1, y: 0 };
      else if (dx < 0 && dir.x !== 1) nextDir = { x: -1, y: 0 };
    } else {
      if (dy > 0 && dir.y !== -1) nextDir = { x: 0, y: 1 };
      else if (dy < 0 && dir.y !== 1) nextDir = { x: 0, y: -1 };
    }
  }

  document.addEventListener('keydown', onKey);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  canvas.addEventListener('click', () => {
    if (!started) { reset(); }
    else if (!alive) { reset(); }
  });

  snakeState = {
    cleanup() {
      document.removeEventListener('keydown', onKey);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    }
  };

  if (status) status.textContent = 'Press SPACE to start';
  snakeRaf = requestAnimationFrame(draw);
}

function stopSnake() {
  cancelAnimationFrame(snakeRaf);
  clearInterval(snakeInterval);
  if (snakeState && snakeState.cleanup) snakeState.cleanup();
  snakeState = null;
}

function spawnFood(snake, cols, rows) {
  let f;
  do {
    f = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
  } while (snake.some(s => s.x === f.x && s.y === f.y));
  return f;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Public API for game modules */
export function arcadeReportScore(gameId, score) {
  if (saveHighScore(gameId, score)) {
    const el = document.querySelector(`.arcade-card-score[data-score-for="${gameId}"]`);
    if (el) el.textContent = `Best ${formatNumber(score)}`;
  }
}
