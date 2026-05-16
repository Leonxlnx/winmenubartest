const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('winbar', {
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  getPowerInfo: () => ipcRenderer.invoke('system:power'),
  quit: () => ipcRenderer.invoke('app:quit'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  openSettings: () => ipcRenderer.invoke('app:openSettings')
});
