const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { URL } = require('url');

const PORT = process.env.PORT || 3456;
const PUBLIC_DIR = path.join(__dirname, 'public');

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser'
];

function getChromePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Extract Open Graph metadata, theme color, headings, and CTA labels from HTML
function parseHtmlDetails(html, fallbackHost, fullUrl) {
  const extractMeta = (regex) => {
    const m = html.match(regex);
    return m ? m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() : '';
  };

  const title =
    extractMeta(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    extractMeta(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
    extractMeta(/<title[^>]*>([^<]+)<\/title>/i) ||
    fallbackHost;

  const description =
    extractMeta(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    extractMeta(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    'Interactive website showcase & social media video reel.';

  const siteName =
    extractMeta(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
    fallbackHost.replace(/^www\./, '');

  const themeColor =
    extractMeta(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i) ||
    '#6366f1';

  const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const h1List = [];
  const h2List = [];
  const btnList = [];
  const pList = [];

  let m;
  const h1Re = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  while ((m = h1Re.exec(html)) !== null && h1List.length < 3) {
    const t = stripTags(m[1]);
    if (t.length > 2) h1List.push(t);
  }

  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  while ((m = h2Re.exec(html)) !== null && h2List.length < 8) {
    const t = stripTags(m[1]);
    if (t.length > 2) h2List.push(t);
  }

  const btnRe = /<(?:button|a)[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
  while ((m = btnRe.exec(html)) !== null && btnList.length < 10) {
    const t = stripTags(m[1]);
    if (t.length >= 3 && t.length <= 32 && !btnList.includes(t)) {
      btnList.push(t);
    }
  }

  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = pRe.exec(html)) !== null && pList.length < 8) {
    const t = stripTags(m[1]);
    if (t.length >= 15) pList.push(t);
  }

  const extractedLabels = [...btnList.slice(0, 2), ...h2List.slice(0, 3)].filter(Boolean);

  return {
    title,
    description,
    siteName,
    themeColor,
    hostname: fallbackHost,
    fullUrl,
    heroHeading: h1List[0] || title,
    heroSub: pList[0] || description,
    sectionHeadings: h2List.length ? h2List : ['Smooth Auto-Scroll', 'Smart Cursor & Zoom', 'Multi-Aspect Social Export'],
    sectionTexts: pList.slice(1, 5),
    ctaButtons: btnList.length ? btnList.slice(0, 3) : ['Get Started →', 'Explore Showcase'],
    extractedLabels
  };
}

function fetchHtmlMetadata(targetUrl) {
  return new Promise((resolve) => {
    try {
      // Built-in demo site shortcut
      if (targetUrl.includes('/demo-site')) {
        const html = fs.readFileSync(path.join(PUBLIC_DIR, 'demo-site.html'), 'utf8');
        return resolve(parseHtmlDetails(html, 'pulseflow.app', 'https://pulseflow.app'));
      }

      const parsed = new URL(targetUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(
        targetUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml'
          },
          timeout: 7000
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            return resolve(fetchHtmlMetadata(redirectUrl));
          }
          let html = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            if (html.length < 300000) html += chunk;
          });
          res.on('end', () => {
            resolve(parseHtmlDetails(html, parsed.hostname, targetUrl));
          });
        }
      );
      req.on('error', () => {
        const parsed = new URL(targetUrl);
        resolve(parseHtmlDetails('', parsed.hostname, targetUrl));
      });
      req.on('timeout', () => {
        req.destroy();
      });
    } catch (e) {
      resolve(parseHtmlDetails('', targetUrl, targetUrl));
    }
  });
}

// Try native Chrome headless screenshot with fast fallback if Chrome is restricted by OS sandbox
function captureTallScreenshot(chromePath, targetUrl, width, captureHeight, isMobile) {
  return new Promise((resolve) => {
    if (!chromePath) return resolve(null);

    const tmpFile = path.join(
      os.tmpdir(),
      `sitereel_${Date.now()}_${Math.random().toString(36).slice(2)}.png`
    );

    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--disable-dev-shm-usage',
      '--force-device-scale-factor=2',
      `--window-size=${width},${captureHeight}`,
      `--screenshot=${tmpFile}`,
      '--virtual-time-budget=4000'
    ];

    if (isMobile) {
      args.push(
        '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      );
    }

    args.push(targetUrl);

    let settled = false;
    const finish = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    try {
      const proc = spawn(chromePath, args);
      const timer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch (_) {}
        finish(null);
      }, 6500);

      proc.on('close', () => {
        clearTimeout(timer);
        if (fs.existsSync(tmpFile)) {
          try {
            const buf = fs.readFileSync(tmpFile);
            fs.unlinkSync(tmpFile);
            return finish(buf);
          } catch (_) {}
        }
        finish(null);
      });

      proc.on('error', () => {
        clearTimeout(timer);
        finish(null);
      });
    } catch (_) {
      finish(null);
    }
  });
}

function buildHotspots(vw, vh, captureHeight, labels = []) {
  const defaultLabels = [
    'Primary Hero CTA',
    'Interactive Feature Card',
    'Live Metrics Showcase',
    'Get Started Action'
  ];
  const getLabel = (i) => labels[i] || defaultLabels[i % defaultLabels.length];

  return [
    {
      centerX: Math.round(vw * 0.42),
      centerY: Math.round(vh * 0.56),
      width: Math.round(vw * 0.24),
      height: 54,
      type: 'click',
      label: getLabel(0),
      zoomScale: 1.48
    },
    {
      centerX: Math.round(vw * 0.30),
      centerY: Math.round(captureHeight * 0.42),
      width: Math.round(vw * 0.28),
      height: 110,
      type: 'focus',
      label: getLabel(1),
      zoomScale: 1.38
    },
    {
      centerX: Math.round(vw * 0.68),
      centerY: Math.round(captureHeight * 0.65),
      width: Math.round(vw * 0.28),
      height: 90,
      type: 'click',
      label: getLabel(2),
      zoomScale: 1.45
    },
    {
      centerX: Math.round(vw * 0.5),
      centerY: Math.round(captureHeight * 0.86),
      width: Math.round(vw * 0.3),
      height: 60,
      type: 'click',
      label: getLabel(3),
      zoomScale: 1.42
    }
  ];
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && parsedUrl.pathname === '/demo-site') {
    const demoPath = path.join(PUBLIC_DIR, 'demo-site.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(demoPath).pipe(res);
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/extract') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        let { url, device = 'desktop' } = payload;

        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'URL is required' }));
        }

        if (url === 'demo' || url === 'demo-site' || url.includes('pulseflow.app')) {
          url = `http://localhost:${PORT}/demo-site`;
        } else if (!/^https?:\/\//i.test(url)) {
          url = 'https://' + url;
        }

        const isMobile = device === 'mobile';
        const viewportWidth = isMobile ? 390 : 1440;
        const viewportHeight = isMobile ? 844 : 900;
        const captureHeight = isMobile ? 2600 : 2850;

        const chromePath = getChromePath();
        const [meta, screenshotBuffer] = await Promise.all([
          fetchHtmlMetadata(url),
          captureTallScreenshot(chromePath, url, viewportWidth, captureHeight, isMobile)
        ]);

        const hotspots = buildHotspots(
          viewportWidth,
          viewportHeight,
          captureHeight,
          meta.extractedLabels
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            success: true,
            metadata: {
              ...meta,
              viewportWidth,
              viewportHeight,
              captureHeight,
              scrollHeight: captureHeight,
              device,
              hotspots
            },
            screenshotDataUrl: screenshotBuffer
              ? `data:image/png;base64,${screenshotBuffer.toString('base64')}`
              : null
          })
        );
      } catch (err) {
        console.error('Extraction error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            error: err.message || 'Failed to capture website'
          })
        );
      }
    });
    return;
  }

  let filePath = path.join(
    PUBLIC_DIR,
    parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname
  );
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream'
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`SiteReel Studio server listening on http://localhost:${PORT}`);
});
