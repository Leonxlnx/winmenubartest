const {
  app, BrowserWindow, screen, ipcMain, shell,
  globalShortcut, Tray, Menu, nativeImage
} = require('electron');
const path = require('path');
const os = require('os');
const { loadSettings, saveSettings } = require('./settings');
const openusage = require('./openusage-api');

let mainWindow = null;
let tray = null;
let currentSettings = loadSettings();
let isExpanded = false;
let lastSnapshot = openusage.snapshot();
let resizeTween = null;

/* ---------- Window bounds (docked to top edge) ---------- */
function collapsedWidth() {
  const s = currentSettings;
  const count = Math.max(1, (lastSnapshot.providers || []).length);
  return Math.max(120, s.collapsedPadX * 2 + count * s.collapsedIconSize + (count - 1) * s.collapsedGap);
}

function computeBounds(expanded) {
  const display = screen.getPrimaryDisplay();
  const work = display.workArea;
  const w = expanded ? currentSettings.expandedWidth : collapsedWidth();
  const h = expanded ? currentSettings.expandedMaxHeight : currentSettings.collapsedHeight;
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
  });

  screen.on('display-metrics-changed', () => applyBounds());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function applyBounds(animate = false, duration = 320) {
  if (!mainWindow) return;
  const target = computeBounds(isExpanded);
  if (!animate) {
    mainWindow.setBounds(target);
    return;
  }
  smoothResize(target, duration);
}

function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }
function lerp(a, b, t) { return a + (b - a) * t; }

function smoothResize(target, duration = 360) {
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
    const e = easeOutQuint(t);
    mainWindow.setBounds({
      x: Math.round(lerp(start.x, target.x, e)),
      y: Math.round(lerp(start.y, target.y, e)),
      width: Math.round(lerp(start.width, target.width, e)),
      height: Math.round(lerp(start.height, target.height, e))
    });
    if (t < 1) {
      resizeTween = setTimeout(frame, 1000 / 120);
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
  applyBounds(true, isExpanded ? 420 : 260);
  return isExpanded;
});

ipcMain.handle('providers:list', () => lastSnapshot);
ipcMain.handle('providers:refresh', async () => {
  await openusage.fetchAll();
  return openusage.snapshot();
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
ipcMain.handle('app:openExternal', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});
ipcMain.handle('app:openOpenusageRelease', () => {
  shell.openExternal('https://github.com/robinebers/openusage/releases');
});

/* ---------- Tray ---------- */
function buildTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = x - 7.5, cy = y - 6;
      const insideEllipse = (cx * cx) / 36 + (cy * cy) / 9 <= 1;
      buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255;
      buf[i + 3] = insideEllipse ? 230 : 0;
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function createTray() {
  if (tray) return;
  try {
    tray = new Tray(buildTrayIcon());
    tray.setToolTip('WinUsage — AI quota notch');
    const menu = Menu.buildFromTemplate([
      { label: 'Show / hide notch', click: () => {
          if (!mainWindow) return;
          if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
        }},
      { label: 'Refresh from OpenUsage', click: () => openusage.fetchAll() },
      { type: 'separator' },
      { label: 'Get OpenUsage (macOS)', click: () => shell.openExternal('https://github.com/robinebers/openusage/releases') },
      { type: 'separator' },
      { label: 'Quit WinUsage', click: () => app.quit() }
    ]);
    tray.setContextMenu(menu);
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

app.on('will-quit', () => { globalShortcut.unregisterAll(); openusage.stop(); });
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
    createWindow();
    registerShortcuts();
    createTray();
  });
}
