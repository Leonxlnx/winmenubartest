/* ============================================================
   Active-AI process detection
   Polls `tasklist` every N seconds and reports which AI tools
   are currently running on the system.
   ============================================================ */

const { exec } = require('child_process');

const DEFAULT_POLL = 4000;

// process name patterns → providerId.
// `kind`: 'cli' = process only exists while a task runs (presence == active)
//        'gui' = always-on app, requires CPU-spike detection to count as active
const PATTERNS = [
  { id: 'codex',       name: 'Codex',       kind: 'cli', patterns: [/^codex(\.exe)?$/i] },
  { id: 'claude',      name: 'Claude Code', kind: 'cli', patterns: [/^claude(\.exe)?$/i] },
  { id: 'cursor',      name: 'Cursor',      kind: 'gui', patterns: [/^cursor(\.exe)?$/i] },
  { id: 'windsurf',    name: 'Windsurf',    kind: 'gui', patterns: [/^windsurf(\.exe)?$/i] },
  { id: 'antigravity', name: 'Antigravity', kind: 'gui', patterns: [/^antigravity(\.exe)?$/i] }
];

let timer = null;
let listeners = new Set();
let lastActive = [];
// pid -> { name, cpuTime (in 100ns ticks total), ts (epoch ms) }
let prevCpu = new Map();
const CPU_ACTIVE_THRESHOLD_PCT = 4;

function listProcessesWithCpu() {
  return new Promise((resolve) => {
    // PowerShell: Name, Id, CPU (total seconds of CPU time)
    const ps = `Get-Process | Select-Object Name, Id, CPU | ConvertTo-Json -Compress`;
    exec(`powershell -NoProfile -NonInteractive -Command "${ps}"`,
      { maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve([]);
        try {
          const arr = JSON.parse(stdout);
          resolve(Array.isArray(arr) ? arr : [arr]);
        } catch { resolve([]); }
      });
  });
}

function findProvider(processName) {
  for (const provider of PATTERNS) {
    if (provider.patterns.some((p) => p.test(processName))) return provider;
  }
  return null;
}

async function detect() {
  const procs = await listProcessesWithCpu();
  const now = Date.now();
  const nextCpu = new Map();
  const byProvider = new Map();

  for (const p of procs) {
    const provider = findProvider(p.Name);
    if (!provider) continue;
    const cpu = typeof p.CPU === 'number' ? p.CPU : 0;
    nextCpu.set(p.Id, { name: p.Name, cpuSec: cpu, ts: now });

    let activeNow;
    if (provider.kind === 'cli') {
      activeNow = true;
    } else {
      const prev = prevCpu.get(p.Id);
      if (!prev) {
        activeNow = false; // need a baseline first
      } else {
        const dtSec = (now - prev.ts) / 1000;
        const deltaCpu = cpu - prev.cpuSec;
        const cpuPct = dtSec > 0 ? (deltaCpu / dtSec) * 100 : 0;
        activeNow = cpuPct >= CPU_ACTIVE_THRESHOLD_PCT;
      }
    }

    const existing = byProvider.get(provider.id);
    if (!existing) {
      byProvider.set(provider.id, { ...provider, active: activeNow });
    } else if (activeNow) {
      existing.active = true;
    }
  }

  prevCpu = nextCpu;
  // Only emit providers that are *actually active right now*
  lastActive = Array.from(byProvider.values()).filter((p) => p.active);
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
