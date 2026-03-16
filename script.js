/* ============================================================
   BIRTHDAY WEBSITE — script.js
   1. Screen navigation
   2. Canvas confetti
   3. Candle blow (button + mic breath detection)
   4. Spotify-style player (show, progress, toggle)
   5. Lightbox
   6. Save / download image
   ============================================================ */

/* ── 1. SCREEN NAVIGATION ───────────────────────────────── */
function goTo(targetId) {
  const screens = document.querySelectorAll('.screen');
  const target  = document.getElementById(targetId);
  if (!target) return;

  screens.forEach(s => {
    if (s.dataset.active === 'true') {
      s.dataset.active  = 'false';
      s.dataset.leaving = 'true';
      setTimeout(() => { s.dataset.leaving = 'false'; }, 360);
    }
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      target.dataset.active = 'true';
    });
  });

  confettiBurst(40);
}

/* ── 2. CONFETTI ─────────────────────────────────────────── */
(function () {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#ffd6e7','#ffb3d1','#ff6bab','#e8d8ff','#c9aeff','#ffe5d9','#ffc7ad','#fff'];
  const SHAPES = ['circle', 'rect', 'heart'];
  let pieces = [];
  let W, H, frame = 0;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  window.confettiBurst = function (count = 100) {
    for (let i = 0; i < count; i++) {
      pieces.push({
        x:    Math.random() * W,
        y:    Math.random() * H * 0.35,
        size: Math.random() * 9 + 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        vx:   (Math.random() - 0.5) * 4,
        vy:   Math.random() * 2.5 + 0.6,
        rot:  Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.14,
        alpha: 1,
      });
    }
  };

  function spawnDrizzle() {
    if (pieces.length < 160) {
      pieces.push({
        x:    Math.random() * W, y: -14,
        size: Math.random() * 7 + 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        vx:   (Math.random() - 0.5) * 1.6,
        vy:   Math.random() * 1.6 + 0.7,
        rot:  Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.1,
        alpha: 1,
      });
    }
  }

  function drawHeart(size) {
    const s = size * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.3);
    ctx.bezierCurveTo( s, -s * 1.1,  s * 1.8, s * 0.6, 0,  s * 1.2);
    ctx.bezierCurveTo(-s * 1.8, s * 0.6, -s, -s * 1.1, 0, -s * 0.3);
    ctx.closePath();
  }

  function drawPiece(p) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle   = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.shape === 'circle') {
      ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
    } else if (p.shape === 'rect') {
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.55);
    } else {
      drawHeart(p.size); ctx.fill();
    }
    ctx.restore();
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    frame++;
    if (frame % 18 === 0) spawnDrizzle();
    pieces = pieces.filter(p => p.alpha > 0.02 && p.y < H + 30);
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.vy += 0.018;
      if (p.y > H * 0.72) p.alpha -= 0.013;
      drawPiece(p);
    });
    requestAnimationFrame(loop);
  }

  confettiBurst(160);
  loop();
})();

/* ── 3. CANDLE BLOW ──────────────────────────────────────── */
let candleBlown = false;

function blowCandle() {
  if (candleBlown) return;
  candleBlown = true;

  stopBreathDetection();

  const flameWrapper = document.getElementById('flame-wrapper');
  const btnBlow      = document.getElementById('btn-blow');

  if (flameWrapper) flameWrapper.classList.add('blown');
  if (btnBlow) { btnBlow.style.pointerEvents = 'none'; btnBlow.style.opacity = '0.5'; }

  setTimeout(() => {
    confettiBurst(200);

    const candleScreen = document.getElementById('screen-candle');
    const heroScreen   = document.getElementById('screen-hero');

    candleScreen.dataset.active  = 'false';
    candleScreen.dataset.leaving = 'true';
    setTimeout(() => { candleScreen.dataset.leaving = 'false'; }, 400);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        heroScreen.dataset.active = 'true';
        const heroInner = heroScreen.querySelector('.hero-inner');
        if (heroInner) heroInner.classList.add('hero-entrance');

        // Start music + show player now that we have a user gesture
        startMusic();
      });
    });

    setTimeout(() => confettiBurst(80), 600);
  }, 800);
}

/* ── Mic breath detection ── */
let breathStream   = null;
let breathAudio    = null;
let breathAnalyser = null;
let breathRafId    = null;
let breathActive   = false;

const BLOW_THRESHOLD  = 18;   // raise if triggers too easily, lower if too hard
const BLOW_SUSTAIN_MS = 280;  // ms of sustained breath needed
let   blowSustainStart = null;

function stopBreathDetection() {
  breathActive = false;
  if (breathRafId)  { cancelAnimationFrame(breathRafId); breathRafId = null; }
  if (breathStream) { breathStream.getTracks().forEach(t => t.stop()); breathStream = null; }
  if (breathAudio)  { breathAudio.close().catch(() => {}); breathAudio = null; }
  breathAnalyser = null;
  blowSustainStart = null;
}

function startBreathDetection() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(stream => {
      if (candleBlown) { stream.getTracks().forEach(t => t.stop()); return; }

      breathStream   = stream;
      breathAudio    = new (window.AudioContext || window.webkitAudioContext)();
      breathAnalyser = breathAudio.createAnalyser();
      breathAnalyser.fftSize = 256;

      const source = breathAudio.createMediaStreamSource(stream);
      source.connect(breathAnalyser);

      breathActive = true;
      const buf = new Uint8Array(breathAnalyser.frequencyBinCount);

      function tick() {
        if (!breathActive) return;
        breathAnalyser.getByteTimeDomainData(buf);

        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / buf.length) * 255;

        if (rms > BLOW_THRESHOLD) {
          if (!blowSustainStart) blowSustainStart = performance.now();
          if (performance.now() - blowSustainStart >= BLOW_SUSTAIN_MS) {
            blowCandle();
            return;
          }
        } else {
          blowSustainStart = null;
        }

        breathRafId = requestAnimationFrame(tick);
      }
      tick();
    })
    .catch(() => {
      // Mic denied — tap/click the candle still works
      const hint = document.querySelector('.candle-hint');
      if (hint) hint.textContent = '🕯️ Tap the candle to blow it out ✨';
    });
}

document.addEventListener('DOMContentLoaded', () => {
  const flameWrapper = document.getElementById('flame-wrapper');
  const candle       = document.querySelector('.candle');
  const btnBlow      = document.getElementById('btn-blow');

  // ── IMPORTANT: start mic only after the FIRST user gesture ──
  // AudioContext is blocked until interaction on most browsers.
  // We listen for the first tap/click anywhere on the candle screen,
  // then kick off mic detection exactly once.
  let micStarted = false;

  function onFirstGesture() {
    if (micStarted) return;
    micStarted = true;
    startBreathDetection();
  }

  // Wire click-to-blow on flame + candle body + optional button
  if (flameWrapper) flameWrapper.addEventListener('click', blowCandle);
  if (candle)       candle.addEventListener('click', blowCandle);
  if (btnBlow)      btnBlow.addEventListener('click', blowCandle);

  // Any touch/click on the candle screen unlocks the mic
  const candleScreen = document.getElementById('screen-candle');
  if (candleScreen) {
    candleScreen.addEventListener('click',      onFirstGesture, { once: true });
    candleScreen.addEventListener('touchstart', onFirstGesture, { once: true });
  }

  // Also start mic if user taps anywhere on the page (fallback)
  document.addEventListener('click',      onFirstGesture, { once: true });
  document.addEventListener('touchstart', onFirstGesture, { once: true });
});

/* ── 4. SPOTIFY-STYLE PLAYER ─────────────────────────────── */

/* Show the player pill and start playing */
function startMusic() {
  const bgMusic = document.getElementById('bg-music');
  const player  = document.getElementById('sp-player');
  if (!bgMusic) return;

  bgMusic.volume = 0.05;
  bgMusic.loop   = true;

  bgMusic.play()
    .then(() => {
      spSetPlaying(true);
    })
    .catch(() => {
      // Autoplay blocked — player still visible, user can tap play
      spSetPlaying(false);
    });

  // Make the pill slide up
  if (player) player.classList.add('sp-visible');

  // Hook up the progress bar
  bgMusic.addEventListener('timeupdate', spUpdateProgress);
}

/* Sync spinning disc + play/pause icon state */
function spSetPlaying(isPlaying) {
  const art       = document.getElementById('sp-art');
  const iconPlay  = document.getElementById('sp-icon-play');
  const iconPause = document.getElementById('sp-icon-pause');
  const player    = document.getElementById('sp-player');

  if (isPlaying) {
    art?.classList.add('sp-spinning');
    player?.classList.add('sp-spinning');       // also starts marquee
    if (iconPlay)  iconPlay.style.display  = 'none';
    if (iconPause) iconPause.style.display = 'block';
  } else {
    art?.classList.remove('sp-spinning');
    player?.classList.remove('sp-spinning');
    if (iconPlay)  iconPlay.style.display  = 'block';
    if (iconPause) iconPause.style.display = 'none';
  }
}

/* Update the thin progress bar as song plays */
function spUpdateProgress() {
  const bgMusic = document.getElementById('bg-music');
  const fill    = document.getElementById('sp-progress');
  if (!bgMusic || !fill || !bgMusic.duration) return;
  fill.style.width = ((bgMusic.currentTime / bgMusic.duration) * 100) + '%';
}

/* Play / pause toggle — called by the button in the player */
function toggleMusic() {
  const bgMusic = document.getElementById('bg-music');
  if (!bgMusic) return;

  if (bgMusic.paused) {
    bgMusic.play().then(() => spSetPlaying(true)).catch(() => {});
  } else {
    bgMusic.pause();
    spSetPlaying(false);
  }
}

/* ── 5. LIGHTBOX ─────────────────────────────────────────── */
function openLightbox(src) {
  const overlay = document.getElementById('lightbox');
  const img     = document.getElementById('lightbox-img');
  if (!overlay || !img) return;
  img.src = src;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(event) {
  const overlay = document.getElementById('lightbox');
  if (event && event.target !== overlay && !event.target.classList.contains('lightbox-close')) return;
  if (overlay) { overlay.classList.remove('active'); document.body.style.overflow = ''; }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('lightbox');
    if (overlay?.classList.contains('active')) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
});

/* ── 6. SAVE / DOWNLOAD IMAGE ────────────────────────────── */
function saveImage(src, filename) {
  fetch(src)
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = filename || 'memory.jpg';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    })
    .catch(() => window.open(src, '_blank'));
}