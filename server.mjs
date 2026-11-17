import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

/**
 * Продакшен-сервер контейнера «КРЕСЛО» (Zero-PII / 152-ФЗ Compliant):
 * 1. Раздаёт статический билд ./dist со сжатием gzip и кэш-заголовками.
 * 2. НЕ читает, НЕ логирует и НЕ сохраняет IP-адреса, User-Agent, Referer и Cookies посетителей.
 * 3. Считает ТОЛЬКО общие математические суммы игровых событий в /data/aggregate-stats.json.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATS_FILE = path.join(DATA_DIR, 'aggregate-stats.json');
const PORT = Number(process.env.PORT || 8080);

fs.mkdirSync(DATA_DIR, { recursive: true });

const VALID_EVENTS = new Set([
  'run_start',
  'swipe',
  'block_clear',
  'unlock_more',
  'share_click',
  'camera_on',
  'sms_open',
  'b2b_click',
]);

const VALID_PACKS = new Set([
  'it_product',
  'smm_insta',
  'rector_nii',
  'plastic_surgeon',
  'renovation_pro',
  'wb_seller',
  'sec_sysadmin',
  'tender_44fz',
  'it_cfo',
  'pvz_december',
  'barista_acup',
  'hr_family',
]);

const VALID_SOURCES = new Set(['intermission', 'ending', 'hub', 'vault']);

function createEmptyStats() {
  return {
    updatedAtDay: new Date().toISOString().slice(0, 10),
    totals: {
      runsStarted: 0,
      swipesTotal: 0,
      blocksCleared: 0,
      unlockMoreClicks: 0,
      sharesClicked: 0,
      cameraActivations: 0,
      smsEventsOpened: 0,
      b2bLeadClicks: 0,
    },
    packPlays: {},
    unlockMoreByPack: {},
    unlockMoreBySource: {},
    daily: {},
  };
}

let stats = createEmptyStats();
try {
  if (fs.existsSync(STATS_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    stats = {
      ...createEmptyStats(),
      ...parsed,
      totals: { ...createEmptyStats().totals, ...(parsed.totals || {}) },
    };
  }
} catch {
  stats = createEmptyStats();
}

let dirty = false;
function flushStatsSync() {
  if (!dirty) return;
  dirty = false;
  try {
    const tmp = `${STATS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(stats, null, 2), 'utf8');
    fs.renameSync(tmp, STATS_FILE);
  } catch {
    // ignore disk errors
  }
}

setInterval(flushStatsSync, 4000).unref();

// Глобальный ограничитель частоты импульсов в секунду (без привязки к IP!)
let pulsesThisSecond = 0;
setInterval(() => {
  pulsesThisSecond = 0;
}, 1000).unref();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

const COMPRESSIBLE_EXTS = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.webmanifest',
  '.svg',
  '.wasm',
]);

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
}

function recordPulse(payload) {
  if (!payload || typeof payload !== 'object') return;
  const { event, packId, source } = payload;
  if (!VALID_EVENTS.has(event)) return;

  const day = new Date().toISOString().slice(0, 10);
  stats.updatedAtDay = day;
  if (!stats.daily[day]) {
    stats.daily[day] = { runs: 0, swipes: 0, unlocks: 0, shares: 0 };
  }

  const validPack = typeof packId === 'string' && VALID_PACKS.has(packId) ? packId : null;
  const validSource = typeof source === 'string' && VALID_SOURCES.has(source) ? source : null;

  switch (event) {
    case 'run_start':
      stats.totals.runsStarted += 1;
      stats.daily[day].runs += 1;
      if (validPack) {
        stats.packPlays[validPack] = (stats.packPlays[validPack] || 0) + 1;
      }
      break;
    case 'swipe':
      stats.totals.swipesTotal += 1;
      stats.daily[day].swipes += 1;
      break;
    case 'block_clear':
      stats.totals.blocksCleared += 1;
      break;
    case 'unlock_more':
      stats.totals.unlockMoreClicks += 1;
      stats.daily[day].unlocks += 1;
      if (validPack) {
        stats.unlockMoreByPack[validPack] = (stats.unlockMoreByPack[validPack] || 0) + 1;
      }
      if (validSource) {
        stats.unlockMoreBySource[validSource] = (stats.unlockMoreBySource[validSource] || 0) + 1;
      }
      break;
    case 'share_click':
      stats.totals.sharesClicked += 1;
      stats.daily[day].shares += 1;
      break;
    case 'camera_on':
      stats.totals.cameraActivations += 1;
      break;
    case 'sms_open':
      stats.totals.smsEventsOpened += 1;
      break;
    case 'b2b_click':
      stats.totals.b2bLeadClicks += 1;
      break;
  }

  dirty = true;
}

function serveStaticFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);

  const rel = path.relative(DIST_DIR, filePath).replace(/\\/g, '/');
  if (rel === 'index.html' || rel === 'sw.js' || rel === 'manifest.webmanifest') {
    res.setHeader('Cache-Control', 'no-cache');
  } else if (rel.startsWith('assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }

  const acceptEnc = String(req.headers['accept-encoding'] || '');
  if (COMPRESSIBLE_EXTS.has(ext) && acceptEnc.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    res.writeHead(200);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(zlib.createGzip({ level: 6 })).pipe(res);
    return;
  }

  const stat = fs.statSync(filePath);
  res.setHeader('Accept-Ranges', 'bytes');

  const rangeHeader = req.headers.range;
  if (rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader)) {
    const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
    let start = startStr ? parseInt(startStr, 10) : 0;
    let end = endStr ? parseInt(endStr, 10) : stat.size - 1;
    if (!startStr && endStr) {
      start = Math.max(0, stat.size - parseInt(endStr, 10));
      end = stat.size - 1;
    }
    if (start >= stat.size || end >= stat.size || start > end) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      res.writeHead(416);
      res.end();
      return;
    }
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', end - start + 1);
    res.writeHead(206);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.setHeader('Content-Length', stat.size);
  res.writeHead(200);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  applySecurityHeaders(res);

  const rawUrl = req.url || '/';
  const pathname = rawUrl.split('?')[0];

  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  if (pathname.endsWith('/api/pulse') && req.method === 'POST') {
    if (pulsesThisSecond > 800) {
      res.writeHead(204);
      res.end();
      return;
    }
    pulsesThisSecond += 1;

    let body = '';
    req.on('data', (chunk) => {
      if (body.length < 512) body += chunk;
    });
    req.on('end', () => {
      try {
        recordPulse(JSON.parse(body));
      } catch {
        // ignore malformed JSON
      }
      res.writeHead(204);
      res.end();
    });
    return;
  }

  if (pathname.endsWith('/api/stats') && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(stats, null, 2));
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }

  let safeRel = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!safeRel) safeRel = 'index.html';

  const resolved = path.resolve(DIST_DIR, safeRel);
  if (!resolved.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    serveStaticFile(req, res, resolved);
    return;
  }

  const fallbackIndex = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(fallbackIndex)) {
    serveStaticFile(req, res, fallbackIndex);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[KRESLO Zero-PII Container] Listening on 0.0.0.0:${PORT} (IP logging disabled)`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    flushStatsSync();
    process.exit(0);
  });
}
