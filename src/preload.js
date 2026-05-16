const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('winbar', {
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  getPowerInfo: () => ipcRenderer.invoke('system:power'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  quit: () => ipcRenderer.invoke('app:quit'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  openSettings: () => ipcRenderer.invoke('app:openSettings'),
  onSettings: (cb) => {
    ipcRenderer.on('settings:loaded', (_e, settings) => cb(settings));
  },
  onShortcutSettings: (cb) => {
    ipcRenderer.on('shortcut:settings', () => cb());
  }
});
