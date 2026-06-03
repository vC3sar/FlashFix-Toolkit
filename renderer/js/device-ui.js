import { createBadge, ellipsizePath, jsonSafe } from "./components.js";

function createStepCard({ icon, label, status, note, variant }) {
  const card = document.createElement("article");
  card.className = `ff-step-card ff-step-card--${variant}`;

  const iconEl = document.createElement("div");
  iconEl.className = "ff-step-icon";
  iconEl.textContent = icon;

  const body = document.createElement("div");
  body.className = "ff-step-body";

  const labelEl = document.createElement("div");
  labelEl.className = "ff-step-label";
  labelEl.textContent = label;

  const statusEl = document.createElement("div");
  statusEl.className = "ff-step-status";
  statusEl.textContent = status;

  const noteEl = document.createElement("div");
  noteEl.className = "ff-step-note";
  noteEl.textContent = note;

  body.append(labelEl, statusEl, noteEl);
  card.append(iconEl, body);
  return card;
}

export function renderDeviceDashboard(target, state) {
  target.className = "ff-dashboard-stack";

  const stepCore = state.core.available ? "ready" : "pending";
  const stepDevice = state.device.connected ? "ready" : state.operation.current?.command === "detect" ? "active" : "pending";
  const stepFirmware = state.firmware.path ? "ready" : "pending";
  const stepPlan = state.flashPlan.path ? "ready" : "pending";

  const tracker = document.createElement("div");
  tracker.className = "ff-dashboard-track";

  const summary = document.createElement("div");
  summary.className = "ff-dashboard-summary";
  summary.textContent = state.operation.current?.message
    || "Conecta el dispositivo, carga el firmware, revisa el plan y ejecuta.";

  tracker.append(
    createStepCard({
      icon: "C",
      label: "Core",
      status: state.core.available ? "Listo" : "Pendiente",
      note: state.core.available ? "FlashFix.Core localizado" : "FlashFix.Core.exe no encontrado",
      variant: stepCore,
    }),
    createStepCard({
      icon: "D",
      label: "Dispositivo",
      status: state.device.connected ? "Conectado" : "Esperando",
      note: state.device.info?.status || "Conecta el teléfono en Download Mode",
      variant: stepDevice,
    }),
    createStepCard({
      icon: "F",
      label: "Firmware",
      status: state.firmware.path ? "Cargado" : "Pendiente",
      note: state.firmware.path ? ellipsizePath(state.firmware.path, 36) : "Selecciona la carpeta con los paquetes",
      variant: stepFirmware,
    }),
    createStepCard({
      icon: "P",
      label: "Plan",
      status: state.flashPlan.path ? "Listo" : "Pendiente",
      note: state.flashPlan.path ? ellipsizePath(state.flashPlan.path, 36) : "Construye el plan revisado",
      variant: stepPlan,
    }),
  );

  target.replaceChildren(tracker, summary);
}

export function renderDevicePanel({
  emptyState,
  connectedState,
  statusText,
  detailText,
  modelText,
  modelMetaText,
  badgeTarget,
  infoTarget,
  device,
}) {
  if (emptyState) {
    emptyState.hidden = Boolean(device.connected);
  }

  if (connectedState) {
    connectedState.hidden = !device.connected;
  }

  statusText.textContent = device.connected ? "Conectado" : "No detectado";
  detailText.textContent = device.connected
    ? device.info?.warnings?.[0] || "Listo para leer información."
    : device.info?.warnings?.[0] || "Usa detectar para iniciar.";
  modelText.textContent = device.info?.model || "Modelo no disponible";
  modelMetaText.textContent = [
    device.info?.modelSource ? `Fuente: ${device.info.modelSource}` : null,
    device.info?.modelConfidence ? `Confianza: ${device.info.modelConfidence}` : null,
  ].filter(Boolean).join(" · ") || "Sin fuente de modelo";

  badgeTarget.replaceChildren(
    createBadge(device.connected ? "Conectado" : "No detectado", device.connected ? "success" : "muted"),
  );

  infoTarget.textContent = jsonSafe(device.info || {});
}
