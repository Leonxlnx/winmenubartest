#!/usr/bin/env node
/* ============================================================
   winusage — tiny CLI to push AI-subscription usage into the notch
   from any external script, scraper, or LLM agent.

   Examples:
     winusage set codex --plan Pro --color "#10a37f" --icon codex \
              --metric "Session=73%@2h" --metric "Weekly=91%@4d"

     winusage set cursor --plan Ultra --color "#5bc0eb" --icon cursor \
              --metric "Plan usage=$167.78@8d"

     winusage list
     winusage remove copilot
     winusage path
   ============================================================ */

const fs = require('fs');
const path = require('path');
const os = require('os');

const APP_NAME = 'winmenubartest';

function userDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), APP_NAME);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), APP_NAME);
}
function file() { return path.join(userDataDir(), 'providers.json'); }
function read() {
  if (!fs.existsSync(file())) return [];
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return []; }
}
function write(list) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(list, null, 2), 'utf8');
}

function parseDuration(s) {
  if (!s) return null;
  let total = 0;
  const re = /(\d+(?:\.\d+)?)\s*(d|h|m)/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const n = parseFloat(m[1]);
    if (m[2] === 'd') total += n * 86400 * 1000;
    else if (m[2] === 'h') total += n * 3600 * 1000;
    else if (m[2] === 'm') total += n * 60 * 1000;
  }
  if (!total) return null;
  return new Date(Date.now() + total).toISOString();
}

function parseMetric(spec) {
  // "Session=73%@2h"  |  "Plan usage=$167.78@8d"
  const eq = spec.indexOf('=');
  if (eq < 0) return null;
  const label = spec.slice(0, eq).trim();
  let rest = spec.slice(eq + 1).trim();
  let resetsAt = null;
  const at = rest.indexOf('@');
  if (at >= 0) {
    resetsAt = parseDuration(rest.slice(at + 1));
    rest = rest.slice(0, at).trim();
  }
  const m = { label, resetsAt };
  if (rest.startsWith('$')) {
    m.dollarsLeft = parseFloat(rest.slice(1));
  } else if (rest.endsWith('%')) {
    m.percentLeft = parseFloat(rest.slice(0, -1));
  } else {
    m.note = rest;
  }
  return m;
}

function parseFlags(args) {
  const flags = {};
  const positional = [];
  const multi = { metric: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      const val = next && !next.startsWith('--') ? next : true;
      if (key === 'metric') multi.metric.push(val);
      else flags[key] = val;
      if (val !== true) i++;
    } else {
      positional.push(a);
    }
  }
  return { flags, multi, positional };
}

const [, , cmd, ...rest] = process.argv;
const { flags, multi, positional } = parseFlags(rest);

switch ((cmd || '').toLowerCase()) {
  case 'set': {
    const id = (positional[0] || '').toLowerCase();
    if (!id) { console.error('Usage: winusage set <id> [--plan ..] [--color ..] [--icon ..] [--metric "Label=N%@2h"]+'); process.exit(1); }
    const list = read();
    const idx = list.findIndex((p) => p.id === id);
    const entry = idx >= 0 ? { ...list[idx] } : { id, name: id.charAt(0).toUpperCase() + id.slice(1) };
    if (flags.name) entry.name = flags.name;
    if (flags.plan) entry.plan = flags.plan;
    if (flags.color) entry.color = flags.color;
    if (flags.icon) entry.iconKey = flags.icon;
    if (multi.metric.length) {
      entry.metrics = multi.metric.map(parseMetric).filter(Boolean);
    } else if (!entry.metrics) {
      entry.metrics = [];
    }
    entry.fetchedAt = new Date().toISOString();
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    write(list);
    console.log(JSON.stringify(entry, null, 2));
    break;
  }
  case 'list': {
    const list = read();
    if (!list.length) { console.log('(no providers)'); break; }
    for (const p of list) {
      const pcts = p.metrics.map((m) => m.percentLeft).filter((x) => typeof x === 'number');
      const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) + '%' : '—';
      console.log(`${p.id.padEnd(14)} ${avg.padStart(4)}  ${p.name}${p.plan ? ' · ' + p.plan : ''}`);
    }
    break;
  }
  case 'remove':
  case 'rm': {
    const id = (positional[0] || '').toLowerCase();
    if (!id) { console.error('Usage: winusage remove <id>'); process.exit(1); }
    write(read().filter((p) => p.id !== id));
    console.log('removed', id);
    break;
  }
  case 'path': {
    console.log(file());
    break;
  }
  default: {
    console.log('winusage — push AI-quota usage into the WinUsage notch');
    console.log('');
    console.log('  winusage set <id> [--name ..] [--plan ..] [--color "#hex"] [--icon key]');
    console.log('                    [--metric "Label=73%@2h" --metric "Plan=$50@7d"]');
    console.log('  winusage list');
    console.log('  winusage remove <id>');
    console.log('  winusage path');
  }
}
