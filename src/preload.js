const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('winbar', {
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  setExpanded: (expanded) => ipcRenderer.invoke('notch:setExpanded', expanded),
  listProviders: () => ipcRenderer.invoke('providers:list'),
  upsertProvider: (p) => ipcRenderer.invoke('providers:upsert', p),
  removeProvider: (id) => ipcRenderer.invoke('providers:remove', id),
  resetProviders: () => ipcRenderer.invoke('providers:reset'),
  openProvidersFile: () => ipcRenderer.invoke('providers:openFile'),
  quit: () => ipcRenderer.invoke('app:quit'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  onSettings: (cb) => { ipcRenderer.on('settings:loaded', (_e, settings) => cb(settings)); },
  onProviders: (cb) => { ipcRenderer.on('providers:loaded', (_e, list) => cb(list)); },
  onNotchToggle: (cb) => { ipcRenderer.on('notch:toggle', () => cb()); }
});
