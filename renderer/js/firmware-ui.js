import { basename, createBadge, formatBytes } from "./components.js";

const PACKAGE_ORDER = ["BL", "AP", "CP", "CSC", "HOME_CSC"];

function resolvePackageStatus(name, analysis) {
  const foundPackages = Array.isArray(analysis?.foundPackages) ? analysis.foundPackages : [];
  const missingPackages = Array.isArray(analysis?.missingPackages) ? analysis.missingPackages : [];
  const prefix = `${name.toLowerCase()}_`;

  if (foundPackages.some((value) => basename(value).toLowerCase().startsWith(prefix))) {
    return { label: "Detectado", variant: "success" };
  }

  if (missingPackages.some((value) => String(value).toLowerCase() === name.toLowerCase())) {
    return { label: "Faltante", variant: "warning" };
  }

  return { label: "Pendiente", variant: "muted" };
}

function sumImageSizes(images = []) {
  return images.reduce((total, image) => total + (Number(image?.sizeBytes) || 0), 0);
}

export function renderFirmwarePanel({ pathText, hintText, packageGrid, summaryBox, dropZone }, state) {
  const analysis = state.firmware.analysis;
  const sourcePath = state.firmware.path || analysis?.sourcePath || "";

  pathText.textContent = state.firmware.path ? basename(state.firmware.path) : "No seleccionada";
  hintText.textContent = state.firmware.path
    ? "Lista para analizar."
    : "Arrastra aquí la carpeta con BL / AP / CP / CSC.";
  summaryBox.textContent = analysis
    ? `${analysis.foundPackages?.length || 0} paquetes detectados · ${formatBytes(sumImageSizes(analysis.images))}`
    : "Sin análisis todavía.";

  if (dropZone) {
    dropZone.classList.toggle("is-populated", Boolean(sourcePath));
  }

  packageGrid.replaceChildren();

  PACKAGE_ORDER.forEach((name) => {
    const status = resolvePackageStatus(name, analysis);
    const chip = document.createElement("div");
    chip.className = `ff-chip ff-chip--${status.variant}`;

    const title = document.createElement("span");
    title.className = "ff-chip-label";
    title.textContent = name;

    const meta = document.createElement("span");
    meta.className = "ff-chip-status";
    meta.textContent = status.label;

    chip.append(title, meta);
    packageGrid.appendChild(chip);
  });
}

export function renderFirmwareAnalysis(target, analysis) {
  if (!analysis) {
    target.textContent = "Sin análisis todavía.";
    return;
  }

  const lines = [
    `${analysis.foundPackages?.length || 0} paquetes detectados`,
    `${analysis.images?.length || 0} imágenes preparadas`,
    `${analysis.warnings?.length || 0} advertencias`,
  ];

  target.textContent = lines.join(" · ");
}

export function renderFirmwareImageSize(value) {
  return formatBytes(value);
}
