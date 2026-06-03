const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('flashfix', {
  getStatus: () => ipcRenderer.invoke('app:getStatus'),
  openLogsFolder: () => ipcRenderer.invoke('app:openLogsFolder'),
  selectSamsungPackage: (slot) => ipcRenderer.invoke('file:selectSamsungPackage', slot),
  selectExpertImage: (partition) => ipcRenderer.invoke('file:selectExpertImage', partition),
  detectDevice: () => ipcRenderer.invoke('heimdall:detect'),
  printPit: () => ipcRenderer.invoke('heimdall:printPit'),
  flashExpert: (entries) => ipcRenderer.invoke('heimdall:flashExpert', entries),
  rebootDevice: () => ipcRenderer.invoke('heimdall:reboot'),
  onOperationStart: (callback) => subscribe('heimdall:operation-start', callback),
  onOperationLog: (callback) => subscribe('heimdall:log', callback),
  onOperationEnd: (callback) => subscribe('heimdall:operation-end', callback)
});
