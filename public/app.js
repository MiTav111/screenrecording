// SiteReel Studio — 60FPS Website Screen Video Engine
// Includes:
// 1. Smooth automatic scrolling (spring / cubic easing showcase)
// 2. Styled background padding, shadows, and browser/device frames (macOS Dark/Light, iPhone 16 Pro, Minimal Glass)
// 3. Simulated cursor movements, click ripples, and camera zoom-in effects on key sections
// 4. Multiple aspect ratios for social media (16:9 Landscape, 9:16 TikTok/Reels, 1:1 Square)

const canvas = document.getElementById('stageCanvas');
const ctx = canvas.getContext('2d');

const state = {
  aspect: '16:9',        // '16:9' | '9:16' | '1:1'
  frame: 'macos-dark',   // 'macos-dark' | 'macos-light' | 'iphone' | 'glass'
  bgTheme: 'aurora',
  padding: 64,
  shadowIntensity: 0.65,
  smoothScroll: true,
  simulateCursor: true,
  cameraZoom: true,
  showSocialBadge: true,
  maxZoom: 1.45,
  duration: 10,          // seconds
  currentTime: 0,
  isPlaying: true,
  isRecording: false,
  siteImage: null,
  metadata: {
    title: 'PulseFlow — Next-Gen Creator Social Platform',
    description: 'Share interactive stories, live drops, and visual reels with zero friction.',
    siteName: 'pulseflow.app',
    hostname: 'pulseflow.app',
    fullUrl: 'https://pulseflow.app',
    viewportWidth: 1440,
    viewportHeight: 900,
    captureHeight: 2850,
    hotspots: []
  }
};

const BG_THEMES = {
  aurora: ['#312e81', '#6d28d9', '#db2777', '#0f172a'],
  sunset: ['#7c2d12', '#ea580c', '#e11d48', '#4c1d95'],
  cyber:  ['#083344', '#0284c7', '#1d4ed8', '#090d16'],
  emerald:['#064e3b', '#059669', '#0d9488', '#0f172a'],
  noir:   ['#1e293b', '#0f172a', '#020617', '#090b10'],
  cotton: ['#be185d', '#7c3aed', '#0284c7', '#1e1b4b']
};

const ASPECT_DIMENSIONS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1200, height: 1200 }
};

// Smooth math helpers
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Build keyframe schedule from detected website hotspots
function getKeyframes() {
  const spots = state.metadata.hotspots || [];
  if (spots.length === 0) return [];

  // Distribute hotspots evenly across normalized timeline [0.14 .. 0.86]
  return spots.slice(0, 4).map((spot, idx, arr) => {
    const startP = 0.12 + (idx / arr.length) * 0.72;
    const endP = startP + 0.16;
    const peakP = (startP + endP) / 2;
    return {
      ...spot,
      startP,
      peakP,
      endP
    };
  });
}

// Compute scroll position, camera zoom, and cursor state for normalized progress p in [0, 1]
function evaluateChoreography(p, viewportW, viewportH, totalImageH) {
  const maxScroll = Math.max(0, totalImageH - viewportH);

  // 1. Smooth Automatic Scroll curve (pauses slightly at hero, glides down, then returns or settles)
  let scrollY = 0;
  if (state.smoothScroll && maxScroll > 0) {
    if (p < 0.1) {
      scrollY = 0;
    } else if (p < 0.88) {
      const scrollNorm = (p - 0.1) / 0.78;
      // Add subtle smooth steps so it lingers slightly on sections
      const stepped = scrollNorm + 0.04 * Math.sin(scrollNorm * Math.PI * 3);
      scrollY = clamp(easeInOutCubic(clamp(stepped, 0, 1)) * maxScroll, 0, maxScroll);
    } else {
      // Hold near bottom or smoothly settle
      scrollY = maxScroll;
    }
  }

  // 2. Camera Zoom & Pan on key sections + 3. Simulated Cursor & Clicks
  const keyframes = getKeyframes();
  let zoom = 1.0;
  let focusX = viewportW * 0.5;
  let focusY = viewportH * 0.5;

  let cursorX = viewportW * 0.55;
  let cursorY = viewportH * 0.45;
  let clickRipple = 0; // 0..1 when clicking
  let activeLabel = null;

  // Base ambient cursor drift when between hotspots
  cursorX = viewportW * (0.5 + 0.22 * Math.sin(p * Math.PI * 2.5));
  cursorY = viewportH * (0.48 + 0.18 * Math.cos(p * Math.PI * 2));

  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];
    // Convert hotspot absolute page Y to current viewport-relative Y
    const relY = clamp(kf.centerY - scrollY, viewportH * 0.18, viewportH * 0.82);
    const relX = clamp(kf.centerX, viewportW * 0.18, viewportW * 0.82);

    // Move cursor smoothly toward upcoming hotspot slightly before zoom starts
    const approachStart = kf.startP - 0.06;
    if (p >= approachStart && p <= kf.endP) {
      const moveT = clamp((p - approachStart) / 0.08, 0, 1);
      const easedMove = easeInOutCubic(moveT);
      cursorX = lerp(cursorX, relX, easedMove);
      cursorY = lerp(cursorY, relY, easedMove);
    }

    if (p >= kf.startP && p <= kf.endP) {
      const localT = (p - kf.startP) / (kf.endP - kf.startP);
      // Smooth bell curve (0 -> 1 -> 0) with plateau in middle
      let intensity = 0;
      if (localT < 0.3) {
        intensity = easeInOutCubic(localT / 0.3);
      } else if (localT < 0.7) {
        intensity = 1;
      } else {
        intensity = 1 - easeInOutCubic((localT - 0.7) / 0.3);
      }

      if (state.cameraZoom) {
        zoom = lerp(1.0, state.maxZoom, intensity);
        focusX = lerp(viewportW * 0.5, relX, intensity);
        focusY = lerp(viewportH * 0.5, relY, intensity);
      }

      activeLabel = kf.label;

      // Trigger click ripple right around peak
      if (localT >= 0.35 && localT <= 0.78) {
        clickRipple = (localT - 0.35) / 0.43;
      }
      break;
    }
  }

  return {
    scrollY,
    zoom,
    focusX,
    focusY,
    cursorX,
    cursorY,
    clickRipple,
    activeLabel
  };
}

// Render animated mesh wallpaper background
function drawWallpaper(ctx, W, H, p) {
  const colors = BG_THEMES[state.bgTheme] || BG_THEMES.aurora;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.5, colors[1]);
  grad.addColorStop(1, colors[3]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Animated glowing orbs for cinematic depth
  ctx.save();
  const orb1X = W * (0.25 + 0.12 * Math.cos(p * Math.PI * 2));
  const orb1Y = H * (0.28 + 0.1 * Math.sin(p * Math.PI * 2));
  const rad1 = Math.max(W, H) * 0.55;
  const g1 = ctx.createRadialGradient(orb1X, orb1Y, 10, orb1X, orb1Y, rad1);
  g1.addColorStop(0, colors[2] + '88');
  g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const orb2X = W * (0.78 + 0.1 * Math.sin(p * Math.PI * 2));
  const orb2Y = H * (0.72 + 0.12 * Math.cos(p * Math.PI * 2));
  const g2 = ctx.createRadialGradient(orb2X, orb2Y, 10, orb2X, orb2Y, rad1 * 0.9);
  g2.addColorStop(0, colors[1] + '77');
  g2.addColorStop(1, 'transparent');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  // Subtle studio grid overlay
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  const step = 64;
  for (let x = 0; x < W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
}

// Draw macOS style cursor & click animation
function drawSimulatedCursor(ctx, x, y, clickRipple, activeLabel) {
  ctx.save();

  // Click ripple rings
  if (clickRipple > 0) {
    const r1 = 12 + clickRipple * 46;
    const alpha = (1 - clickRipple) * 0.75;
    ctx.beginPath();
    ctx.arc(x, y, r1, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    const r2 = 6 + clickRipple * 26;
    ctx.beginPath();
    ctx.arc(x, y, r2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(236, 72, 153, ${alpha * 0.45})`;
    ctx.fill();
  }

  // Slight click press scale
  const pressScale =
    clickRipple > 0 && clickRipple < 0.35
      ? 1 - 0.18 * Math.sin((clickRipple / 0.35) * Math.PI)
      : 1;

  ctx.translate(x, y);
  ctx.scale(pressScale, pressScale);

  // Cursor drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;

  // Classic crisp pointer arrow
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 26);
  ctx.lineTo(6.8, 20.2);
  ctx.lineTo(11.8, 30);
  ctx.lineTo(16.2, 27.8);
  ctx.lineTo(11.2, 18.2);
  ctx.lineTo(19.5, 18.2);
  ctx.closePath();

  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  // Floating callout pill next to cursor during zoom focus
  if (activeLabel && clickRipple > 0.05) {
    ctx.shadowBlur = 10;
    const pillText = `✦ ${activeLabel.slice(0, 26)}`;
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, sans-serif';
    const textW = ctx.measureText(pillText).width;
    const px = 24;
    const py = 12;
    roundRectPath(ctx, px, py, textW + 22, 28, 14);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(pillText, px + 11, py + 18.5);
  }

  ctx.restore();
}

// Main frame render function
function renderFrame(progress) {
  const dim = ASPECT_DIMENSIONS[state.aspect] || ASPECT_DIMENSIONS['16:9'];
  if (canvas.width !== dim.width || canvas.height !== dim.height) {
    canvas.width = dim.width;
    canvas.height = dim.height;
  }

  const W = canvas.width;
  const H = canvas.height;

  // 1. Draw Background Wallpaper
  drawWallpaper(ctx, W, H, progress);

  // Determine inner window geometry based on aspect ratio, padding, and device frame
  const isIphoneFrame = state.frame === 'iphone';
  const pad = state.padding * (W / 1200);

  let availW = W - pad * 2;
  let availH = H - pad * 2 - (state.showSocialBadge ? 56 : 0);

  const siteAspect = isIphoneFrame ? 9 / 19.2 : 16 / 10;
  let winW = availW;
  let winH = winW / siteAspect;

  if (winH > availH) {
    winH = availH;
    winW = winH * siteAspect;
  }

  const headerH = isIphoneFrame ? 0 : state.frame === 'glass' ? 0 : 44;
  const contentW = winW;
  const contentH = winH - headerH;

  const imgW = state.siteImage ? state.siteImage.width : 1440;
  const imgH = state.siteImage ? state.siteImage.height : 2850;
  const scaleToWindow = contentW / imgW;
  const scaledTotalH = imgH * scaleToWindow;

  // Evaluate scroll, camera zoom, and cursor choreography
  const choreo = evaluateChoreography(progress, contentW, contentH, scaledTotalH);

  ctx.save();

  // Center of canvas stage
  const stageCenterX = W / 2;
  const stageCenterY = (H - (state.showSocialBadge ? 42 : 0)) / 2;

  ctx.translate(stageCenterX, stageCenterY);

  // Apply Screen Studio style camera zoom & pan around active hotspot
  if (state.cameraZoom && choreo.zoom > 1.001) {
    const offsetX = (contentW / 2 - choreo.focusX) * (choreo.zoom - 1);
    const offsetY = (contentH / 2 - choreo.focusY) * (choreo.zoom - 1);
    ctx.scale(choreo.zoom, choreo.zoom);
    ctx.translate(offsetX / choreo.zoom, offsetY / choreo.zoom);
  }

  // Subtle floating 3D breathing effect
  const floatY = Math.sin(progress * Math.PI * 2) * 6 * state.shadowIntensity;
  ctx.translate(0, floatY);

  const winX = -winW / 2;
  const winY = -winH / 2;
  const borderRadius = isIphoneFrame ? 46 : 18;

  // Deep multi-layer window elevation shadow
  ctx.save();
  ctx.shadowColor = `rgba(0, 0, 0, ${0.45 + state.shadowIntensity * 0.35})`;
  ctx.shadowBlur = 40 + state.shadowIntensity * 55;
  ctx.shadowOffsetY = 20 + state.shadowIntensity * 28;
  roundRectPath(ctx, winX, winY, winW, winH, borderRadius);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.restore();

  // Clip to device/browser window
  ctx.save();
  roundRectPath(ctx, winX, winY, winW, winH, borderRadius);
  ctx.clip();

  // Draw Browser Chrome Header (macOS Dark / Light)
  if (headerH > 0) {
    const isLight = state.frame === 'macos-light';
    ctx.fillStyle = isLight ? '#f1f5f9' : '#161b26';
    ctx.fillRect(winX, winY, winW, headerH);

    // Traffic lights
    const dotY = winY + headerH / 2;
    const colors = ['#ff5f56', '#ffbd2e', '#27c93f'];
    colors.forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(winX + 22 + i * 20, dotY, 6.2, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    });

    // URL Address pill inside browser bar
    const pillW = Math.min(winW * 0.48, 420);
    const pillH = 26;
    const pillX = winX + (winW - pillW) / 2;
    const pillY = winY + (headerH - pillH) / 2;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, 7);
    ctx.fillStyle = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.07)';
    ctx.fill();

    ctx.fillStyle = isLight ? '#334155' : '#94a3b8';
    ctx.font = '500 12.5px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const domainLabel = `🔒 ${state.metadata.hostname || 'pulseflow.app'}`;
    ctx.fillText(domainLabel, winX + winW / 2, dotY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // Draw Website Content Area with Smooth Scrolling
  const contentX = winX;
  const contentY = winY + headerH;

  ctx.save();
  ctx.beginPath();
  ctx.rect(contentX, contentY, contentW, contentH);
  ctx.clip();

  if (state.siteImage) {
    ctx.drawImage(
      state.siteImage,
      contentX,
      contentY - choreo.scrollY,
      contentW,
      scaledTotalH
    );
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(contentX, contentY, contentW, contentH);
  }

  // Smooth Scrollbar indicator on right edge
  if (state.smoothScroll && scaledTotalH > contentH) {
    const trackH = contentH - 16;
    const thumbH = Math.max(36, (contentH / scaledTotalH) * trackH);
    const maxScroll = scaledTotalH - contentH;
    const thumbY =
      contentY + 8 + (choreo.scrollY / maxScroll) * (trackH - thumbH);
    roundRectPath(ctx, contentX + contentW - 9, thumbY, 5, thumbH, 3);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.fill();
  }

  // Simulated Cursor & Click Ripples inside content viewport
  if (state.simulateCursor) {
    drawSimulatedCursor(
      ctx,
      contentX + choreo.cursorX,
      contentY + choreo.cursorY,
      choreo.clickRipple,
      choreo.activeLabel
    );
  }

  ctx.restore(); // End content clip

  // iPhone Dynamic Island & Bezel overlay if iPhone frame selected
  if (isIphoneFrame) {
    const islandW = winW * 0.3;
    const islandH = 24;
    roundRectPath(
      ctx,
      winX + (winW - islandW) / 2,
      winY + 14,
      islandW,
      islandH,
      12
    );
    ctx.fillStyle = '#000000';
    ctx.fill();
  }

  ctx.restore(); // End window clip

  // Outer Frame Border Sheen
  roundRectPath(ctx, winX, winY, winW, winH, borderRadius);
  ctx.lineWidth = isIphoneFrame ? 8 : 2;
  ctx.strokeStyle =
    state.frame === 'macos-light'
      ? 'rgba(255, 255, 255, 0.8)'
      : 'rgba(255, 255, 255, 0.18)';
  ctx.stroke();

  ctx.restore(); // End stage camera transform

  // 4. Floating Social Link Caption Badge at bottom of video
  if (state.showSocialBadge) {
    ctx.save();
    const badgeText = `${state.metadata.title.slice(0, 42)}  •  ${state.metadata.hostname}`;
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, sans-serif';
    const textMetrics = ctx.measureText(badgeText);
    const bW = Math.min(W - 60, textMetrics.width + 44);
    const bH = 42;
    const bX = (W - bW) / 2;
    const bY = H - bH - 22;

    roundRectPath(ctx, bX, bY, bW, bH, 21);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, W / 2, bY + bH / 2 + 1);
    ctx.restore();
  }
}

// Animation Loop
let lastFrameTime = performance.now();

function tick(now) {
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  if (state.isPlaying) {
    state.currentTime += dt;
    if (state.currentTime >= state.duration) {
      if (state.isRecording) {
        state.currentTime = state.duration;
        stopRecordingVideo();
      } else {
        state.currentTime = 0;
      }
    }
    updateTimelineUI();
  }

  const progress = clamp(state.currentTime / state.duration, 0, 1);
  renderFrame(progress);

  requestAnimationFrame(tick);
}

// UI Synchronization
const scrubber = document.getElementById('timelineScrubber');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const playIcon = document.getElementById('playIcon');

function updateTimelineUI() {
  const norm = clamp(state.currentTime / state.duration, 0, 1);
  scrubber.value = Math.round(norm * 1000);
  currentTimeEl.textContent = `${state.currentTime.toFixed(1)}s`;
  totalTimeEl.textContent = `${state.duration.toFixed(1)}s`;
}

function renderHotspotsUI() {
  const listEl = document.getElementById('hotspotList');
  const markersEl = document.getElementById('scrubberMarkers');
  listEl.innerHTML = '';
  markersEl.innerHTML = '';

  const kfs = getKeyframes();
  kfs.forEach((kf, idx) => {
    const item = document.createElement('div');
    item.className = 'hotspot-item';
    const timeSec = (kf.peakP * state.duration).toFixed(1);
    item.innerHTML = `
      <span>🎯 ${kf.label}</span>
      <span class="hotspot-badge">@ ${timeSec}s</span>
    `;
    item.addEventListener('click', () => {
      state.currentTime = kf.peakP * state.duration;
      updateTimelineUI();
    });
    listEl.appendChild(item);

    const dot = document.createElement('div');
    dot.className = 'marker-dot';
    dot.style.left = `${kf.peakP * 100}%`;
    dot.title = `Zoom: ${kf.label}`;
    markersEl.appendChild(dot);
  });
}

// Build a high-DPI offscreen canvas representing the extracted website if a raw screenshot bitmap isn't returned
function buildSynthesizedSiteCanvas(meta, isMobile) {
  const vw = isMobile ? 390 : 1440;
  const vh = isMobile ? 2600 : 2850;
  const off = document.createElement('canvas');
  off.width = vw;
  off.height = vh;
  const c = off.getContext('2d');

  // Deep modern dark SaaS landing page theme
  const bgGrad = c.createLinearGradient(0, 0, 0, vh);
  bgGrad.addColorStop(0, '#090b14');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#070911');
  c.fillStyle = bgGrad;
  c.fillRect(0, 0, vw, vh);

  // Ambient hero glow
  const heroGlow = c.createRadialGradient(vw / 2, 320, 20, vw / 2, 320, vw * 0.55);
  heroGlow.addColorStop(0, 'rgba(99, 102, 241, 0.28)');
  heroGlow.addColorStop(0.5, 'rgba(168, 85, 247, 0.12)');
  heroGlow.addColorStop(1, 'transparent');
  c.fillStyle = heroGlow;
  c.fillRect(0, 0, vw, 950);

  // Top Navbar
  c.fillStyle = 'rgba(15, 23, 42, 0.8)';
  c.fillRect(0, 0, vw, 82);
  c.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  c.beginPath();
  c.moveTo(0, 82);
  c.lineTo(vw, 82);
  c.stroke();

  const padX = isMobile ? 24 : 96;
  c.fillStyle = '#ffffff';
  c.font = `800 ${isMobile ? 20 : 24}px -apple-system, BlinkMacSystemFont, sans-serif`;
  c.fillText(`✦ ${meta.siteName || meta.hostname || 'PulseFlow'}`, padX, 50);

  // Nav CTA button
  const navBtnW = isMobile ? 110 : 150;
  roundRectPath(c, vw - padX - navBtnW, 22, navBtnW, 40, 20);
  c.fillStyle = '#6366f1';
  c.fill();
  c.fillStyle = '#ffffff';
  c.font = '600 14px -apple-system, BlinkMacSystemFont, sans-serif';
  c.textAlign = 'center';
  c.fillText((meta.ctaButtons && meta.ctaButtons[0]) || 'Launch App', vw - padX - navBtnW / 2, 47);

  // Hero Badge
  const badgeY = isMobile ? 140 : 170;
  roundRectPath(c, vw / 2 - 170, badgeY, 340, 34, 17);
  c.fillStyle = 'rgba(99, 102, 241, 0.16)';
  c.fill();
  c.strokeStyle = 'rgba(129, 140, 248, 0.45)';
  c.stroke();
  c.fillStyle = '#a5b4fc';
  c.font = '600 13px -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillText(`✨ Live from ${meta.hostname || 'pulseflow.app'}`, vw / 2, badgeY + 22);

  // Hero Title (multi-line wrap)
  const heroTitle = meta.heroHeading || meta.title || 'Turn Any Web Link Into a Cinematic Video';
  c.fillStyle = '#f8fafc';
  c.font = `800 ${isMobile ? 34 : 62}px -apple-system, BlinkMacSystemFont, sans-serif`;
  const words = heroTitle.split(' ');
  let line = '';
  let y = isMobile ? 230 : 275;
  const maxLineW = vw - padX * 2;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (c.measureText(test).width > maxLineW && line) {
      c.fillText(line.trim(), vw / 2, y);
      line = words[i] + ' ';
      y += isMobile ? 42 : 72;
    } else {
      line = test;
    }
  }
  if (line) {
    c.fillText(line.trim(), vw / 2, y);
    y += isMobile ? 46 : 70;
  }

  // Hero Subtitle
  c.fillStyle = '#94a3b8';
  c.font = `400 ${isMobile ? 16 : 22}px -apple-system, BlinkMacSystemFont, sans-serif`;
  const subText = (meta.heroSub || meta.description || '').slice(0, 110);
  c.fillText(subText, vw / 2, y);

  // Hero CTA Buttons (Matches Hotspot #1 at vh * 0.56)
  const ctaY = isMobile ? 440 : 475;
  const btnW = isMobile ? 165 : 230;
  const btnH = 56;
  roundRectPath(c, vw / 2 - btnW - 10, ctaY, btnW, btnH, 14);
  const ctaGrad = c.createLinearGradient(vw / 2 - btnW, ctaY, vw / 2, ctaY + btnH);
  ctaGrad.addColorStop(0, '#6366f1');
  ctaGrad.addColorStop(1, '#ec4899');
  c.fillStyle = ctaGrad;
  c.fill();
  c.fillStyle = '#ffffff';
  c.font = '700 17px -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillText((meta.ctaButtons && meta.ctaButtons[0]) || 'Start Creating →', vw / 2 - btnW / 2 - 10, ctaY + 34);

  roundRectPath(c, vw / 2 + 10, ctaY, btnW * 0.85, btnH, 14);
  c.fillStyle = 'rgba(255, 255, 255, 0.07)';
  c.fill();
  c.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  c.stroke();
  c.fillStyle = '#e2e8f0';
  c.fillText('Watch Demo', vw / 2 + 10 + (btnW * 0.85) / 2, ctaY + 34);

  // Interactive Feature Cards Grid (Matches Hotspot #2 around captureHeight * 0.42)
  const cardsY = isMobile ? 740 : 880;
  const headings = meta.sectionHeadings && meta.sectionHeadings.length
    ? meta.sectionHeadings
    : ['Smooth Auto-Scroll', 'Smart Zoom & Clicks', 'Multi-Format Export'];
  const icons = ['🎥', '🎯', '📱', '⚡'];

  const cols = isMobile ? 1 : 3;
  const gap = 28;
  const cardW = (vw - padX * 2 - gap * (cols - 1)) / cols;
  const cardH = isMobile ? 210 : 320;

  for (let i = 0; i < 3; i++) {
    const cx = padX + (isMobile ? 0 : i * (cardW + gap));
    const cy = cardsY + (isMobile ? i * (cardH + 20) : 0);

    roundRectPath(c, cx, cy, cardW, cardH, 24);
    c.fillStyle = 'rgba(30, 41, 59, 0.65)';
    c.fill();
    c.lineWidth = 1.5;
    c.strokeStyle = i === 0 ? 'rgba(99, 102, 241, 0.6)' : 'rgba(255, 255, 255, 0.1)';
    c.stroke();

    // Icon badge
    roundRectPath(c, cx + 28, cy + 28, 52, 52, 14);
    c.fillStyle = 'rgba(99, 102, 241, 0.25)';
    c.fill();
    c.font = '24px sans-serif';
    c.textAlign = 'center';
    c.fillText(icons[i % icons.length], cx + 54, cy + 63);

    c.textAlign = 'left';
    c.fillStyle = '#ffffff';
    c.font = `700 ${isMobile ? 20 : 24}px -apple-system, BlinkMacSystemFont, sans-serif`;
    c.fillText((headings[i] || `Feature Spotlight ${i + 1}`).slice(0, 26), cx + 28, cy + 125);

    c.fillStyle = '#94a3b8';
    c.font = `400 ${isMobile ? 14 : 16}px -apple-system, BlinkMacSystemFont, sans-serif`;
    const desc = (meta.sectionTexts && meta.sectionTexts[i]) ||
      'Automatically extracted section layout with high-DPI vector rendering and smooth motion.';
    c.fillText(desc.slice(0, 44), cx + 28, cy + 162);
    c.fillText(desc.slice(44, 88) || 'Built for viral social media engagement.', cx + 28, cy + 188);
  }

  // Showcase Metrics Banner (Matches Hotspot #3 around captureHeight * 0.65)
  const metricsY = isMobile ? 1520 : 1560;
  const metricsH = isMobile ? 420 : 380;
  roundRectPath(c, padX, metricsY, vw - padX * 2, metricsH, 32);
  const mGrad = c.createLinearGradient(padX, metricsY, vw - padX, metricsY + metricsH);
  mGrad.addColorStop(0, 'rgba(79, 70, 229, 0.28)');
  mGrad.addColorStop(1, 'rgba(219, 39, 119, 0.22)');
  c.fillStyle = mGrad;
  c.fill();
  c.strokeStyle = 'rgba(168, 85, 247, 0.45)';
  c.stroke();

  const stats = [
    { val: '60 FPS', lbl: 'Ultra-Smooth Motion' },
    { val: '4.8x', lbl: 'Social Engagement' },
    { val: '100%', lbl: 'Automated Link-to-Video' }
  ];
  c.textAlign = 'center';
  stats.forEach((st, idx) => {
    const sx = isMobile
      ? vw / 2
      : padX + ((vw - padX * 2) / 3) * (idx + 0.5);
    const sy = isMobile ? metricsY + 100 + idx * 120 : metricsY + 185;
    c.fillStyle = '#ffffff';
    c.font = `800 ${isMobile ? 40 : 64}px -apple-system, BlinkMacSystemFont, sans-serif`;
    c.fillText(st.val, sx, sy);
    c.fillStyle = '#c7d2fe';
    c.font = '600 18px -apple-system, BlinkMacSystemFont, sans-serif';
    c.fillText(st.lbl, sx, sy + 38);
  });

  // Bottom Final Call-To-Action Banner (Matches Hotspot #4 around captureHeight * 0.86)
  const bottomY = isMobile ? 2080 : 2180;
  const bottomH = 420;
  roundRectPath(c, padX, bottomY, vw - padX * 2, bottomH, 32);
  const bGrad = c.createLinearGradient(padX, bottomY, vw - padX, bottomY + bottomH);
  bGrad.addColorStop(0, '#4f46e5');
  bGrad.addColorStop(0.5, '#9333ea');
  bGrad.addColorStop(1, '#db2777');
  c.fillStyle = bGrad;
  c.fill();

  c.fillStyle = '#ffffff';
  c.font = `800 ${isMobile ? 28 : 48}px -apple-system, BlinkMacSystemFont, sans-serif`;
  c.fillText(`Experience ${meta.siteName || meta.hostname} Today`, vw / 2, bottomY + 145);

  c.font = `500 ${isMobile ? 15 : 20}px -apple-system, BlinkMacSystemFont, sans-serif`;
  c.fillStyle = 'rgba(255, 255, 255, 0.9)';
  c.fillText(meta.description.slice(0, 75), vw / 2, bottomY + 195);

  roundRectPath(c, vw / 2 - 140, bottomY + 245, 280, 64, 18);
  c.fillStyle = '#ffffff';
  c.fill();
  c.fillStyle = '#0f172a';
  c.font = '800 18px -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillText('Get Started Now →', vw / 2, bottomY + 284);

  return off;
}

// Extract Website via Backend (with smart client-side synthesis fallback if opened directly via file://)
async function extractWebsite(urlToExtract) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const extractBtn = document.getElementById('extractBtn');
  const statusPill = document.getElementById('extractStatus');

  loadingOverlay.classList.remove('hidden');
  loadingText.textContent = `Extracting metadata & high-DPI layout from ${urlToExtract}...`;
  extractBtn.disabled = true;
  statusPill.textContent = 'Extracting...';

  const isMobile = state.frame === 'iphone';
  const device = isMobile ? 'mobile' : 'desktop';

  try {
    if (window.location.protocol === 'file:') {
      throw new Error('Running in standalone file mode');
    }
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlToExtract, device })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to extract website');
    }

    state.metadata = data.metadata;

    if (data.screenshotDataUrl) {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = data.screenshotDataUrl;
      });
      state.siteImage = img;
    } else {
      state.siteImage = buildSynthesizedSiteCanvas(state.metadata, isMobile);
    }

    state.currentTime = 0;
    document.getElementById('metaTitle').textContent = state.metadata.title;
    document.getElementById('metaUrl').textContent = state.metadata.hostname;
    document.getElementById('metaDesc').textContent = state.metadata.description;
    statusPill.textContent = 'Extracted ✓';

    renderHotspotsUI();
  } catch (err) {
    // Smart standalone metadata + high-DPI synthesis when running offline or via file://
    const cleanHost = urlToExtract.replace(/^https?:\/\//i, '').replace(/\/.*$/, '') || 'pulseflow.app';
    const vw = isMobile ? 390 : 1440;
    const vh = isMobile ? 844 : 900;
    const captureHeight = isMobile ? 2600 : 2850;
    const brandName = cleanHost.split('.')[0].charAt(0).toUpperCase() + cleanHost.split('.')[0].slice(1);

    state.metadata = {
      title: cleanHost === 'pulseflow.app'
        ? 'PulseFlow — Next-Gen Creator Social Platform'
        : `${brandName} — Official Interactive Showcase`,
      description: `Discover ${cleanHost} with smooth auto-scrolling, simulated cursor clicks, and dynamic camera zoom.`,
      siteName: brandName,
      hostname: cleanHost,
      fullUrl: `https://${cleanHost}`,
      heroHeading: cleanHost === 'pulseflow.app'
        ? 'Turn Any Web Link Into a Cinematic Social Video'
        : `Welcome to the Future of ${brandName}`,
      viewportWidth: vw,
      viewportHeight: vh,
      captureHeight,
      hotspots: [
        { centerX: Math.round(vw * 0.42), centerY: Math.round(vh * 0.56), label: 'Primary Hero CTA', zoomScale: 1.48 },
        { centerX: Math.round(vw * 0.30), centerY: Math.round(captureHeight * 0.42), label: 'Feature Spotlight', zoomScale: 1.38 },
        { centerX: Math.round(vw * 0.68), centerY: Math.round(captureHeight * 0.65), label: 'Live Metrics Grid', zoomScale: 1.45 },
        { centerX: Math.round(vw * 0.50), centerY: Math.round(captureHeight * 0.86), label: 'Get Started Action', zoomScale: 1.42 }
      ]
    };

    state.siteImage = buildSynthesizedSiteCanvas(state.metadata, isMobile);
    state.currentTime = 0;
    document.getElementById('metaTitle').textContent = state.metadata.title;
    document.getElementById('metaUrl').textContent = state.metadata.hostname;
    document.getElementById('metaDesc').textContent = state.metadata.description;
    renderHotspotsUI();
    statusPill.textContent = 'Ready ✓';
  } finally {
    loadingOverlay.classList.add('hidden');
    extractBtn.disabled = false;
  }
}

// Video Recording & Export (.webm / MP4 compatible)
let mediaRecorder = null;
let recordedChunks = [];

function startRecordingVideo() {
  if (state.isRecording) return;

  const exportBtn = document.getElementById('exportVideoBtn');
  const exportLabel = document.getElementById('exportBtnLabel');

  state.isRecording = true;
  state.currentTime = 0;
  state.isPlaying = true;
  playIcon.textContent = '⏸';

  exportBtn.classList.add('recording');
  exportLabel.textContent = 'Recording 60fps...';

  const stream = canvas.captureStream(60);
  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ];
  const selectedMime =
    mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(
    stream,
    selectedMime ? { mimeType: selectedMime, videoBitsPerSecond: 12000000 } : {}
  );

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, {
      type: selectedMime || 'video/webm'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const cleanHost = (state.metadata.hostname || 'website').replace(/[^a-z0-9]/gi, '-');
    a.href = url;
    a.download = `sitereel-${cleanHost}-${state.aspect.replace(':', 'x')}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    exportBtn.classList.remove('recording');
    exportLabel.textContent = 'Export Video (.webm)';
    document.getElementById('downloadToast').classList.remove('hidden');
  };

  mediaRecorder.start(100);
}

function stopRecordingVideo() {
  if (!state.isRecording) return;
  state.isRecording = false;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

// Wire up UI Controls
document.getElementById('extractForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const url = document.getElementById('urlInput').value.trim();
  if (url) extractWebsite(url);
});

document.querySelectorAll('.preset-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const url = chip.getAttribute('data-url');
    document.getElementById('urlInput').value = url;
    extractWebsite(url);
  });
});

// Aspect Ratio buttons
document.querySelectorAll('#aspectGroup .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#aspectGroup .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.aspect = btn.getAttribute('data-aspect');
  });
});

// Device Frame buttons
document.querySelectorAll('#frameGroup .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#frameGroup .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const prevFrame = state.frame;
    state.frame = btn.getAttribute('data-frame');
    // Re-capture if switching between desktop and iPhone mobile viewport
    if ((prevFrame === 'iphone') !== (state.frame === 'iphone')) {
      extractWebsite(document.getElementById('urlInput').value.trim() || 'demo');
    }
  });
});

// Wallpaper Swatches
document.querySelectorAll('#bgSwatches .swatch').forEach((sw) => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('#bgSwatches .swatch').forEach((s) => s.classList.remove('active'));
    sw.classList.add('active');
    state.bgTheme = sw.getAttribute('data-bg');
  });
});

// Sliders & Checkboxes
document.getElementById('paddingSlider').addEventListener('input', (e) => {
  state.padding = Number(e.target.value);
  document.getElementById('paddingVal').textContent = `${state.padding}px`;
});

document.getElementById('tiltSlider').addEventListener('input', (e) => {
  state.shadowIntensity = Number(e.target.value) / 100;
});

document.getElementById('toggleScroll').addEventListener('change', (e) => {
  state.smoothScroll = e.target.checked;
});

document.getElementById('toggleCursor').addEventListener('change', (e) => {
  state.simulateCursor = e.target.checked;
});

document.getElementById('toggleZoom').addEventListener('change', (e) => {
  state.cameraZoom = e.target.checked;
});

document.getElementById('toggleBadge').addEventListener('change', (e) => {
  state.showSocialBadge = e.target.checked;
});

document.getElementById('zoomSlider').addEventListener('input', (e) => {
  state.maxZoom = Number(e.target.value) / 100;
  document.getElementById('zoomVal').textContent = `${state.maxZoom.toFixed(2)}x`;
});

document.getElementById('durationSlider').addEventListener('input', (e) => {
  state.duration = Number(e.target.value);
  document.getElementById('durationVal').textContent = `${state.duration}s`;
  renderHotspotsUI();
  updateTimelineUI();
});

// Timeline controls
document.getElementById('playPauseBtn').addEventListener('click', () => {
  state.isPlaying = !state.isPlaying;
  playIcon.textContent = state.isPlaying ? '⏸' : '▶';
});

document.getElementById('restartBtn').addEventListener('click', () => {
  state.currentTime = 0;
  state.isPlaying = true;
  playIcon.textContent = '⏸';
  updateTimelineUI();
});

scrubber.addEventListener('input', (e) => {
  const norm = Number(e.target.value) / 1000;
  state.currentTime = norm * state.duration;
  updateTimelineUI();
});

document.getElementById('exportVideoBtn').addEventListener('click', () => {
  if (state.isRecording) {
    stopRecordingVideo();
  } else {
    startRecordingVideo();
  }
});

document.getElementById('closeToastBtn').addEventListener('click', () => {
  document.getElementById('downloadToast').classList.add('hidden');
});

// Initial load: extract the built-in demo social app immediately and start 60fps loop
window.addEventListener('DOMContentLoaded', () => {
  extractWebsite('pulseflow.app');
  requestAnimationFrame(tick);
});
