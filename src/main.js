const {
  app, BrowserWindow, screen, ipcMain, shell,
  globalShortcut, Tray, Menu, nativeImage
} = require('electron');
const path = require('path');
const os = require('os');
const { loadSettings, saveSettings } = require('./settings');
const tasks = require('./tasks');

let mainWindow = null;
let tray = null;
let currentSettings = loadSettings();
let isExpanded = false;

function computeBounds(settings, expanded) {
  const display = screen.getPrimaryDisplay();
  const sw = display.workAreaSize.width;
  const w = expanded ? settings.expandedWidth : settings.collapsedWidth;
  const h = expanded ? settings.expandedMaxHeight : settings.collapsedHeight;
  const x = Math.round((sw - w) / 2);
  const y = settings.topOffset != null ? settings.topOffset : 4;
  return { x, y, width: w, height: h };
}

function createWindow() {
  const bounds = computeBounds(currentSettings, false);

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
    mainWindow.webContents.send('tasks:loaded', tasks.list());
  });

  screen.on('display-metrics-changed', () => applyBounds());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function applyBounds() {
  if (!mainWindow) return;
  const bounds = computeBounds(currentSettings, isExpanded);
  mainWindow.setBounds(bounds, true);
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

/* ---------- IPC: expanded state ---------- */
ipcMain.handle('notch:setExpanded', (_e, expanded) => {
  isExpanded = !!expanded;
  applyBounds();
  return isExpanded;
});

/* ---------- IPC: tasks ---------- */
ipcMain.handle('tasks:list', () => tasks.list());
ipcMain.handle('tasks:add', (_e, t) => tasks.add(t));
ipcMain.handle('tasks:update', (_e, id, patch) => tasks.update(id, patch));
ipcMain.handle('tasks:remove', (_e, id) => tasks.remove(id));
ipcMain.handle('tasks:clearDone', () => tasks.clearDone());
ipcMain.handle('tasks:openFile', () => shell.openPath(tasks.filePath()));

tasks.onChange((list) => {
  if (mainWindow) mainWindow.webContents.send('tasks:loaded', list);
});

/* ---------- IPC: system ---------- */
ipcMain.handle('system:info', () => ({
  hostname: os.hostname(),
  user: os.userInfo().username,
  platform: process.platform,
  release: os.release(),
  electronVersion: process.versions.electron,
  tasksFile: tasks.filePath()
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
    tray.setToolTip('WinMenuBar — Codex Notch');
    const menu = Menu.buildFromTemplate([
      { label: 'Show / hide notch', click: () => {
          if (!mainWindow) return;
          if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
        }},
      { label: 'Add demo task', click: () => {
          tasks.add({
            title: 'New task ' + new Date().toLocaleTimeString(),
            status: 'running',
            source: 'tray'
          });
        }},
      { label: 'Open tasks.json', click: () => shell.openPath(tasks.filePath()) },
      { label: 'Clear finished tasks', click: () => tasks.clearDone() },
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
  globalShortcut.register('Control+Alt+T', () => {
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
    tasks.init(app.getPath('userData'));
    createWindow();
    registerShortcuts();
    createTray();
  });
}
