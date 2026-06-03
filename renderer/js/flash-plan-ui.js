import { basename, createBadge } from "./components.js";

function statusMeta(item) {
  const status = String(item?.status || "unknown").toLowerCase();

  switch (status) {
    case "vital_ready":
      return { label: "Vital", variant: "success" };
    case "optional_ready":
      return { label: "Opcional", variant: "info" };
    case "ready":
      return { label: "Listo", variant: "success" };
    case "large_but_flashable":
      return { label: "Grande", variant: "warning" };
    case "pit_not_found":
      return { label: "PIT", variant: "warning" };
    case "duplicate_resolved":
      return { label: "Duplicado", variant: "info" };
    case "metadata_excluded":
      return { label: "Meta", variant: "muted" };
    case "high_risk_blocked":
      return { label: "Bloqueado", variant: "danger" };
    case "excluded_by_user_mode":
      return { label: "Excluido", variant: "muted" };
    case "unmapped":
      return { label: "Sin mapa", variant: "muted" };
    default:
      return { label: "Otro", variant: "muted" };
  }
}

function groupKeyForItem(item) {
  const status = String(item?.status || "unknown").toLowerCase();

  switch (status) {
    case "ready":
    case "vital_ready":
    case "optional_ready":
      return "ready";
    case "large_but_flashable":
      return "large_but_flashable";
    case "high_risk_blocked":
      return "high_risk_blocked";
    case "excluded_by_user_mode":
      return "excluded_by_user_mode";
    case "pit_not_found":
      return "pit_not_found";
    case "duplicate_resolved":
      return "duplicate_resolved";
    case "metadata_excluded":
      return "metadata_excluded";
    case "unmapped":
      return "unmapped";
    default:
      return "unknown";
  }
}

function groupLabel(key) {
  switch (key) {
    case "ready":
      return "Ready / Safe candidates";
    case "large_but_flashable":
      return "Large but flashable";
    case "high_risk_blocked":
      return "High risk blocked";
    case "excluded_by_user_mode":
      return "Excluded by user mode";
    case "pit_not_found":
      return "PIT not found";
    case "duplicate_resolved":
      return "Duplicate resolved";
    case "metadata_excluded":
      return "Auxiliary / metadata";
    case "unmapped":
      return "Unmapped";
    default:
      return "Other";
  }
}

function createGroupRow(label, count) {
  const row = document.createElement("tr");
  row.className = "ff-table-group-row";

  const cell = document.createElement("th");
  cell.colSpan = 5;
  cell.className = "ff-table-group-cell";

  const title = document.createElement("div");
  title.className = "ff-table-group-title";
  title.textContent = label;

  const meta = document.createElement("div");
  meta.className = "ff-table-group-meta";
  meta.textContent = `${count} elementos`;

  cell.append(title, meta);
  row.appendChild(cell);
  return row;
}

function createFileCell(item) {
  const cell = document.createElement("td");

  const title = document.createElement("div");
  title.className = "ff-plan-cell-title";
  title.textContent = item.image || "";

  const meta = document.createElement("div");
  meta.className = "ff-plan-cell-meta";
  const parts = [item.sourcePackage, item.imageKind, item.decompressionStatus].filter(Boolean);
  meta.textContent = parts.join(" · ");

  cell.append(title, meta);
  return cell;
}

function createPartitionCell(item) {
  const cell = document.createElement("td");

  const title = document.createElement("div");
  title.className = "ff-plan-cell-title";
  title.textContent = item.partition || "—";

  const meta = document.createElement("div");
  meta.className = "ff-plan-cell-meta";
  const parts = [];
  if (item.pitStatus) {
    parts.push(`PIT: ${item.pitStatus}`);
  }
  if (item.matchedPitPartition && item.matchedPitPartition !== item.partition) {
    parts.push(`Matched: ${item.matchedPitPartition}`);
  }
  meta.textContent = parts.join(" · ");

  cell.append(title, meta);
  return cell;
}

function createRiskCell(item) {
  const cell = document.createElement("td");
  const risk = String(item.risk || "low").toLowerCase();
  const variant = risk === "high" ? "danger" : risk === "medium" ? "warning" : "success";
  const label = risk === "high" ? "Alto" : risk === "medium" ? "Medio" : "Bajo";
  cell.appendChild(createBadge(label, variant));
  return cell;
}

function createIncludeCell(item) {
  const td = document.createElement("td");
  const toggle = document.createElement("label");
  toggle.className = "ff-switch";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(item.include);
  input.disabled = true;
  input.setAttribute("aria-label", `Incluir ${item.image || item.partition || "elemento"}`);

  const track = document.createElement("span");
  track.className = "ff-switch-track";

  toggle.append(input, track);
  td.appendChild(toggle);
  return td;
}

function statusDescription(item) {
  const status = String(item?.status || "unknown").toLowerCase();
  const partition = String(item?.partition || "").toUpperCase();
  const reason = String(item?.reason || "").toLowerCase();
  const image = item?.image || item?.originalName || "Archivo";

  switch (status) {
    case "vital_ready":
      if (partition === "SUPER") {
        return "SUPER es vital para particiones dinámicas del sistema.";
      }
      return "Listo para flasheo.";
    case "optional_ready":
      return "Imagen opcional lista para flasheo.";
    case "ready":
      return "Listo para flasheo.";
    case "large_but_flashable":
      if (partition === "SUPER") {
        return "SUPER es vital para particiones dinámicas del sistema.";
      }
      return "Imagen grande o comprimida; requiere preparación antes del flasheo.";
    case "pit_not_found":
      return "No existe en PIT; se excluye por seguridad.";
    case "duplicate_resolved":
      return partition === "VBMETA"
        ? "VBMETA duplicado; se usará el de AP."
        : "Duplicado resuelto automáticamente.";
    case "metadata_excluded":
      if (item.imageKind === "pit_file") {
        return "Archivo PIT detectado; no es una partición flasheable.";
      }
      if (item.imageKind === "archive_inside_firmware") {
        return "Archivo FOTA detectado; no es una partición flasheable.";
      }
      if (item.imageKind === "auxiliary_file") {
        return "Archivo auxiliar; no es una partición flasheable.";
      }
      return "Metadatos excluidos del plan.";
    case "high_risk_blocked":
      if (partition === "EFUSE") {
        return "EFUSE bloqueado por seguridad.";
      }
      if (partition === "USERDATA") {
        return "USERDATA puede borrar o reinicializar datos del usuario.";
      }
      if (partition === "PRELOADER") {
        return "Preloader bloqueado por seguridad.";
      }
      if (partition === "LK" || partition === "LK_VERIFIED") {
        return "LK bloqueado por seguridad.";
      }
      if (partition === "VBMETA" || partition === "VBMETA_SYSTEM") {
        return "VBMETA bloqueado por seguridad.";
      }
      return "Partición bloqueada por seguridad.";
    case "excluded_by_user_mode":
      if (reason === "home_csc_disabled") {
        return "CSC excluido porque el usuario eligió HOME_CSC.";
      }
      if (reason === "csc_disabled") {
        return "HOME_CSC excluido porque el usuario eligió instalación limpia.";
      }
      return "Excluido por el modo de instalación.";
    case "unmapped":
      return "No existe mapeo sugerido; se excluye por seguridad.";
    default:
      return "Sin motivo adicional.";
  }
}

function buildSummaryText(state) {
  const summary = state.flashPlan.summary;
  const binary = state.flashPlan.binary || state.firmware.binary;
  const mode = summary?.effectiveInstallationMode || state.flashPlan.installationMode || "clean";
  const selectedRegionalPackage = summary?.selectedRegionalPackage || state.flashPlan.selectedRegionalPackage || "—";
  const lines = [];

  if (!summary) {
    return "Sin plan todavía.";
  }

  lines.push("Flash plan generated");
  lines.push(`Installation mode: ${mode === "keep_data" ? "Conservar datos" : "Instalación limpia"} · regional package: ${selectedRegionalPackage}`);
  lines.push("FlashFix never mixes CSC and HOME_CSC.");

  if (binary?.status === "parsed") {
    const firmwareBit = Number.isFinite(binary.firmwareBit) ? binary.firmwareBit : "n/a";
    const deviceBit = Number.isFinite(binary.deviceBit) ? binary.deviceBit : "not checked";
    lines.push(`Binary compatibility: firmware bit ${firmwareBit}, device bit ${deviceBit}`);
  } else {
    lines.push("Binary compatibility: not checked");
  }

  lines.push(`PIT partitions loaded: ${summary.pitPartitionsLoaded || state.pit.partitions.length}`);
  lines.push(`Images analyzed: ${summary.totalImages || 0}`);
  lines.push(`Ready candidates: ${summary.readyCandidates || 0}`);
  lines.push(`Vital ready: ${summary.vitalReady || 0}`);
  lines.push(`Optional ready: ${summary.optionalReady || 0}`);
  lines.push(`Large but flashable: ${summary.largeButFlashable || 0}`);
  lines.push(`Excluded by user mode: ${summary.excludedByUserMode || 0}`);
  lines.push(`Pit not found: ${summary.pitNotFound || 0}`);
  lines.push(`High risk blocked: ${summary.highRiskBlocked || 0}`);
  lines.push(`Metadata excluded: ${summary.metadataExcluded || 0}`);
  lines.push(`Unmapped: ${summary.unmapped || 0}`);
  lines.push(`Warnings: ${summary.warnings || 0}`);

  return lines.join("\n");
}

function buildChecklistItems(state) {
  const summary = state.flashPlan.summary;
  const binary = state.flashPlan.binary || state.firmware.binary;
  const analysis = state.firmware.analysis;
  const foundPackages = Array.isArray(analysis?.foundPackages) ? analysis.foundPackages : [];
  const hasPackage = (name) => foundPackages.some((value) => new RegExp(`^${name}($|[_.-])`, "i").test(basename(value)));
  const hasAp = summary?.hasAp ?? hasPackage("AP");
  const hasBl = summary?.hasBl ?? hasPackage("BL");
  const hasCp = summary?.hasCp ?? hasPackage("CP");
  const hasCsc = summary?.hasCsc ?? hasPackage("CSC");
  const hasHomeCsc = summary?.hasHomeCsc ?? hasPackage("HOME_CSC");
  const hasPit = summary?.hasPIT ?? state.pit.partitions.length > 0;
  const hasSuper = summary?.hasSuper ?? Boolean(analysis?.images?.some((image) => String(image.suggestedPartition || image.partition || "").toUpperCase() === "SUPER"));
  const plannedRegionalPackage = summary?.selectedRegionalPackage
    || state.flashPlan.selectedRegionalPackage
    || (state.flashPlan.installationMode === "keep_data"
      ? (hasHomeCsc ? "HOME_CSC" : hasCsc ? "CSC" : "")
      : (hasCsc ? "CSC" : hasHomeCsc ? "HOME_CSC" : ""));
  const items = [
    {
      label: "Dispositivo detectado",
      note: state.device.connected ? "Conexión activa en Download Mode." : "Detecta el dispositivo antes de flashear.",
      level: state.device.connected ? "success" : "warning",
    },
    {
      label: "Binary / SW REV compatible",
      note: binary?.status === "parsed"
        ? `Firmware bit ${binary.firmwareBit ?? "n/a"} · device bit ${binary.deviceBit ?? "not checked"}`
        : "No verificado todavía.",
      level: binary?.status === "parsed" ? "info" : "muted",
    },
    {
      label: "PIT cargado",
      note: hasPit ? `${summary?.pitPartitionsLoaded || state.pit.partitions.length || 0} particiones` : "PIT no cargado.",
      level: hasPit ? "success" : "warning",
    },
    {
      label: "AP presente",
      note: hasAp ? "Paquete principal detectado." : "Falta AP.",
      level: hasAp ? "success" : "danger",
    },
    {
      label: "BL presente",
      note: hasBl ? "Bootloader detectado." : "Falta BL.",
      level: hasBl ? "success" : "warning",
    },
    {
      label: "CP presente",
      note: hasCp ? "Módem/baseband detectado." : "No se actualizará el módem/baseband.",
      level: hasCp ? "success" : "warning",
    },
    {
      label: "CSC o HOME_CSC seleccionado",
      note: plannedRegionalPackage
        ? `Usando ${plannedRegionalPackage}`
        : "Selecciona tipo de instalación.",
      level: plannedRegionalPackage ? "success" : "warning",
    },
    {
      label: "CSC y HOME_CSC no se mezclan",
      note: plannedRegionalPackage
        ? "Solo un paquete regional se usa en el plan."
        : "Selecciona un modo de instalación para fijar un paquete regional.",
      level: plannedRegionalPackage ? "success" : "warning",
    },
    {
      label: "SUPER detectado y listo",
      note: hasSuper
        ? (summary?.blockingReasons?.some((reason) => String(reason).toLowerCase().includes("super"))
          ? "SUPER detectado, pero aún requiere revisión."
          : "Partición dinámica lista.")
        : "SUPER faltante o no mapeado.",
      level: hasSuper
        ? (summary?.blockingReasons?.some((reason) => String(reason).toLowerCase().includes("super")) ? "warning" : "success")
        : "danger",
    },
    {
      label: "EFUSE bloqueado",
      note: "EFUSE nunca se incluye en el plan automático.",
      level: "success",
    },
    {
      label: "Re-partition desactivado",
      note: "No se activa por defecto.",
      level: "success",
    },
  ];

  return items;
}

function renderChecklist(target, state) {
  if (!target) {
    return;
  }

  target.replaceChildren();

  for (const item of buildChecklistItems(state)) {
    const card = document.createElement("div");
    card.className = `ff-checklist-item is-${item.level}`;

    const marker = document.createElement("div");
    marker.className = "ff-checklist-marker";
    marker.appendChild(createBadge(item.level === "danger" ? "!" : "✓", item.level === "danger" ? "danger" : item.level));

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "ff-checklist-title";
    title.textContent = item.label;

    const note = document.createElement("div");
    note.className = "ff-checklist-note";
    note.textContent = item.note;

    body.append(title, note);
    card.append(marker, body);
    target.appendChild(card);
  }
}

function renderModeSelector({ cleanModeBtn, keepDataModeBtn, modeWarningText }, state) {
  const mode = state.flashPlan.installationMode || "clean";
  const summary = state.flashPlan.summary;
  const selectedRegionalPackage = summary?.selectedRegionalPackage || state.flashPlan.selectedRegionalPackage;
  const hasCsc = Boolean(summary?.hasCsc || state.firmware.analysis?.foundPackages?.some((value) => /^CSC($|[_.-])/i.test(basename(value))));
  const hasHomeCsc = Boolean(summary?.hasHomeCsc || state.firmware.analysis?.foundPackages?.some((value) => /^HOME[_-]?CSC($|[_.-])/i.test(basename(value))));

  cleanModeBtn?.classList.toggle("is-active", mode !== "keep_data");
  keepDataModeBtn?.classList.toggle("is-active", mode === "keep_data");

  if (modeWarningText) {
    if (hasCsc && hasHomeCsc) {
      modeWarningText.textContent = "FlashFix nunca usará CSC y HOME_CSC al mismo tiempo.";
    } else if (hasHomeCsc && !hasCsc && mode !== "keep_data") {
      modeWarningText.textContent = "HOME_CSC es el único paquete regional disponible. El modo limpio puede terminar usando HOME_CSC por seguridad.";
    } else if (hasCsc && !hasHomeCsc && mode === "keep_data") {
      modeWarningText.textContent = "HOME_CSC no está disponible. El modo conservar datos puede terminar usando CSC si construyes el plan.";
    } else if (mode === "keep_data") {
      modeWarningText.textContent = "Conservar datos no está garantizado. Si el firmware, el CSC, el binario o las particiones no coinciden, el dispositivo puede requerir borrado de datos.";
    } else if (selectedRegionalPackage) {
      modeWarningText.textContent = `Paquete regional seleccionado: ${selectedRegionalPackage}.`;
    } else {
      modeWarningText.textContent = "Conservar datos no está garantizado. Si el firmware, el CSC, el binario o las particiones no coinciden, el dispositivo puede requerir borrado de datos.";
    }
  }
}

function reasonCell(item) {
  const cell = document.createElement("td");
  const meta = statusMeta(item);

  const badge = createBadge(meta.label, meta.variant);
  badge.className += " ff-plan-state-badge";

  const text = document.createElement("div");
  text.className = "ff-plan-reason-text";
  text.textContent = statusDescription(item);

  const note = document.createElement("div");
  note.className = "ff-plan-reason-note";
  note.textContent = item.warnings?.length ? item.warnings.join(" · ") : "";

  cell.append(badge, text);
  if (note.textContent) {
    cell.appendChild(note);
  }

  return cell;
}

export function renderFlashPlanPanel({ pathText, hintText, summaryBox, checklistBox, tableBody, warningsBox, cleanModeBtn, keepDataModeBtn, modeWarningText }, state) {
  renderModeSelector({ cleanModeBtn, keepDataModeBtn, modeWarningText }, state);

  pathText.textContent = state.flashPlan.path || "No generado";
  hintText.textContent = state.flashPlan.path
    ? "Plan listo para revisión y flasheo."
    : "Solo se incluyen particiones permitidas, mapeadas y listas.";

  summaryBox.textContent = buildSummaryText(state);
  renderChecklist(checklistBox, state);
  warningsBox.textContent = state.flashPlan.warnings?.length
    ? state.flashPlan.warnings.join("\n")
    : "Sin advertencias.";

  tableBody.replaceChildren();

  if (!state.flashPlan.items.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "py-10 text-center text-flashfix-dim";
    cell.textContent = "No hay elementos de plan todavía.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  const grouped = new Map();
  state.flashPlan.items.forEach((item) => {
    const key = groupKeyForItem(item);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  });

  const groupOrder = ["ready", "large_but_flashable", "high_risk_blocked", "excluded_by_user_mode", "pit_not_found", "duplicate_resolved", "metadata_excluded", "unmapped", "unknown"];

  groupOrder.forEach((key) => {
    const items = grouped.get(key);
    if (!items?.length) {
      return;
    }

    tableBody.appendChild(createGroupRow(groupLabel(key), items.length));

    items.forEach((item) => {
      const row = document.createElement("tr");

      row.append(
        createFileCell(item),
        createPartitionCell(item),
        createRiskCell(item),
        createIncludeCell(item),
        reasonCell(item),
      );

      tableBody.appendChild(row);
    });
  });
}
