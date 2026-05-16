/* ============================================================
   OpenUsage local HTTP API client
   Polls http://127.0.0.1:6736/v1/usage every N seconds
   and emits normalized provider snapshots.
   ============================================================ */

const http = require('http');

const DEFAULT_BASE = 'http://127.0.0.1:6736';
const DEFAULT_INTERVAL = 60 * 1000;
const DEFAULT_TIMEOUT = 8000;

let base = DEFAULT_BASE;
let pollInterval = DEFAULT_INTERVAL;
let timeoutMs = DEFAULT_TIMEOUT;
let timer = null;
let listeners = new Set();
let lastSnapshot = { ok: false, providers: [], error: null, fetchedAt: null };
let demoFallback = true;

function hoursFromNow(h) {
  return new Date(Date.now() + h * 3600 * 1000).toISOString();
}

const DEMO_PROVIDERS = [
  {
    providerId: 'codex', displayName: 'Codex', plan: 'Pro',
    lines: [
      { type: 'progress', label: 'Weekly', used: 9, limit: 100, format: { kind: 'percent' }, resetsAt: hoursFromNow(103) }
    ]
  },
  {
    providerId: 'claude', displayName: 'Claude Code', plan: 'Max',
    lines: [
      { type: 'progress', label: 'Weekly', used: 58, limit: 100, format: { kind: 'percent' }, resetsAt: hoursFromNow(43) }
    ]
  },
  {
    providerId: 'cursor', displayName: 'Cursor', plan: 'Ultra',
    lines: [
      { type: 'progress', label: 'Plan', used: 32.22, limit: 200, format: { kind: 'currency' }, resetsAt: hoursFromNow(8 * 24) }
    ]
  },
  {
    providerId: 'windsurf', displayName: 'Windsurf', plan: 'Pro',
    lines: [
      { type: 'progress', label: 'Premium', used: 18, limit: 100, format: { kind: 'percent' }, resetsAt: hoursFromNow(72) }
    ]
  },
  {
    providerId: 'antigravity', displayName: 'Antigravity', plan: 'Free',
    lines: [
      { type: 'progress', label: 'Daily', used: 42, limit: 100, format: { kind: 'percent' }, resetsAt: hoursFromNow(15) }
    ]
  }
];

function demoSnapshot() {
  return {
    ok: true,
    providers: DEMO_PROVIDERS.map(normalize),
    error: null,
    fetchedAt: Date.now(),
    empty: false,
    demo: true
  };
}

function setConfig({ baseUrl, intervalMs, requestTimeoutMs, demoOnOffline } = {}) {
  if (baseUrl) base = baseUrl.replace(/\/$/, '');
  if (typeof intervalMs === 'number' && intervalMs >= 1000) pollInterval = intervalMs;
  if (typeof requestTimeoutMs === 'number' && requestTimeoutMs >= 500) timeoutMs = requestTimeoutMs;
  if (typeof demoOnOffline === 'boolean') demoFallback = demoOnOffline;
}

function get(pathname) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, base);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + (url.search || ''),
        method: 'GET',
        timeout: timeoutMs,
        headers: { 'Accept': 'application/json' }
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 204) return resolve({ status: 204, data: null });
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          }
          try {
            const data = body ? JSON.parse(body) : null;
            resolve({ status: res.statusCode, data });
          } catch (err) {
            reject(new Error(`Bad JSON from ${pathname}: ${err.message}`));
          }
        });
      }
    );
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

async function fetchAll() {
  try {
    const { status, data } = await get('/v1/usage');
    if (status === 204 || !data) {
      lastSnapshot = { ok: true, providers: [], error: null, fetchedAt: Date.now(), empty: true };
    } else {
      const list = Array.isArray(data) ? data : (Array.isArray(data?.providers) ? data.providers : []);
      lastSnapshot = {
        ok: true,
        providers: list.map(normalize),
        error: null,
        fetchedAt: Date.now(),
        empty: list.length === 0
      };
    }
  } catch (err) {
    if (demoFallback) {
      lastSnapshot = demoSnapshot();
    } else {
      lastSnapshot = {
        ok: false,
        providers: [],
        error: err.message || String(err),
        fetchedAt: Date.now()
      };
    }
  }
  for (const cb of listeners) {
    try { cb(lastSnapshot); } catch (e) { console.error(e); }
  }
  return lastSnapshot;
}

function normalize(p) {
  return {
    providerId: String(p.providerId || p.id || 'unknown'),
    displayName: String(p.displayName || p.name || p.providerId || 'Unknown'),
    plan: p.plan || null,
    lines: Array.isArray(p.lines) ? p.lines.map(normalizeLine) : [],
    fetchedAt: p.fetchedAt || new Date().toISOString()
  };
}

function normalizeLine(l) {
  if (!l || typeof l !== 'object') return null;
  if (l.type === 'progress') {
    return {
      type: 'progress',
      label: String(l.label || ''),
      used: typeof l.used === 'number' ? l.used : 0,
      limit: typeof l.limit === 'number' ? l.limit : null,
      format: l.format || { kind: 'percent' },
      resetsAt: l.resetsAt || null,
      periodDurationMs: l.periodDurationMs || null
    };
  }
  if (l.type === 'text') {
    return {
      type: 'text',
      label: String(l.label || ''),
      value: String(l.value ?? '')
    };
  }
  return null;
}

function start() {
  stop();
  fetchAll();
  timer = setInterval(fetchAll, pollInterval);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

function onSnapshot(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function snapshot() { return lastSnapshot; }

module.exports = {
  setConfig, start, stop, fetchAll, onSnapshot, snapshot, get,
  DEFAULT_BASE, DEFAULT_INTERVAL
};
