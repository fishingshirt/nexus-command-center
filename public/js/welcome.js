/**
 * welcome.js — Cinematic Onboarding Experience (T-033)
 */

const AUDIO_PATH = 'assets/audio/we-do-what-we-want-edit.mp3';

const COPY_LINES = [
  { time: 2.0,   text: "I DON'T SLEEP." },
  { time: 4.5,   text: "I DON'T EAT." },
  { time: 7.0,   text: "I WORK 24/7 FOR YOU." },
  { time: 10.0,  text: "Sick? I'll put in a good word for you." },
  { time: 14.0,  text: "Not sick and just wanna call off? No problem." },
  { time: 18.0,  text: "Welcome to the future." },
  { time: 21.0,  text: "Are you ready?" },
];

const SHOWCASE_BEATS = [
  { time: 24.0,  text: "Your calendar — optimized by AI.",                   icon: '📅' },
  { time: 26.5,  text: "Your tasks — auto-prioritized. I sort the noise.",   icon: '✅' },
  { time: 29.0,  text: "Your notes — summarized in seconds.",                  icon: '📝' },
  { time: 31.5,  text: "Your weather — always one glance away.",              icon: '☀️' },
  { time: 34.0,  text: "Your system — monitored 24/7. I see everything.",    icon: '💻' },
  { time: 36.5,  text: "Your data — backed up and encrypted.",               icon: '🔐' },
  { time: 39.0,  text: "Your inbox — sorted before you wake up.",            icon: '📬' },
  { time: 41.5,  text: "Your terminal — real-time system control.",         icon: '⌨️' },
  { time: 44.0,  text: "Your AI assistant — always one message away.",      icon: '🤖' },
  { time: 46.5,  text: "Your smart home — lights, locks, climate.",         icon: '🏠' },
  { time: 49.0,  text: "Your portfolio — crypto, stocks, net worth.",       icon: '📈' },
  { time: 51.5,  text: "Your music — soundtrack to your command center.",    icon: '🎵' },
  { time: 54.0,  text: "Your games — when you need to disconnect.",        icon: '🎮' },
  { time: 56.5,  text: "Your files — organized, searchable, secure.",      icon: '📁' },
  { time: 59.0,  text: "Your command center awaits.",                        icon: '🔷' },
];

const PHASE = { START: 0, SHOWCASE: 22, LANDING: 64, END: 78 };

let audioCtx, analyser, audio;
let phaseRaf, beatRaf, particleRaf;
let currentPhase = 0;
let userName = '';
let isCleanedUp = false;
let cineStart = 0;           // performance.now() when cinematic began

function getOverlay() { return document.getElementById('welcome-overlay'); }
function getContent() { return document.querySelector('.welcome-content'); }
function getApp()     { return document.getElementById('app'); }

/* ========= PUBLIC INIT ========= */
export function initWelcome() {
  const overlay = getOverlay();
  if (!overlay) { revealApp(); return; }

  // Respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hideOverlay(); revealApp(); return;
  }

  const settings = loadSettings();
  const hasSeen  = localStorage.getItem('ncc-welcome-shown') === 'true';
  const shouldShow = settings.showWelcomeOnBoot || !hasSeen;

  if (!shouldShow) {
    hideOverlay(); revealApp(); return;
  }

  // SURPRISE: only show overlay; #app stays hidden via inline style until dismissed
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');

  buildPhase1();
}

/* ========= PHASE 1: NAME PROMPT ========= */
function buildPhase1() {
  const content = getContent(); if (!content) return;
  content.innerHTML = '';
  content.className = 'welcome-content phase1';

  // Vignette appended to overlay
  const overlay = getOverlay();
  if (overlay && !overlay.querySelector('.welcome-vignette')) {
    const vig = document.createElement('div');
    vig.className = 'welcome-vignette';
    overlay.appendChild(vig);
  }

  const brand = document.createElement('div');
  brand.className = 'welcome-brand';
  brand.textContent = 'NEXUS';
  content.appendChild(brand);

  const prompt = document.createElement('div');
  prompt.className = 'welcome-prompt';
  prompt.textContent = "What's your name?";
  content.appendChild(prompt);

  const wrap = document.createElement('div');
  wrap.className = 'welcome-input-wrap';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'welcome-name-input';
  input.placeholder = 'Enter your name';
  input.maxLength = 30;
  input.autocomplete = 'off';
  wrap.appendChild(input);
  content.appendChild(wrap);

  const btn = document.createElement('button');
  btn.className = 'welcome-cta';
  btn.id = 'welcome-start-btn';
  btn.innerHTML = '<span>START</span>';
  btn.disabled = true; // enabled when audio ready
  content.appendChild(btn);

  const status = document.createElement('div');
  status.className = 'welcome-audio-status';
  status.textContent = '🎵 Loading audio…';
  content.appendChild(status);

  const skip = document.createElement('button');
  skip.className = 'welcome-skip';
  skip.textContent = 'Skip Intro';
  content.appendChild(skip);

  input.focus();

  // Preload audio
  preloadAudio(status, () => {
    btn.disabled = false;
    btn.classList.add('ready');
    status.textContent = '🎵 Audio ready. Press START.';
    status.classList.add('ready');
  });

  btn.addEventListener('click', () => {
    userName = input.value.trim();
    if (userName) localStorage.setItem('ncc-welcome-name', userName);
    startCinematic();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') btn.click();
  });

  skip.addEventListener('click', dismissWelcome);
}

/* ========= AUDIO PRELOAD ========= */
function preloadAudio(statusEl, onReady) {
  let fired = false;
  const fire = () => { if (!fired) { fired = true; onReady(); } };

  audio = new Audio(AUDIO_PATH);
  audio.preload = 'auto';

  audio.addEventListener('canplaythrough', () => {
    statusEl.textContent = '🎵 Audio ready. Press START.';
    statusEl.classList.add('ready');
    fire();
  }, { once: true });

  audio.addEventListener('error', () => {
    statusEl.textContent = '⚠️ Audio unavailable. Starting without music.';
    statusEl.classList.add('warning');
    fire();
  }, { once: true });

  audio.addEventListener('ended', () => {
    console.log('[welcome] audio ended');
  }, { once: true });

  audio.load();
  setTimeout(() => { if (audio.readyState < 3 && !fired) fire(); }, 5000);
}

/* ========= START CINEMATIC ========= */
function startCinematic() {
  const content = getContent(); if (!content) return;
  content.innerHTML = '';
  content.className = 'welcome-content cinematic';

  cineStart = performance.now();

  // Wire Web Audio (may fail on autoplay policies — that's OK, visual timer runs regardless)
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
    }
    const src = audioCtx.createMediaElementSource(audio);
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch (e) {
    console.warn('[welcome] Web Audio setup failed:', e.message);
  }

  audio.currentTime = 0;
  audio.volume = 1.0;

  const playAttempt = audio.play();
  if (playAttempt && typeof playAttempt.then === 'function') {
    playAttempt.catch(err => console.warn('[welcome] Autoplay blocked:', err.message));
  }

  currentPhase = 1;
  isCleanedUp = false;
  runPhaseEngine();
  runBeatEngine();
  runParticleEngine();
}

/* ========= TIME SOURCE ========= */
function getCineTime() {
  // Always returns a monotonically increasing time in seconds.
  // If audio is playing, tracks the song position.
  // If audio is paused/blocked/ended, falls back to wall-clock since cineStart.
  if (audio && !audio.paused) return audio.currentTime;
  return (performance.now() - cineStart) / 1000;
}

/* ========= PHASE ENGINE ========= */
function runPhaseEngine() {
  function tick() {
    if (isCleanedUp) return;
    const t = getCineTime();

    if (t < PHASE.SHOWCASE) {
      if (currentPhase !== 2) { currentPhase = 2; renderBeatText(); }
      updateBeatText(t);
    } else if (t < PHASE.LANDING) {
      if (currentPhase !== 3) { currentPhase = 3; renderShowcase(); }
      updateShowcase(t);
    } else if (t < PHASE.END) {
      if (currentPhase !== 4) { currentPhase = 4; startFadeOut(); }
    } else {
      dismissWelcome();
      return;
    }

    phaseRaf = requestAnimationFrame(tick);
  }
  tick();
}

/* ========= BEAT ENGINE ========= */
function runBeatEngine() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  let lastBeat = 0;

  function tick() {
    if (isCleanedUp) return;
    if (!audio || audio.paused) { beatRaf = requestAnimationFrame(tick); return; }
    analyser.getByteFrequencyData(data);
    let bass = 0;
    for (let i = 0; i < Math.min(6, data.length); i++) bass += data[i];
    bass /= Math.min(6, data.length);
    const now = performance.now() / 1000;
    if (bass > 180 && (now - lastBeat) > 0.35) {
      lastBeat = now;
      onBeat();
    }
    beatRaf = requestAnimationFrame(tick);
  }
  tick();
}

function onBeat() {
  const active = document.querySelector('.beat-text.active, .showcase-line.visible');
  if (active) {
    active.classList.remove('beat-pulse');
    void active.offsetWidth; // force reflow to retrigger css animation
    active.classList.add('beat-pulse');
  }
  const flash = document.querySelector('.welcome-flash');
  if (flash) {
    flash.style.opacity = '0.12';
    setTimeout(() => { if (flash) flash.style.opacity = '0'; }, 80);
  }
  spawnParticles(8);
}

/* ========= PHASE 2: BEAT TEXT ========= */
let beatTextEls = [];

function renderBeatText() {
  const content = getContent(); if (!content) return;
  addFlash(content);
  beatTextEls = [];
  COPY_LINES.forEach(line => {
    const el = document.createElement('div');
    el.className = 'beat-text';
    el.textContent = line.text;
    el.dataset.time = String(line.time);
    content.appendChild(el);
    beatTextEls.push(el);
  });
}

function updateBeatText(t) {
  beatTextEls.forEach(el => {
    const time = parseFloat(el.dataset.time);
    const active = t >= time && t < time + 1.8;
    el.classList.toggle('active', active);
    // Let CSS handle all transforms — no inline style manipulation to prevent jump
  });
}

/* ========= PHASE 3: SHOWCASE ========= */
let showcaseEls = [];

function renderShowcase() {
  const content = getContent(); if (!content) return;
  content.innerHTML = '';
  addFlash(content);
  addParticleLayer(content);
  showcaseEls = [];
  SHOWCASE_BEATS.forEach(beat => {
    const el = document.createElement('div');
    el.className = 'showcase-line';
    el.dataset.time = String(beat.time);
    el.innerHTML = `<span class="showcase-icon">${beat.icon}</span><span class="showcase-text">${beat.text}</span>`;
    content.appendChild(el);
    showcaseEls.push(el);
  });
}

function updateShowcase(t) {
  showcaseEls.forEach(el => {
    const time = parseFloat(el.dataset.time);
    const dt = t - time;
    const visible = dt >= 0 && dt < 2.2;
    el.classList.toggle('visible', visible);

    if (dt < 0) {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -50%) scale(0.92)';
    } else if (dt < 0.3) {
      const p = dt / 0.3;
      el.style.opacity = String(p);
      el.style.transform = `translate(-50%, -50%) scale(${0.92 + p * 0.08})`;
    } else if (dt < 1.9) {
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%, -50%) scale(1)';
    } else {
      const p = Math.max(0, 1 - (dt - 1.9) / 0.3);
      el.style.opacity = String(p);
      el.style.transform = `translate(-50%, -50%) scale(${1 - (1 - p) * 0.08})`;
    }
  });
}

/* ========= PARTICLE ENGINE ========= */
function runParticleEngine() {
  function tick() {
    if (isCleanedUp) return;
    document.querySelectorAll('.particle').forEach(pt => {
      let x = parseFloat(pt.dataset.x), y = parseFloat(pt.dataset.y);
      let vx = parseFloat(pt.dataset.vx), vy = parseFloat(pt.dataset.vy);
      let life = parseFloat(pt.dataset.life) - 0.015;
      if (life <= 0) { pt.remove(); return; }
      x += vx; y += vy; vy += 0.04;
      Object.assign(pt.dataset, { x: String(x), y: String(y), vy: String(vy), life: String(life) });
      pt.style.transform = `translate(${x}px, ${y}px)`;
      pt.style.opacity = String(life);
    });
    particleRaf = requestAnimationFrame(tick);
  }
  tick();
}

function spawnParticles(count = 6) {
  const layer = document.getElementById('particle-layer') || getContent();
  if (!layer) return;
  const { width, height } = layer.getBoundingClientRect();
  const cx = width / 2, cy = height / 2;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    const pt = document.createElement('div');
    pt.className = 'particle';
    Object.assign(pt.dataset, {
      x: '0', y: '0',
      vx: String(Math.cos(angle) * speed),
      vy: String(Math.sin(angle) * speed),
      life: '1'
    });
    pt.style.left = `${cx}px`;
    pt.style.top  = `${cy}px`;
    layer.appendChild(pt);
  }
}

/* ========= PHASE 4: FADE OUT & LANDING ========= */
function startFadeOut() {
  const content = getContent(); if (!content) { dismissWelcome(); return; }
  content.innerHTML = '';
  content.className = 'welcome-content phase4';

  const saved = localStorage.getItem('ncc-welcome-name');
  const displayName = saved || 'Commander';

  const line1 = document.createElement('div');
  line1.className = 'welcome-farewell';
  line1.textContent = `Welcome back, ${displayName}`;
  content.appendChild(line1);

  const line2 = document.createElement('div');
  line2.className = 'welcome-farewell-sub';
  line2.textContent = 'Welcome to the future';
  content.appendChild(line2);

  const fadeStart = getCineTime();
  function tick() {
    if (isCleanedUp) return;
    const elapsed = getCineTime() - fadeStart;
    if (audio && !audio.paused) {
      const vol = Math.max(0, 1 - elapsed / 14);
      audio.volume = vol;
    }
    if (elapsed < 14) {
      requestAnimationFrame(tick);
    } else {
      if (audio) audio.pause();
      dismissWelcome();
    }
  }
  requestAnimationFrame(tick);
}

/* ========= DISMISS & CLEANUP ========= */
export function dismissWelcome() {
  if (isCleanedUp) return;
  isCleanedUp = true;

  cancelAnimationFrame(phaseRaf);
  cancelAnimationFrame(beatRaf);
  cancelAnimationFrame(particleRaf);

  try {
    if (audio) { audio.pause(); audio.currentTime = 0; audio.volume = 1; }
    if (audioCtx && audioCtx.state !== 'closed') audioCtx.suspend?.();
  } catch (e) { /* no-op */ }

  const overlay = getOverlay();
  if (overlay) {
    overlay.style.transition = 'opacity 0.8s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.display = 'none';
      overlay.style.opacity = '';
      overlay.style.transition = '';
      cleanupOverlay();
      revealApp();
    }, 800);
  } else {
    revealApp();
  }

  localStorage.setItem('ncc-welcome-shown', 'true');
  const settings = loadSettings();
  saveSettings({ ...settings, showWelcomeOnBoot: false });
  const cb = document.getElementById('show-welcome');
  if (cb) cb.checked = false;
}

function cleanupOverlay() {
  const overlay = getOverlay();
  if (!overlay) return;
  overlay.querySelectorAll('.welcome-vignette').forEach(el => el.remove());
  const content = getContent();
  if (content) content.innerHTML = '';
}

/* ========= APP VISIBILITY HELPERS ========= */
function revealApp() {
  const app = getApp();
  if (app) {
    // .welcome-ready overrides the inline `display:none !important` on #app
    app.classList.add('welcome-ready');
    app.focus?.();
  }
}
function hideOverlay() {
  const overlay = getOverlay();
  if (overlay) {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.display = 'none';
    overlay.style.opacity = '';
    overlay.style.transition = '';
  }
}

/* ========= DOM UTILITIES ========= */
function addFlash(container) {
  const f = document.createElement('div');
  f.className = 'welcome-flash';
  getOverlay().appendChild(f);
}
function addParticleLayer(container) {
  const p = document.createElement('div');
  p.className = 'particle-layer';
  p.id = 'particle-layer';
  container.appendChild(p);
}

/* ========= SETTINGS HELPERS ========= */
function loadSettings() {
  try { return JSON.parse(localStorage.getItem('ncc-settings') || '{}'); }
  catch { return {}; }
}
function saveSettings(patch) {
  const s = loadSettings();
  Object.assign(s, patch);
  localStorage.setItem('ncc-settings', JSON.stringify(s));
}
