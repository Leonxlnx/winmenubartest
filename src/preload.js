const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('winbar', {
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  setExpanded: (expanded) => ipcRenderer.invoke('notch:setExpanded', expanded),
  listProviders: () => ipcRenderer.invoke('providers:list'),
  refreshProviders: () => ipcRenderer.invoke('providers:refresh'),
  openProviderDashboard: (id) => ipcRenderer.invoke('providers:openDashboard', id),
  openOpenusageRelease: () => ipcRenderer.invoke('app:openOpenusageRelease'),
  quit: () => ipcRenderer.invoke('app:quit'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  onSettings: (cb) => { ipcRenderer.on('settings:loaded', (_e, settings) => cb(settings)); },
  onProviders: (cb) => { ipcRenderer.on('providers:loaded', (_e, snap) => cb(snap)); },
  onNotchToggle: (cb) => { ipcRenderer.on('notch:toggle', () => cb()); }
});
