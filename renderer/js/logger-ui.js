import { createBadge, formatTime, jsonSafe, levelBadgeClass, normalizeLevel } from "./components.js";

function formatLogLine(entry) {
  const parts = [`[${formatTime(entry.timestamp)}]`, `[${entry.level.toUpperCase()}]`];
  if (entry.command) {
    parts.push(`${entry.command} —`);
  }
  parts.push(entry.message);
  return parts.join(" ");
}

function buildTextLog(entries) {
  return entries
    .map((entry) => {
      const line = formatLogLine(entry);
      if (entry.details) {
        return `${line}\n${jsonSafe(entry.details)}`;
      }
      return line;
    })
    .join("\n");
}

export class LoggerUI {
  constructor({
    streamEl,
    countEl,
    summaryEl,
    filterButtons,
    searchInput,
    clearBtn,
    copyVisibleBtn,
    copyAllBtn,
    exportBtn,
  }) {
    this.streamEl = streamEl;
    this.countEl = countEl;
    this.summaryEl = summaryEl;
    this.filterButtons = Array.from(filterButtons);
    this.searchInput = searchInput;
    this.clearBtn = clearBtn;
    this.copyVisibleBtn = copyVisibleBtn;
    this.copyAllBtn = copyAllBtn;
    this.exportBtn = exportBtn;
    this.entries = [];
    this.filter = "all";
    this.query = "";
    this.clearedAt = 0;
    this.currentFileName = "flashfix-log.txt";
    this.bind();
    this.setFilter(this.filter);
  }

  bind() {
    this.filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.setFilter(button.dataset.filter || "all");
      });
    });

    this.searchInput.addEventListener("input", () => {
      this.setQuery(this.searchInput.value);
    });

    this.clearBtn.addEventListener("click", () => this.clearVisible());
    this.copyVisibleBtn.addEventListener("click", () => this.copyVisible());
    this.copyAllBtn.addEventListener("click", () => this.copyAll());
    this.exportBtn.addEventListener("click", () => this.exportVisible());
  }

  setCurrentFileName(fileName) {
    this.currentFileName = fileName || "flashfix-log.txt";
  }

  setFilter(filter) {
    this.filter = filter || "all";
    this.filterButtons.forEach((button) => {
      const active = (button.dataset.filter || "all") === this.filter;
      button.classList.toggle("ff-btn-primary", active);
      button.classList.toggle("ff-btn-ghost", !active);
    });
    this.render();
  }

  setQuery(query) {
    this.query = String(query || "").toLowerCase();
    this.render();
  }

  clearVisible() {
    this.clearedAt = Date.now();
    this.render();
  }

  add(entry) {
    this.entries.push({
      id: crypto.randomUUID(),
      timestamp: entry.timestamp || Date.now(),
      level: normalizeLevel(entry.level),
      command: entry.command || "",
      message: entry.message || "",
      details: entry.details ?? null,
      expandable: Boolean(entry.expandable ?? entry.details),
    });
    this.render();
  }

  addMany(entries) {
    entries.forEach((entry) => this.add(entry));
  }

  getVisibleEntries() {
    return this.entries.filter((entry) => {
      if (entry.timestamp < this.clearedAt) {
        return false;
      }

      if (this.filter !== "all" && entry.level !== this.filter) {
        return false;
      }

      if (!this.query) {
        return true;
      }

      const haystack = [
        entry.command,
        entry.message,
        jsonSafe(entry.details),
      ].join(" ").toLowerCase();

      return haystack.includes(this.query);
    });
  }

  getAllEntries() {
    return this.entries.slice();
  }

  copyVisible() {
    navigator.clipboard.writeText(buildTextLog(this.getVisibleEntries())).catch(() => {});
  }

  copyAll() {
    navigator.clipboard.writeText(buildTextLog(this.getAllEntries())).catch(() => {});
  }

  exportVisible() {
    const blob = new Blob([buildTextLog(this.getVisibleEntries())], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = this.currentFileName.replace(/\.txt$/i, "") + ".txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  render() {
    const entries = this.getVisibleEntries();
    this.countEl.textContent = `${entries.length} visible${this.filter !== "all" ? ` · ${this.filter}` : ""}`;

    if (this.summaryEl) {
      const lastEntry = entries.at(-1);
      const lastMessage = lastEntry ? lastEntry.message : "sin actividad";
      this.summaryEl.textContent = `${entries.length} mensajes · último: ${lastMessage}`;
    }

    this.streamEl.replaceChildren();

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ff-log-empty";
      empty.textContent = "No hay logs visibles con el filtro actual.";
      this.streamEl.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      this.streamEl.appendChild(this.createEntryElement(entry));
    }
  }

  createEntryElement(entry) {
    const wrapper = document.createElement("article");
    wrapper.className = "ff-log-line";

    const meta = document.createElement("div");
    meta.className = "ff-log-meta";

    const time = document.createElement("span");
    time.className = "ff-log-time";
    time.textContent = formatTime(entry.timestamp);

    const level = createBadge(entry.level, levelBadgeClass(entry.level));
    level.className += " ff-log-level";

    meta.append(time, level);

    if (entry.command) {
      const command = document.createElement("span");
      command.className = "ff-log-command";
      command.textContent = entry.command;
      meta.appendChild(command);
    }

    const message = document.createElement("div");
    message.className = "ff-log-message";
    message.textContent = entry.message;

    wrapper.append(meta, message);

      if (entry.expandable && entry.details !== null && entry.details !== undefined) {
        const detailsBtn = document.createElement("button");
        detailsBtn.type = "button";
        detailsBtn.className = "ff-log-details-btn";
        detailsBtn.textContent = "Ver detalles";

      const details = document.createElement("div");
      details.className = "ff-log-details";
      const pre = document.createElement("pre");
      pre.className = "whitespace-pre-wrap";
      pre.textContent = jsonSafe(entry.details);
      details.appendChild(pre);

      detailsBtn.addEventListener("click", () => {
        details.classList.toggle("is-open");
      });

      wrapper.append(detailsBtn, details);
    }

    return wrapper;
  }
}
