let electron;
try {
  electron = require("electron");
} catch (error) {
  console.error(
    "FlashFix Toolkit requiere Electron. Ejecuta la app con `npm start` o `npx electron .`, no con `node main.js`.",
  );
  process.exit(1);
}

if (!electron || !electron.app || !electron.BrowserWindow) {
  console.error(
    "FlashFix Toolkit requiere el runtime de Electron. Ejecuta la app con `npm start` o `npx electron .`, no con `node main.js`.",
  );
  process.exit(1);
}

const { app, BrowserWindow, dialog, ipcMain, shell } = electron;
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { spawn } = require("child_process");

const ALLOWED_COMMANDS = new Set([
  "detect",
  "print-pit",
  "flash",
  "close-pc-screen",
]);
const ALLOWED_PARTITIONS = [
  "BOOT",
  "RECOVERY",
  "SYSTEM",
  "VENDOR",
  "PRODUCT",
  "CACHE",
  "ODM",
  "MODEM",
  "HIDDEN",
];
const SAMSUNG_PACKAGE_SLOTS = ["BL", "AP", "CP", "CSC", "HOME_CSC"];

let mainWindow = null;
let activeOperation = null;
let logsDir = null;

function formatDateForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(
      "-",
    ) +
    "_" +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(
      "-",
    )
  );
}

function formatDateTime(date = new Date()) {
  return date.toISOString();
}

function safeFileStem(value) {
  return String(value)
    .replace(/[^a-z0-9._-]+/gi, "_")
    .replace(/^_+|_+$/g, "");
}

function getAppRootCandidates() {
  const candidates = [
    app.getAppPath(),
    process.resourcesPath,
    app.getPath("userData"),
  ].filter(Boolean);

  return [...new Set(candidates)];
}

function getHeimdallCandidates() {
  const roots = getAppRootCandidates();
  const candidates = [];

  for (const root of roots) {
    candidates.push(path.join(root, "bin", "heimdall.exe"));
    candidates.push(path.join(root, "heimdall.exe"));
  }

  return [...new Set(candidates)];
}

async function resolveHeimdallPath() {
  for (const candidate of getHeimdallCandidates()) {
    try {
      await fsp.access(candidate, fs.constants.F_OK);
      return candidate;
    } catch {
      // Continue scanning common locations.
    }
  }
  return null;
}

async function ensureLogsDir() {
  if (logsDir) {
    return logsDir;
  }

  const candidates = [
    path.join(app.getAppPath(), "logs"),
    path.join(app.getPath("userData"), "logs"),
  ];

  for (const candidate of candidates) {
    try {
      await fsp.mkdir(candidate, { recursive: true });
      logsDir = candidate;
      return logsDir;
    } catch {
      // Try next location.
    }
  }

  throw new Error("No se pudo crear una carpeta de logs escribible.");
}

function writeLogLine(logPath, line) {
  fs.appendFileSync(logPath, `${line}\n`, "utf8");
}

function normalizeCommandLine(command, args) {
  const joinedArgs = args
    .map((arg) => {
      const text = String(arg);
      return /\s/.test(text) ? `"${text}"` : text;
    })
    .join(" ");
  return joinedArgs
    ? `heimdall ${command} ${joinedArgs}`
    : `heimdall ${command}`;
}

function classifyHeimdallOutput(command, stdout, stderr, exitCode) {
  const output = `${stdout}\n${stderr}`.toLowerCase();

  if (/permission denied|access denied|driver|usb|libusb/i.test(output)) {
    return {
      deviceState: "driver_issue",
      message: "Posible problema de driver, permisos o acceso USB.",
    };
  }

  if (
    /no device detected|failed to detect|could not detect|device not detected/i.test(
      output,
    )
  ) {
    return {
      deviceState: "not_detected",
      message: "Heimdall no detectó un dispositivo en Download Mode.",
    };
  }

  if (/device detected|session begun|connected/i.test(output)) {
    return {
      deviceState: "detected",
      message:
        command === "print-pit"
          ? "Dispositivo detectado y PIT leído correctamente."
          : "Dispositivo detectado correctamente.",
    };
  }

  if (exitCode === 0) {
    return {
      deviceState: command === "print-pit" ? "detected" : "unknown",
      message:
        command === "print-pit"
          ? "PIT leído correctamente."
          : "Operación completada correctamente.",
    };
  }

  return {
    deviceState: "error",
    message: "Heimdall devolvió un error no clasificado.",
  };
}

function sendOperationEvent(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function collectStreamLines(stream, level, appendLine, forwardLine) {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const parts = buffer.split(/\r?\n/);
    buffer = parts.pop() ?? "";

    for (const line of parts) {
      if (line.length === 0) {
        continue;
      }
      appendLine(level, line);
      forwardLine(level, line);
    }
  });

  stream.on("close", () => {
    const finalLine = buffer.trim();
    if (finalLine.length > 0) {
      appendLine(level, finalLine);
      forwardLine(level, finalLine);
    }
  });
}

async function runHeimdallOperation(command, args, options = {}) {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Comando no permitido: ${command}`);
  }

  if (activeOperation) {
    throw new Error("Ya hay una operación de Heimdall en curso.");
  }

  const heimdallPath = await resolveHeimdallPath();
  if (!heimdallPath) {
    throw new Error("Heimdall no encontrado. Coloca heimdall.exe en /bin.");
  }

  await ensureLogsDir();

  const operationId = `${command}-${Date.now()}`;
  const logFileName = `${formatDateForFile()}_${safeFileStem(command)}_${operationId}.log`;
  const logPath = path.join(logsDir, logFileName);
  const startedAt = new Date();
  const commandLine = normalizeCommandLine(command, args);

  activeOperation = {
    id: operationId,
    command,
    logPath,
  };

  writeLogLine(logPath, `Timestamp: ${formatDateTime(startedAt)}`);
  writeLogLine(logPath, `Command: ${commandLine}`);
  writeLogLine(logPath, "--- stdout / stderr ---");
  sendOperationEvent("heimdall:operation-start", {
    operationId,
    command,
    logPath,
    commandLine,
  });

  const stdoutLines = [];
  const stderrLines = [];

  const child = spawn(heimdallPath, [command, ...args], {
    windowsHide: true,
    shell: false,
  });

  const forwardLine = (level, line) => {
    const payload = {
      operationId,
      level,
      line,
      timestamp: formatDateTime(),
    };
    sendOperationEvent("heimdall:log", payload);
  };

  const appendLine = (level, line) => {
    const stamped = `[${formatDateTime()}] [${level}] ${line}`;
    writeLogLine(logPath, stamped);
    if (level === "stdout") {
      stdoutLines.push(line);
    } else {
      stderrLines.push(line);
    }
  };

  collectStreamLines(child.stdout, "stdout", appendLine, forwardLine);
  collectStreamLines(child.stderr, "stderr", appendLine, forwardLine);

  try {
    const exitInfo = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => {
        resolve({ code, signal });
      });
    });

    const stdout = stdoutLines.join("\n").trim();
    const stderr = stderrLines.join("\n").trim();
    const classification = classifyHeimdallOutput(
      command,
      stdout,
      stderr,
      exitInfo.code,
    );

    writeLogLine(logPath, `Exit code: ${exitInfo.code}`);
    if (exitInfo.signal) {
      writeLogLine(logPath, `Signal: ${exitInfo.signal}`);
    }
    writeLogLine(logPath, `Result: ${classification.message}`);

    if (command === "print-pit") {
      const pitSnapshotPath = path.join(
        logsDir,
        `${formatDateForFile()}_pit_${operationId}.txt`,
      );
      const pitContent = [
        `Timestamp: ${formatDateTime(startedAt)}`,
        `Command: ${commandLine}`,
        "",
        "--- stdout ---",
        stdout || "[empty]",
        "",
        "--- stderr ---",
        stderr || "[empty]",
        "",
        `Exit code: ${exitInfo.code}`,
      ].join("\n");
      fs.writeFileSync(pitSnapshotPath, pitContent, "utf8");
    }

    const result = {
      success: exitInfo.code === 0,
      command,
      commandLine,
      exitCode: exitInfo.code,
      signal: exitInfo.signal ?? null,
      stdout,
      stderr,
      logPath,
      deviceState: classification.deviceState,
      message: classification.message,
    };

    sendOperationEvent("heimdall:operation-end", {
      operationId,
      command,
      logPath,
      result,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeLogLine(logPath, `Error: ${message}`);
    sendOperationEvent("heimdall:operation-end", {
      operationId,
      command,
      logPath,
      result: {
        success: false,
        command,
        commandLine,
        exitCode: -1,
        signal: null,
        stdout: "",
        stderr: message,
        logPath,
        deviceState: "error",
        message,
      },
    });
    throw error;
  } finally {
    activeOperation = null;
  }
}

async function readFileInfo(filePath, options = {}) {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new Error("Ruta de archivo inválida.");
  }

  const normalizedPath = path.resolve(filePath);
  const stat = await fsp.stat(normalizedPath);
  if (!stat.isFile()) {
    throw new Error("La ruta seleccionada no apunta a un archivo.");
  }
  if (stat.size <= 0) {
    throw new Error("El archivo está vacío.");
  }

  const basename = path.basename(normalizedPath);
  const lower = basename.toLowerCase();
  const acceptedExtensions = options.acceptedExtensions ?? [];
  const isAccepted =
    acceptedExtensions.length === 0 ||
    acceptedExtensions.some((ext) => lower.endsWith(ext));

  if (!isAccepted) {
    throw new Error(`Extensión no permitida para ${basename}.`);
  }

  return {
    path: normalizedPath,
    name: basename,
    size: stat.size,
  };
}

async function selectFileDialog({ title, extensions }) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    properties: ["openFile"],
    filters: [
      {
        name: title,
        extensions,
      },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

async function validateSamsungPackage(filePath) {
  const info = await readFileInfo(filePath, {
    acceptedExtensions: [".tar", ".md5", ".tar.md5", ".img"],
  });
  return info;
}

async function validateExpertImage(filePath) {
  const info = await readFileInfo(filePath, {
    acceptedExtensions: [".img"],
  });
  return info;
}

function buildFlashArgs(entries) {
  const args = ["flash"];
  for (const entry of entries) {
    args.push(`--${entry.partition}`);
    args.push(entry.filePath);
  }
  return args;
}

async function flashExpertEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("No hay particiones para flashear.");
  }

  const normalizedEntries = [];
  const seenPartitions = new Set();

  for (const entry of entries) {
    const partition = String(entry.partition || "")
      .toUpperCase()
      .trim();
    if (!ALLOWED_PARTITIONS.includes(partition)) {
      throw new Error(`Partición no permitida: ${partition || "[vacía]"}`);
    }
    if (seenPartitions.has(partition)) {
      throw new Error(`La partición ${partition} está duplicada.`);
    }
    seenPartitions.add(partition);

    const fileInfo = await validateExpertImage(entry.filePath);
    normalizedEntries.push({
      partition,
      filePath: fileInfo.path,
      fileName: fileInfo.name,
      size: fileInfo.size,
    });
  }

  const args = buildFlashArgs(normalizedEntries);
  return runHeimdallOperation("flash", args);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#111317",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.setName("FlashFix Toolkit");

app.whenReady().then(async () => {
  await ensureLogsDir();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("app:getStatus", async () => {
  const heimdallPath = await resolveHeimdallPath();
  return {
    appName: "FlashFix Toolkit",
    shortName: "FlashFix",
    longName: "Uncomplicated FlashFix Toolkit",
    heimdallFound: Boolean(heimdallPath),
    heimdallPath,
    logsDir: await ensureLogsDir(),
    allowedPartitions: ALLOWED_PARTITIONS,
    allowedCommands: [...ALLOWED_COMMANDS],
  };
});

ipcMain.handle("app:openLogsFolder", async () => {
  const folder = await ensureLogsDir();
  await shell.openPath(folder);
  return { ok: true, folder };
});

ipcMain.handle("file:selectSamsungPackage", async (_event, slot) => {
  if (!SAMSUNG_PACKAGE_SLOTS.includes(slot)) {
    throw new Error(`Slot no permitido: ${slot}`);
  }

  const filePath = await selectFileDialog({
    title: `Seleccionar ${slot}`,
    extensions: ["tar", "md5", "img"],
  });

  if (!filePath) {
    return null;
  }

  const info = await validateSamsungPackage(filePath);
  return {
    slot,
    ...info,
  };
});

ipcMain.handle("file:selectExpertImage", async (_event, partition) => {
  const normalizedPartition = String(partition || "")
    .toUpperCase()
    .trim();
  if (!ALLOWED_PARTITIONS.includes(normalizedPartition)) {
    throw new Error(`Partición no permitida: ${partition}`);
  }

  const filePath = await selectFileDialog({
    title: `Seleccionar imagen para ${normalizedPartition}`,
    extensions: ["img"],
  });

  if (!filePath) {
    return null;
  }

  const info = await validateExpertImage(filePath);
  return {
    partition: normalizedPartition,
    ...info,
  };
});

ipcMain.handle("heimdall:detect", async () => {
  return runHeimdallOperation("detect", []);
});

ipcMain.handle("heimdall:printPit", async () => {
  return runHeimdallOperation("print-pit", []);
});

ipcMain.handle("heimdall:flashExpert", async (_event, entries) => {
  return flashExpertEntries(entries);
});

ipcMain.handle("heimdall:reboot", async () => {
  return runHeimdallOperation("close-pc-screen", []);
});
