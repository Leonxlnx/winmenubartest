const { app, BrowserWindow, screen, ipcMain, Menu, Tray, nativeImage, shell, powerMonitor } = require('electron');
const path = require('path');
const os = require('os');
const { registerAppBar, unregisterAppBar, repositionAppBar } = require('./appbar');

const BAR_HEIGHT = 32;

let mainWindow = null;
let isAppBarRegistered = false;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const fullWidth = primaryDisplay.size.width;

  mainWindow = new BrowserWindow({
    width: fullWidth,
    height: BAR_HEIGHT,
    x: 0,
    y: 0,
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

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    try {
      const hwndBuffer = mainWindow.getNativeWindowHandle();
      registerAppBar(hwndBuffer, BAR_HEIGHT);
      isAppBarRegistered = true;
      console.log('[main] AppBar registered. Top of screen reserved.');
    } catch (err) {
      console.error('[main] Failed to register AppBar:', err);
    }
  });

  screen.on('display-metrics-changed', () => {
    if (!mainWindow) return;
    const display = screen.getPrimaryDisplay();
    mainWindow.setBounds({ x: 0, y: 0, width: display.size.width, height: BAR_HEIGHT });
    if (isAppBarRegistered) {
      try {
        repositionAppBar(mainWindow.getNativeWindowHandle(), BAR_HEIGHT);
      } catch (err) {
        console.error('[main] reposition failed:', err);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('system:info', () => {
  return {
    hostname: os.hostname(),
    user: os.userInfo().username,
    platform: process.platform,
    arch: os.arch(),
    release: os.release(),
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node
  };
});

ipcMain.handle('system:power', () => {
  return {
    onBattery: powerMonitor.isOnBatteryPower ? powerMonitor.isOnBatteryPower() : false,
    systemIdleTime: powerMonitor.getSystemIdleTime ? powerMonitor.getSystemIdleTime() : 0
  };
});

ipcMain.handle('app:quit', () => {
  cleanup();
  app.quit();
});

ipcMain.handle('app:openExternal', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
  }
});

ipcMain.handle('app:openSettings', () => {
  shell.openPath('ms-settings:').catch(() => {});
});

function cleanup() {
  if (mainWindow && isAppBarRegistered) {
    try {
      unregisterAppBar(mainWindow.getNativeWindowHandle());
      isAppBarRegistered = false;
      console.log('[main] AppBar unregistered.');
    } catch (err) {
      console.error('[main] cleanup failed:', err);
    }
  }
}

app.on('before-quit', cleanup);
app.on('window-all-closed', () => {
  cleanup();
  app.quit();
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}
