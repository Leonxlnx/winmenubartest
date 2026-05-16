const { app, BrowserWindow, screen, ipcMain, shell, powerMonitor } = require('electron');
const path = require('path');
const os = require('os');
const { loadSettings, saveSettings } = require('./settings');

const DEFAULT_BAR_HEIGHT = 36;
const TOP_OFFSET = 6;

let mainWindow = null;
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

  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
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

ipcMain.handle('settings:get', () => currentSettings);
ipcMain.handle('settings:set', (_e, patch) => {
  currentSettings = { ...currentSettings, ...patch };
  saveSettings(currentSettings);
  applyBounds();
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

app.on('window-all-closed', () => app.quit());

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
  app.whenReady().then(createWindow);
}
