/**
 * welcome.js — Cinematic Onboarding Experience (T-033)
 * Song-driven, beat-reactive welcome intro for Nexus Command Center.
 * Phases:
 *   1. Name prompt (pre-audio)
 *   2. Beat-reactive text sequence (0:00 – 0:22)
 *   3. Feature showcase montage (0:22 – 1:45)
 *   4. Landing / fade-out (1:45 – 2:00)
 */

const AUDIO_PATH = 'assets/audio/we-do-what-we-want-edit.mp3';
const BPM_FALLBACK = 128;
const BEAT_INTERVAL = 60 / BPM_FALLBACK; // ~0.46875s

// ========== CONFIG ==========
const COPY_LINES = [
  { time: 2.0,   text: "I DON'T SLEEP.",                        tile: null,   effect: 'flash' },
  { time: 4.5,   text: "I DON'T EAT.",                          tile: null,   effect: 'flash' },
  { time: 7.0,   text: "I WORK 24/7 FOR YOU.",                  tile: null,   effect: 'pulse' },
  { time: 10.0,  text: "Sick? I'll text and email who needs to know.", tile: 'phone', effect: 'zoom' },
  { time: 14.0,  text: "Not sick and just wanna call off? No problem.", tile: 'phone', effect: 'zoom' },
  { time: 18.0,  text: "Welcome to the future.",                tile: null,   effect: 'pulse' },
  { time: 21.0,  text: "Are you ready?",                        tile: null,   effect: 'flash' },
];

const SHOWCASE_BEATS = [
  { time: 24.0,  text: "Your calendar — optimized by AI.",                           tile: 'calendar', icon: '📅', effect: 'zoom' },
  { time: 33.0,  text: "Your tasks — auto-prioritized. I sort the noise.",           tile: 'todo',     icon: '✅', effect: 'zoom' },
  { time: 42.0,  text: "Your notes — summarized in seconds.",                        tile: 'notes',    icon: '📝', effect: 'zoom' },
  { time: 51.0,  text: "Your weather — always one glance away.",                     tile: 'weather',  icon: '☀️', effect: 'zoom' },
  { time: 60.0,  text: "Your system — monitored 24/7. I see everything.",            tile: 'feedback', icon: '💬', effect: 'zoom' },
  { time: 69.0,  text: "Your data — backed up and encrypted. Even I can't peek.",    tile: 'phone',    icon: '📱', effect: 'zoom' },
  { time: 78.0,  text: "Your inbox — sorted by AI before you wake up.",            tile: 'chat',     icon: '💬', effect: 'zoom' },
  { time: 87.0,  text: "Your terminal — real-time system control.",                 tile: 'feedback', icon: '🖥️', effect: 'zoom' },
  { time: 96.0,  text: "Your games — right here when you need a break.",             tile: 'feedback', icon: '🎮', effect: 'zoom' },
  { time: 105.0, text: "Your command center awaits.",                                tile: null,       icon: '🔷', effect: 'pulse' },
];

const PHASE_THRESHOLDS = {
  START:      0,
  SHOWCASE:   22,
  LANDING:    105,
  END:        120,
};

let audioCtx, analyser, audio, source;
let beatFrameId, phaseFrameId, particleFrameId;
let currentPhase = 0;
let userName = '';

// ========== DOM REFS ==========
function getOverlay()  { return document.getElementById('welcome-overlay'); }
function getContent()  { return document.querySelector('.welcome-content'); }

// ========== PUBLIC INIT ==========
export function initWelcome() {
  const overlay = getOverlay();
  if (!overlay) return;

  // Skip if user prefers reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    overlay.style.display = 'none';
    return;
  }

  const settings = loadSettings();
  const hasSeen = localStorage.getItem('ncc-welcome-shown') === 'true';
  const shouldShow = settings.showWelcomeOnBoot || !hasSeen;

  if (!shouldShow) {
    overlay.style.display = 'none';
    document.getElementById('app')?.classList.remove('hidden');
    return;
  }

  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  document.getElementById('app')?.classList.add('hidden');

  buildPhase1();
}

// ========== PHASE 1: NAME PROMPT ==========
function buildPhase1() {
  const content = getContent();
  content.innerHTML = '';
  content.className = 'welcome-content phase1';

  const vignette = document.createElement('div');
  vignette.className = 'welcome-vignette';
  overlay.appendChild(vignette);

  const brand = document.createElement('div');
  brand.className = 'welcome-brand';
  brand.textContent = 'NEXUS';
  content.appendChild(brand);

  const prompt = document.createElement('div');
  prompt.className = 'welcome-prompt';
  prompt.textContent = "What's your name?";
  content.appendChild(prompt);

  const inputWrap = document.createElement('div');
  inputWrap.className = 'welcome-input-wrap';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'welcome-name-input';
  input.placeholder = 'Enter your name';
  input.maxLength = 30;
  input.autocomplete = 'off';
  inputWrap.appendChild(input);
  content.appendChild(inputWrap);

  const btn = document.createElement('button');
  btn.className = 'welcome-cta';
  btn.id = 'welcome-start-btn';
  btn.innerHTML = '<span>START</span>';
  content.appendChild(btn);

  // Audio preload status
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

// ========== AUDIO PRELOAD ==========
function preloadAudio(statusEl, onReady) {
  audio = new Audio(AUDIO_PATH);
  audio.preload = 'auto';

  const fail = () => {
    statusEl.textContent = '⚠️ Audio unavailable. Starting without music.';
    statusEl.classList.add('warning');
    onReady();
  };

  audio.addEventListener('canplaythrough', () => {
    statusEl.textContent = '🎵 Audio ready. Press START.';
    statusEl.classList.add('ready');
    onReady();
  }, { once: true });

  audio.addEventListener('error', fail, { once: true });
  audio.load();

  // Fallback timeout
  setTimeout(() => {
    if (audio.readyState < 3) fail();
  }, 5000);
}

// ========== START CINEMATIC ==========
function startCinematic() {
  const content = getContent();
  content.innerHTML = '';
  content.className = 'welcome-content cinematic';

  // Init Web Audio for beat detection
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch (e) {
    console.warn('[welcome] Web Audio API unavailable, using timed fallback');
  }

  audio.volume = 1.0;
  audio.currentTime = 0;
  const playProm = audio.play();
  if (playProm && playProm.catch) playProm.catch(() => {});

  currentPhase = 1;
  runPhaseEngine();
  runBeatEngine();
  runParticleEngine();
}

// ========== PHASE ENGINE ==========
function runPhaseEngine() {
  const content = getContent();
  const overlay = getOverlay();

  function tick() {
    if (!audio || audio.paused) {
      phaseFrameId = requestAnimationFrame(tick);
      return;
    }
    const t = audio.currentTime;

    // Phase 2: Beat-reactive text (0:00 – 0:22)
    if (t < PHASE_THRESHOLDS.SHOWCASE) {
      if (currentPhase !== 2) {
        currentPhase = 2;
        content.classList.add('phase2');
        renderBeatText();
      }
      updateBeatText(t);
    }
    // Phase 3: Showcase montage (0:22 – 1:45)
    else if (t < PHASE_THRESHOLDS.LANDING) {
      if (currentPhase !== 3) {
        currentPhase = 3;
        content.classList.remove('phase2');
        content.classList.add('phase3');
        renderShowcase();
      }
      updateShowcase(t);
    }
    // Phase 4: Landing (1:45 – 2:00)
    else if (t < PHASE_THRESHOLDS.END) {
      if (currentPhase !== 4) {
        currentPhase = 4;
        content.classList.remove('phase3');
        content.classList.add('phase4');
        startFadeOut();
      }
    }
    // End
    else {
      dismissWelcome();
      return;
    }

    phaseFrameId = requestAnimationFrame(tick);
  }
  tick();
}

// ========== BEAT ENGINE (Web Audio) ==========
function runBeatEngine() {
  if (!analyser) return; // fallback handled by timestamps
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  let lastBeatTime = 0;
  const BEAT_COOLDOWN = 0.35; // seconds

  function tick() {
    if (!audio || audio.paused) {
      beatFrameId = requestAnimationFrame(tick);
      return;
    }
    analyser.getByteFrequencyData(dataArray);

    // Bass (20–150Hz) ≈ bins 0–5 at 44.1kHz / 256 FFT
    let bass = 0;
    const binCount = Math.min(6, dataArray.length);
    for (let i = 0; i < binCount; i++) bass += dataArray[i];
    bass /= binCount;

    const t = audio.currentTime;
    if (bass > 180 && (t - lastBeatTime) > BEAT_COOLDOWN) {
      lastBeatTime = t;
      onBeat(t);
    }
    beatFrameId = requestAnimationFrame(tick);
  }
  tick();
}

function onBeat(t) {
  // Trigger visual pulse on active text/tile
  const active = document.querySelector('.beat-text.active, .showcase-line.active');
  if (active) {
    active.classList.remove('beat-pulse');
    void active.offsetWidth; // reflow
    active.classList.add('beat-pulse');
  }

  // Screen flash
  const flash = document.querySelector('.welcome-flash');
  if (flash) {
    flash.style.opacity = '0.12';
    setTimeout(() => { if (flash) flash.style.opacity = '0'; }, 80);
  }

  spawnParticles(8);
}

// ========== RENDER PHASE 2 (Beat Text) ==========
let beatTextEls = [];

function renderBeatText() {
  const content = getContent();
  content.innerHTML = '';

  const flash = document.createElement('div');
  flash.className = 'welcome-flash';
  content.appendChild(flash);

  COPY_LINES.forEach((line, i) => {
    const el = document.createElement('div');
    el.className = 'beat-text';
    el.dataset.time = line.time;
    el.textContent = line.text;
    el.style.opacity = '0';
    el.style.transform = 'scale(0.9)';
    content.appendChild(el);
    beatTextEls.push(el);
  });
}

function updateBeatText(t) {
  beatTextEls.forEach(el => {
    const time = parseFloat(el.dataset.time);
    const active = Math.abs(t - time) < 1.5;
    el.classList.toggle('active', active);
    if (active) {
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
      // Slight letter-spacing breath
      const breath = Math.sin((t - time) * 3) * 2;
      el.style.letterSpacing = `${breath}px`;
    } else if (t > time + 1.5) {
      el.style.opacity = '0';
      el.style.transform = 'scale(1.05)';
    }
  });
}

// ========== RENDER PHASE 3 (Showcase) ==========
let showcaseEls = [];

function renderShowcase() {
  const content = getContent();
  content.innerHTML = '';

  const flash = document.createElement('div');
  flash.className = 'welcome-flash';
  content.appendChild(flash);

  // Particle container
  const particles = document.createElement('div');
  particles.className = 'particle-layer';
  particles.id = 'particle-layer';
  content.appendChild(particles);

  SHOWCASE_BEATS.forEach((beat, i) => {
    const el = document.createElement('div');
    el.className = 'showcase-line';
    el.dataset.time = beat.time;
    el.dataset.tile = beat.tile || '';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'showcase-icon';
    iconSpan.textContent = beat.icon;

    const textSpan = document.createElement('span');
    textSpan.className = 'showcase-text';
    textSpan.textContent = beat.text;

    el.appendChild(iconSpan);
    el.appendChild(textSpan);
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px) scale(0.95)';
    content.appendChild(el);
    showcaseEls.push(el);
  });
}

function updateShowcase(t) {
  showcaseEls.forEach(el => {
    const time = parseFloat(el.dataset.time);
    const delta = t - time;
    const active = delta >= 0 && delta < 8;
    el.classList.toggle('active', active);

    if (delta < 0) {
      // Before this beat
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px) scale(0.95)';
    } else if (delta < 0.5) {
      // Pop in
      const p = delta / 0.5;
      el.style.opacity = String(p);
      el.style.transform = `translateY(${(1 - p) * 20}px) scale(${0.95 + p * 0.05})`;
    } else if (delta < 6) {
      // Hold
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    } else {
      // Fade out
      const p = 1 - (delta - 6) / 2;
      el.style.opacity = String(Math.max(0, p));
      el.style.transform = `translateY(-${(1 - p) * 20}px) scale(${1 + (1 - p) * 0.03})`;
    }
  });
}

// ========== PARTICLE ENGINE ==========
function runParticleEngine() {
  const layer = document.getElementById('particle-layer') || getContent();

  function tick() {
    const p = layer.querySelectorAll('.particle');
    p.forEach(pt => {
      let x = parseFloat(pt.dataset.x);
      let y = parseFloat(pt.dataset.y);
      let vx = parseFloat(pt.dataset.vx);
      let vy = parseFloat(pt.dataset.vy);
      let life = parseFloat(pt.dataset.life);
      life -= 0.02;
      if (life <= 0) {
        pt.remove();
        return;
      }
      x += vx; y += vy;
      vy += 0.05; // gravity
      pt.dataset.x = String(x);
      pt.dataset.y = String(y);
      pt.dataset.life = String(life);
      pt.style.transform = `translate(${x}px, ${y}px)`;
      pt.style.opacity = String(life);
    });
    particleFrameId = requestAnimationFrame(tick);
  }
  tick();
}

function spawnParticles(count = 6) {
  const layer = document.getElementById('particle-layer') || getContent();
  if (!layer) return;
  const rect = layer.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  for (let i = 0; i < count; i++) {
    const pt = document.createElement('div');
    pt.className = 'particle';
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    pt.dataset.x = '0';
    pt.dataset.y = '0';
    pt.dataset.vx = String(Math.cos(angle) * speed);
    pt.dataset.vy = String(Math.sin(angle) * speed);
    pt.dataset.life = '1';
    pt.style.left = `${cx}px`;
    pt.style.top = `${cy}px`;
    layer.appendChild(pt);
  }
}

// ========== PHASE 4: FADE OUT ==========
function startFadeOut() {
  const content = getContent();
  content.innerHTML = '';
  content.className = 'welcome-content phase4';

  const farewell = document.createElement('div');
  farewell.className = 'welcome-farewell';
  farewell.textContent = userName ? `Welcome back, ${userName}` : 'Welcome back.';
  content.appendChild(farewell);

  // Fade audio over 15s
  const fadeStart = audio.currentTime;
  const fadeDuration = 15;

  const fadeTick = () => {
    if (!audio) return;
    const elapsed = audio.currentTime - fadeStart;
    const vol = Math.max(0, 1 - elapsed / fadeDuration);
    audio.volume = vol;
    if (vol > 0 && elapsed < fadeDuration) {
      requestAnimationFrame(fadeTick);
    } else {
      audio.pause();
      dismissWelcome();
    }
  };
  requestAnimationFrame(fadeTick);
}

// ========== DISMISS ==========
function dismissWelcome() {
  cancelAnimationFrame(phaseFrameId);
  cancelAnimationFrame(beatFrameId);
  cancelAnimationFrame(particleFrameId);

  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
  }
  if (audioCtx && audioCtx.state !== 'closed') {
    audioCtx.suspend?.();
  }

  const overlay = getOverlay();
  if (overlay) {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.transition = 'opacity 1.5s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
      document.getElementById('app')?.classList.remove('hidden');
      document.getElementById('app')?.focus?.();
    }, 1500);
  }

  localStorage.setItem('ncc-welcome-shown', 'true');
  const settings = loadSettings();
  saveSettings({ ...settings, showWelcomeOnBoot: false });
  document.getElementById('show-welcome').checked = false;
}

// ========== SETTINGS HELPERS (shared with app.js) ==========
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('ncc-settings') || '{}');
  } catch { return {}; }
}
function saveSettings(patch) {
  const s = loadSettings();
  Object.assign(s, patch);
  localStorage.setItem('ncc-settings', JSON.stringify(s));
}
