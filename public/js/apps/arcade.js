/* ===== ARCADE APP SHELL ===== */
const GAMES = [
  { id: 'snake', name: 'Snake', desc: 'Classic snake. Eat, grow, don\'t crash.', icon: '🐍', comingSoon: false },
  { id: 'pong', name: 'Pong', desc: 'VS CPU paddle battle.', icon: '🏓', comingSoon: false },
  { id: 'tetromino', name: 'Tetromino', desc: 'Block stacking with hold + preview.', icon: '🧱', comingSoon: false },
  { id: 'minesweeper', name: 'Minesweeper', desc: 'Find all mines. Flag carefully.', icon: '💣', comingSoon: false },
  { id: 'two048', name: '2048', desc: 'Merge tiles to reach 2048.', icon: '🔢', comingSoon: false },
  { id: 'typing', name: 'Typing Speed', desc: 'Words per minute test.', icon: '⌨️', comingSoon: false },
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
  } else if (gameId === 'pong') {
    startPong(canvas);
  } else if (gameId === 'tetromino') {
    startTetromino(canvas);
  } else if (gameId === 'minesweeper') {
    const dom = document.getElementById('arcade-game-dom');
    canvas.style.display = 'none';
    dom.style.display = 'block';
    startMinesweeper(dom);
  } else if (gameId === 'two048') {
    const dom = document.getElementById('arcade-game-dom');
    canvas.style.display = 'none';
    dom.style.display = 'block';
    startTwo048(dom);
  } else if (gameId === 'typing') {
    const dom = document.getElementById('arcade-game-dom');
    canvas.style.display = 'none';
    dom.style.display = 'block';
    startTyping(dom);
  } else {
    drawPlaceholder(canvas, game);
  }

  // Back button
  const backBtn = document.getElementById('arcade-game-back');
  backBtn.onclick = () => {
    stopSnake();
    stopPong();
    stopTetromino();
    stopMinesweeper();
    stopTwo048();
    stopTyping();
    canvas.style.display = 'block';
    document.getElementById('arcade-game-dom').style.display = 'none';
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
      } else if (gameId === 'pong' || gameId === 'tetromino') {
        // Pong / Tetromino recalculate layout each draw frame; no action needed
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

/* ===== PONG GAME ===== */
let pongRaf = 0;
let pongInterval = 0;
let pongState = null;

function startPong(canvas) {
  stopPong();
  const status = document.getElementById('arcade-game-status');
  const scoreEl = document.getElementById('arcade-game-score');

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = Math.floor(canvas.width / dpr);
  const H = Math.floor(canvas.height / dpr);

  const PADDLE_W = 12;
  const PADDLE_H = Math.max(60, Math.floor(H * 0.18));
  const BALL_R = 6;
  const WIN_SCORE = 7;

  let playerY = H / 2 - PADDLE_H / 2;
  let cpuY = H / 2 - PADDLE_H / 2;
  let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  let playerScore = 0;
  let cpuScore = 0;
  let started = false;
  let ended = false;
  let difficulty = 0.75; // CPU speed multiplier (0.5 easy, 0.75 normal, 0.95 hard)
  let particles = [];

  function resetBall(winner) {
    ball.x = W / 2;
    ball.y = H / 2;
    const dir = winner === 'player' ? 1 : -1;
    const speed = 4 + Math.min(4, (playerScore + cpuScore) * 0.4);
    const angle = (Math.random() * Math.PI / 3) - Math.PI / 6;
    ball.vx = Math.cos(angle) * speed * dir;
    ball.vy = Math.sin(angle) * speed;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Center dashed line
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.setLineDash([8, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Scores
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.12)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(cpuScore), W / 4, H * 0.08);
    ctx.fillText(String(playerScore), W * 0.75, H * 0.08);

    // Paddles
    ctx.fillStyle = 'var(--accent, #22d3ee)';
    roundRect(ctx, 18, cpuY, PADDLE_W, PADDLE_H, 4);
    ctx.fill();
    roundRect(ctx, W - 18 - PADDLE_W, playerY, PADDLE_W, PADDLE_H, 4);
    ctx.fill();

    // Ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= 0.05;
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

    if (!started) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.05)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PONG', W / 2, H / 2 - 18);
      ctx.font = `${Math.floor(Math.min(W, H) * 0.025)}px sans-serif`;
      ctx.fillStyle = 'var(--text-secondary, #94a3b8)';
      ctx.fillText('SPACE or TAP to start', W / 2, H / 2 + 18);
    }

    if (ended) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const msg = playerScore >= WIN_SCORE ? 'YOU WIN!' : 'CPU WINS';
      ctx.fillText(msg, W / 2, H / 2 - 16);
      ctx.font = `${Math.floor(Math.min(W, H) * 0.025)}px sans-serif`;
      ctx.fillStyle = 'var(--text-secondary, #94a3b8)';
      ctx.fillText('SPACE to rematch', W / 2, H / 2 + 20);
    }

    pongRaf = requestAnimationFrame(draw);
  }

  function tick() {
    if (!started || ended) return;

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall bounce (top/bottom)
    if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy *= -1; }
    if (ball.y + BALL_R > H) { ball.y = H - BALL_R; ball.vy *= -1; }

    // Paddle collisions
    // Player paddle (right)
    if (ball.x + BALL_R >= W - 18 - PADDLE_W && ball.x + BALL_R <= W - 18 &&
        ball.y >= playerY && ball.y <= playerY + PADDLE_H) {
      ball.x = W - 18 - PADDLE_W - BALL_R;
      const rel = (ball.y - (playerY + PADDLE_H / 2)) / (PADDLE_H / 2);
      ball.vx = -Math.abs(ball.vx) * 1.04;
      ball.vy += rel * 1.5;
      speedCap();
      spawnParticles(ball.x, ball.y, 'var(--accent, #22d3ee)');
    }
    // CPU paddle (left)
    if (ball.x - BALL_R <= 18 + PADDLE_W && ball.x - BALL_R >= 18 &&
        ball.y >= cpuY && ball.y <= cpuY + PADDLE_H) {
      ball.x = 18 + PADDLE_W + BALL_R;
      const rel = (ball.y - (cpuY + PADDLE_H / 2)) / (PADDLE_H / 2);
      ball.vx = Math.abs(ball.vx) * 1.04;
      ball.vy += rel * 1.5;
      speedCap();
      spawnParticles(ball.x, ball.y, 'var(--accent, #22d3ee)');
    }

    // Scoring
    if (ball.x < -BALL_R) {
      playerScore++;
      scoreEl.textContent = `${playerScore} – ${cpuScore}`;
      if (playerScore >= WIN_SCORE) { ended = true; if (status) status.textContent = 'You Win!'; }
      else { resetBall('player'); }
      return;
    }
    if (ball.x > W + BALL_R) {
      cpuScore++;
      scoreEl.textContent = `${playerScore} – ${cpuScore}`;
      if (cpuScore >= WIN_SCORE) { ended = true; if (status) status.textContent = 'CPU Wins'; }
      else { resetBall('cpu'); }
      return;
    }

    // CPU AI — move toward ball, clamped to difficulty
    const targetY = ball.y - PADDLE_H / 2;
    const maxSpeed = 4.2 * difficulty + (playerScore + cpuScore) * 0.12;
    const dy = targetY - cpuY;
    if (dy > maxSpeed) cpuY += maxSpeed;
    else if (dy < -maxSpeed) cpuY -= maxSpeed;
    else cpuY = targetY;
    if (cpuY < 0) cpuY = 0;
    if (cpuY + PADDLE_H > H) cpuY = H - PADDLE_H;
  }

  function speedCap() {
    const max = 9;
    if (Math.abs(ball.vx) > max) ball.vx = Math.sign(ball.vx) * max;
    if (Math.abs(ball.vy) > max) ball.vy = Math.sign(ball.vy) * max;
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.push({
        x, y,
        vx: Math.cos(angle) * (Math.random() * 3 + 1),
        vy: Math.sin(angle) * (Math.random() * 3 + 1),
        life: 1, r: Math.random() * 2.5 + 1,
        color
      });
    }
  }

  function startGame() {
    started = true;
    ended = false;
    playerScore = 0;
    cpuScore = 0;
    playerY = H / 2 - PADDLE_H / 2;
    cpuY = H / 2 - PADDLE_H / 2;
    scoreEl.textContent = '0 – 0';
    if (status) status.textContent = 'First to 7 wins';
    resetBall(Math.random() < 0.5 ? 'player' : 'cpu');
    clearInterval(pongInterval);
    pongInterval = setInterval(tick, 1000 / 60);
  }

  function onKey(e) {
    if (e.code === 'Space') {
      if (!started) { e.preventDefault(); startGame(); return; }
      if (ended) { e.preventDefault(); startGame(); return; }
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      stopPong();
      document.getElementById('arcade-game-panel').classList.remove('active');
      return;
    }
    if (!started || ended) return;
    const step = 18;
    if (['ArrowUp', 'KeyW'].includes(e.code)) { playerY -= step; e.preventDefault(); }
    if (['ArrowDown', 'KeyS'].includes(e.code)) { playerY += step; e.preventDefault(); }
    if (playerY < 0) playerY = 0;
    if (playerY + PADDLE_H > H) playerY = H - PADDLE_H;
  }

  // Touch drag controls
  let touchDragging = false;
  function onTouchStart(e) {
    if (e.touches.length === 1) {
      touchDragging = true;
      onTouchMove(e);
    }
  }
  function onTouchMove(e) {
    if (!touchDragging || !started || ended) return;
    const rect = canvas.getBoundingClientRect();
    const touchY = e.touches[0].clientY - rect.top;
    playerY = touchY - PADDLE_H / 2;
    if (playerY < 0) playerY = 0;
    if (playerY + PADDLE_H > H) playerY = H - PADDLE_H;
  }
  function onTouchEnd() { touchDragging = false; }

  // Click to start/rematch
  function onClick() {
    if (!started) { startGame(); }
    else if (ended) { startGame(); }
  }

  document.addEventListener('keydown', onKey);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  canvas.addEventListener('click', onClick);

  pongState = {
    cleanup() {
      document.removeEventListener('keydown', onKey);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('click', onClick);
    }
  };

  if (status) status.textContent = 'Press SPACE to start';
  scoreEl.textContent = '0 – 0';
  pongRaf = requestAnimationFrame(draw);
}

function stopPong() {
  cancelAnimationFrame(pongRaf);
  clearInterval(pongInterval);
  if (pongState && pongState.cleanup) pongState.cleanup();
  pongState = null;
}

/* ===== TETROMINO GAME ===== */
let tetroRaf = 0;
let tetroInterval = 0;
let tetroState = null;

const TETRO_SHAPES = {
  I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#06b6d4' },
  O: { shape: [[1,1],[1,1]], color: '#eab308' },
  T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#a855f7' },
  L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#f97316' },
  J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#2563eb' },
  S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#22c55e' },
  Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#ef4444' }
};

function newBag() {
  const keys = Object.keys(TETRO_SHAPES);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys;
}

function rotateMatrix(m) {
  const N = m.length;
  const res = Array.from({ length: N }, () => Array(N).fill(0));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      res[x][N - 1 - y] = m[y][x];
    }
  }
  return res;
}

function startTetromino(canvas) {
  stopTetromino();
  const status = document.getElementById('arcade-game-status');
  const scoreEl = document.getElementById('arcade-game-score');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = Math.floor(canvas.width / dpr);
  const H = Math.floor(canvas.height / dpr);

  // Board geometry
  const COLS = 10;
  const ROWS = 20;
  const PREVIEW_CELLS = 4;
  const HOLD_CELLS = 4;
  const PADDING = 10;
  const INFO_WIDTH = 90; // side panels
  const GAME_W = W - INFO_WIDTH * 2 - PADDING * 4;
  const GAME_H = H - PADDING * 2;
  const CS = Math.min(Math.floor(GAME_W / COLS), Math.floor(GAME_H / ROWS)); // cell size
  const OFFX = INFO_WIDTH + PADDING * 2 + Math.floor((GAME_W - COLS * CS) / 2);
  const OFFY = PADDING + Math.floor((GAME_H - ROWS * CS) / 2);

  let board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let bag = newBag();
  let hold = null;
  let holdUsed = false;
  let piece = null;
  let nextPieces = [];
  let score = 0;
  let lines = 0;
  let level = 1;
  let started = false;
  let gameOver = false;
  let particles = [];
  let dropTimer = 0;
  let dropInterval = 800;

  function nextPiece() {
    if (bag.length === 0) bag = newBag();
    const type = bag.shift();
    const def = TETRO_SHAPES[type];
    return { type, matrix: def.shape.map(r => [...r]), color: def.color, x: 3, y: 0 };
  }

  function ensureNext(n = 3) {
    while (nextPieces.length < n) nextPieces.push(nextPiece());
  }

  function spawnPiece() {
    ensureNext();
    piece = nextPieces.shift();
    ensureNext();
    holdUsed = false;
    if (collides(piece.matrix, piece.x, piece.y)) {
      gameOver = true;
      if (status) status.textContent = 'Game Over — SPACE to restart';
      arcadeReportScore('tetromino', score);
    }
  }

  function collides(mat, px, py) {
    for (let y = 0; y < mat.length; y++) {
      for (let x = 0; x < mat[y].length; x++) {
        if (!mat[y][x]) continue;
        const bx = px + x;
        const by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    }
    return false;
  }

  function lockPiece() {
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        const by = piece.y + y;
        const bx = piece.x + x;
        if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) board[by][bx] = piece.color;
      }
    }
    // Clear lines
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(c => c !== null)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++;
        y++; // recheck same row index
      }
    }
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] * level;
      score += points;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(80, 800 - (level - 1) * 60);
      spawnLineParticles(cleared);
    }
    if (scoreEl) scoreEl.textContent = score;
    spawnPiece();
  }

  function tryRotate() {
    const rotated = rotateMatrix(piece.matrix);
    // Wall kicks: try original, then shift left, right, up
    const kicks = [0, -1, 1, -2, 2, 0, -1, 1];
    for (let i = 0; i < kicks.length; i++) {
      const dx = kicks[i];
      const dy = i >= 5 ? -1 : 0;
      if (!collides(rotated, piece.x + dx, piece.y + dy)) {
        piece.matrix = rotated;
        piece.x += dx;
        piece.y += dy;
        return true;
      }
    }
    return false;
  }

  function tryMove(dx, dy) {
    if (!collides(piece.matrix, piece.x + dx, piece.y + dy)) {
      piece.x += dx;
      piece.y += dy;
      return true;
    }
    return false;
  }

  function hardDrop() {
    while (tryMove(0, 1)) { score += 2; }
    lockPiece();
  }

  function swapHold() {
    if (holdUsed) return;
    if (!hold) {
      hold = { type: piece.type, matrix: TETRO_SHAPES[piece.type].shape.map(r => [...r]), color: piece.color };
      spawnPiece();
    } else {
      const old = hold;
      hold = { type: piece.type, matrix: TETRO_SHAPES[piece.type].shape.map(r => [...r]), color: piece.color };
      piece = { type: old.type, matrix: old.matrix.map(r => [...r]), color: old.color, x: 3, y: 0 };
      if (collides(piece.matrix, piece.x, piece.y)) {
        gameOver = true;
        if (status) status.textContent = 'Game Over — SPACE to restart';
        arcadeReportScore('tetromino', score);
      }
    }
    holdUsed = true;
  }

  function spawnLineParticles(clearedRows) {
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: OFFX + Math.random() * COLS * CS,
        y: OFFY + (ROWS - clearedRows * 0.5) * CS,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 4 - 1,
        life: 1, r: Math.random() * 3 + 2,
        color: ['#22d3ee','#f472b6','#fbbf24','#a3e635'][Math.floor(Math.random()*4)]
      });
    }
  }

  function drawBlock(cx, cy, color, size) {
    ctx.fillStyle = color;
    roundRect(ctx, cx + 1, cy + 1, size - 2, size - 2, 3);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(cx + 3, cy + 3, size * 0.35, size * 0.25);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx + size * 0.55, cy + size * 0.65, size * 0.4, size * 0.3);
  }

  function drawMini(matrix, ox, oy, size) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x]) {
          drawBlock(ox + x * size, oy + y * size, TETRO_SHAPES[Object.keys(TETRO_SHAPES).find(k => TETRO_SHAPES[k].color === TETRO_SHAPES[Object.keys(TETRO_SHAPES).find(z => matrix === TETRO_SHAPES[z]?.shape ? false : true)])?.color] || '#94a3b8', size);
        }
      }
    }
  }

  function drawGhost() {
    if (!piece) return;
    let gy = piece.y;
    while (!collides(piece.matrix, piece.x, gy + 1)) gy++;
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        const bx = piece.x + x;
        const by = gy + y;
        if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(OFFX + bx * CS + 1, OFFY + by * CS + 1, CS - 2, CS - 2);
        }
      }
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Side panel backgrounds
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    roundRect(ctx, PADDING, PADDING, INFO_WIDTH, H - PADDING * 2, 8);
    ctx.fill();
    roundRect(ctx, W - INFO_WIDTH - PADDING, PADDING, INFO_WIDTH, H - PADDING * 2, 8);
    ctx.fill();

    // Labels
    ctx.fillStyle = 'var(--text-secondary, #94a3b8)';
    ctx.font = `bold ${Math.max(10, Math.floor(INFO_WIDTH * 0.14))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('HOLD', PADDING + INFO_WIDTH / 2, PADDING + 8);
    ctx.fillText('NEXT', W - INFO_WIDTH / 2 - PADDING, PADDING + 8);

    // Hold piece
    if (hold) {
      const ms = Math.min(INFO_WIDTH * 0.55, HOLD_CELLS * 14);
      const hox = PADDING + (INFO_WIDTH - hold.matrix[0].length * ms) / 2;
      const hoy = PADDING + 30;
      for (let y = 0; y < hold.matrix.length; y++) {
        for (let x = 0; x < hold.matrix[y].length; x++) {
          if (hold.matrix[y][x]) drawBlock(hox + x * ms, hoy + y * ms, hold.color, ms);
        }
      }
    }

    // Next pieces
    const ns = Math.min(INFO_WIDTH * 0.45, PREVIEW_CELLS * 12);
    let ny = PADDING + 30;
    for (let i = 0; i < Math.min(3, nextPieces.length); i++) {
      const np = nextPieces[i];
      const nox = W - INFO_WIDTH - PADDING + (INFO_WIDTH - np.matrix[0].length * ns) / 2;
      for (let y = 0; y < np.matrix.length; y++) {
        for (let x = 0; x < np.matrix[y].length; x++) {
          if (np.matrix[y][x]) drawBlock(nox + x * ns, ny + y * ns, np.color, ns);
        }
      }
      ny += ns * 3.5;
    }

    // Board border
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.strokeRect(OFFX, OFFY, COLS * CS, ROWS * CS);

    // Board background
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(OFFX, OFFY, COLS * CS, ROWS * CS);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(OFFX + x * CS, OFFY);
      ctx.lineTo(OFFX + x * CS, OFFY + ROWS * CS);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(OFFX, OFFY + y * CS);
      ctx.lineTo(OFFX + COLS * CS, OFFY + y * CS);
      ctx.stroke();
    }

    // Locked blocks
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) drawBlock(OFFX + x * CS, OFFY + y * CS, board[y][x], CS);
      }
    }

    // Ghost + active piece
    if (piece) {
      drawGhost();
      for (let y = 0; y < piece.matrix.length; y++) {
        for (let x = 0; x < piece.matrix[y].length; x++) {
          if (!piece.matrix[y][x]) continue;
          const bx = piece.x + x;
          const by = piece.y + y;
          if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
            drawBlock(OFFX + bx * CS, OFFY + by * CS, piece.color, CS);
          }
        }
      }
    }

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

    // HUD inside side panels bottom
    ctx.fillStyle = 'var(--text-secondary, #94a3b8)';
    ctx.font = `bold ${Math.max(10, Math.floor(INFO_WIDTH * 0.14))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL', PADDING + INFO_WIDTH / 2, H - PADDING - 72);
    ctx.fillText(String(level), PADDING + INFO_WIDTH / 2, H - PADDING - 52);
    ctx.fillText('LINES', PADDING + INFO_WIDTH / 2, H - PADDING - 30);
    ctx.fillText(String(lines), PADDING + INFO_WIDTH / 2, H - PADDING - 10);

    // Overlay screens
    if (!started) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(OFFX, OFFY, COLS * CS, ROWS * CS);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(Math.min(COLS * CS, ROWS * CS) * 0.08)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TETROMINO', OFFX + COLS * CS / 2, OFFY + ROWS * CS / 2 - 18);
      ctx.font = `${Math.floor(Math.min(COLS * CS, ROWS * CS) * 0.04)}px sans-serif`;
      ctx.fillStyle = 'var(--text-secondary, #94a3b8)';
      ctx.fillText('SPACE or TAP to start', OFFX + COLS * CS / 2, OFFY + ROWS * CS / 2 + 18);
    }

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(OFFX, OFFY, COLS * CS, ROWS * CS);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(Math.min(COLS * CS, ROWS * CS) * 0.09)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', OFFX + COLS * CS / 2, OFFY + ROWS * CS / 2 - 22);
      ctx.font = `${Math.floor(Math.min(COLS * CS, ROWS * CS) * 0.05)}px sans-serif`;
      ctx.fillText(`Score ${score}`, OFFX + COLS * CS / 2, OFFY + ROWS * CS / 2 + 14);
      ctx.font = `${Math.floor(Math.min(COLS * CS, ROWS * CS) * 0.035)}px sans-serif`;
      ctx.fillStyle = 'var(--text-secondary, #94a3b8)';
      ctx.fillText('SPACE to restart', OFFX + COLS * CS / 2, OFFY + ROWS * CS / 2 + 48);
    }

    tetroRaf = requestAnimationFrame(draw);
  }

  function tick() {
    if (!started || gameOver || !piece) return;
    dropTimer += 1000 / 60; // assume 60fps tick interval; actually we use setInterval at ~16ms
    if (dropTimer >= dropInterval) {
      dropTimer = 0;
      if (!tryMove(0, 1)) lockPiece();
    }
  }

  function resetGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    bag = newBag();
    hold = null;
    holdUsed = false;
    nextPieces = [];
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 800;
    dropTimer = 0;
    started = true;
    gameOver = false;
    particles = [];
    if (scoreEl) scoreEl.textContent = '0';
    if (status) status.textContent = 'Level 1';
    spawnPiece();
  }

  function onKey(e) {
    if (e.code === 'Space') {
      if (!started) { e.preventDefault(); resetGame(); return; }
      if (gameOver) { e.preventDefault(); resetGame(); return; }
      // Hard drop on space if already started
      e.preventDefault();
      hardDrop();
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      stopTetromino();
      document.getElementById('arcade-game-panel').classList.remove('active');
      return;
    }
    if (!started || gameOver) return;
    if (['ArrowLeft', 'KeyA'].includes(e.code)) { e.preventDefault(); tryMove(-1, 0); }
    if (['ArrowRight', 'KeyD'].includes(e.code)) { e.preventDefault(); tryMove(1, 0); }
    if (['ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); if (tryMove(0, 1)) score += 1; }
    if (['ArrowUp', 'KeyW', 'KeyX'].includes(e.code)) { e.preventDefault(); tryRotate(); }
    if (e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); swapHold(); }
    if (e.code === 'KeyZ') { e.preventDefault(); tryRotate(); } // same as up
    if (scoreEl) scoreEl.textContent = score;
  }

  // Touch controls: tap = rotate, swipe left/right = move, swipe down = soft drop, swipe up = hard drop
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  function onTouchStart(e) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  }
  function onTouchEnd(e) {
    if (!started) { resetGame(); return; }
    if (gameOver) { resetGame(); return; }
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const dt = Date.now() - touchStartTime;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    // Tap (short time, little movement) = rotate
    if (dt < 250 && Math.max(absDx, absDy) < 16) {
      tryRotate();
      return;
    }
    if (Math.max(absDx, absDy) < 24) return;
    if (absDx > absDy) {
      if (dx > 0) tryMove(1, 0);
      else tryMove(-1, 0);
    } else {
      if (dy > 0) { if (tryMove(0, 1)) score += 1; }
      else hardDrop();
    }
    if (scoreEl) scoreEl.textContent = score;
  }

  function onClick() {
    if (!started) { resetGame(); }
    else if (gameOver) { resetGame(); }
  }

  document.addEventListener('keydown', onKey);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  canvas.addEventListener('click', onClick);

  tetroState = {
    cleanup() {
      document.removeEventListener('keydown', onKey);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('click', onClick);
    }
  };

  if (status) status.textContent = 'Press SPACE to start';
  if (scoreEl) scoreEl.textContent = '0';
  ensureNext();
  tetroRaf = requestAnimationFrame(draw);
  tetroInterval = setInterval(tick, 1000 / 60);
}

function stopTetromino() {
  cancelAnimationFrame(tetroRaf);
  clearInterval(tetroInterval);
  if (tetroState && tetroState.cleanup) tetroState.cleanup();
  tetroState = null;
}

/* ===== MINESWEEPER ===== */
let mineTimer = 0;
let mineState = null;

function startMinesweeper(container) {
  stopMinesweeper();
  container.innerHTML = '';

  const DIFFICULTIES = {
    easy:   { cols: 9,  rows: 9,  mines: 10 },
    medium: { cols: 16, rows: 16, mines: 40 },
    hard:   { cols: 30, rows: 16, mines: 99 },
  };

  let difficulty = 'easy';
  let { cols, rows, mines } = DIFFICULTIES[difficulty];
  let board = []; // each cell: { mine, revealed, flagged, neighborMines }
  let alive = false;
  let started = false;
  let flags = 0;
  let time = 0;
  let timerInterval = 0;
  let firstClick = true;

  const status = document.getElementById('arcade-game-status');
  const scoreEl = document.getElementById('arcade-game-score');

  function buildUI() {
    container.innerHTML = '';
    container.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.75rem;background:#0a0a0a;padding:0.5rem;overflow:auto;';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'minesweeper-toolbar';
    toolbar.style.cssText = 'display:flex;gap:0.5rem;align-items:center;justify-content:center;flex-wrap:wrap;';

    ['easy','medium','hard'].forEach(d => {
      const btn = document.createElement('button');
      btn.textContent = d[0].toUpperCase() + d.slice(1);
      btn.className = 'minesweeper-diff-btn';
      btn.style.cssText = 'padding:0.35rem 0.6rem;font-size:0.75rem;border-radius:0.4rem;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;font-weight:600;';
      if (d === difficulty) { btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--accent)'; }
      btn.onclick = () => { difficulty = d; newGame(); };
      toolbar.appendChild(btn);
    });

    const stats = document.createElement('div');
    stats.className = 'minesweeper-stats';
    stats.style.cssText = 'display:flex;gap:1rem;font-size:0.85rem;color:var(--text-secondary);font-variant-numeric:tabular-nums;';
    const minesEl = document.createElement('span');
    const timeEl = document.createElement('span');
    stats.appendChild(minesEl);
    stats.appendChild(timeEl);

    toolbar.appendChild(stats);
    container.appendChild(toolbar);

    // Grid
    const gridWrap = document.createElement('div');
    gridWrap.className = 'minesweeper-grid-wrap';
    gridWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;flex:1;overflow:auto;width:100%;';

    const grid = document.createElement('div');
    grid.id = 'minesweeper-grid';
    grid.className = 'minesweeper-grid';
    grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols}, 1fr);gap:2px;background:var(--border);padding:2px;border-radius:var(--radius);`;
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', 'Minesweeper board');

    gridWrap.appendChild(grid);
    container.appendChild(gridWrap);

    return { grid, minesEl, timeEl };
  }

  const { grid, minesEl, timeEl } = buildUI();

  function updateStats() {
    minesEl.textContent = `Mines: ${mines - flags}`;
    timeEl.textContent = `Time: ${time}`;
    if (scoreEl) scoreEl.textContent = String(time);
  }

  function newGame() {
    stopTimer();
    ({ cols, rows, mines } = DIFFICULTIES[difficulty]);
    const ui = buildUI();
    Object.assign(grid, ui.grid);
    Object.assign(minesEl, ui.minesEl);
    Object.assign(timeEl, ui.timeEl);
    board = [];
    alive = true;
    started = true;
    flags = 0;
    time = 0;
    firstClick = true;
    updateStats();
    renderGrid();
    if (status) status.textContent = 'Left click = reveal. Long-press / right-click = flag';
  }

  function placeMines(excludeIndex) {
    const cells = Array.from({ length: cols * rows }, (_, i) => i);
    // Exclude area around first click (3x3)
    const exX = excludeIndex % cols;
    const exY = Math.floor(excludeIndex / cols);
    const safeSet = new Set();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = exX + dx, ny = exY + dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) safeSet.add(ny * cols + nx);
      }
    }
    const candidates = cells.filter(i => !safeSet.has(i));
    // Fisher-Yates shuffle for randomness
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const mineSet = new Set(candidates.slice(0, mines));
    board = Array.from({ length: rows }, (_, y) =
      Array.from({ length: cols }, (_, x) => {
        const idx = y * cols + x;
        return { mine: mineSet.has(idx), revealed: false, flagged: false, neighborMines: 0 };
      })
    );
    // Count neighbors
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && board[ny][nx].mine) n++;
          }
        }
        board[y][x].neighborMines = n;
      }
    }
  }

  function renderGrid() {
    const g = document.getElementById('minesweeper-grid');
    if (!g) return;
    g.innerHTML = '';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = board[y][x];
        const el = document.createElement('button');
        el.className = 'minesweeper-cell';
        el.dataset.x = x;
        el.dataset.y = y;
        el.setAttribute('role', 'gridcell');
        el.style.cssText = 'width:28px;height:28px;border:none;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background 0.1s;';
        if (cell.revealed) {
          el.style.background = 'rgba(255,255,255,0.08)';
          if (cell.mine) {
            el.textContent = '💥';
            el.style.background = '#ef4444';
          } else if (cell.neighborMines > 0) {
            const colors = ['','#3b82f6','#22c55e','#ef4444','#a855f7','#f97316','#06b6d4','#000','#64748b'];
            el.textContent = String(cell.neighborMines);
            el.style.color = colors[cell.neighborMines] || '#fff';
          }
          el.disabled = true;
          el.style.cursor = 'default';
        } else {
          el.style.background = 'rgba(255,255,255,0.2)';
          if (cell.flagged) {
            el.textContent = '🚩';
            el.style.color = '#ef4444';
          }
        }
        el.addEventListener('click', e => onCellClick(x, y, e));
        el.addEventListener('contextmenu', e => { e.preventDefault(); onCellFlag(x, y); });
        // Long-press for flag on touch
        let longPressTimer;
        el.addEventListener('touchstart', e => {
          longPressTimer = setTimeout(() => { onCellFlag(x, y); longPressTimer = null; }, 500);
        }, { passive: true });
        el.addEventListener('touchend', e => {
          if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        });
        el.addEventListener('touchmove', e => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
        g.appendChild(el);
      }
    }
  }

  function onCellClick(x, y, e) {
    if (!alive) { if (!started) newGame(); return; }
    const cell = board[y][x];
    if (cell.flagged || cell.revealed) return;
    if (firstClick) {
      placeMines(y * cols + x);
      firstClick = false;
      startTimer();
    }
    revealCell(x, y);
    checkWin();
  }

  function onCellFlag(x, y) {
    if (!alive) return;
    const cell = board[y][x];
    if (cell.revealed) return;
    if (cell.flagged) { cell.flagged = false; flags--; }
    else { if (flags < mines) { cell.flagged = true; flags++; } }
    updateStats();
    renderGrid();
  }

  function revealCell(x, y) {
    const cell = board[y][x];
    if (cell.revealed || cell.flagged) return;
    cell.revealed = true;
    if (cell.mine) {
      die();
      renderGrid();
      return;
    }
    if (cell.neighborMines === 0) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) revealCell(nx, ny);
        }
      }
    }
  }

  function die() {
    alive = false;
    stopTimer();
    // Reveal all mines
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (board[y][x].mine) board[y][x].revealed = true;
      }
    }
    renderGrid();
    if (status) status.textContent = 'Game Over — Click any cell to restart';
    arcadeReportScore('minesweeper', 0); // zero score on death
  }

  function checkWin() {
    let unrevealedSafe = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!board[y][x].mine && !board[y][x].revealed) unrevealedSafe++;
      }
    }
    if (unrevealedSafe === 0) {
      alive = false;
      stopTimer();
      // Flag all remaining mines
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (board[y][x].mine && !board[y][x].flagged) board[y][x].flagged = true;
        }
      }
      flags = mines;
      updateStats();
      renderGrid();
      if (status) status.textContent = `Win! Time: ${time}s`;
      arcadeReportScore('minesweeper', time);
    }
  }

  function startTimer() {
    timerInterval = setInterval(() => { time++; updateStats(); }, 1000);
  }
  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = 0;
  }

  function onKey(e) {
    if (e.code === 'Escape') {
      e.preventDefault();
      stopMinesweeper();
      document.getElementById('arcade-game-panel').classList.remove('active');
    }
    if (e.code === 'KeyR') {
      e.preventDefault();
      newGame();
    }
  }
  document.addEventListener('keydown', onKey);

  mineState = {
    cleanup() {
      stopTimer();
      document.removeEventListener('keydown', onKey);
    }
  };

  newGame();
}

function stopMinesweeper() {
  if (mineState && mineState.cleanup) mineState.cleanup();
  mineState = null;
}

let t048State = null;
let t048Timer = 0;

function startTwo048(container) {
  stopTwo048();
  container.innerHTML = '';

  const status = document.getElementById('arcade-game-status');
  const scoreEl = document.getElementById('arcade-game-score');

  const GRID_SIZE = 4;
  let board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  let score = 0;
  let best = getHighScores().two048 || 0;
  let undoBoard = null;
  let undoScore = 0;
  let alive = true;
  let won = false;

  function addRandom() {
    const empty = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (board[y][x] === 0) empty.push({ x, y });
      }
    }
    if (empty.length === 0) return false;
    const cell = empty[Math.floor(Math.random() * empty.length)];
    board[cell.y][cell.x] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }

  function newGame() {
    board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    score = 0;
    undoBoard = null;
    undoScore = 0;
    alive = true;
    won = false;
    addRandom();
    addRandom();
    render();
    scoreEl.textContent = score;
    if (status) status.textContent = 'Arrow keys or swipe to move';
  }

  function clone(b) {
    return b.map(row => row.slice());
  }

  function slideRow(row) {
    let filtered = row.filter(v => v !== 0);
    for (let i = 0; i < filtered.length - 1; i++) {
      if (filtered[i] === filtered[i + 1]) {
        filtered[i] *= 2;
        score += filtered[i];
        filtered[i + 1] = 0;
      }
    }
    filtered = filtered.filter(v => v !== 0);
    while (filtered.length < GRID_SIZE) filtered.push(0);
    return filtered;
  }

  function moveLeft() {
    const before = clone(board);
    for (let y = 0; y < GRID_SIZE; y++) {
      board[y] = slideRow(board[y]);
    }
    return boardChanged(before);
  }

  function moveRight() {
    const before = clone(board);
    for (let y = 0; y < GRID_SIZE; y++) {
      board[y] = slideRow(board[y].slice().reverse()).reverse();
    }
    return boardChanged(before);
  }

  function moveUp() {
    const before = clone(board);
    for (let x = 0; x < GRID_SIZE; x++) {
      const col = [];
      for (let y = 0; y < GRID_SIZE; y++) col.push(board[y][x]);
      const merged = slideRow(col);
      for (let y = 0; y < GRID_SIZE; y++) board[y][x] = merged[y];
    }
    return boardChanged(before);
  }

  function moveDown() {
    const before = clone(board);
    for (let x = 0; x < GRID_SIZE; x++) {
      const col = [];
      for (let y = 0; y < GRID_SIZE; y++) col.push(board[y][x]);
      const merged = slideRow(col.reverse()).reverse();
      for (let y = 0; y < GRID_SIZE; y++) board[y][x] = merged[y];
    }
    return boardChanged(before);
  }

  function boardChanged(before) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (before[y][x] !== board[y][x]) return true;
      }
    }
    return false;
  }

  function hasMoves() {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (board[y][x] === 0) return true;
        if (x < GRID_SIZE - 1 && board[y][x] === board[y][x + 1]) return true;
        if (y < GRID_SIZE - 1 && board[y][x] === board[y + 1][x]) return true;
      }
    }
    return false;
  }

  function tryMove(fn) {
    if (!alive) return;
    undoBoard = clone(board);
    undoScore = score;
    const changed = fn();
    if (changed) {
      addRandom();
      if (!won && board.flat().includes(2048)) {
        won = true;
        if (status) status.textContent = 'You reached 2048! Keep going.';
      }
      if (!hasMoves()) {
        alive = false;
        if (status) status.textContent = 'Game Over — SPACE or tap to restart';
        arcadeReportScore('two048', score);
      }
      render();
      scoreEl.textContent = score;
    }
  }

  const TILE_COLORS = {
    2: { bg: 'rgba(255,255,255,0.18)', text: '#e2e8f0' },
    4: { bg: 'rgba(255,255,255,0.22)', text: '#e2e8f0' },
    8: { bg: '#fb923c33', text: '#fdba74' },
    16: { bg: '#f9731633', text: '#fb923c' },
    32: { bg: '#ef444433', text: '#fca5a5' },
    64: { bg: '#dc262633', text: '#fecaca' },
    128: { bg: '#eab30833', text: '#fde047' },
    256: { bg: '#ca8a0433', text: '#fcd34d' },
    512: { bg: '#a855f733', text: '#e9d5ff' },
    1024: { bg: '#7c3aed33', text: '#c4b5fd' },
    2048: { bg: 'var(--accent)', text: '#fff' },
  };

  function render() {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'two048-wrap';
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0.75rem;width:100%;max-width:360px;';

    const scoreRow = document.createElement('div');
    scoreRow.style.cssText = 'display:flex;gap:0.75rem;justify-content:center;width:100%;';

    function mkBox(label, value) {
      const b = document.createElement('div');
      b.style.cssText = 'flex:1;background:var(--surface-raised);border-radius:var(--radius);padding:0.4rem 0.6rem;text-align:center;border:1px solid var(--border);';
      b.innerHTML = `<div style="font-size:0.65rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em;">${label}</div><div style="font-size:1.1rem;font-weight:700;color:var(--text);">${value}</div>`;
      return b;
    }
    scoreRow.appendChild(mkBox('Score', score));
    scoreRow.appendChild(mkBox('Best', Math.max(best, score)));
    wrap.appendChild(scoreRow);

    const grid = document.createElement('div');
    grid.className = 'two048-grid';
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;background:rgba(255,255,255,0.06);padding:0.5rem;border-radius:var(--radius-lg);width:100%;aspect-ratio:1;';

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const val = board[y][x];
        const cell = document.createElement('div');
        const style = TILE_COLORS[val] || { bg: 'transparent', text: 'var(--text)' };
        cell.style.cssText = `display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${val >= 1000 ? '1.1rem' : '1.35rem'};border-radius:var(--radius);background:${style.bg};color:${style.text};transition:transform 0.15s,background 0.15s;`;
        cell.textContent = val || '';
        grid.appendChild(cell);
      }
    }
    wrap.appendChild(grid);

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center;';
    const btn = (label, action) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'padding:0.35rem 0.7rem;font-size:0.8rem;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;';
      b.addEventListener('click', action);
      return b;
    };
    controls.appendChild(btn('New Game', newGame));
    controls.appendChild(btn('Undo', () => {
      if (undoBoard && alive) {
        board = clone(undoBoard);
        score = undoScore;
        undoBoard = null;
        render();
        scoreEl.textContent = score;
      }
    }));
    wrap.appendChild(controls);

    container.appendChild(wrap);
  }

  function onKey(e) {
    if (!alive && e.code === 'Space') { e.preventDefault(); newGame(); return; }
    if (!alive) return;
    if (['ArrowLeft','KeyA'].includes(e.code)) { e.preventDefault(); tryMove(moveLeft); }
    else if (['ArrowRight','KeyD'].includes(e.code)) { e.preventDefault(); tryMove(moveRight); }
    else if (['ArrowUp','KeyW'].includes(e.code)) { e.preventDefault(); tryMove(moveUp); }
    else if (['ArrowDown','KeyS'].includes(e.code)) { e.preventDefault(); tryMove(moveDown); }
    else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); /* undo shortcut handled by button */ }
    else if (e.code === 'Escape') {
      e.preventDefault();
      stopTwo048();
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
    if (!alive) { newGame(); return; }
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 24) return;
    if (absDx > absDy) {
      if (dx > 0) tryMove(moveRight); else tryMove(moveLeft);
    } else {
      if (dy > 0) tryMove(moveDown); else tryMove(moveUp);
    }
  }

  document.addEventListener('keydown', onKey);
  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true });

  t048State = {
    cleanup() {
      document.removeEventListener('keydown', onKey);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
    }
  };

  newGame();
}

function stopTwo048() {
  if (t048State && t048State.cleanup) t048State.cleanup();
  t048State = null;
}

/* ===== TYPING SPEED TEST ===== */
let typingState = null;
let typingTimer = null;

const TYPING_CORPUS = [
  "The quick brown fox jumps over the lazy dog while the sun continues to rise above the distant mountains on a crisp autumn morning.",
  "In the middle of every difficulty lies opportunity that can transform challenges into stepping stones for greater achievements.",
  "Technology is best when it brings people together and creates meaningful connections across vast distances in real time.",
  "Consistency is the key to mastery because small daily improvements compound into extraordinary results over the long term.",
  "The only way to do great work is to love what you do and persist through uncertainty with courage and curiosity.",
  "A journey of a thousand miles begins with a single step taken with purpose and sustained by unwavering determination.",
  "Simplicity is the ultimate sophistication that separates elegant solutions from unnecessary complexity in design.",
  "Creativity is intelligence having fun when constraints inspire innovation and lead to breakthrough discoveries.",
  "Success usually comes to those who are too busy to be looking for it while they build value for others.",
  "Your time is limited so do not waste it living someone else's life or following paths that do not belong to you.",
  "The best way to predict the future is to create it by taking deliberate action today rather than waiting for permission.",
  "Quality is not an act, it is a habit formed through repetition and refinement over countless deliberate iterations.",
  "It always seems impossible until it is done because perspective shifts once effort meets opportunity.",
  "Do not count the days, make the days count by choosing purpose over distraction every single morning.",
  "Change your thoughts and you change your world because perception shapes action and action shapes reality.",
];

function startTyping(container) {
  stopTyping();
  container.innerHTML = '';
  const status = document.getElementById('arcade-game-status');
  const scoreEl = document.getElementById('arcade-game-score');

  const MODES = { time: '60s Time Attack', words: '25 Words', zen: 'Zen (No Limit)' };
  let mode = 'time';
  let targetWords = 25;
  let timeLimit = 60;
  let started = false;
  let ended = false;
  let startTime = 0;
  let elapsed = 0;
  let wordsTyped = 0;
  let charsTyped = 0;
  let correctChars = 0;
  let mistakes = 0;
  let currentWordIndex = 0;
  let currentText = '';
  let wordElements = [];

  function pickParagraph() {
    const p = TYPING_CORPUS[Math.floor(Math.random() * TYPING_CORPUS.length)];
    return p.toLowerCase().replace(/[^a-z ]/g, '');
  }

  function buildText() {
    // Build enough words from corpus paragraphs
    let words = [];
    while (words.length < Math.max(targetWords, 60)) {
      words.push(...pickParagraph().split(/\s+/).filter(Boolean));
    }
    return words;
  }

  function newGame() {
    started = false;
    ended = false;
    elapsed = 0;
    wordsTyped = 0;
    charsTyped = 0;
    correctChars = 0;
    mistakes = 0;
    currentWordIndex = 0;
    wordElements = [];
    scoreEl.textContent = '0 WPM';
    if (status) status.textContent = MODES[mode];

    const words = buildText();
    currentText = words.join(' ');
    renderUI(words);
    input.focus();
  }

  const wrap = document.createElement('div');
  wrap.className = 'typing-wrap';
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0.75rem;width:100%;max-width:720px;padding:0 0.5rem;';

  // Mode selector
  const modeRow = document.createElement('div');
  modeRow.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center;';
  Object.keys(MODES).forEach(k => {
    const b = document.createElement('button');
    b.textContent = MODES[k];
    b.dataset.mode = k;
    b.style.cssText = 'padding:0.3rem 0.7rem;font-size:0.8rem;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;';
    b.addEventListener('click', () => {
      if (started && !ended) return;
      mode = k;
      updateModeButtons();
      newGame();
    });
    modeRow.appendChild(b);
  });
  wrap.appendChild(modeRow);

  function updateModeButtons() {
    Array.from(modeRow.children).forEach(b => {
      if (b.dataset.mode === mode) {
        b.style.background = 'var(--accent)';
        b.style.color = '#fff';
        b.style.borderColor = 'var(--accent)';
      } else {
        b.style.background = 'var(--surface)';
        b.style.color = 'var(--text)';
        b.style.borderColor = 'var(--border)';
      }
    });
  }

  // Stats row
  const statsRow = document.createElement('div');
  statsRow.style.cssText = 'display:flex;gap:0.75rem;justify-content:center;width:100%;';
  function statBox(label, value) {
    const b = document.createElement('div');
    b.style.cssText = 'flex:1;background:var(--surface-raised);border-radius:var(--radius);padding:0.35rem 0.5rem;text-align:center;border:1px solid var(--border);min-width:0;';
    b.innerHTML = `<div style="font-size:0.6rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em;">${label}</div><div style="font-size:1rem;font-weight:700;color:var(--text);white-space:nowrap;">${value}</div>`;
    return b;
  }
  const wpmBox = statBox('WPM', '0');
  const accBox = statBox('Acc', '100%');
  const errBox = statBox('Errors', '0');
  const timeBox = statBox('Time', '0s');
  statsRow.appendChild(wpmBox);
  statsRow.appendChild(accBox);
  statsRow.appendChild(errBox);
  statsRow.appendChild(timeBox);
  wrap.appendChild(statsRow);

  // Word display
  const textDisplay = document.createElement('div');
  textDisplay.className = 'typing-display';
  textDisplay.style.cssText = 'width:100%;background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1rem;min-height:120px;font-size:clamp(0.85rem,2.2vw,1.05rem);line-height:1.7;color:var(--text-secondary);overflow-wrap:break-word;user-select:none;-webkit-user-select:none;caret-color:transparent;';
  wrap.appendChild(textDisplay);

  // Hidden input (captures keyboard events, mobile keyboard)
  const input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  input.style.cssText = 'position:absolute;opacity:0;pointer-events:none;';
  wrap.appendChild(input);

  // Restart + controls hint
  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:0.75rem;color:var(--text-secondary);text-align:center;';
  hint.textContent = 'Start typing to begin. SPACE to submit word.';
  wrap.appendChild(hint);

  container.appendChild(wrap);

  function renderUI(words) {
    textDisplay.innerHTML = '';
    wordElements = [];
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.textContent = w;
      span.dataset.index = i;
      span.style.cssText = 'display:inline-block;padding:0.05rem 0.25rem;margin:0.05rem;border-radius:var(--radius);transition:color 0.15s, background 0.15s;';
      if (i === 0) span.style.background = 'rgba(255,255,255,0.08)';
      textDisplay.appendChild(span);
      wordElements.push(span);
    });
  }

  function updateStats() {
    const now = performance.now();
    const minutes = (now - startTime) / 60000;
    let wpm = 0;
    if (minutes > 0) {
      const grossWpm = (charsTyped / 5) / minutes;
      const accuracy = charsTyped > 0 ? (charsTyped - mistakes) / charsTyped : 1;
      wpm = Math.max(0, Math.round(grossWpm * accuracy));
    }
    const accuracy = charsTyped > 0 ? Math.round(((charsTyped - mistakes) / charsTyped) * 100) : 100;
    wpmBox.lastElementChild.textContent = String(wpm);
    accBox.lastElementChild.textContent = accuracy + '%';
    errBox.lastElementChild.textContent = String(mistakes);
    const timeVal = mode === 'time' ? Math.max(0, Math.round(timeLimit - (now - startTime) / 1000)) : Math.round((now - startTime) / 1000);
    timeBox.lastElementChild.textContent = timeVal + 's';
    scoreEl.textContent = wpm + ' WPM';
  }

  function endGame(reason) {
    if (ended) return;
    ended = true;
    started = false;
    if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
    updateStats();
    const wpm = Number(wpmBox.lastElementChild.textContent) || 0;
    const accuracy = Number(accBox.lastElementChild.textContent.textContent?.replace('%','')) || 100;
    const finalScore = Math.round(wpm * (accuracy / 100));
    if (status) status.textContent = `${reason} — Final: ${wpm} WPM, ${accuracy}% acc`;
    arcadeReportScore('typing', finalScore);
    hint.textContent = 'SPACE or tap to restart';
  }

  function onInput() {
    if (ended) { newGame(); return; }
    if (!started) {
      started = true;
      startTime = performance.now();
      if (mode === 'time') {
        typingTimer = setInterval(() => {
          const elapsedSec = (performance.now() - startTime) / 1000;
          if (elapsedSec >= timeLimit) { endGame('Time up'); }
          else { updateStats(); }
        }, 500);
      } else {
        typingTimer = setInterval(() => { updateStats(); }, 500);
      }
    }
    const val = input.value.trimStart();
    input.value = val; // strip leading spaces
    const target = wordElements[currentWordIndex]?.textContent || '';

    // Check if space pressed -> commit word
    if (input.value.endsWith(' ')) {
      const typedWord = input.value.trim();
      const targetWord = wordElements[currentWordIndex]?.textContent || '';
      wordsTyped++;
      if (typedWord === targetWord) {
        correctChars += typedWord.length + 1;
        charsTyped += typedWord.length + 1;
        wordElements[currentWordIndex].style.color = '#22c55e';
      } else {
        charsTyped += typedWord.length + 1;
        mistakes += typedWord.length + 1;
        wordElements[currentWordIndex].style.color = '#ef4444';
      }
      wordElements[currentWordIndex].style.background = 'transparent';
      currentWordIndex++;
      input.value = '';
      if (wordElements[currentWordIndex]) {
        wordElements[currentWordIndex].style.background = 'rgba(255,255,255,0.08)';
        wordElements[currentWordIndex].style.color = 'var(--text)';
      }
      // Scroll active word into view
      wordElements[currentWordIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

      if (mode === 'words' && wordsTyped >= targetWords) {
        endGame('Goal reached');
        return;
      }
      if (currentWordIndex >= wordElements.length) {
        endGame('Finished text');
        return;
      }
      updateStats();
      return;
    }

    // Live character-level feedback on current word
    const typed = input.value;
    let correctSoFar = true;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] !== target[i]) correctSoFar = false;
    }
    const el = wordElements[currentWordIndex];
    if (el) {
      if (!correctSoFar || typed.length > target.length) {
        el.style.color = '#f59e0b'; // amber warning
      } else {
        el.style.color = 'var(--text)';
      }
    }
  }

  function onKey(e) {
    if (!started && e.code === 'Space') { e.preventDefault(); return; }
    if (ended && e.code === 'Space') { e.preventDefault(); newGame(); return; }
    if (e.code === 'Escape') {
      e.preventDefault();
      stopTyping();
      document.getElementById('arcade-game-panel').classList.remove('active');
      return;
    }
    input.focus();
  }

  // Tap display to focus input (mobile)
  function onTap() { input.focus(); }

  input.addEventListener('input', onInput);
  document.addEventListener('keydown', onKey);
  textDisplay.addEventListener('click', onTap);

  typingState = {
    cleanup() {
      if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
      input.removeEventListener('input', onInput);
      document.removeEventListener('keydown', onKey);
      textDisplay.removeEventListener('click', onTap);
    }
  };

  updateModeButtons();
  newGame();
}

function stopTyping() {
  if (typingState && typingState.cleanup) typingState.cleanup();
  typingState = null;
}

/* Public API for game modules */
export function arcadeReportScore(gameId, score) {
  if (saveHighScore(gameId, score)) {
    const el = document.querySelector(`.arcade-card-score[data-score-for="${gameId}"]`);
    if (el) el.textContent = `Best ${formatNumber(score)}`;
  }
}
