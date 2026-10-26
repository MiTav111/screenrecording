// ChurchReel Studio — 60FPS Catholic & Web Showcase Screen Video Engine
// Features:
// 1. Real Full-Height Webpage Screenshot Loading (via local server or public Microlink API when opened as standalone file)
// 2. Smooth Auto-Scrolling AND Direct Interactive Mouse-Wheel / Slider Scrolling
// 3. Styled Catholic-inspired & Light Studio Backdrops, Shadows, and Device Frames (macOS Light/Dark, iPhone 16 Pro, Glass)
// 4. Simulated Cursor, Clicks, Camera Zoom-In, and Native MP4 + Animated GIF Export

const canvas = document.getElementById('stageCanvas');
const ctx = canvas.getContext('2d');

const state = {
  aspect: '16:9',        // '16:9' | '9:16' | '1:1'
  frame: 'macos-light',  // 'macos-light' | 'macos-dark' | 'iphone' | 'glass'
  bgTheme: 'vatican',
  padding: 64,
  shadowIntensity: 0.55,
  smoothScroll: true,
  manualScrollRatio: 0,  // 0..1 when user scrolls manually
  simulateCursor: true,
  cameraZoom: true,
  showSocialBadge: true,
  maxZoom: 1.40,
  duration: 8,           // seconds
  currentTime: 0,
  isPlaying: true,
  isRecording: false,
  siteImage: null,
  metadata: {
    title: 'Vatican News — Official Catholic Portal',
    description: 'All the news of the Pope, the Holy See, and the Catholic Church around the world.',
    siteName: 'Vatican News',
    hostname: 'vaticannews.va',
    fullUrl: 'https://www.vaticannews.va/en.html',
    viewportWidth: 1440,
    viewportHeight: 900,
    captureHeight: 2850,
    hotspots: []
  }
};

const BG_THEMES = {
  vatican:   ['#fffbeb', '#fde68a', '#f59e0b', '#fef3c7'],
  alabaster: ['#f8fafc', '#e2e8f0', '#cbd5e1', '#f1f5f9'],
  marian:    ['#eff6ff', '#93c5fd', '#2563eb', '#dbeafe'],
  rose:      ['#fdf2f8', '#f9a8d4', '#c084fc', '#fce7f3'],
  olive:     ['#f0fdf4', '#86efac', '#059669', '#dcfce7'],
  aurora:    ['#312e81', '#6d28d9', '#db2777', '#0f172a']
};

const ASPECT_DIMENSIONS = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1':  { width: 960, height: 960 }
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
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

function getKeyframes() {
  const spots = state.metadata.hotspots || [];
  if (spots.length === 0) return [];

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

// Compute scroll position, camera zoom, and cursor state
function evaluateChoreography(p, viewportW, viewportH, totalImageH) {
  const maxScroll = Math.max(0, totalImageH - viewportH);

  // 1. Smooth Automatic Scroll OR Manual Wheel/Slider Scroll
  let scrollY = 0;
  if (state.smoothScroll && maxScroll > 0) {
    if (p < 0.08) {
      scrollY = 0;
    } else if (p < 0.90) {
      const scrollNorm = (p - 0.08) / 0.82;
      const stepped = scrollNorm + 0.035 * Math.sin(scrollNorm * Math.PI * 3);
      scrollY = clamp(easeInOutCubic(clamp(stepped, 0, 1)) * maxScroll, 0, maxScroll);
    } else {
      scrollY = maxScroll;
    }
    // Sync manual slider visually
    state.manualScrollRatio = maxScroll > 0 ? scrollY / maxScroll : 0;
    const msSlider = document.getElementById('manualScrollSlider');
    const msVal = document.getElementById('manualScrollVal');
    if (msSlider && document.activeElement !== msSlider) {
      msSlider.value = Math.round(state.manualScrollRatio * 100);
      if (msVal) msVal.textContent = `${msSlider.value}%`;
    }
  } else {
    scrollY = state.manualScrollRatio * maxScroll;
  }

  // 2. Camera Zoom & Pan on key sections + 3. Simulated Cursor & Clicks
  const keyframes = getKeyframes();
  let zoom = 1.0;
  let focusX = viewportW * 0.5;
  let focusY = viewportH * 0.5;

  let cursorX = viewportW * (0.5 + 0.22 * Math.sin(p * Math.PI * 2.5));
  let cursorY = viewportH * (0.48 + 0.18 * Math.cos(p * Math.PI * 2));
  let clickRipple = 0;
  let activeLabel = null;

  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];
    const scaleX = viewportW / (state.metadata.viewportWidth || 1440);
    const scaleY = totalImageH / (state.metadata.captureHeight || 2850);
    const targetX = clamp(kf.centerX * scaleX, viewportW * 0.18, viewportW * 0.82);
    const targetY = clamp(kf.centerY * scaleY - scrollY, viewportH * 0.2, viewportH * 0.8);

    const approachStart = kf.startP - 0.06;
    if (p >= approachStart && p <= kf.endP) {
      const moveT = clamp((p - approachStart) / 0.08, 0, 1);
      const easedMove = easeInOutCubic(moveT);
      cursorX = lerp(cursorX, targetX, easedMove);
      cursorY = lerp(cursorY, targetY, easedMove);
    }

    if (p >= kf.startP && p <= kf.endP) {
      const localT = (p - kf.startP) / (kf.endP - kf.startP);
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
        focusX = lerp(viewportW * 0.5, targetX, intensity);
        focusY = lerp(viewportH * 0.5, targetY, intensity);
      }

      activeLabel = kf.label;

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

function drawWallpaper(ctx, W, H, p) {
  const colors = BG_THEMES[state.bgTheme] || BG_THEMES.vatican;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.5, colors[1]);
  grad.addColorStop(1, colors[3]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  const orb1X = W * (0.25 + 0.12 * Math.cos(p * Math.PI * 2));
  const orb1Y = H * (0.28 + 0.1 * Math.sin(p * Math.PI * 2));
  const rad1 = Math.max(W, H) * 0.55;
  const g1 = ctx.createRadialGradient(orb1X, orb1Y, 10, orb1X, orb1Y, rad1);
  g1.addColorStop(0, colors[2] + '55');
  g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const orb2X = W * (0.78 + 0.1 * Math.sin(p * Math.PI * 2));
  const orb2Y = H * (0.72 + 0.12 * Math.cos(p * Math.PI * 2));
  const g2 = ctx.createRadialGradient(orb2X, orb2Y, 10, orb2X, orb2Y, rad1 * 0.9);
  g2.addColorStop(0, colors[1] + '66');
  g2.addColorStop(1, 'transparent');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawSimulatedCursor(ctx, x, y, clickRipple, activeLabel) {
  ctx.save();

  if (clickRipple > 0) {
    const r1 = 10 + clickRipple * 42;
    const alpha = (1 - clickRipple) * 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r1, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(217, 119, 6, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    const r2 = 5 + clickRipple * 24;
    ctx.beginPath();
    ctx.arc(x, y, r2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.4})`;
    ctx.fill();
  }

  const pressScale =
    clickRipple > 0 && clickRipple < 0.35
      ? 1 - 0.18 * Math.sin((clickRipple / 0.35) * Math.PI)
      : 1;

  ctx.translate(x, y);
  ctx.scale(pressScale, pressScale);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 24);
  ctx.lineTo(6.2, 18.8);
  ctx.lineTo(11, 28);
  ctx.lineTo(15, 26);
  ctx.lineTo(10.2, 17);
  ctx.lineTo(18, 17);
  ctx.closePath();

  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1e293b';
  ctx.stroke();

  if (activeLabel && clickRipple > 0.05) {
    ctx.shadowBlur = 8;
    const pillText = `✝ ${activeLabel.slice(0, 26)}`;
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
    const textW = ctx.measureText(pillText).width;
    const px = 22;
    const py = 10;
    roundRectPath(ctx, px, py, textW + 20, 26, 13);
    ctx.fillStyle = 'rgba(255, 251, 235, 0.95)';
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#92400e';
    ctx.fillText(pillText, px + 10, py + 17);
  }

  ctx.restore();
}

function renderFrame(progress) {
  const dim = ASPECT_DIMENSIONS[state.aspect] || ASPECT_DIMENSIONS['16:9'];
  if (canvas.width !== dim.width || canvas.height !== dim.height) {
    canvas.width = dim.width;
    canvas.height = dim.height;
  }

  const W = canvas.width;
  const H = canvas.height;

  drawWallpaper(ctx, W, H, progress);

  const isIphoneFrame = state.frame === 'iphone';
  const pad = state.padding * (W / 1280);

  let availW = W - pad * 2;
  let availH = H - pad * 2 - (state.showSocialBadge ? 48 : 0);

  const siteAspect = isIphoneFrame ? 9 / 19.2 : 16 / 10;
  let winW = availW;
  let winH = winW / siteAspect;

  if (winH > availH) {
    winH = availH;
    winW = winH * siteAspect;
  }

  const headerH = isIphoneFrame ? 0 : state.frame === 'glass' ? 0 : 38;
  const contentW = winW;
  const contentH = winH - headerH;

  const imgW = state.siteImage ? state.siteImage.width : 1440;
  const imgH = state.siteImage ? state.siteImage.height : 2850;
  const scaleToWindow = contentW / imgW;
  const scaledTotalH = Math.max(contentH + 100, imgH * scaleToWindow);

  const choreo = evaluateChoreography(progress, contentW, contentH, scaledTotalH);

  ctx.save();

  const stageCenterX = W / 2;
  const stageCenterY = (H - (state.showSocialBadge ? 36 : 0)) / 2;

  ctx.translate(stageCenterX, stageCenterY);

  if (state.cameraZoom && choreo.zoom > 1.001) {
    const offsetX = (contentW / 2 - choreo.focusX) * (choreo.zoom - 1);
    const offsetY = (contentH / 2 - choreo.focusY) * (choreo.zoom - 1);
    ctx.scale(choreo.zoom, choreo.zoom);
    ctx.translate(offsetX / choreo.zoom, offsetY / choreo.zoom);
  }

  const floatY = Math.sin(progress * Math.PI * 2) * 4 * state.shadowIntensity;
  ctx.translate(0, floatY);

  const winX = -winW / 2;
  const winY = -winH / 2;
  const borderRadius = isIphoneFrame ? 38 : 16;

  // Window elevation shadow
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
  ctx.shadowBlur = 45;
  ctx.shadowOffsetY = 22;
  roundRectPath(ctx, winX, winY, winW, winH, borderRadius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, winX, winY, winW, winH, borderRadius);
  ctx.clip();

  // Browser Header Bar
  if (headerH > 0) {
    const isLight = state.frame === 'macos-light';
    ctx.fillStyle = isLight ? '#f8fafc' : '#1e293b';
    ctx.fillRect(winX, winY, winW, headerH);

    const dotY = winY + headerH / 2;
    const colors = ['#ff5f56', '#ffbd2e', '#27c93f'];
    colors.forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(winX + 18 + i * 18, dotY, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    });

    const pillW = Math.min(winW * 0.52, 380);
    const pillH = 22;
    const pillX = winX + (winW - pillW) / 2;
    const pillY = winY + (headerH - pillH) / 2;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, 6);
    ctx.fillStyle = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)';
    ctx.fill();

    ctx.fillStyle = isLight ? '#334155' : '#cbd5e1';
    ctx.font = '600 11.5px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const domainLabel = `🔒 ${state.metadata.hostname || 'vaticannews.va'}`;
    ctx.fillText(domainLabel, winX + winW / 2, dotY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // Webpage Content Viewport with Scrolling
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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(contentX, contentY, contentW, contentH);
  }

  // Scrollbar thumb on right edge
  if (scaledTotalH > contentH) {
    const trackH = contentH - 14;
    const thumbH = Math.max(30, (contentH / scaledTotalH) * trackH);
    const maxScroll = scaledTotalH - contentH;
    const thumbY = contentY + 7 + (choreo.scrollY / maxScroll) * (trackH - thumbH);
    roundRectPath(ctx, contentX + contentW - 8, thumbY, 4.5, thumbH, 2.5);
    ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
    ctx.fill();
  }

  if (state.simulateCursor) {
    drawSimulatedCursor(
      ctx,
      contentX + choreo.cursorX,
      contentY + choreo.cursorY,
      choreo.clickRipple,
      choreo.activeLabel
    );
  }

  ctx.restore();

  if (isIphoneFrame) {
    const islandW = winW * 0.3;
    const islandH = 20;
    roundRectPath(ctx, winX + (winW - islandW) / 2, winY + 12, islandW, islandH, 10);
    ctx.fillStyle = '#000000';
    ctx.fill();
  }

  ctx.restore();

  roundRectPath(ctx, winX, winY, winW, winH, borderRadius);
  ctx.lineWidth = isIphoneFrame ? 6 : 2;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)';
  ctx.stroke();

  ctx.restore();

  // Floating Caption Badge at bottom
  if (state.showSocialBadge) {
    ctx.save();
    const badgeText = `✝ ${state.metadata.title.slice(0, 42)}  •  ${state.metadata.hostname}`;
    ctx.font = '600 13.5px -apple-system, BlinkMacSystemFont, sans-serif';
    const textMetrics = ctx.measureText(badgeText);
    const bW = Math.min(W - 50, textMetrics.width + 38);
    const bH = 34;
    const bX = (W - bW) / 2;
    const bY = H - bH - 16;

    roundRectPath(ctx, bX, bY, bW, bH, 17);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, W / 2, bY + bH / 2 + 1);
    ctx.restore();
  }
}

// High-DPI Catholic / Parish Webpage Synthesizer Fallback (when offline or demo)
function buildSynthesizedSiteCanvas(meta, isMobile) {
  const vw = isMobile ? 390 : 1440;
  const vh = isMobile ? 2600 : 2850;
  const off = document.createElement('canvas');
  off.width = vw;
  off.height = vh;
  const c = off.getContext('2d');

  // Warm Ivory & Cathedral Gold Parish / Catholic Portal Page
  c.fillStyle = '#fcfbf7';
  c.fillRect(0, 0, vw, vh);

  // Top Header Bar
  c.fillStyle = '#854d0e';
  c.fillRect(0, 0, vw, 14);

  c.fillStyle = '#ffffff';
  c.fillRect(0, 14, vw, 82);
  c.strokeStyle = '#e7e2d8';
  c.beginPath();
  c.moveTo(0, 96);
  c.lineTo(vw, 96);
  c.stroke();

  const padX = isMobile ? 24 : 96;
  c.fillStyle = '#78350f';
  c.font = `800 ${isMobile ? 20 : 26}px Georgia, serif`;
  c.fillText(`✝ ${meta.siteName || meta.hostname}`, padX, 64);

  // Nav button
  const navBtnW = isMobile ? 110 : 160;
  roundRectPath(c, vw - padX - navBtnW, 34, navBtnW, 42, 21);
  c.fillStyle = '#b45309';
  c.fill();
  c.fillStyle = '#ffffff';
  c.font = '600 14px -apple-system, BlinkMacSystemFont, sans-serif';
  c.textAlign = 'center';
  c.fillText('Mass Times & Live', vw - padX - navBtnW / 2, 60);

  // Hero Banner
  const heroGrad = c.createLinearGradient(0, 96, 0, 680);
  heroGrad.addColorStop(0, '#fef3c7');
  heroGrad.addColorStop(1, '#fcfbf7');
  c.fillStyle = heroGrad;
  c.fillRect(0, 96, vw, 584);

  const badgeY = isMobile ? 140 : 165;
  roundRectPath(c, vw / 2 - 180, badgeY, 360, 34, 17);
  c.fillStyle = '#fde68a';
  c.fill();
  c.fillStyle = '#92400e';
  c.font = '700 13px -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillText(`🕊️ Official Webpage • ${meta.hostname}`, vw / 2, badgeY + 22);

  // Hero Heading
  const heroTitle = meta.heroHeading || meta.title || 'Welcome to Our Catholic Community';
  c.fillStyle = '#1e293b';
  c.font = `800 ${isMobile ? 32 : 56}px Georgia, serif`;
  const words = heroTitle.split(' ');
  let line = '';
  let y = isMobile ? 230 : 270;
  const maxLineW = vw - padX * 2;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (c.measureText(test).width > maxLineW && line) {
      c.fillText(line.trim(), vw / 2, y);
      line = words[i] + ' ';
      y += isMobile ? 40 : 66;
    } else {
      line = test;
    }
  }
  if (line) {
    c.fillText(line.trim(), vw / 2, y);
    y += isMobile ? 44 : 64;
  }

  c.fillStyle = '#475569';
  c.font = `400 ${isMobile ? 15 : 21}px -apple-system, BlinkMacSystemFont, sans-serif`;
  c.fillText((meta.description || '').slice(0, 95), vw / 2, y);

  // Primary CTA Buttons
  const ctaY = isMobile ? 430 : 475;
  const btnW = isMobile ? 160 : 230;
  const btnH = 54;
  roundRectPath(c, vw / 2 - btnW - 10, ctaY, btnW, btnH, 12);
  c.fillStyle = '#b45309';
  c.fill();
  c.fillStyle = '#ffffff';
  c.font = '700 16px -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillText('Explore Parish →', vw / 2 - btnW / 2 - 10, ctaY + 33);

  roundRectPath(c, vw / 2 + 10, ctaY, btnW * 0.85, btnH, 12);
  c.fillStyle = '#ffffff';
  c.fill();
  c.strokeStyle = '#d97706';
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = '#92400e';
  c.fillText('Daily Readings', vw / 2 + 10 + (btnW * 0.85) / 2, ctaY + 33);

  // 3 Feature Cards Section
  const cardsY = isMobile ? 700 : 820;
  const headings = meta.sectionHeadings && meta.sectionHeadings.length
    ? meta.sectionHeadings
    : ['Holy Mass & Liturgy', 'Daily Gospel & Homilies', 'Parish Ministries & Youth'];
  const icons = ['⛪', '📖', '🕯️'];

  const cols = isMobile ? 1 : 3;
  const gap = 28;
  const cardW = (vw - padX * 2 - gap * (cols - 1)) / cols;
  const cardH = isMobile ? 210 : 320;

  for (let i = 0; i < 3; i++) {
    const cx = padX + (isMobile ? 0 : i * (cardW + gap));
    const cy = cardsY + (isMobile ? i * (cardH + 20) : 0);

    roundRectPath(c, cx, cy, cardW, cardH, 20);
    c.fillStyle = '#ffffff';
    c.fill();
    c.lineWidth = 1.5;
    c.strokeStyle = '#e5e0d5';
    c.stroke();

    roundRectPath(c, cx + 28, cy + 28, 52, 52, 14);
    c.fillStyle = '#fef3c7';
    c.fill();
    c.font = '26px sans-serif';
    c.textAlign = 'center';
    c.fillText(icons[i % icons.length], cx + 54, cy + 64);

    c.textAlign = 'left';
    c.fillStyle = '#1e293b';
    c.font = `700 ${isMobile ? 20 : 23}px Georgia, serif`;
    c.fillText((headings[i] || `Section ${i + 1}`).slice(0, 26), cx + 28, cy + 122);

    c.fillStyle = '#64748b';
    c.font = `400 ${isMobile ? 14 : 15.5}px -apple-system, BlinkMacSystemFont, sans-serif`;
    c.fillText('Join our community in prayer, sacraments,', cx + 28, cy + 158);
    c.fillText('sacred music, and charitable outreach.', cx + 28, cy + 184);
  }

  // Schedule & Highlights Box
  const metricsY = isMobile ? 1480 : 1480;
  const metricsH = 380;
  roundRectPath(c, padX, metricsY, vw - padX * 2, metricsH, 28);
  c.fillStyle = '#1e3a8a';
  c.fill();

  const stats = [
    { val: 'Sunday Mass', lbl: '8:00 AM • 10:30 AM • 6:00 PM' },
    { val: 'Adoration', lbl: 'Daily Chapel & Benediction' },
    { val: 'Confession', lbl: 'Saturdays 4:00 PM – 5:00 PM' }
  ];
  c.textAlign = 'center';
  stats.forEach((st, idx) => {
    const sx = isMobile ? vw / 2 : padX + ((vw - padX * 2) / 3) * (idx + 0.5);
    const sy = isMobile ? metricsY + 95 + idx * 110 : metricsY + 180;
    c.fillStyle = '#fde68a';
    c.font = `800 ${isMobile ? 28 : 42}px Georgia, serif`;
    c.fillText(st.val, sx, sy);
    c.fillStyle = '#e0f2fe';
    c.font = '500 17px -apple-system, BlinkMacSystemFont, sans-serif';
    c.fillText(st.lbl, sx, sy + 36);
  });

  // Footer Callout Banner
  const bottomY = 2080;
  const bottomH = 440;
  roundRectPath(c, padX, bottomY, vw - padX * 2, bottomH, 28);
  const bGrad = c.createLinearGradient(padX, bottomY, vw - padX, bottomY + bottomH);
  bGrad.addColorStop(0, '#92400e');
  bGrad.addColorStop(1, '#b45309');
  c.fillStyle = bGrad;
  c.fill();

  c.fillStyle = '#ffffff';
  c.font = `800 ${isMobile ? 26 : 44}px Georgia, serif`;
  c.fillText(`Visit ${meta.siteName || meta.hostname}`, vw / 2, bottomY + 145);

  c.font = `400 ${isMobile ? 15 : 20}px -apple-system, BlinkMacSystemFont, sans-serif`;
  c.fillStyle = '#fef3c7';
  c.fillText('“Peace be with you.” — Share the Good News online.', vw / 2, bottomY + 195);

  roundRectPath(c, vw / 2 - 140, bottomY + 245, 280, 60, 16);
  c.fillStyle = '#ffffff';
  c.fill();
  c.fillStyle = '#78350f';
  c.font = '800 17px -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillText('Connect With Us →', vw / 2, bottomY + 282);

  return off;
}

// Fetch real full-page screenshot & metadata from any URL (works both via local server AND directly in browser via Microlink API!)
async function extractWebsite(rawUrl) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const extractBtn = document.getElementById('extractBtn');
  const statusPill = document.getElementById('extractStatus');

  let targetUrl = (rawUrl || '').trim();
  if (!targetUrl) return;

  const isDemo = targetUrl.toLowerCase() === 'demo';
  if (!isDemo && !/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  loadingOverlay.classList.remove('hidden');
  loadingText.textContent = `Loading full webpage & scrolling view for ${targetUrl}...`;
  extractBtn.disabled = true;
  statusPill.textContent = 'Loading Page...';

  const isMobile = state.frame === 'iphone';
  const vw = isMobile ? 390 : 1440;
  const vh = isMobile ? 844 : 900;
  const captureHeight = isMobile ? 2600 : 2850;

  try {
    let loadedRealImage = null;
    let extractedMeta = null;

    // 1. If running on local Node server (http://localhost:3456), try backend first
    if (!isDemo && window.location.protocol.startsWith('http')) {
      try {
        const resp = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl, device: isMobile ? 'mobile' : 'desktop' })
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
          extractedMeta = data.metadata;
          if (data.screenshotDataUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((res, rej) => {
              img.onload = res;
              img.onerror = rej;
              img.src = data.screenshotDataUrl;
            });
            loadedRealImage = img;
          }
        }
      } catch (_) {}
    }

    // 2. If opened via file:// or local Chrome didn't return a bitmap, fetch REAL full-page screenshot via Microlink Public API!
    if (!isDemo && !loadedRealImage) {
      try {
        const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=true&viewport.width=${vw}&viewport.height=${captureHeight}&viewport.isMobile=${isMobile}`;
        const mlResp = await fetch(apiUrl);
        const mlJson = await mlResp.json();
        if (mlJson && mlJson.status === 'success' && mlJson.data) {
          const d = mlJson.data;
          const parsedHost = new URL(targetUrl).hostname.replace(/^www\./, '');
          extractedMeta = {
            title: d.title || parsedHost,
            description: d.description || `Live interactive scroll showcase of ${parsedHost}`,
            siteName: d.publisher || parsedHost,
            hostname: parsedHost,
            fullUrl: targetUrl,
            viewportWidth: vw,
            viewportHeight: vh,
            captureHeight,
            hotspots: [
              { centerX: Math.round(vw * 0.48), centerY: Math.round(vh * 0.52), label: (d.title || 'Header Highlight').slice(0, 24), zoomScale: 1.42 },
              { centerX: Math.round(vw * 0.34), centerY: Math.round(captureHeight * 0.42), label: 'Featured Section', zoomScale: 1.38 },
              { centerX: Math.round(vw * 0.66), centerY: Math.round(captureHeight * 0.66), label: 'Page Content Spotlight', zoomScale: 1.42 },
              { centerX: Math.round(vw * 0.50), centerY: Math.round(captureHeight * 0.85), label: 'Footer & Links', zoomScale: 1.38 }
            ]
          };

          if (d.screenshot && d.screenshot.url) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((res, rej) => {
              img.onload = res;
              img.onerror = rej;
              img.src = d.screenshot.url;
            });
            loadedRealImage = img;
          }
        }
      } catch (e) {
        console.warn('Microlink live screenshot fallback:', e);
      }
    }

    // 3. Apply extracted metadata & either the real webpage image or the Catholic Parish synthesizer
    const cleanHost = isDemo
      ? 'st-peters-parish.org'
      : targetUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const brandName = cleanHost.split('.')[0].charAt(0).toUpperCase() + cleanHost.split('.')[0].slice(1);

    state.metadata = extractedMeta || {
      title: isDemo ? 'St. Peter Parish — Catholic Church & Community' : `${brandName} — Official Webpage`,
      description: `Scroll through ${cleanHost} with smooth auto-scrolling, cursor highlights, and zoom effects.`,
      siteName: isDemo ? 'St. Peter Parish' : brandName,
      hostname: cleanHost,
      fullUrl: targetUrl,
      viewportWidth: vw,
      viewportHeight: vh,
      captureHeight,
      hotspots: [
        { centerX: Math.round(vw * 0.42), centerY: Math.round(vh * 0.55), label: 'Main Call to Action', zoomScale: 1.42 },
        { centerX: Math.round(vw * 0.32), centerY: Math.round(captureHeight * 0.42), label: 'Liturgy & Gospel', zoomScale: 1.38 },
        { centerX: Math.round(vw * 0.68), centerY: Math.round(captureHeight * 0.65), label: 'Mass Schedule', zoomScale: 1.42 },
        { centerX: Math.round(vw * 0.50), centerY: Math.round(captureHeight * 0.85), label: 'Parish Connect', zoomScale: 1.38 }
      ]
    };

    state.siteImage = loadedRealImage || buildSynthesizedSiteCanvas(state.metadata, isMobile);
    state.currentTime = 0;
    state.manualScrollRatio = 0;

    document.getElementById('metaTitle').textContent = state.metadata.title;
    document.getElementById('metaUrl').textContent = state.metadata.hostname;
    document.getElementById('metaDesc').textContent = state.metadata.description;
    statusPill.textContent = loadedRealImage ? 'Live Page Loaded ✓' : 'Demo Page Ready ✓';

    renderHotspotsUI();
  } finally {
    loadingOverlay.classList.add('hidden');
    extractBtn.disabled = false;
  }
}

// ============================================================================
// Pure-JS Animated GIF89a Encoder (Zero External Dependencies!)
// ============================================================================
function encodeAnimatedGIF(frames, width, height, delayCs) {
  const bytes = [];
  const writeByte = (b) => bytes.push(b & 0xff);
  const writeShort = (s) => {
    writeByte(s & 0xff);
    writeByte((s >> 8) & 0xff);
  };
  const writeStr = (str) => {
    for (let i = 0; i < str.length; i++) writeByte(str.charCodeAt(i));
  };

  // GIF89a Header
  writeStr('GIF89a');
  writeShort(width);
  writeShort(height);
  writeByte(0xf7); // Global color table flag, 256 colors (3x3x2 RGB palette)
  writeByte(0);
  writeByte(0);

  // Build uniform 256-color RGB 3-3-2 global palette
  for (let i = 0; i < 256; i++) {
    const r = Math.round(((i >> 5) & 0x07) * (255 / 7));
    const g = Math.round(((i >> 2) & 0x07) * (255 / 7));
    const b = Math.round((i & 0x03) * (255 / 3));
    writeByte(r);
    writeByte(g);
    writeByte(b);
  }

  // Netscape 2.0 Infinite Loop Application Extension
  writeByte(0x21);
  writeByte(0xff);
  writeByte(11);
  writeStr('NETSCAPE2.0');
  writeByte(3);
  writeByte(1);
  writeShort(0);
  writeByte(0);

  // LZW Compressor for 8-bit indexed pixels
  function lzwEncode(indexStream) {
    const minCodeSize = 8;
    const out = [];
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;

    let codeSize = minCodeSize + 1;
    let nextCode = eoiCode + 1;
    let dict = new Map();

    let bitBuf = 0;
    let bitCount = 0;
    const subBlock = [];

    const flushSubBlock = () => {
      if (subBlock.length > 0) {
        out.push(subBlock.length);
        for (let i = 0; i < subBlock.length; i++) out.push(subBlock[i]);
        subBlock.length = 0;
      }
    };

    const emitCode = (c) => {
      bitBuf |= c << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        subBlock.push(bitBuf & 0xff);
        if (subBlock.length === 255) flushSubBlock();
        bitBuf >>= 8;
        bitCount -= 8;
      }
    };

    emitCode(clearCode);
    let prefix = indexStream[0];

    for (let i = 1; i < indexStream.length; i++) {
      const k = indexStream[i];
      const key = (prefix << 8) | k;
      const found = dict.get(key);
      if (found !== undefined) {
        prefix = found;
      } else {
        emitCode(prefix);
        if (nextCode < 4096) {
          dict.set(key, nextCode++);
          if (nextCode > (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          emitCode(clearCode);
          dict.clear();
          codeSize = minCodeSize + 1;
          nextCode = eoiCode + 1;
        }
        prefix = k;
      }
    }

    emitCode(prefix);
    emitCode(eoiCode);
    if (bitCount > 0) {
      subBlock.push(bitBuf & 0xff);
    }
    flushSubBlock();
    out.push(0); // Block terminator
    return out;
  }

  for (let f = 0; f < frames.length; f++) {
    // Graphic Control Extension
    writeByte(0x21);
    writeByte(0xf9);
    writeByte(4);
    writeByte(0x00);
    writeShort(delayCs);
    writeByte(0);
    writeByte(0);

    // Image Descriptor
    writeByte(0x2c);
    writeShort(0);
    writeShort(0);
    writeShort(width);
    writeShort(height);
    writeByte(0x00);

    // Image Data
    writeByte(8); // LZW min code size
    const compressed = lzwEncode(frames[f]);
    for (let i = 0; i < compressed.length; i++) {
      writeByte(compressed[i]);
    }
  }

  // Trailer
  writeByte(0x3b);
  return new Uint8Array(bytes);
}

// Fast Animated GIF Export
async function exportAnimatedGIF() {
  if (state.isRecording) return;
  const gifBtn = document.getElementById('exportGifBtn');
  const gifLabel = document.getElementById('exportGifLabel');

  state.isRecording = true;
  const wasPlaying = state.isPlaying;
  state.isPlaying = false;
  gifBtn.classList.add('recording');
  gifLabel.textContent = 'Rendering GIF...';

  await new Promise((r) => setTimeout(r, 40));

  try {
    const scale = 0.42; // Crisp & fast social GIF resolution (e.g. 538x302)
    const gifW = Math.round(canvas.width * scale);
    const gifH = Math.round(canvas.height * scale);

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = gifW;
    tmpCanvas.height = gifH;
    const tCtx = tmpCanvas.getContext('2d', { willReadFrequently: true });

    const fps = 10;
    const totalFrames = Math.min(80, Math.round(state.duration * fps));
    const indexedFrames = [];

    for (let i = 0; i < totalFrames; i++) {
      const p = i / (totalFrames - 1);
      renderFrame(p);
      tCtx.drawImage(canvas, 0, 0, gifW, gifH);
      const rgba = tCtx.getImageData(0, 0, gifW, gifH).data;
      const indexed = new Uint8Array(gifW * gifH);

      for (let px = 0, j = 0; px < rgba.length; px += 4, j++) {
        const r3 = (rgba[px] >> 5) & 0x07;
        const g3 = (rgba[px + 1] >> 5) & 0x07;
        const b2 = (rgba[px + 2] >> 6) & 0x03;
        indexed[j] = (r3 << 5) | (g3 << 2) | b2;
      }
      indexedFrames.push(indexed);

      if (i % 5 === 0) {
        gifLabel.textContent = `GIF ${Math.round((i / totalFrames) * 100)}%`;
        await new Promise((r) => setTimeout(r, 5));
      }
    }

    const gifBytes = encodeAnimatedGIF(indexedFrames, gifW, gifH, Math.round(100 / fps));
    const blob = new Blob([gifBytes], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const cleanHost = (state.metadata.hostname || 'churchreel').replace(/[^a-z0-9]/gi, '-');
    a.href = url;
    a.download = `churchreel-${cleanHost}-${state.aspect.replace(':', 'x')}.gif`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    document.getElementById('toastTitle').textContent = 'Animated GIF Downloaded!';
    document.getElementById('toastSub').textContent = `Saved ${a.download} to your Downloads folder.`;
    document.getElementById('downloadToast').classList.remove('hidden');
  } finally {
    state.isRecording = false;
    state.isPlaying = wasPlaying;
    gifBtn.classList.remove('recording');
    gifLabel.textContent = 'Export GIF';
  }
}

// MP4 Video Recording & Export
let mediaRecorder = null;
let recordedChunks = [];

function startRecordingMp4() {
  if (state.isRecording) return;

  const mp4Btn = document.getElementById('exportMp4Btn');
  const mp4Label = document.getElementById('exportMp4Label');

  state.isRecording = true;
  state.currentTime = 0;
  state.isPlaying = true;
  document.getElementById('playIcon').textContent = '⏸';

  mp4Btn.classList.add('recording');
  mp4Label.textContent = 'Recording MP4...';

  const stream = canvas.captureStream(60);
  // Prioritize native MP4 H.264/AVC1 (supported in Safari & modern Chrome on macOS)
  const mimeTypes = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=h264',
    'video/webm'
  ];
  const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(
    stream,
    selectedMime ? { mimeType: selectedMime, videoBitsPerSecond: 10000000 } : {}
  );

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const cleanHost = (state.metadata.hostname || 'churchreel').replace(/[^a-z0-9]/gi, '-');
    a.href = url;
    a.download = `churchreel-${cleanHost}-${state.aspect.replace(':', 'x')}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    mp4Btn.classList.remove('recording');
    mp4Label.textContent = 'Export MP4';
    document.getElementById('toastTitle').textContent = 'MP4 Video Downloaded!';
    document.getElementById('toastSub').textContent = `Saved ${a.download} to your Downloads folder.`;
    document.getElementById('downloadToast').classList.remove('hidden');
  };

  mediaRecorder.start(100);
}

function stopRecordingMp4() {
  if (!state.isRecording) return;
  state.isRecording = false;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
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
      if (state.isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
        state.currentTime = state.duration;
        stopRecordingMp4();
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
  kfs.forEach((kf) => {
    const item = document.createElement('div');
    item.className = 'hotspot-item';
    const timeSec = (kf.peakP * state.duration).toFixed(1);
    item.innerHTML = `
      <span>✝ ${kf.label}</span>
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

// Event Listeners
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

// Direct Mouse Wheel / Trackpad Scrolling on the Canvas!
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  // Switch to manual scroll mode or nudge timeline so user can scroll freely
  if (state.smoothScroll) {
    state.currentTime = clamp(state.currentTime + (e.deltaY * 0.004), 0, state.duration);
    updateTimelineUI();
  } else {
    state.manualScrollRatio = clamp(state.manualScrollRatio + e.deltaY * 0.0008, 0, 1);
    const msSlider = document.getElementById('manualScrollSlider');
    const msVal = document.getElementById('manualScrollVal');
    if (msSlider) msSlider.value = Math.round(state.manualScrollRatio * 100);
    if (msVal) msVal.textContent = `${Math.round(state.manualScrollRatio * 100)}%`;
  }
}, { passive: false });

document.getElementById('manualScrollSlider').addEventListener('input', (e) => {
  const val = Number(e.target.value);
  document.getElementById('manualScrollVal').textContent = `${val}%`;
  state.manualScrollRatio = val / 100;
  // Also scrub timeline proportionally if auto-scroll is active
  if (state.smoothScroll) {
    state.currentTime = (0.08 + state.manualScrollRatio * 0.82) * state.duration;
    updateTimelineUI();
  }
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

document.getElementById('paddingSlider').addEventListener('input', (e) => {
  state.padding = Number(e.target.value);
  document.getElementById('paddingVal').textContent = `${state.padding}px`;
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

document.getElementById('exportMp4Btn').addEventListener('click', () => {
  if (state.isRecording) {
    stopRecordingMp4();
  } else {
    startRecordingMp4();
  }
});

document.getElementById('exportGifBtn').addEventListener('click', () => {
  exportAnimatedGIF();
});

document.getElementById('closeToastBtn').addEventListener('click', () => {
  document.getElementById('downloadToast').classList.add('hidden');
});

// Initialize with Vatican News (or Parish fallback if offline)
window.addEventListener('DOMContentLoaded', () => {
  extractWebsite(document.getElementById('urlInput').value.trim() || 'demo');
  requestAnimationFrame(tick);
});
