export function byId(id) {
  return document.getElementById(id);
}

export function formatTime(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDateTime(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  return date.toLocaleString();
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "n/a";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function basename(value) {
  if (!value) {
    return "";
  }
  return String(value).replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";
}

export function ellipsizePath(value, maxLength = 64) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }

  const file = basename(text);
  if (file.length >= maxLength - 6) {
    return `...${file.slice(-(maxLength - 3))}`;
  }

  return `${text.slice(0, Math.max(12, maxLength - file.length - 5))}...${text.slice(-file.length - 1)}`;
}

export function jsonSafe(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function escapeText(value) {
  return String(value ?? "");
}

export function normalizeLevel(level, fallback = "info") {
  const raw = String(level || fallback).toLowerCase();
  if (["success", "ok", "done"].includes(raw)) return "success";
  if (["warning", "warn"].includes(raw)) return "warning";
  if (["danger", "error", "stderr", "fatal"].includes(raw)) return "error";
  if (["debug", "trace", "muted"].includes(raw)) return "debug";
  if (["running", "progress", "active"].includes(raw)) return "running";
  if (["info", "system", "stdout", "result"].includes(raw)) return "info";
  return fallback;
}

export function levelBadgeClass(level) {
  switch (normalizeLevel(level)) {
    case "success":
      return "ff-badge--success";
    case "warning":
      return "ff-badge--warning";
    case "error":
      return "ff-badge--danger";
    case "debug":
      return "ff-badge--muted";
    case "running":
      return "ff-badge--running";
    case "info":
    default:
      return "ff-badge--info";
  }
}

export function createBadge(text, variant = "muted") {
  const badge = document.createElement("span");
  badge.className = `ff-badge ${variant.startsWith("ff-badge--") ? variant : `ff-badge--${variant}`}`;
  badge.textContent = text;
  return badge;
}

export function createCard(title, label, value, note = "") {
  const card = document.createElement("article");
  card.className = "ff-card";

  const labelEl = document.createElement("div");
  labelEl.className = "ff-card-label";
  labelEl.textContent = label;

  const titleEl = document.createElement("div");
  titleEl.className = "ff-card-title";
  titleEl.textContent = title;

  const valueEl = document.createElement("div");
  valueEl.className = "ff-card-value";
  valueEl.textContent = value;

  card.append(labelEl, titleEl, valueEl);

  if (note) {
    const noteEl = document.createElement("div");
    noteEl.className = "ff-card-note";
    noteEl.textContent = note;
    card.appendChild(noteEl);
  }

  return card;
}

export function createTableCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

export function createDetailsBlock(summaryText, jsonText) {
  const details = document.createElement("details");
  details.className = "ff-details";

  const summary = document.createElement("summary");
  summary.textContent = summaryText;

  const pre = document.createElement("pre");
  pre.className = "ff-pre mt-3 max-h-72";
  pre.textContent = jsonText;

  details.append(summary, pre);
  return details;
}
