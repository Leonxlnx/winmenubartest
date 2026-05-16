const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('winbar', {
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  setExpanded: (expanded) => ipcRenderer.invoke('notch:setExpanded', expanded),
  listTasks: () => ipcRenderer.invoke('tasks:list'),
  addTask: (t) => ipcRenderer.invoke('tasks:add', t),
  updateTask: (id, patch) => ipcRenderer.invoke('tasks:update', id, patch),
  removeTask: (id) => ipcRenderer.invoke('tasks:remove', id),
  clearDoneTasks: () => ipcRenderer.invoke('tasks:clearDone'),
  openTasksFile: () => ipcRenderer.invoke('tasks:openFile'),
  quit: () => ipcRenderer.invoke('app:quit'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  onSettings: (cb) => {
    ipcRenderer.on('settings:loaded', (_e, settings) => cb(settings));
  },
  onTasks: (cb) => {
    ipcRenderer.on('tasks:loaded', (_e, list) => cb(list));
  },
  onNotchToggle: (cb) => {
    ipcRenderer.on('notch:toggle', () => cb());
  }
});
