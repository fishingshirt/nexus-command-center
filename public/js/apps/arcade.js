/* ===== ARCADE APP SHELL ===== */
const GAMES = [
  { id: 'snake', name: 'Snake', desc: 'Classic snake. Eat, grow, don\'t crash.', icon: '🐍', comingSoon: false },
  { id: 'pong', name: 'Pong', desc: 'VS CPU paddle battle.', icon: '🏓', comingSoon: false },
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
  } else if (gameId === 'pong') {
    startPong(canvas);
  } else {
    drawPlaceholder(canvas, game);
  }

  // Back button
  const backBtn = document.getElementById('arcade-game-back');
  backBtn.onclick = () => {
    stopSnake();
    stopPong();
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

/* Public API for game modules */
export function arcadeReportScore(gameId, score) {
  if (saveHighScore(gameId, score)) {
    const el = document.querySelector(`.arcade-card-score[data-score-for="${gameId}"]`);
    if (el) el.textContent = `Best ${formatNumber(score)}`;
  }
}
