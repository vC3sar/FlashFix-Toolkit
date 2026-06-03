import { analyzeFirmware, buildFlashPlan, cleanTemp, detectDevice, executeFlashPlan, getDeviceInfo, getStatus, openLicensesFolder, openLogsFolder, onCoreEvent, readPit, selectFirmwareFolder, selectJsonFile } from "./js/api.js";
import { basename, byId, ellipsizePath, formatDateTime, normalizeLevel } from "./js/components.js";
import { renderDeviceDashboard, renderDevicePanel } from "./js/device-ui.js";
import { renderFirmwarePanel } from "./js/firmware-ui.js";
import { LoggerUI } from "./js/logger-ui.js";
import { renderFlashPlanPanel } from "./js/flash-plan-ui.js";
import { renderPitPanel, renderPitRaw } from "./js/pit-ui.js";
import { appState } from "./js/state.js";

const state = appState;

const els = {
  backendBadge: byId("backendBadge"),
  deviceBadge: byId("deviceBadge"),
  operationBadge: byId("operationBadge"),
  dashboardCards: byId("dashboardCards"),
  openLogsQuickBtn: byId("openLogsQuickBtn"),
  cleanTempBtn: byId("cleanTempBtn"),
  detectBtn: byId("detectBtn"),
  deviceInfoBtn: byId("deviceInfoBtn"),
  readPitBtnDevice: byId("readPitBtnDevice"),
  readPitBtnSection: byId("readPitBtnSection"),
  selectFirmwareBtn: byId("selectFirmwareBtn"),
  analyzeBtn: byId("analyzeBtn"),
  selectPitBtn: byId("selectPitBtn"),
  buildPlanBtn: byId("buildPlanBtn"),
  selectPlanBtn: byId("selectPlanBtn"),
  flashPlanBtn: byId("flashPlanBtn"),
  cleanTempSecondaryBtn: byId("cleanTempSecondaryBtn"),
  openLicensesBtn: byId("openLicensesBtn"),
  backendPathText: byId("backendPathText"),
  backendPathFullBox: byId("backendPathFullBox"),
  logsPathText: byId("logsPathText"),
  logsPathFullBox: byId("logsPathFullBox"),
  tempPathText: byId("tempPathText"),
  tempPathFullBox: byId("tempPathFullBox"),
  licensesPathText: byId("licensesPathText"),
  licensesPathFullBox: byId("licensesPathFullBox"),
  disclaimerText: byId("disclaimerText"),
  deviceStatusText: byId("deviceStatusText"),
  deviceDetailText: byId("deviceDetailText"),
  deviceModelText: byId("deviceModelText"),
  deviceModelMetaText: byId("deviceModelMetaText"),
  deviceBadgeInline: byId("deviceBadgeInline"),
  deviceInfoBox: byId("deviceInfoBox"),
  pitBox: byId("pitBox"),
  firmwarePathText: byId("firmwarePathText"),
  firmwareHintText: byId("firmwareHintText"),
  firmwarePackageGrid: byId("firmwarePackageGrid"),
  analysisSummaryBox: byId("analysisSummaryBox"),
  pitPathText: byId("pitPathText"),
  pitHintText: byId("pitHintText"),
  pitSummaryBox: byId("pitSummaryBox"),
  pitTableBody: byId("pitTableBody"),
  planPathText: byId("planPathText"),
  planHintText: byId("planHintText"),
  planSummaryBox: byId("planSummaryBox"),
  planTableBody: byId("planTableBody"),
  planWarningsBox: byId("planWarningsBox"),
  currentOperationTitle: byId("currentOperationTitle"),
  currentOperationMessage: byId("currentOperationMessage"),
  currentOperationMeta: byId("currentOperationMeta"),
  currentOperationProgress: byId("currentOperationProgress"),
  currentOperationProgressText: byId("currentOperationProgressText"),
  logStream: byId("logStream"),
  logCountText: byId("logCountText"),
  logSearchInput: byId("logSearchInput"),
  copyVisibleLogsBtn: byId("copyVisibleLogsBtn"),
  copyAllLogsBtn: byId("copyAllLogsBtn"),
  exportLogsBtn: byId("exportLogsBtn"),
  clearLogsBtn: byId("clearLogsBtn"),
  openLogsBtn: byId("openLogsBtn"),
  filterButtons: document.querySelectorAll("[data-log-filter]"),
};

const logger = new LoggerUI({
  streamEl: els.logStream,
  countEl: els.logCountText,
  filterButtons: els.filterButtons,
  searchInput: els.logSearchInput,
  clearBtn: els.clearLogsBtn,
  copyVisibleBtn: els.copyVisibleLogsBtn,
  copyAllBtn: els.copyAllLogsBtn,
  exportBtn: els.exportLogsBtn,
});

state.logs.entries = logger.entries;

function setBadge(el, text, variant) {
  el.className = `ff-badge ${variant ? `ff-badge--${variant}` : "ff-badge--muted"}`;
  el.textContent = text;
}

function setBusy(value) {
  state.operation.running = value;
  updateButtons();
  renderOperationPanel();
}

function updateButtons() {
  const backendReady = state.core.available;
  const disabled = Boolean(state.operation.running);

  [
    els.detectBtn,
    els.deviceInfoBtn,
    els.readPitBtnDevice,
    els.readPitBtnSection,
    els.selectFirmwareBtn,
    els.analyzeBtn,
    els.selectPitBtn,
    els.buildPlanBtn,
    els.selectPlanBtn,
    els.flashPlanBtn,
    els.cleanTempBtn,
    els.cleanTempSecondaryBtn,
  ].forEach((button) => {
    if (!button) {
      return;
    }

    const coreAction = [
      els.detectBtn,
      els.deviceInfoBtn,
      els.readPitBtnDevice,
      els.readPitBtnSection,
      els.analyzeBtn,
      els.buildPlanBtn,
      els.flashPlanBtn,
      els.cleanTempBtn,
      els.cleanTempSecondaryBtn,
    ].includes(button);

    const selectionAction = [els.selectFirmwareBtn, els.selectPitBtn, els.selectPlanBtn].includes(button);

    button.disabled = (coreAction && (disabled || !backendReady))
      || (selectionAction && disabled);
  });

  els.openLogsQuickBtn.disabled = false;
  els.openLogsBtn.disabled = false;
  els.openLicensesBtn.disabled = false;
}

function renderDashboard() {
  renderDeviceDashboard(els.dashboardCards, state);
}

function renderTopBadges() {
  setBadge(
    els.backendBadge,
    state.core.available ? "Backend: listo" : "Backend: faltante",
    state.core.available ? "success" : "muted",
  );

  const deviceVariant = state.device.connected
    ? "success"
    : state.device.info?.status === "error"
      ? "danger"
      : "warning";
  setBadge(
    els.deviceBadge,
    state.device.connected ? "Dispositivo: conectado" : "Dispositivo: no detectado",
    deviceVariant,
  );

  const opVariant = state.operation.current
    ? (state.operation.current.status === "error"
      ? "danger"
      : state.operation.current.status === "success"
        ? "success"
        : "running")
    : "muted";

  const opText = state.operation.current
    ? (state.operation.current.status === "error"
      ? "Operación: error"
      : state.operation.current.status === "success"
        ? "Operación: completada"
        : "Operación: en curso")
    : "Operación: inactiva";

  setBadge(els.operationBadge, opText, opVariant);
}

function renderSettings() {
  const corePath = state.core.path || "engines/FlashFix.Core.exe";
  const logsPath = state.core.logsDir || "logs/";
  const tempPath = state.core.tempDir || "temp/";
  const licensesPath = state.core.licensesDir || "licenses/";

  els.backendPathText.textContent = ellipsizePath(corePath, 56);
  els.backendPathFullBox.textContent = corePath;
  els.logsPathText.textContent = ellipsizePath(logsPath, 56);
  els.logsPathFullBox.textContent = logsPath;
  els.tempPathText.textContent = ellipsizePath(tempPath, 56);
  els.tempPathFullBox.textContent = tempPath;
  els.licensesPathText.textContent = ellipsizePath(licensesPath, 56);
  els.licensesPathFullBox.textContent = licensesPath;
  els.disclaimerText.textContent = "FlashFix Toolkit is an independent firmware utility. It is not affiliated with or endorsed by Samsung.";
}

function renderDeviceSection() {
  renderDevicePanel({
    statusText: els.deviceStatusText,
    detailText: els.deviceDetailText,
    modelText: els.deviceModelText,
    modelMetaText: els.deviceModelMetaText,
    badgeTarget: els.deviceBadgeInline,
    infoTarget: els.deviceInfoBox,
    device: state.device,
  });
  renderPitRaw(els.pitBox, state.pit.loaded ? {
    partitions: state.pit.partitions,
    txtPath: state.pit.txtPath,
    jsonPath: state.pit.path,
  } : null);
}

function renderFirmwareSection() {
  renderFirmwarePanel({
    pathText: els.firmwarePathText,
    hintText: els.firmwareHintText,
    packageGrid: els.firmwarePackageGrid,
    summaryBox: els.analysisSummaryBox,
  }, state);
}

function renderPitSection() {
  renderPitPanel({
    pathText: els.pitPathText,
    hintText: els.pitHintText,
    summaryBox: els.pitSummaryBox,
    tableBody: els.pitTableBody,
  }, state);
}

function renderPlanSection() {
  renderFlashPlanPanel({
    pathText: els.planPathText,
    hintText: els.planHintText,
    summaryBox: els.planSummaryBox,
    tableBody: els.planTableBody,
    warningsBox: els.planWarningsBox,
  }, state);
}

function renderOperationPanel() {
  const current = state.operation.current;
  if (!current) {
    els.currentOperationTitle.textContent = "Sin operación";
    els.currentOperationMessage.textContent = "No hay tareas en curso.";
    els.currentOperationMeta.textContent = "";
    els.currentOperationProgress.style.width = "0%";
    els.currentOperationProgressText.textContent = "0%";
    renderTopBadges();
    return;
  }

  const statusText = current.status === "error"
    ? "Fallo"
    : current.status === "success"
      ? "Completado"
      : state.operation.running
        ? "En curso"
        : "Finalizado";

  els.currentOperationTitle.textContent = `${current.command || "operation"} · ${statusText}`;
  els.currentOperationMessage.textContent = current.message || "Procesando...";

  const metaParts = [
    current.command ? `Proceso: ${current.command}` : null,
    current.logPath ? `Log: ${ellipsizePath(current.logPath, 64)}` : null,
    current.startedAt ? `Inicio: ${formatDateTime(current.startedAt)}` : null,
    current.completedAt ? `Fin: ${formatDateTime(current.completedAt)}` : null,
    Number.isFinite(current.durationMs) ? `Duración: ${(current.durationMs / 1000).toFixed(1)} s` : null,
    Number.isFinite(current.exitCode) ? `Exit: ${current.exitCode}` : null,
  ].filter(Boolean);
  els.currentOperationMeta.textContent = metaParts.join(" · ");

  const progress = Number.isFinite(state.operation.progress) ? state.operation.progress : 0;
  els.currentOperationProgress.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  els.currentOperationProgressText.textContent = `${Math.round(progress)}%`;
  renderTopBadges();
}

function renderAll() {
  renderTopBadges();
  renderDashboard();
  renderDeviceSection();
  renderFirmwareSection();
  renderPitSection();
  renderPlanSection();
  renderSettings();
  renderOperationPanel();
  updateButtons();
}

function applyCommandData(command, data) {
  if (!data) {
    return;
  }

  if (command === "detect" || command === "device-info") {
    state.device.info = data;
    state.device.connected = Boolean(data.connected);
  }

  if (command === "detect") {
    state.device.connected = Boolean(data.connected);
  }

  if (command === "read-pit") {
    state.pit.loaded = Boolean(data.partitions?.length);
    state.pit.partitions = Array.isArray(data.partitions) ? data.partitions : [];
    state.pit.path = data.pitJsonPath || state.pit.path;
    state.pit.txtPath = data.pitTxtPath || state.pit.txtPath;
  }

  if (command === "analyze-firmware") {
    state.firmware.analysis = data;
    state.firmware.path = data.sourcePath || state.firmware.path;
    state.firmware.packages = Array.isArray(data.images) ? data.images : [];
  }

  if (command === "build-plan") {
    state.flashPlan.path = data.planPath || state.flashPlan.path;
    state.flashPlan.items = Array.isArray(data.items) ? data.items : [];
    state.flashPlan.summary = data.summary || state.flashPlan.summary;
    state.flashPlan.warnings = Array.isArray(data.warnings) ? data.warnings : [];
  }

  if (command === "flash-plan") {
    state.flashPlan.path = data.planPath || state.flashPlan.path;
    state.flashPlan.summary = data.summary || state.flashPlan.summary;
    state.flashPlan.warnings = Array.isArray(data.warnings) ? data.warnings : [];
    state.flashPlan.resultPath = data.resultPath || state.flashPlan.resultPath;
  }
}

function buildLogEntry(eventType, payload) {
  const timestamp = Date.now();
  switch (eventType) {
    case "operation-start":
      return {
        timestamp,
        level: "running",
        command: "system",
        message: `Inicio: ${payload.commandLine || payload.command || "operación"}`,
        details: payload,
        expandable: true,
      };
    case "progress":
      return {
        timestamp,
        level: "running",
        command: payload.step || "progress",
        message: payload.message || "En progreso",
        details: payload,
        expandable: true,
      };
    case "log":
      return {
        timestamp,
        level: normalizeLevel(payload.level, "info"),
        command: payload.command || state.operation.current?.command || "log",
        message: payload.message || "Log",
        details: payload.data ?? payload,
        expandable: Boolean(payload.data ?? payload),
      };
    case "result":
      return {
        timestamp,
        level: payload.ok === false ? "error" : "success",
        command: payload.command || state.operation.current?.command || "result",
        message: payload.message || "Resultado",
        details: payload.data ?? payload,
        expandable: Boolean(payload.data ?? payload.warnings?.length),
      };
    case "error":
      return {
        timestamp,
        level: "error",
        command: payload.command || state.operation.current?.command || "error",
        message: payload.message || "Error",
        details: payload.data ?? payload,
        expandable: true,
      };
    case "stderr":
      return {
        timestamp,
        level: "warning",
        command: state.operation.current?.command || "stderr",
        message: payload.line || "stderr",
        details: payload,
        expandable: true,
      };
    case "raw":
      return {
        timestamp,
        level: "debug",
        command: state.operation.current?.command || "raw",
        message: payload.line || "Salida raw",
        details: payload.parsed ?? payload,
        expandable: Boolean(payload.parsed),
      };
    case "operation-end":
      return {
        timestamp,
        level: payload.exitCode === 0 ? "success" : "error",
        command: state.operation.current?.command || "operation",
        message: payload.exitCode === 0 ? "Operación finalizada" : "Operación fallida",
        details: payload,
        expandable: true,
      };
    default:
      return null;
  }
}

function handleCoreEvent(event) {
  const { type, payload } = event;

  if (type === "operation-start") {
    state.operation.current = {
      ...payload,
      startedAt: Date.now(),
      status: "running",
    };
    state.operation.progress = 0;
    state.operation.message = "Iniciando...";
    state.operation.step = "starting";
    logger.setCurrentFileName(payload.logPath ? basename(payload.logPath) : "flashfix-log.txt");
  }

  if (type === "progress") {
    state.operation.progress = Number.isFinite(payload.percent) ? payload.percent : state.operation.progress;
    state.operation.message = payload.message || state.operation.message;
    state.operation.step = payload.step || state.operation.step;
    if (state.operation.current) {
      state.operation.current.message = payload.message || state.operation.current.message;
      state.operation.current.step = payload.step || state.operation.current.step;
      state.operation.current.progress = state.operation.progress;
    }
    renderOperationPanel();
  }

  if (type === "log" && payload.level === "warning") {
    state.operation.message = payload.message || state.operation.message;
  }

  if (type === "result") {
    applyCommandData(payload.command, payload.data);
    if (state.operation.current) {
      state.operation.current.message = payload.message || state.operation.current.message;
      state.operation.current.lastResult = payload;
      state.operation.current.status = payload.ok === false ? "error" : state.operation.current.status;
    }
  }

  if (type === "error") {
    if (state.operation.current) {
      state.operation.current.message = payload.message || state.operation.current.message;
      state.operation.current.lastError = payload;
      state.operation.current.status = "error";
    }
  }

  if (type === "operation-end") {
    state.operation.running = false;
    if (state.operation.current) {
      state.operation.current.exitCode = payload.exitCode;
      state.operation.current.completedAt = Date.now();
      state.operation.current.durationMs = state.operation.current.completedAt - state.operation.current.startedAt;
      state.operation.current.status = payload.exitCode === 0
        ? (state.operation.current.status === "error" ? "error" : "success")
        : "error";
      state.operation.progress = payload.exitCode === 0 ? 100 : state.operation.progress;
    }
  }

  const entry = buildLogEntry(type, payload);
  if (entry) {
    logger.add(entry);
  }

  if (["operation-start", "result", "error", "operation-end", "progress"].includes(type)) {
    renderAll();
  } else {
    renderTopBadges();
    renderOperationPanel();
  }
}

function wireActions() {
  els.openLogsQuickBtn.addEventListener("click", () => openLogsFolder().catch((error) => logger.add({
    level: "error",
    command: "open-logs",
    message: error.message || String(error),
    details: { error: error.message || String(error) },
    expandable: true,
  })));

  els.openLogsBtn.addEventListener("click", () => openLogsFolder().catch((error) => logger.add({
    level: "error",
    command: "open-logs",
    message: error.message || String(error),
    details: { error: error.message || String(error) },
    expandable: true,
  })));

  els.openLicensesBtn.addEventListener("click", () => openLicensesFolder().catch((error) => logger.add({
    level: "error",
    command: "open-licenses",
    message: error.message || String(error),
    details: { error: error.message || String(error) },
    expandable: true,
  })));

  const runCleanTemp = async () => {
    setBusy(true);
    try {
      await cleanTemp();
    } catch (error) {
      logger.add({
        level: "error",
        command: "clean-temp",
        message: error.message || String(error),
        details: { error: error.message || String(error) },
        expandable: true,
      });
    } finally {
      setBusy(false);
    }
  };

  els.cleanTempBtn.addEventListener("click", runCleanTemp);
  els.cleanTempSecondaryBtn.addEventListener("click", runCleanTemp);

  els.detectBtn.addEventListener("click", async () => {
    setBusy(true);
    try {
      await detectDevice();
    } catch (error) {
      logger.add({
        level: "error",
        command: "detect",
        message: error.message || String(error),
        details: { error: error.message || String(error) },
        expandable: true,
      });
    } finally {
      setBusy(false);
    }
  });

  els.deviceInfoBtn.addEventListener("click", async () => {
    setBusy(true);
    try {
      await getDeviceInfo();
    } catch (error) {
      logger.add({
        level: "error",
        command: "device-info",
        message: error.message || String(error),
        details: { error: error.message || String(error) },
        expandable: true,
      });
    } finally {
      setBusy(false);
    }
  });

  [els.readPitBtnDevice, els.readPitBtnSection].forEach((button) => {
    button.addEventListener("click", async () => {
      setBusy(true);
      try {
        await readPit();
      } catch (error) {
        logger.add({
          level: "error",
          command: "read-pit",
          message: error.message || String(error),
          details: { error: error.message || String(error) },
          expandable: true,
        });
      } finally {
        setBusy(false);
      }
    });
  });

  els.selectFirmwareBtn.addEventListener("click", async () => {
    const folder = await selectFirmwareFolder();
    if (!folder) {
      return;
    }

    state.firmware.path = folder;
    state.firmware.analysis = null;
    state.firmware.packages = [];
    state.flashPlan.path = null;
    state.flashPlan.items = [];
    state.flashPlan.summary = null;
    state.flashPlan.warnings = [];
    renderAll();
    logger.add({
      level: "info",
      command: "select-firmware",
      message: `Firmware seleccionado: ${basename(folder)}`,
      details: { folder },
      expandable: true,
    });
  });

  els.analyzeBtn.addEventListener("click", async () => {
    if (!state.firmware.path) {
      logger.add({
        level: "warning",
        command: "analyze-firmware",
        message: "Selecciona primero una carpeta de firmware.",
        details: {},
      });
      return;
    }

    setBusy(true);
    try {
      await analyzeFirmware(state.firmware.path);
    } catch (error) {
      logger.add({
        level: "error",
        command: "analyze-firmware",
        message: error.message || String(error),
        details: { error: error.message || String(error) },
        expandable: true,
      });
    } finally {
      setBusy(false);
    }
  });

  els.selectPitBtn.addEventListener("click", async () => {
    const file = await selectJsonFile("Seleccionar PIT JSON");
    if (!file) {
      return;
    }

    state.pit.path = file;
    state.flashPlan.path = null;
    state.flashPlan.items = [];
    state.flashPlan.summary = null;
    state.flashPlan.warnings = [];
    renderAll();
    logger.add({
      level: "info",
      command: "select-pit",
      message: `PIT JSON seleccionado: ${basename(file)}`,
      details: { file },
      expandable: true,
    });
  });

  els.buildPlanBtn.addEventListener("click", async () => {
    if (!state.firmware.path || !state.pit.path) {
      logger.add({
        level: "warning",
        command: "build-plan",
        message: "Selecciona firmware y PIT JSON antes de construir el plan.",
        details: {},
      });
      return;
    }

    setBusy(true);
    try {
      await buildFlashPlan(state.firmware.path, state.pit.path);
    } catch (error) {
      logger.add({
        level: "error",
        command: "build-plan",
        message: error.message || String(error),
        details: { error: error.message || String(error) },
        expandable: true,
      });
    } finally {
      setBusy(false);
    }
  });

  els.selectPlanBtn.addEventListener("click", async () => {
    const file = await selectJsonFile("Seleccionar plan JSON");
    if (!file) {
      return;
    }

    state.flashPlan.path = file;
    renderAll();
    logger.add({
      level: "info",
      command: "select-plan",
      message: `Plan seleccionado: ${basename(file)}`,
      details: { file },
      expandable: true,
    });
  });

  els.flashPlanBtn.addEventListener("click", async () => {
    if (!state.flashPlan.path) {
      logger.add({
        level: "warning",
        command: "flash-plan",
        message: "Selecciona un plan JSON antes de ejecutar.",
        details: {},
      });
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
      await executeFlashPlan(state.flashPlan.path);
    } catch (error) {
      logger.add({
        level: "error",
        command: "flash-plan",
        message: error.message || String(error),
        details: { error: error.message || String(error) },
        expandable: true,
      });
    } finally {
      setBusy(false);
    }
  });
}

async function refreshStatus() {
  const status = await getStatus();
  state.core.available = Boolean(status.coreFound);
  state.core.path = status.corePath || null;
  state.core.logsDir = status.logsDir || null;
  state.core.tempDir = status.tempDir || null;
  state.core.licensesDir = status.licensesDir || null;
  renderAll();
}

onCoreEvent(handleCoreEvent);
wireActions();
refreshStatus().catch((error) => {
  logger.add({
    level: "error",
    command: "status",
    message: error.message || String(error),
    details: { error: error.message || String(error) },
    expandable: true,
  });
});
