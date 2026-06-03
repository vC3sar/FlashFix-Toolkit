import { createBadge, createCard, ellipsizePath, jsonSafe } from "./components.js";

export function renderDeviceDashboard(target, state) {
  target.replaceChildren(
    createCard(
      "Core",
      "Estado del Core",
      state.core.available ? "Listo" : "Pendiente",
      state.core.available ? "FlashFix.Core localizado" : "No se encontró FlashFix.Core.exe",
    ),
    createCard(
      "Dispositivo",
      "Estado del dispositivo",
      state.device.connected ? "Conectado" : "No detectado",
      state.device.info?.status || "Esperando detección",
    ),
    createCard(
      "Firmware",
      "Firmware cargado",
      state.firmware.path ? "Cargado" : "Vacío",
      state.firmware.path ? ellipsizePath(state.firmware.path, 56) : "Selecciona una carpeta de firmware",
    ),
    createCard(
      "PIT",
      "PIT leído",
      state.pit.loaded ? "Leído" : "Pendiente",
      state.pit.path ? ellipsizePath(state.pit.path, 56) : "Aún no se ha leído un PIT",
    ),
    createCard(
      "Plan",
      "Plan de flasheo",
      state.flashPlan.path ? "Listo" : "Pendiente",
      state.flashPlan.path ? ellipsizePath(state.flashPlan.path, 56) : "Construye un plan revisado",
    ),
    createCard(
      "Operación",
      "Última operación",
      state.operation.current?.command || "Sin actividad",
      state.operation.current?.message || "No hay operación reciente",
    ),
  );
}

export function renderDevicePanel({
  statusText,
  detailText,
  modelText,
  modelMetaText,
  badgeTarget,
  infoTarget,
  device,
}) {
  statusText.textContent = device.connected ? "Conectado" : "No detectado";
  detailText.textContent = device.connected
    ? device.info?.warnings?.[0] || "Dispositivo listo para lectura."
    : device.info?.warnings?.[0] || "Usa Detectar para iniciar.";
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
