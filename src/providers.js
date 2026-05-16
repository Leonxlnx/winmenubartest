/* ============================================================
   Providers subsystem — tracks AI subscription quotas
   (Codex / Claude / Cursor / Copilot / Gemini ...)
   - Persists to <userData>/providers.json
   - Watches the file so any external collector / plugin can
     push fresh usage and the notch updates live.
   ============================================================ */

const fs = require('fs');
const path = require('path');

let dataDir = null;
let cache = [];
let watcher = null;
let listeners = new Set();
let debounceTimer = null;
let writeLock = false;

const DEFAULT_SAMPLE = [
  {
    id: 'codex',
    name: 'Codex',
    plan: 'Pro',
    color: '#10a37f',
    iconKey: 'codex',
    metrics: [
      { label: 'Session', percentLeft: 73, resetsAt: hoursFromNow(2.3) },
      { label: 'Weekly',  percentLeft: 91, resetsAt: hoursFromNow(103) }
    ]
  },
  {
    id: 'claude',
    name: 'Claude',
    plan: 'Max',
    color: '#d97757',
    iconKey: 'claude',
    metrics: [
      { label: 'Session', percentLeft: 100, resetsAt: hoursFromNow(4.5) },
      { label: 'Weekly',  percentLeft: 42,  resetsAt: hoursFromNow(43) }
    ]
  },
  {
    id: 'cursor',
    name: 'Cursor',
    plan: 'Ultra',
    color: '#5bc0eb',
    iconKey: 'cursor',
    metrics: [
      { label: 'Plan usage', dollarsLeft: 167.78, resetsAt: hoursFromNow(8 * 24) }
    ]
  },
  {
    id: 'copilot',
    name: 'Copilot',
    plan: 'Pro',
    color: '#a371f7',
    iconKey: 'copilot',
    metrics: [
      { label: 'Premium',  percentLeft: 54, resetsAt: hoursFromNow(12 * 24) }
    ]
  }
];

function hoursFromNow(h) {
  return new Date(Date.now() + h * 3600 * 1000).toISOString();
}

function filePath() { return path.join(dataDir, 'providers.json'); }

function normalize(p) {
  return {
    id: String(p.id || (p.name || 'unknown').toLowerCase()),
    name: String(p.name || 'Unknown'),
    plan: p.plan || null,
    color: p.color || '#7d7d80',
    iconKey: p.iconKey || (p.name || 'unknown').toLowerCase(),
    metrics: Array.isArray(p.metrics) ? p.metrics.map(normalizeMetric) : [],
    fetchedAt: p.fetchedAt || new Date().toISOString()
  };
}

function normalizeMetric(m) {
  return {
    label: String(m.label || 'Usage'),
    percentLeft: typeof m.percentLeft === 'number' ? clamp(m.percentLeft, 0, 100) : null,
    dollarsLeft: typeof m.dollarsLeft === 'number' ? m.dollarsLeft : null,
    note: m.note || null,
    resetsAt: m.resetsAt || null
  };
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function readFromDisk() {
  try {
    const p = filePath();
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalize);
  } catch (err) {
    console.error('[providers] read failed:', err);
    return [];
  }
}

function writeToDisk(list) {
  try {
    writeLock = true;
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(filePath(), JSON.stringify(list, null, 2), 'utf8');
    setTimeout(() => { writeLock = false; }, 120);
  } catch (err) {
    writeLock = false;
    console.error('[providers] write failed:', err);
  }
}

function notify() {
  for (const cb of listeners) {
    try { cb(cache); } catch (err) { console.error(err); }
  }
}

function init(userDataDir) {
  dataDir = userDataDir;
  fs.mkdirSync(dataDir, { recursive: true });
  const p = filePath();
  if (!fs.existsSync(p)) {
    cache = DEFAULT_SAMPLE.map(normalize);
    writeToDisk(cache);
  } else {
    cache = readFromDisk();
  }

  try {
    watcher = fs.watch(dataDir, { persistent: false }, (event, filename) => {
      if (filename !== path.basename(p)) return;
      if (writeLock) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        cache = readFromDisk();
        notify();
      }, 80);
    });
  } catch (err) {
    console.error('[providers] watcher failed:', err);
  }
}

function list() { return cache.slice(); }
function setAll(next) { cache = next.map(normalize); writeToDisk(cache); notify(); }
function upsert(p) {
  const entry = normalize(p);
  const idx = cache.findIndex((x) => x.id === entry.id);
  if (idx >= 0) cache[idx] = entry; else cache.unshift(entry);
  writeToDisk(cache);
  notify();
  return entry;
}
function remove(id) {
  cache = cache.filter((x) => x.id !== id);
  writeToDisk(cache);
  notify();
}
function reset() {
  cache = DEFAULT_SAMPLE.map(normalize);
  writeToDisk(cache);
  notify();
}
function onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }

module.exports = { init, list, setAll, upsert, remove, reset, onChange, filePath };
