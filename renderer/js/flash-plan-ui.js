import { createBadge, createTableCell } from "./components.js";

function riskBadge(risk) {
  const normalized = String(risk || "low").toLowerCase();
  if (normalized === "high") return createBadge("Alto", "danger");
  if (normalized === "medium") return createBadge("Medio", "warning");
  if (normalized === "info") return createBadge("Info", "info");
  return createBadge("Bajo", "success");
}

function toggleCell(include, label) {
  const td = document.createElement("td");
  const toggle = document.createElement("label");
  toggle.className = "ff-switch";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(include);
  input.disabled = true;
  input.setAttribute("aria-label", `Incluir ${label}`);

  const track = document.createElement("span");
  track.className = "ff-switch-track";

  toggle.append(input, track);
  td.appendChild(toggle);
  return td;
}

function groupKeyForItem(item) {
  const category = String(item?.category || "unknown").toLowerCase();
  if (category === "pit_file") {
    return "auxiliary";
  }
  if (category === "metadata") {
    return "auxiliary";
  }
  return category;
}

function groupLabel(key) {
  switch (key) {
    case "ready":
      return "Ready / Safe candidates";
    case "mapped_but_not_ready":
      return "Mapped but not ready";
    case "high_risk_excluded":
      return "High risk excluded";
    case "unmapped":
      return "Unmapped";
    case "auxiliary":
      return "Auxiliary / metadata";
    default:
      return "Other";
  }
}

function createGroupRow(label, count) {
  const row = document.createElement("tr");
  row.className = "ff-table-group-row";

  const cell = document.createElement("th");
  cell.colSpan = 4;
  cell.className = "ff-table-group-cell";

  const title = document.createElement("div");
  title.className = "ff-table-group-title";
  title.textContent = `${label}`;

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
  const parts = [item.sourcePackage, item.imageKind, item.reason].filter(Boolean);
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
  if (item.decompressionStatus && item.decompressionStatus !== "not_checked") {
    parts.push(`LZ4: ${item.decompressionStatus}`);
  }
  meta.textContent = parts.join(" · ");

  cell.append(title, meta);
  return cell;
}

function buildSummaryText(state) {
  const summary = state.flashPlan.summary;
  const binary = state.flashPlan.binary || state.firmware.binary;
  const lines = [];

  if (summary) {
    lines.push("Flash plan generated");
    if (binary?.status === "parsed") {
      const firmwareBit = Number.isFinite(binary.firmwareBit) ? binary.firmwareBit : "n/a";
      const deviceBit = Number.isFinite(binary.deviceBit) ? binary.deviceBit : "not checked";
      lines.push(`Binary compatibility: firmware bit ${firmwareBit}, device bit ${deviceBit}`);
    } else {
      lines.push("Binary compatibility: not checked");
    }

    lines.push(`PIT partitions loaded: ${summary.pitPartitionsLoaded || state.pit.partitions.length}`);
    lines.push(`Images analyzed: ${summary.totalImages || 0}`);
    lines.push(`Flashable candidates: ${summary.readyCandidates || 0}`);
    lines.push(`Included by default: ${summary.included || 0}`);
    lines.push(`Excluded unmapped: ${summary.unmapped || 0}`);
    lines.push(`Excluded auxiliary: ${(summary.auxiliary || 0) + (summary.metadata || 0) + (summary.pitFiles || 0)}`);
    lines.push(`Excluded compressed/not ready: ${summary.mappedButNotReady || 0}`);
    lines.push(`Excluded high risk: ${summary.highRiskExcluded || 0}`);
    lines.push(`Warnings: ${summary.warnings || 0}`);
    return lines.join("\n");
  }

  return "Sin plan todavía.";
}

function warningTextFromState(state) {
  if (!state.flashPlan.warnings?.length) {
    return "Sin advertencias.";
  }

  return state.flashPlan.warnings.join("\n");
}

export function renderFlashPlanPanel({ pathText, hintText, summaryBox, tableBody, warningsBox }, state) {
  pathText.textContent = state.flashPlan.path || "No generado";
  hintText.textContent = state.flashPlan.path
    ? "Plan listo para revisión y flasheo."
    : "Solo se incluyen particiones permitidas, mapeadas y listas.";

  summaryBox.textContent = buildSummaryText(state);
  warningsBox.textContent = warningTextFromState(state);

  tableBody.replaceChildren();

  if (!state.flashPlan.items.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
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

  const groupOrder = ["ready", "mapped_but_not_ready", "high_risk_excluded", "unmapped", "auxiliary", "unknown"];

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
        (() => {
          const td = document.createElement("td");
          td.appendChild(riskBadge(item.risk));
          return td;
        })(),
        toggleCell(item.include, item.image || item.partition || "elemento"),
      );

      tableBody.appendChild(row);
    });
  });
}
