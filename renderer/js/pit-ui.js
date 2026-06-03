import { createBadge, createTableCell, ellipsizePath, jsonSafe } from "./components.js";

function deriveRisk(partition) {
  const name = String(partition?.name || "").toUpperCase();
  if (partition?.matched === false || partition?.Matched === false) {
    return { label: "Revisar", variant: "warning" };
  }

  if (name === "CSC") {
    return { label: "Borra datos", variant: "warning" };
  }

  if (name === "HOME_CSC") {
    return { label: "Conservar datos", variant: "info" };
  }

  if (!partition?.flashFileName && !partition?.FlashFileName) {
    return { label: "Sin asignar", variant: "muted" };
  }

  return { label: "Normal", variant: "success" };
}

export function renderPitPanel({ pathText, hintText, summaryBox, tableBody }, state) {
  pathText.textContent = state.pit.path || "No seleccionado";
  hintText.textContent = state.pit.path
    ? "PIT listo para construir el plan."
    : "Se puede usar el PIT generado por el backend.";

  summaryBox.textContent = state.pit.partitions.length
    ? `${state.pit.partitions.length} particiones detectadas`
    : "Sin PIT todavía.";

  tableBody.replaceChildren();

  if (!state.pit.partitions.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "py-10 text-center text-flashfix-dim";
    cell.textContent = "No hay particiones cargadas.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  state.pit.partitions.slice(0, 120).forEach((partition) => {
    const row = document.createElement("tr");
    const risk = deriveRisk(partition);
    const flashFile = partition.flashFileName || partition.FlashFileName || partition.fileName || partition.FileName || "";

    row.append(
      createTableCell(partition.name || partition.Name || ""),
      createTableCell(ellipsizePath(flashFile, 44)),
      (() => {
        const td = document.createElement("td");
        td.appendChild(createBadge(risk.label, risk.variant));
        return td;
      })(),
    );

    tableBody.appendChild(row);
  });
}

export function renderPitRaw(target, pitData) {
  target.textContent = pitData ? jsonSafe(pitData) : "Sin PIT todavía.";
}
