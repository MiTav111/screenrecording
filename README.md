# SiteReel Studio

Automated Website-to-Screen-Video Studio that extracts metadata and high-DPI visuals from any URL and renders 60fps showcase videos with:

1. **Smooth Automatic Scrolling** — Spring/cubic-eased top-to-bottom showcase scrolling
2. **Device Frames & Styled Backdrops** — macOS Dark, macOS Light, iPhone 16 Pro, and Minimal Glass frames over animated mesh wallpapers
3. **Simulated Cursor, Clicks & Camera Zoom** — Automatic hotspot detection with pointer glides, click ripples, and Screen Studio-style camera zoom-in
4. **Social Media Aspect Ratios & 60fps Export** — Switch between `16:9` (YouTube/X), `9:16` (TikTok/Reels), and `1:1` (Feed) and export directly to `.webm` video

## Quick Start

### Option 1: Full Server Mode (with Live Headless Chrome Capture)
```bash
node server.js
```
Open `http://localhost:3456` in your browser.

### Option 2: Standalone Browser Mode
Open `public/index.html` directly in Chrome or Safari.
