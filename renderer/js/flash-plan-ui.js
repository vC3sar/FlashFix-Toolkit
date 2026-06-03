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

export function renderFlashPlanPanel({ pathText, hintText, summaryBox, tableBody, warningsBox }, state) {
  pathText.textContent = state.flashPlan.path || "No generado";
  hintText.textContent = state.flashPlan.path
    ? "Plan listo para revisión y flasheo."
    : "Solo se incluyen particiones permitidas y mapeadas.";

  summaryBox.textContent = state.flashPlan.summary
    ? `${state.flashPlan.summary.totalImages || 0} imágenes · ${state.flashPlan.summary.included || 0} incluidas · ${state.flashPlan.summary.excluded || 0} excluidas · ${state.flashPlan.summary.warnings || 0} advertencias`
    : "Sin plan todavía.";

  warningsBox.textContent = state.flashPlan.warnings?.length
    ? state.flashPlan.warnings.join("\n")
    : "Sin advertencias.";

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

  state.flashPlan.items.forEach((item) => {
    const row = document.createElement("tr");

    row.append(
      createTableCell(item.image || ""),
      createTableCell(item.partition || ""),
      (() => {
        const td = document.createElement("td");
        td.appendChild(riskBadge(item.risk));
        return td;
      })(),
      toggleCell(item.include, item.image || item.partition || "elemento"),
    );

    tableBody.appendChild(row);
  });
}
