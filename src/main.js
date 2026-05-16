const { app, BrowserWindow, screen, ipcMain, shell, powerMonitor, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const os = require('os');
const { loadSettings, saveSettings } = require('./settings');

const DEFAULT_BAR_HEIGHT = 36;
const TOP_OFFSET = 6;

let mainWindow = null;
let tray = null;
let currentSettings = loadSettings();

function computeBarBounds(settings) {
  const display = screen.getPrimaryDisplay();
  const sw = display.workAreaSize.width;
  const width = Math.min(Math.max(settings.width || 720, 320), sw - 20);
  const height = settings.height || DEFAULT_BAR_HEIGHT;
  let x;
  switch (settings.position) {
    case 'left':
      x = 12;
      break;
    case 'right':
      x = sw - width - 12;
      break;
    case 'center':
    default:
      x = Math.round((sw - width) / 2);
      break;
  }
  const y = settings.topOffset != null ? settings.topOffset : TOP_OFFSET;
  return { x, y, width, height };
}

function createWindow() {
  const bounds = computeBarBounds(currentSettings);

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
  mainWindow.setIgnoreMouseEvents(false);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.webContents.send('settings:loaded', currentSettings);
  });

  screen.on('display-metrics-changed', () => applyBounds());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function applyBounds() {
  if (!mainWindow) return;
  const bounds = computeBarBounds(currentSettings);
  mainWindow.setBounds(bounds);
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

ipcMain.handle('settings:get', () => currentSettings);
ipcMain.handle('settings:set', (_e, patch) => {
  currentSettings = { ...currentSettings, ...patch };
  saveSettings(currentSettings);
  applyBounds();
  applyWindowFlags();
  if (mainWindow) {
    mainWindow.webContents.send('settings:loaded', currentSettings);
  }
  return currentSettings;
});
ipcMain.handle('settings:reset', () => {
  currentSettings = loadSettings(true);
  saveSettings(currentSettings);
  applyBounds();
  if (mainWindow) {
    mainWindow.webContents.send('settings:loaded', currentSettings);
  }
  return currentSettings;
});

ipcMain.handle('system:info', () => ({
  hostname: os.hostname(),
  user: os.userInfo().username,
  platform: process.platform,
  arch: os.arch(),
  release: os.release(),
  appVersion: app.getVersion(),
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node
}));

ipcMain.handle('system:power', () => ({
  onBattery: powerMonitor.isOnBatteryPower ? powerMonitor.isOnBatteryPower() : false,
  systemIdleTime: powerMonitor.getSystemIdleTime ? powerMonitor.getSystemIdleTime() : 0
}));

ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('app:openExternal', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});
ipcMain.handle('app:openSettings', () => {
  shell.openPath('ms-settings:').catch(() => {});
});

function buildTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const insideBar = y >= 4 && y <= 7 && x >= 1 && x <= 14;
      const insidePill = y >= 9 && y <= 12 && x >= 3 && x <= 12;
      const visible = insideBar || insidePill;
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
    tray.setToolTip('WinMenuBar');
    const menu = Menu.buildFromTemplate([
      { label: 'Show / hide bar', click: () => {
          if (!mainWindow) return;
          if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
        }},
      { label: 'Open customize', click: () => {
          if (!mainWindow) return;
          mainWindow.show();
          mainWindow.webContents.send('shortcut:settings');
        }},
      { type: 'separator' },
      { label: 'Quit WinMenuBar', click: () => app.quit() }
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
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
  });
  globalShortcut.register('Control+Alt+,', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.webContents.send('shortcut:settings');
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
    createWindow();
    registerShortcuts();
  });
}
