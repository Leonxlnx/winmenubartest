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
  hideNotch: () => ipcRenderer.invoke('app:hideNotch'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  listActive: () => ipcRenderer.invoke('active:list'),
  onSettings: (cb) => { ipcRenderer.on('settings:loaded', (_e, settings) => cb(settings)); },
  onProviders: (cb) => { ipcRenderer.on('providers:loaded', (_e, snap) => cb(snap)); },
  onActive: (cb) => { ipcRenderer.on('active:loaded', (_e, list) => cb(list)); },
  onNotchToggle: (cb) => { ipcRenderer.on('notch:toggle', () => cb()); }
});
