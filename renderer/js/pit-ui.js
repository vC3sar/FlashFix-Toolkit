import { createBadge, createTableCell, jsonSafe } from "./components.js";

export function renderPitPanel({ pathText, hintText, summaryBox, tableBody }, state) {
  pathText.textContent = state.pit.path || "No seleccionado";
  hintText.textContent = state.pit.path
    ? "PIT listo para construir el plan."
    : "Se puede usar el PIT generado por el backend.";

  summaryBox.textContent = state.pit.partitions.length
    ? `Particiones: ${state.pit.partitions.length}\nArchivo TXT: ${state.pit.txtPath || "n/a"}`
    : "Sin PIT todavía.";

  tableBody.replaceChildren();

  if (!state.pit.partitions.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "py-10 text-center text-flashfix-dim";
    cell.textContent = "No hay particiones cargadas.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  state.pit.partitions.slice(0, 120).forEach((partition) => {
    const row = document.createElement("tr");

    row.append(
      createTableCell(partition.name || ""),
      createTableCell(partition.identifier || ""),
      createTableCell(partition.flashFileName || partition.fileName || ""),
      createTableCell(String(partition.blockCount ?? "")),
      createTableCell(String(partition.blockStart ?? "")),
    );

    tableBody.appendChild(row);
  });
}

export function renderPitRaw(target, pitData) {
  target.textContent = pitData ? jsonSafe(pitData) : "Sin PIT todavía.";
}
