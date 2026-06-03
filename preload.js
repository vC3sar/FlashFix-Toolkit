const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("flashfix", {
  getStatus: () => ipcRenderer.invoke("app:getStatus"),
  openLogsFolder: () => ipcRenderer.invoke("app:openLogsFolder"),
  selectFirmwareFolder: () => ipcRenderer.invoke("app:selectFirmwareFolder"),
  selectJsonFile: (title) => ipcRenderer.invoke("app:selectJsonFile", title),
  detectDevice: () => ipcRenderer.invoke("core:detect"),
  getDeviceInfo: () => ipcRenderer.invoke("core:deviceInfo"),
  readPit: () => ipcRenderer.invoke("core:readPit"),
  analyzeFirmware: (firmwarePath) => ipcRenderer.invoke("core:analyzeFirmware", firmwarePath),
  buildPlan: (firmwarePath, pitJsonPath) => ipcRenderer.invoke("core:buildPlan", firmwarePath, pitJsonPath),
  flashPlan: (planJsonPath) => ipcRenderer.invoke("core:flashPlan", planJsonPath),
  cleanTemp: () => ipcRenderer.invoke("core:cleanTemp"),
  onOperationStart: (callback) => subscribe("core:operation-start", callback),
  onProgress: (callback) => subscribe("core:progress", callback),
  onLog: (callback) => subscribe("core:log", callback),
  onResult: (callback) => subscribe("core:result", callback),
  onError: (callback) => subscribe("core:error", callback),
  onRaw: (callback) => subscribe("core:raw", callback),
  onStderr: (callback) => subscribe("core:stderr", callback),
  onOperationEnd: (callback) => subscribe("core:operation-end", callback),
});
