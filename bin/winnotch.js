#!/usr/bin/env node
/* ============================================================
   winnotch — tiny CLI to push tasks into the notch from anywhere
   Usage:
     winnotch add "Build feature X"
     winnotch add "Run tests" --status queued
     winnotch list
     winnotch done <id>
     winnotch fail <id> --note "ENOENT"
     winnotch remove <id>
     winnotch clear
     winnotch path
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

function tasksFile() {
  return path.join(userDataDir(), 'tasks.json');
}

function read() {
  const p = tasksFile();
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function write(list) {
  const p = tasksFile();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
}

function uid() {
  return 't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function parseFlags(args) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) { flags[key] = next; i++; }
      else flags[key] = true;
    } else {
      rest.push(a);
    }
  }
  return { flags, rest };
}

const [, , cmd, ...rest] = process.argv;
const { flags, rest: positional } = parseFlags(rest);

switch ((cmd || '').toLowerCase()) {
  case 'add': {
    const title = positional.join(' ').trim();
    if (!title) { console.error('Usage: winnotch add "title"'); process.exit(1); }
    const list = read();
    const status = flags.status || 'running';
    const entry = {
      id: uid(),
      title,
      status,
      source: flags.source || 'cli',
      startedAt: status === 'running' ? Date.now() : null,
      finishedAt: null,
      note: flags.note || null
    };
    list.unshift(entry);
    write(list);
    console.log(entry.id);
    break;
  }
  case 'list': {
    const list = read();
    if (!list.length) { console.log('(no tasks)'); break; }
    for (const t of list) {
      const tag = t.status.padEnd(8);
      console.log(`${tag} ${t.id}  ${t.title}`);
    }
    break;
  }
  case 'done':
  case 'fail': {
    const id = positional[0];
    if (!id) { console.error(`Usage: winnotch ${cmd} <id>`); process.exit(1); }
    const list = read();
    const t = list.find((x) => x.id === id || x.id.startsWith(id));
    if (!t) { console.error('No task with id', id); process.exit(1); }
    t.status = cmd === 'done' ? 'done' : 'failed';
    t.finishedAt = Date.now();
    if (flags.note) t.note = flags.note;
    write(list);
    console.log('updated', t.id);
    break;
  }
  case 'remove':
  case 'rm': {
    const id = positional[0];
    if (!id) { console.error('Usage: winnotch remove <id>'); process.exit(1); }
    const list = read().filter((x) => !(x.id === id || x.id.startsWith(id)));
    write(list);
    console.log('removed');
    break;
  }
  case 'clear': {
    const list = read().filter((t) => t.status !== 'done' && t.status !== 'failed');
    write(list);
    console.log('cleared finished tasks');
    break;
  }
  case 'path': {
    console.log(tasksFile());
    break;
  }
  default: {
    console.log('winnotch — push tasks into the WinMenuBar notch');
    console.log('');
    console.log('  winnotch add "Build feature X" [--status queued|running] [--source name]');
    console.log('  winnotch list');
    console.log('  winnotch done   <id>');
    console.log('  winnotch fail   <id> [--note "error msg"]');
    console.log('  winnotch remove <id>');
    console.log('  winnotch clear');
    console.log('  winnotch path');
  }
}
