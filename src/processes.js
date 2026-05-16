/* ============================================================
   Active-AI process detection
   Polls `tasklist` every N seconds and reports which AI tools
   are currently running on the system.
   ============================================================ */

const { exec } = require('child_process');

const DEFAULT_POLL = 6000;

// process name patterns → providerId
const PATTERNS = [
  { id: 'cursor',                name: 'Cursor',      patterns: [/^cursor(\.exe)?$/i] },
  { id: 'codex',                 name: 'Codex',       patterns: [/^codex(\.exe)?$/i] },
  { id: 'antigravity',           name: 'Antigravity', patterns: [/^antigravity(\.exe)?$/i] },
  { id: 'copilot',               name: 'Copilot',     patterns: [/^m365copilot(\.exe)?$/i, /^copilot(\.exe)?$/i] },
  { id: 'windsurf',              name: 'Windsurf',    patterns: [/^windsurf(\.exe)?$/i, /^codeium(\.exe)?$/i] },
  { id: 'claude',                name: 'Claude',      patterns: [/^claude(\.exe)?$/i, /^anthropic(\.exe)?$/i] },
  { id: 'gemini',                name: 'Gemini',      patterns: [/^gemini(\.exe)?$/i] },
  { id: 'jetbrains-ai-assistant',name: 'JetBrains',   patterns: [/^idea64(\.exe)?$/i, /^webstorm64(\.exe)?$/i, /^pycharm64(\.exe)?$/i, /^rider64(\.exe)?$/i] },
  { id: 'kimi',                  name: 'Kimi',        patterns: [/^kimi(\.exe)?$/i] },
  { id: 'perplexity',            name: 'Perplexity',  patterns: [/^perplexity(\.exe)?$/i] }
];

let timer = null;
let listeners = new Set();
let lastActive = [];

function listProcessNames() {
  return new Promise((resolve) => {
    exec('tasklist /fo csv /nh', { maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const names = new Set();
      for (const line of stdout.split(/\r?\n/)) {
        const m = line.match(/^"([^"]+)"/);
        if (m) names.add(m[1]);
      }
      resolve(Array.from(names));
    });
  });
}

async function detect() {
  const names = await listProcessNames();
  const active = [];
  for (const provider of PATTERNS) {
    if (names.some((n) => provider.patterns.some((p) => p.test(n)))) {
      active.push({ id: provider.id, name: provider.name });
    }
  }
  // dedupe by id
  const seen = new Set();
  lastActive = active.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
  for (const cb of listeners) {
    try { cb(lastActive); } catch (e) { console.error(e); }
  }
  return lastActive;
}

function start(pollMs = DEFAULT_POLL) {
  stop();
  detect();
  timer = setInterval(detect, pollMs);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function snapshot() { return lastActive.slice(); }

module.exports = { start, stop, detect, onChange, snapshot };
