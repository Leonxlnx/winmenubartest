const {
  app, BrowserWindow, screen, ipcMain, shell,
  globalShortcut, Tray, Menu, nativeImage
} = require('electron');
const path = require('path');
const os = require('os');
const { loadSettings, saveSettings } = require('./settings');
const openusage = require('./openusage-api');
const processes = require('./processes');

let mainWindow = null;
let tray = null;
let currentSettings = loadSettings();
let isExpanded = false;
let lastSnapshot = openusage.snapshot();
let resizeTween = null;

/* ---------- Window bounds (docked to top edge) ---------- */
function computeExpandedHeight() {
  // Dynamic: row count drives height so no empty bottom space
  const enabled = currentSettings.enabledProviders || [];
  const rowH = 56; // 32px chip + 12/12 padding + 4 gap
  const topPad = 30; // settings button clearance
  const bottomPad = 10;
  const minH = 100;
  const maxH = currentSettings.expandedMaxHeight || 400;
  return Math.min(maxH, Math.max(minH, topPad + bottomPad + enabled.length * rowH));
}

function computeBounds(expanded) {
  const display = screen.getPrimaryDisplay();
  const work = display.workArea;
  const w = expanded ? currentSettings.expandedWidth : currentSettings.collapsedWidth;
  const h = expanded ? computeExpandedHeight() : currentSettings.collapsedHeight;
  const x = work.x + Math.round((work.width - w) / 2);
  const y = work.y;
  return { x, y, width: w, height: h };
}

function createWindow() {
  const bounds = computeBounds(false);

  mainWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    fullscreenable: false,
    focusable: true,
    hasShadow: false,
    thickFrame: false,
    show: false,
    acceptFirstMouse: true,
    type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: false
    }
  });

  applyWindowFlags();
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    sendSettings();
    sendSnapshot();
    sendActive();
  });

  screen.on('display-metrics-changed', () => applyBounds());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function applyBounds(animate = false, duration = 460) {
  if (!mainWindow) return;
  const target = computeBounds(isExpanded);
  if (!animate) {
    mainWindow.setBounds(target);
    return;
  }
  smoothResize(target, duration, appleEase);
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Apple's signature ease (used in iOS / macOS UI transitions)
function appleEase(t) {
  // cubic-bezier(0.32, 0.72, 0, 1) - the smoothest non-overshoot spring feel
  // Approximation: combined power for buttery deceleration
  const p = 1 - t;
  return 1 - (p * p * p * p);
}
function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

function smoothResize(target, duration = 460, ease = appleEase) {
  if (!mainWindow) return;
  if (resizeTween) {
    clearTimeout(resizeTween);
    resizeTween = null;
  }
  const start = mainWindow.getBounds();
  const startTime = Date.now();
  const frame = () => {
    if (!mainWindow) { resizeTween = null; return; }
    const t = Math.min(1, (Date.now() - startTime) / duration);
    const e = ease(t);
    mainWindow.setBounds({
      x: Math.round(lerp(start.x, target.x, e)),
      y: Math.round(lerp(start.y, target.y, e)),
      width: Math.round(lerp(start.width, target.width, e)),
      height: Math.round(lerp(start.height, target.height, e))
    });
    if (t < 1) {
      // Aim for 144fps; setImmediate gives us the fastest scheduling
      resizeTween = setTimeout(frame, 1000 / 144);
    } else {
      resizeTween = null;
    }
  };
  frame();
}
function applyWindowFlags() {
  if (!mainWindow) return;
  if (currentSettings.alwaysOnTop) mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  else mainWindow.setAlwaysOnTop(false);
  mainWindow.setVisibleOnAllWorkspaces(!!currentSettings.showOnAllWorkspaces, { visibleOnFullScreen: true });
}
function sendSettings() { mainWindow?.webContents.send('settings:loaded', currentSettings); }
function sendSnapshot() { mainWindow?.webContents.send('providers:loaded', lastSnapshot); }
function sendActive() {
  const enabled = new Set(currentSettings.enabledProviders || []);
  const list = processes.snapshot().filter((p) => enabled.has(p.id));
  mainWindow?.webContents.send('active:loaded', list);
}

/* ---------- IPC ---------- */
ipcMain.handle('settings:get', () => currentSettings);
ipcMain.handle('settings:set', (_e, patch) => {
  currentSettings = { ...currentSettings, ...patch };
  saveSettings(currentSettings);
  applyBounds();
  applyWindowFlags();
  if (patch.apiBaseUrl || patch.apiPollMs) {
    openusage.setConfig({
      baseUrl: currentSettings.apiBaseUrl,
      intervalMs: currentSettings.apiPollMs
    });
    openusage.start();
  }
  sendSettings();
  return currentSettings;
});
ipcMain.handle('settings:reset', () => {
  currentSettings = loadSettings(true);
  saveSettings(currentSettings);
  applyBounds();
  applyWindowFlags();
  sendSettings();
  return currentSettings;
});

ipcMain.handle('notch:setExpanded', (_e, expanded) => {
  isExpanded = !!expanded;
  applyBounds(true, isExpanded ? 480 : 320);
  return isExpanded;
});

ipcMain.handle('providers:list', () => lastSnapshot);
ipcMain.handle('providers:refresh', async () => {
  await openusage.fetchAll();
  return openusage.snapshot();
});
ipcMain.handle('active:list', () => {
  const enabled = new Set(currentSettings.enabledProviders || []);
  return processes.snapshot().filter((p) => enabled.has(p.id));
});
ipcMain.handle('providers:openDashboard', (_e, providerId) => {
  const map = {
    codex: 'https://chatgpt.com/codex/settings/usage',
    claude: 'https://claude.ai/settings/usage',
    cursor: 'https://cursor.com/dashboard',
    copilot: 'https://github.com/settings/copilot',
    gemini: 'https://aistudio.google.com/',
    perplexity: 'https://perplexity.ai/settings',
    windsurf: 'https://codeium.com/account',
    'jetbrains-ai-assistant': 'https://account.jetbrains.com/'
  };
  const url = map[providerId];
  if (url) shell.openExternal(url);
});

ipcMain.handle('system:info', () => ({
  hostname: os.hostname(),
  user: os.userInfo().username,
  platform: process.platform,
  release: os.release(),
  electronVersion: process.versions.electron,
  apiBaseUrl: currentSettings.apiBaseUrl
}));

ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('app:hideNotch', () => {
  if (mainWindow) {
    isExpanded = false;
    applyBounds(false);
    mainWindow.hide();
    rebuildTrayMenu();
  }
});
ipcMain.handle('app:openExternal', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});
ipcMain.handle('app:openOpenusageRelease', () => {
  shell.openExternal('https://github.com/robinebers/openusage/releases');
});

/* ---------- Tray ---------- */
function buildTrayIcon() {
  // 16x16 rounded "AI" pill with 3 dots indicating active tools
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let alpha = 0;
      // Pill outline: rounded rectangle 1..14 x 3..12
      const inX = x >= 1 && x <= 14;
      const inY = y >= 3 && y <= 12;
      const corner = (cx, cy) => {
        const dx = x - cx, dy = y - cy;
        return dx * dx + dy * dy <= 6;
      };
      const inCorners = corner(2.5, 4.5) || corner(12.5, 4.5) || corner(2.5, 10.5) || corner(12.5, 10.5);
      const inRect = (x >= 3 && x <= 12 && inY) || (inX && y >= 5 && y <= 10);
      const inside = inRect || inCorners;
      // Three dots inside
      const dot1 = (x - 5) * (x - 5) + (y - 8) * (y - 8) <= 1;
      const dot2 = (x - 8) * (x - 8) + (y - 8) * (y - 8) <= 1;
      const dot3 = (x - 11) * (x - 11) + (y - 8) * (y - 8) <= 1;
      if (inside) alpha = 230;
      if (dot1 || dot2 || dot3) alpha = 0;
      buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255;
      buf[i + 3] = alpha;
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function toggleProvider(id) {
  const set = new Set(currentSettings.enabledProviders || []);
  if (set.has(id)) set.delete(id); else set.add(id);
  currentSettings = { ...currentSettings, enabledProviders: Array.from(set) };
  saveSettings(currentSettings);
  sendSettings();
  sendActive();
  rebuildTrayMenu();
}

const TRAY_TOOLS = [
  { id: 'codex',       name: 'Codex (CLI)' },
  { id: 'claude',      name: 'Claude Code (CLI)' },
  { id: 'cursor',      name: 'Cursor' },
  { id: 'windsurf',    name: 'Windsurf' },
  { id: 'antigravity', name: 'Antigravity' }
];

function buildTrayMenu() {
  const enabled = new Set(currentSettings.enabledProviders || []);
  return Menu.buildFromTemplate([
    { label: mainWindow && mainWindow.isVisible() ? 'Hide AI notch' : 'Show AI notch', click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
        setTimeout(rebuildTrayMenu, 100);
      }},
    { label: 'Refresh from OpenUsage', click: () => openusage.fetchAll() },
    { type: 'separator' },
    { label: 'Show in notch', enabled: false },
    ...TRAY_TOOLS.map((t) => ({
      label: t.name,
      type: 'checkbox',
      checked: enabled.has(t.id),
      click: () => toggleProvider(t.id)
    })),
    { type: 'separator' },
    { label: 'Quit WinUsage', click: () => app.quit() }
  ]);
}

function rebuildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  if (tray) return;
  try {
    tray = new Tray(buildTrayIcon());
    tray.setToolTip('WinUsage — AI quota notch');
    tray.setContextMenu(buildTrayMenu());
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
    });
  } catch (err) {
    console.error('[main] tray creation failed:', err);
  }
}

function registerShortcuts() {
  globalShortcut.register('Control+Alt+B', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
  });
  globalShortcut.register('Control+Alt+U', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.webContents.send('notch:toggle');
  });
  globalShortcut.register('Control+Alt+R', () => openusage.fetchAll());
}

app.on('will-quit', () => { globalShortcut.unregisterAll(); openusage.stop(); processes.stop(); });
app.on('window-all-closed', () => app.quit());

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
  app.whenReady().then(() => {
    openusage.setConfig({
      baseUrl: currentSettings.apiBaseUrl,
      intervalMs: currentSettings.apiPollMs
    });
    openusage.onSnapshot((snap) => {
      lastSnapshot = snap;
      if (!isExpanded) applyBounds();
      sendSnapshot();
    });
    openusage.start();
    processes.onChange((active) => sendActive());
    processes.start(6000);
    createWindow();
    registerShortcuts();
    createTray();
  });
}
