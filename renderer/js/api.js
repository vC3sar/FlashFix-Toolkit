const api = window.flashfix;

export function getStatus() {
  return api.getStatus();
}

export function openLogsFolder() {
  return api.openLogsFolder();
}

export function openLicensesFolder() {
  return api.openLicensesFolder();
}

export function selectFirmwareFolder() {
  return api.selectFirmwareFolder();
}

export function selectJsonFile(title) {
  return api.selectJsonFile(title);
}

export function detectDevice() {
  return api.detectDevice();
}

export function getDeviceInfo() {
  return api.getDeviceInfo();
}

export function readPit() {
  return api.readPit();
}

export function analyzeFirmware(firmwarePath) {
  return api.analyzeFirmware(firmwarePath);
}

export function buildFlashPlan(firmwarePath, pitJsonPath) {
  return api.buildPlan(firmwarePath, pitJsonPath);
}

export function executeFlashPlan(planJsonPath) {
  return api.flashPlan(planJsonPath);
}

export function cleanTemp() {
  return api.cleanTemp();
}

export function onCoreEvent(callback) {
  return api.onCoreEvent(callback);
}
