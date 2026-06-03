import { createBadge, createTableCell, jsonSafe } from "./components.js";

export function renderFlashPlanPanel({ pathText, hintText, summaryBox, tableBody, warningsBox }, state) {
  pathText.textContent = state.flashPlan.path || "No generado";
  hintText.textContent = state.flashPlan.path
    ? "Plan listo para revisión y flasheo."
    : "Solo se incluyen particiones permitidas y mapeadas.";

  summaryBox.textContent = state.flashPlan.summary
    ? jsonSafe(state.flashPlan.summary)
    : "Sin plan todavía.";

  warningsBox.textContent = state.flashPlan.warnings?.length
    ? state.flashPlan.warnings.join("\n")
    : "Sin advertencias.";

  tableBody.replaceChildren();

  if (!state.flashPlan.items.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "py-10 text-center text-flashfix-dim";
    cell.textContent = "No hay elementos de plan todavía.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  state.flashPlan.items.forEach((item) => {
    const row = document.createElement("tr");
    const includeBadge = createBadge(item.include ? "Incluir" : "Excluir", item.include ? "success" : "muted");
    const riskBadge = createBadge(item.risk || "low", item.risk === "high" ? "danger" : item.risk === "medium" ? "warning" : "muted");

    const includeCell = document.createElement("td");
    includeCell.appendChild(includeBadge);

    const riskCell = document.createElement("td");
    riskCell.appendChild(riskBadge);

    row.append(
      createTableCell(item.image || ""),
      createTableCell(item.partition || ""),
      createTableCell(item.pitStatus || ""),
      riskCell,
      includeCell,
      createTableCell((item.warnings || []).join(" | ")),
    );

    tableBody.appendChild(row);
  });
}
