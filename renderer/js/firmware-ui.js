import { basename, createBadge, formatBytes, jsonSafe } from "./components.js";

const PACKAGE_ORDER = ["BL", "AP", "CP", "CSC", "HOME_CSC"];

function resolvePackageStatus(name, analysis) {
  const foundPackages = Array.isArray(analysis?.foundPackages) ? analysis.foundPackages : [];
  const missingPackages = Array.isArray(analysis?.missingPackages) ? analysis.missingPackages : [];
  const prefix = `${name.toLowerCase()}_`;

  if (foundPackages.some((value) => basename(value).toLowerCase().startsWith(prefix))) {
    return { label: "Encontrado", variant: "success" };
  }

  if (missingPackages.some((value) => String(value).toLowerCase() === name)) {
    return { label: "Faltante", variant: "warning" };
  }

  return { label: "Pendiente", variant: "muted" };
}

export function renderFirmwarePanel({ pathText, hintText, packageGrid, summaryBox }, state) {
  pathText.textContent = state.firmware.path || "No seleccionada";
  hintText.textContent = state.firmware.path
    ? "Lista para analizar."
    : "Carpeta con BL/AP/CP/CSC/HOME_CSC.";

  packageGrid.replaceChildren();

  const analysis = state.firmware.analysis;
  PACKAGE_ORDER.forEach((name) => {
    const status = resolvePackageStatus(name, analysis);
    const card = document.createElement("article");
    card.className = "ff-card";

    const title = document.createElement("div");
    title.className = "flex items-center justify-between gap-3";

    const left = document.createElement("div");
    left.className = "space-y-1";

    const label = document.createElement("div");
    label.className = "ff-card-title";
    label.textContent = name;

    const meta = document.createElement("div");
    meta.className = "ff-card-note";
    meta.textContent = name === "HOME_CSC"
      ? "Puede preservar datos, sin garantía."
      : name === "CSC"
        ? "Puede borrar datos."
        : "Paquete oficial Samsung.";

    left.append(label, meta);

    const badge = createBadge(status.label, status.variant);
    title.append(left, badge);

    const details = document.createElement("pre");
    details.className = "ff-pre mt-3 max-h-36";
    const matches = (analysis?.foundPackages || []).filter((value) => basename(value).toLowerCase().startsWith(`${name.toLowerCase()}_`));
    details.textContent = matches.length ? matches.join("\n") : "Sin archivo detectado.";

    card.append(title, details);
    packageGrid.appendChild(card);
  });

  summaryBox.textContent = analysis ? jsonSafe({
    analysisPath: analysis.analysisPath,
    sourcePath: analysis.sourcePath,
    foundPackages: analysis.foundPackages?.length || 0,
    missingPackages: analysis.missingPackages?.length || 0,
    images: analysis.images?.length || 0,
    warnings: analysis.warnings || [],
  }) : "Sin análisis todavía.";
}

export function renderFirmwareAnalysis(target, analysis) {
  if (!analysis) {
    target.textContent = "Sin análisis todavía.";
    return;
  }

  const lines = [
    `Ruta fuente: ${analysis.sourcePath || "n/a"}`,
    `Análisis: ${analysis.analysisPath || "n/a"}`,
    `Paquetes detectados: ${analysis.foundPackages?.length || 0}`,
    `Imágenes preparadas: ${analysis.images?.length || 0}`,
    `Advertencias: ${analysis.warnings?.length || 0}`,
  ];
  target.textContent = lines.join("\n");
}

export function renderFirmwareImageSize(value) {
  return formatBytes(value);
}
