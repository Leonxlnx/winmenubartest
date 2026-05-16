const {
  app, BrowserWindow, screen, ipcMain, shell,
  globalShortcut, Tray, Menu, nativeImage
} = require('electron');
const path = require('path');
const os = require('os');
const { loadSettings, saveSettings } = require('./settings');
const providers = require('./providers');

let mainWindow = null;
let tray = null;
let currentSettings = loadSettings();
let isExpanded = false;
let lastCollapsedWidth = 220;

function computeCollapsedWidth(count) {
  const s = currentSettings;
  const w = s.collapsedPadX * 2 + count * s.collapsedIconSize + Math.max(0, count - 1) * s.collapsedGap;
  return Math.max(120, w);
}

function computeBounds(expanded) {
  const display = screen.getPrimaryDisplay();
  const work = display.workArea;
  const sw = work.width;
  const sh = work.height;
  const swLeft = work.x;
  const swTop = work.y;
  const w = expanded ? currentSettings.expandedWidth : lastCollapsedWidth;
  const h = expanded ? currentSettings.expandedMaxHeight : currentSettings.collapsedHeight;
  const x = swLeft + Math.round((sw - w) / 2);
  let y;
  if (currentSettings.position === 'bottom') {
    y = swTop + sh - h - currentSettings.bottomOffset;
  } else {
    y = swTop + currentSettings.topOffset;
  }
  return { x, y, width: w, height: h };
}

function createWindow() {
  lastCollapsedWidth = computeCollapsedWidth(providers.list().length || 1);
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
    mainWindow.webContents.send('settings:loaded', currentSettings);
    mainWindow.webContents.send('providers:loaded', providers.list());
  });

  screen.on('display-metrics-changed', () => applyBounds());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function applyBounds() {
  if (!mainWindow) return;
  mainWindow.setBounds(computeBounds(isExpanded), true);
}

function applyWindowFlags() {
  if (!mainWindow) return;
  if (currentSettings.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  } else {
    mainWindow.setAlwaysOnTop(false);
  }
  mainWindow.setVisibleOnAllWorkspaces(
    !!currentSettings.showOnAllWorkspaces,
    { visibleOnFullScreen: true }
  );
}

/* ---------- IPC: settings ---------- */
ipcMain.handle('settings:get', () => currentSettings);
ipcMain.handle('settings:set', (_e, patch) => {
  currentSettings = { ...currentSettings, ...patch };
  saveSettings(currentSettings);
  lastCollapsedWidth = computeCollapsedWidth(providers.list().length || 1);
  applyBounds();
  applyWindowFlags();
  if (mainWindow) mainWindow.webContents.send('settings:loaded', currentSettings);
  return currentSettings;
});
ipcMain.handle('settings:reset', () => {
  currentSettings = loadSettings(true);
  saveSettings(currentSettings);
  applyBounds();
  applyWindowFlags();
  if (mainWindow) mainWindow.webContents.send('settings:loaded', currentSettings);
  return currentSettings;
});

/* ---------- IPC: expanded ---------- */
ipcMain.handle('notch:setExpanded', (_e, expanded) => {
  isExpanded = !!expanded;
  applyBounds();
  return isExpanded;
});

/* ---------- IPC: providers ---------- */
ipcMain.handle('providers:list', () => providers.list());
ipcMain.handle('providers:upsert', (_e, p) => providers.upsert(p));
ipcMain.handle('providers:remove', (_e, id) => providers.remove(id));
ipcMain.handle('providers:reset', () => providers.reset());
ipcMain.handle('providers:openFile', () => shell.openPath(providers.filePath()));

providers.onChange((list) => {
  lastCollapsedWidth = computeCollapsedWidth(list.length || 1);
  if (!isExpanded) applyBounds();
  if (mainWindow) mainWindow.webContents.send('providers:loaded', list);
});

/* ---------- IPC: system ---------- */
ipcMain.handle('system:info', () => ({
  hostname: os.hostname(),
  user: os.userInfo().username,
  platform: process.platform,
  release: os.release(),
  electronVersion: process.versions.electron,
  providersFile: providers.filePath()
}));

ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('app:openExternal', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});

/* ---------- Tray ---------- */
function buildTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = (x - 7.5);
      const cy = (y - 6);
      const distSq = (cx * cx) / 36 + (cy * cy) / 9;
      const visible = distSq <= 1;
      buf[i] = 255;
      buf[i + 1] = 255;
      buf[i + 2] = 255;
      buf[i + 3] = visible ? 230 : 0;
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
      { label: 'Toggle position (top / bottom)', click: () => {
          const next = currentSettings.position === 'bottom' ? 'top' : 'bottom';
          currentSettings = { ...currentSettings, position: next };
          saveSettings(currentSettings);
          applyBounds();
          if (mainWindow) mainWindow.webContents.send('settings:loaded', currentSettings);
        }},
      { label: 'Open providers.json', click: () => shell.openPath(providers.filePath()) },
      { label: 'Reset providers', click: () => providers.reset() },
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
}

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
  app.whenReady().then(() => {
    providers.init(app.getPath('userData'));
    createWindow();
    registerShortcuts();
    createTray();
  });
}
