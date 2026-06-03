const state = {
  backendFound: false,
  backendPath: "",
  logsDir: "",
  tempDir: "",
  deviceState: "unknown",
  deviceMessage: "Sin validar",
  deviceInfo: null,
  pitData: null,
  firmwarePath: "",
  pitPath: "",
  analysisPath: "",
  planPath: "",
  busy: false,
  lastOperation: null,
};

const els = {
  backendBadge: document.getElementById("backendBadge"),
  deviceBadge: document.getElementById("deviceBadge"),
  backendStatusText: document.getElementById("backendStatusText"),
  backendPathText: document.getElementById("backendPathText"),
  logsStatusText: document.getElementById("logsStatusText"),
  logsPathText: document.getElementById("logsPathText"),
  tempStatusText: document.getElementById("tempStatusText"),
  tempPathText: document.getElementById("tempPathText"),
  deviceStatusText: document.getElementById("deviceStatusText"),
  deviceDetailText: document.getElementById("deviceDetailText"),
  deviceInfoBox: document.getElementById("deviceInfoBox"),
  pitBox: document.getElementById("pitBox"),
  firmwarePathText: document.getElementById("firmwarePathText"),
  firmwareHintText: document.getElementById("firmwareHintText"),
  pitPathText: document.getElementById("pitPathText"),
  pitHintText: document.getElementById("pitHintText"),
  analysisBox: document.getElementById("analysisBox"),
  planPathText: document.getElementById("planPathText"),
  planHintText: document.getElementById("planHintText"),
  planBox: document.getElementById("planBox"),
  logStream: document.getElementById("logStream"),
  openLogsBtn: document.getElementById("openLogsBtn"),
  detectBtn: document.getElementById("detectBtn"),
  deviceInfoBtn: document.getElementById("deviceInfoBtn"),
  readPitBtn: document.getElementById("readPitBtn"),
  selectFirmwareBtn: document.getElementById("selectFirmwareBtn"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  selectPitBtn: document.getElementById("selectPitBtn"),
  buildPlanBtn: document.getElementById("buildPlanBtn"),
  selectPlanBtn: document.getElementById("selectPlanBtn"),
  flashPlanBtn: document.getElementById("flashPlanBtn"),
  cleanTempBtn: document.getElementById("cleanTempBtn"),
  clearLogsBtn: document.getElementById("clearLogsBtn"),
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function deviceLabel(deviceState) {
  switch (deviceState) {
    case "detected":
      return "Detectado";
    case "not_detected":
      return "No detectado";
    case "driver_issue":
      return "Driver o permisos";
    case "error":
      return "Error";
    default:
      return "Desconocido";
  }
}

function setBusy(value) {
  state.busy = value;
  updateButtons();
}

function updateButtons() {
  const backendReady = state.backendFound;
  els.detectBtn.disabled = state.busy || !backendReady;
  els.deviceInfoBtn.disabled = state.busy || !backendReady;
  els.readPitBtn.disabled = state.busy || !backendReady;
  els.selectFirmwareBtn.disabled = state.busy;
  els.analyzeBtn.disabled = state.busy || !backendReady || !state.firmwarePath;
  els.selectPitBtn.disabled = state.busy;
  els.buildPlanBtn.disabled = state.busy || !backendReady || !state.firmwarePath || !state.pitPath;
  els.selectPlanBtn.disabled = state.busy;
  els.flashPlanBtn.disabled = state.busy || !backendReady || !state.planPath;
  els.cleanTempBtn.disabled = state.busy || !backendReady;
}

function renderStatus() {
  els.backendBadge.textContent = state.backendFound ? "Backend: listo" : "Backend: faltante";
  els.deviceBadge.textContent = `Dispositivo: ${deviceLabel(state.deviceState)}`;
  els.backendStatusText.textContent = state.backendFound ? "FlashFix.Core encontrado" : "FlashFix.Core no encontrado";
  els.backendPathText.textContent = state.backendPath || "engines/FlashFix.Core.exe";
  els.logsStatusText.textContent = state.logsDir ? "Disponible" : "Pendiente";
  els.logsPathText.textContent = state.logsDir || "logs/";
  els.tempStatusText.textContent = state.tempDir ? "Disponible" : "Pendiente";
  els.tempPathText.textContent = state.tempDir || "temp/";
  els.deviceStatusText.textContent = deviceLabel(state.deviceState);
  els.deviceDetailText.textContent = state.deviceMessage;
  els.firmwarePathText.textContent = state.firmwarePath || "No seleccionada";
  els.firmwareHintText.textContent = state.firmwarePath
    ? "Lista para analizar."
    : "Carpeta con BL/AP/CP/CSC/HOME_CSC.";
  els.pitPathText.textContent = state.pitPath || "No seleccionado";
  els.pitHintText.textContent = state.pitPath
    ? "PIT listo para construir el plan."
    : "Se puede usar el PIT generado por el backend.";
  els.planPathText.textContent = state.planPath || "No generado";
  els.planHintText.textContent = state.planPath
    ? "Plan listo para revisión y flasheo."
    : "Solo se incluyen particiones permitidas y mapeadas.";
  els.deviceInfoBox.textContent = state.deviceInfo ? pretty(state.deviceInfo) : "Sin información del dispositivo.";
  els.pitBox.textContent = state.pitData ? pretty(state.pitData) : "Sin PIT todavía.";
  updateButtons();
}

function appendLog(level, message, payload = null) {
  const line = document.createElement("div");
  line.className = `log-line log-${level}`;
  const suffix = payload ? `\n${pretty(payload)}` : "";
  line.innerHTML = `
    <span class="log-time">${escapeHtml(new Date().toISOString())}</span>
    <span class="log-level">${escapeHtml(level)}</span>
    <span class="log-message">${escapeHtml(message + suffix)}</span>
  `;
  els.logStream.appendChild(line);
  els.logStream.scrollTop = els.logStream.scrollHeight;
}

function clearLogView() {
  els.logStream.innerHTML = "";
}

function updateResultBox(box, data) {
  box.textContent = data ? pretty(data) : "Sin datos.";
}

async function refreshStatus() {
  const status = await window.flashfix.getStatus();
  state.backendFound = Boolean(status.coreFound);
  state.backendPath = status.corePath || "";
  state.logsDir = status.logsDir || "";
  state.tempDir = status.tempDir || "";
  renderStatus();
}

async function handleDetect() {
  setBusy(true);
  try {
    const result = await window.flashfix.detectDevice();
    appendLog(result.ok ? "stdout" : "stderr", result.message || "Detect terminado.", result);
    state.deviceState = result.ok ? "detected" : (result.code === "NO_DEVICE" ? "not_detected" : "error");
    state.deviceMessage = result.message || "Sin mensaje.";
    renderStatus();
  } catch (error) {
    appendLog("stderr", error.message || String(error));
    state.deviceState = "error";
    state.deviceMessage = error.message || "Error desconocido.";
    renderStatus();
  } finally {
    setBusy(false);
  }
}

async function handleDeviceInfo() {
  setBusy(true);
  try {
    const result = await window.flashfix.getDeviceInfo();
    appendLog(result.ok ? "stdout" : "stderr", result.message || "Device info terminado.", result);
    state.deviceInfo = result.data || result;
    if (result.ok) {
      state.deviceState = result.data?.connected ? "detected" : state.deviceState;
      state.deviceMessage = result.message || state.deviceMessage;
    }
    renderStatus();
  } catch (error) {
    appendLog("stderr", error.message || String(error));
    state.deviceState = "error";
    state.deviceMessage = error.message || "Error desconocido.";
    renderStatus();
  } finally {
    setBusy(false);
  }
}

async function handleReadPit() {
  setBusy(true);
  try {
    const result = await window.flashfix.readPit();
    appendLog(result.ok ? "stdout" : "stderr", result.message || "Read PIT terminado.", result);
    if (result.data?.pitJsonPath) {
      state.pitPath = result.data.pitJsonPath;
    }
    state.pitData = result.data || null;
    state.planPath = "";
    state.deviceMessage = result.message || state.deviceMessage;
    updateResultBox(els.pitBox, result.data);
    renderStatus();
  } catch (error) {
    appendLog("stderr", error.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function handleSelectFirmware() {
  const folder = await window.flashfix.selectFirmwareFolder();
  if (!folder) {
    return;
  }
  state.firmwarePath = folder;
  state.analysisPath = "";
  state.planPath = "";
  renderStatus();
  appendLog("system", `Firmware seleccionado: ${folder}`);
}

async function handleAnalyzeFirmware() {
  if (!state.firmwarePath) {
    appendLog("stderr", "Selecciona primero una carpeta de firmware.");
    return;
  }
  setBusy(true);
  try {
    const result = await window.flashfix.analyzeFirmware(state.firmwarePath);
    appendLog(result.ok ? "stdout" : "stderr", result.message || "Analyze terminado.", result);
    if (result.data?.analysisPath) {
      state.analysisPath = result.data.analysisPath;
    }
    state.planPath = "";
    updateResultBox(els.analysisBox, result.data);
    renderStatus();
  } catch (error) {
    appendLog("stderr", error.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function handleSelectPitFile() {
  const file = await window.flashfix.selectJsonFile("Seleccionar PIT JSON");
  if (!file) {
    return;
  }
  state.pitPath = file;
  state.planPath = "";
  renderStatus();
  appendLog("system", `PIT JSON seleccionado: ${file}`);
}

async function handleBuildPlan() {
  if (!state.firmwarePath || !state.pitPath) {
    appendLog("stderr", "Selecciona firmware y PIT JSON antes de construir el plan.");
    return;
  }
  setBusy(true);
  try {
    const result = await window.flashfix.buildPlan(state.firmwarePath, state.pitPath);
    appendLog(result.ok ? "stdout" : "stderr", result.message || "Build plan terminado.", result);
    if (result.data?.planPath) {
      state.planPath = result.data.planPath;
    }
    updateResultBox(els.planBox, result.data);
    renderStatus();
  } catch (error) {
    appendLog("stderr", error.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function handleSelectPlanFile() {
  const file = await window.flashfix.selectJsonFile("Seleccionar plan JSON");
  if (!file) {
    return;
  }
  state.planPath = file;
  renderStatus();
  appendLog("system", `Plan seleccionado: ${file}`);
}

async function handleFlashPlan() {
  if (!state.planPath) {
    appendLog("stderr", "Selecciona un plan JSON antes de flashear.");
    return;
  }

  const confirmed = window.confirm(
    "Vas a ejecutar el plan de flasheo revisado.\n\n" +
      "Confirma que el dispositivo correcto está conectado y que entiendes el riesgo de pérdida de datos.",
  );
  if (!confirmed) {
    return;
  }

  setBusy(true);
  try {
    const result = await window.flashfix.flashPlan(state.planPath);
    appendLog(result.ok ? "stdout" : "stderr", result.message || "Flash plan terminado.", result);
    updateResultBox(els.planBox, result.data || result);
    state.deviceMessage = result.message || state.deviceMessage;
    renderStatus();
  } catch (error) {
    appendLog("stderr", error.message || String(error));
    state.deviceState = "error";
    state.deviceMessage = error.message || "Error desconocido.";
    renderStatus();
  } finally {
    setBusy(false);
  }
}

async function handleCleanTemp() {
  setBusy(true);
  try {
    const result = await window.flashfix.cleanTemp();
    appendLog(result.ok ? "stdout" : "stderr", result.message || "Cleanup terminado.", result);
  } catch (error) {
    appendLog("stderr", error.message || String(error));
  } finally {
    setBusy(false);
  }
}

function wireEvents() {
  els.openLogsBtn.addEventListener("click", () => {
    window.flashfix.openLogsFolder().catch((error) => appendLog("stderr", error.message || String(error)));
  });
  els.detectBtn.addEventListener("click", handleDetect);
  els.deviceInfoBtn.addEventListener("click", handleDeviceInfo);
  els.readPitBtn.addEventListener("click", handleReadPit);
  els.selectFirmwareBtn.addEventListener("click", handleSelectFirmware);
  els.analyzeBtn.addEventListener("click", handleAnalyzeFirmware);
  els.selectPitBtn.addEventListener("click", handleSelectPitFile);
  els.buildPlanBtn.addEventListener("click", handleBuildPlan);
  els.selectPlanBtn.addEventListener("click", handleSelectPlanFile);
  els.flashPlanBtn.addEventListener("click", handleFlashPlan);
  els.cleanTempBtn.addEventListener("click", handleCleanTemp);
  els.clearLogsBtn.addEventListener("click", clearLogView);

  window.flashfix.onOperationStart((payload) => {
    state.lastOperation = payload;
    appendLog("system", `Inicio: ${payload.commandLine}`);
  });

  window.flashfix.onProgress((payload) => {
    appendLog("progress", `${payload.step || "progress"}: ${payload.message || ""}`, payload);
  });

  window.flashfix.onLog((payload) => {
    appendLog(payload.level || "system", payload.message || "Log", payload.data);
  });

  window.flashfix.onResult((payload) => {
    appendLog("stdout", payload.message || "Resultado recibido.", payload);
  });

  window.flashfix.onError((payload) => {
    appendLog("stderr", payload.message || "Error recibido.", payload);
  });

  window.flashfix.onRaw((payload) => {
    appendLog("system", payload.line || "Salida raw.");
  });

  window.flashfix.onStderr((payload) => {
    appendLog("stderr", payload.line || "stderr");
  });

  window.flashfix.onOperationEnd((payload) => {
    state.lastOperation = payload;
  });
}

wireEvents();
refreshStatus().catch((error) => {
  appendLog("stderr", error.message || String(error));
});
