/* ============================================================
   Tasks subsystem
   - Persists to <userData>/tasks.json
   - Watches the file so external tools (Codex, scripts, agents)
     can append entries and the notch updates live.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const STATUSES = ['queued', 'running', 'done', 'failed'];

let dataDir = null;
let cache = [];
let watcher = null;
let listeners = new Set();
let debounceTimer = null;
let writeLock = false;

function filePath() {
  return path.join(dataDir, 'tasks.json');
}

function uid() {
  return 't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function readFromDisk() {
  try {
    const p = filePath();
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t === 'object')
      .map((t) => normalize(t));
  } catch (err) {
    console.error('[tasks] read failed:', err);
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
    console.error('[tasks] write failed:', err);
  }
}

function normalize(t) {
  return {
    id: t.id || uid(),
    title: String(t.title || 'Untitled task'),
    status: STATUSES.includes(t.status) ? t.status : 'queued',
    source: t.source || 'manual',
    progress: typeof t.progress === 'number' ? Math.max(0, Math.min(1, t.progress)) : null,
    startedAt: t.startedAt || (t.status === 'running' ? Date.now() : null),
    finishedAt: t.finishedAt || (t.status === 'done' || t.status === 'failed' ? Date.now() : null),
    note: t.note || null
  };
}

function notify() {
  for (const cb of listeners) {
    try { cb(cache); } catch (err) { console.error(err); }
  }
}

function setCache(next, write = true) {
  cache = next;
  if (write) writeToDisk(cache);
  notify();
}

function init(userDataDir) {
  dataDir = userDataDir;
  fs.mkdirSync(dataDir, { recursive: true });
  const p = filePath();

  if (!fs.existsSync(p)) {
    const sample = [
      normalize({ title: 'Bootstrap notch demo', status: 'done', source: 'demo' }),
      normalize({ title: 'Watch for new Codex tasks', status: 'running', source: 'demo' })
    ];
    writeToDisk(sample);
    cache = sample;
  } else {
    cache = readFromDisk();
  }

  try {
    watcher = fs.watch(dataDir, { persistent: false }, (event, filename) => {
      if (filename !== path.basename(p)) return;
      if (writeLock) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const next = readFromDisk();
        cache = next;
        notify();
      }, 80);
    });
  } catch (err) {
    console.error('[tasks] watcher failed:', err);
  }
}

function list() {
  return cache.slice();
}

function add(t) {
  const entry = normalize(t || {});
  setCache([entry, ...cache]);
  return entry;
}

function update(id, patch) {
  const idx = cache.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const merged = normalize({ ...cache[idx], ...patch, id });
  if (patch.status === 'done' || patch.status === 'failed') {
    if (!merged.finishedAt) merged.finishedAt = Date.now();
  }
  const next = cache.slice();
  next[idx] = merged;
  setCache(next);
  return merged;
}

function remove(id) {
  const next = cache.filter((t) => t.id !== id);
  setCache(next);
}

function clearDone() {
  const next = cache.filter((t) => t.status !== 'done' && t.status !== 'failed');
  setCache(next);
}

function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function dispose() {
  if (watcher) {
    try { watcher.close(); } catch {}
    watcher = null;
  }
}

module.exports = {
  init, list, add, update, remove, clearDone,
  onChange, filePath, dispose
};
