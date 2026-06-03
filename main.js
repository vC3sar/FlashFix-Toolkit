let electron;

try {
  electron = require("electron");
} catch {
  console.error(
    "FlashFix Toolkit requiere Electron. Ejecuta la app con `npm start` o `npx electron .`.",
  );
  process.exit(1);
}

if (!electron?.app || !electron?.BrowserWindow) {
  console.error(
    "FlashFix Toolkit requiere el runtime de Electron. Ejecuta la app con `npm start` o `npx electron .`.",
  );
  process.exit(1);
}

const { app, BrowserWindow, dialog, ipcMain, shell } = electron;
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const readline = require("readline");
const { spawn } = require("child_process");

const ALLOWED_COMMANDS = new Set([
  "detect",
  "device-info",
  "read-pit",
  "analyze-firmware",
  "build-plan",
  "flash-plan",
  "clean-temp",
]);

let mainWindow = null;
let activeOperation = null;
let logsDir = null;
let tempDir = null;

function nowStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function isoStamp(date = new Date()) {
  return date.toISOString();
}

function safeFileStem(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function workspaceRoot() {
  return __dirname;
}

function getLogsDirCandidate() {
  return path.join(workspaceRoot(), "logs");
}

function getTempDirCandidate() {
  return path.join(workspaceRoot(), "temp");
}

function getCoreCandidates() {
  const root = workspaceRoot();
  return unique([
    path.join(root, "engines", "FlashFix.Core.exe"),
    path.join(root, "core", "FlashFix.Core", "bin", "Release", "net8.0-windows", "FlashFix.Core.exe"),
    path.join(root, "core", "FlashFix.Core", "bin", "Debug", "net8.0-windows", "FlashFix.Core.exe"),
    path.join(root, "core", "FlashFix.Core", "bin", "Release", "net8.0-windows", "publish", "FlashFix.Core.exe"),
    path.join(root, "core", "FlashFix.Core", "bin", "Debug", "net8.0-windows", "publish", "FlashFix.Core.exe"),
    path.join(root, "core", "FlashFix.Core", "bin", "Release", "net48", "FlashFix.Core.exe"),
    path.join(root, "core", "FlashFix.Core", "bin", "Debug", "net48", "FlashFix.Core.exe"),
  ]);
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
  return dirPath;
}

async function ensureLogsDir() {
  if (!logsDir) {
    logsDir = await ensureDir(getLogsDirCandidate());
  }
  return logsDir;
}

async function ensureTempDir() {
  if (!tempDir) {
    tempDir = await ensureDir(getTempDirCandidate());
  }
  return tempDir;
}

function writeOperationLog(logPath, line) {
  fs.appendFileSync(logPath, `${line}\n`, "utf8");
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function resolveCorePath() {
  for (const candidate of getCoreCandidates()) {
    try {
      await fsp.access(candidate, fs.constants.F_OK);
      return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

async function showDirectoryPicker(options = {}) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || "Seleccionar carpeta",
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

async function showFilePicker(options = {}) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || "Seleccionar archivo",
    properties: ["openFile"],
    filters: options.filters || [],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

async function runCoreCommand(command, args = []) {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Comando no permitido: ${command}`);
  }

  if (activeOperation) {
    throw new Error("Ya hay una operación en curso.");
  }

  const corePath = await resolveCorePath();
  if (!corePath) {
    throw new Error("FlashFix.Core.exe no encontrado. Coloca el binario en /engines.");
  }

  await ensureLogsDir();
  const operationId = `${safeFileStem(command)}-${Date.now()}`;
  const logPath = path.join(logsDir, `${nowStamp()}_${safeFileStem(command)}_${operationId}.log`);
  const commandLine = [path.basename(corePath), command, ...args.map(String)].join(" ");

  activeOperation = { operationId, command, logPath };

  writeOperationLog(logPath, `Timestamp: ${isoStamp()}`);
  writeOperationLog(logPath, `Command: ${commandLine}`);

  send("core:operation-start", {
    operationId,
    command,
    commandLine,
    logPath,
    corePath,
  });

  const env = {
    ...process.env,
    FLASHFIX_LOGS_DIR: logsDir,
    FLASHFIX_TEMP_DIR: await ensureTempDir(),
    FLASHFIX_WORKSPACE: workspaceRoot(),
  };

  const child = spawn(corePath, [command, ...args], {
    cwd: path.dirname(corePath),
    windowsHide: true,
    shell: false,
    env,
  });

  let parsedResult = null;
  const stdoutReader = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  const stderrReader = readline.createInterface({ input: child.stderr, crlfDelay: Infinity });

  stdoutReader.on("line", (line) => {
    writeOperationLog(logPath, `[stdout] ${line}`);
    const parsed = parseJsonLine(line);
    if (parsed) {
      if (parsed.type === "progress") {
        send("core:progress", { operationId, ...parsed });
      } else if (parsed.type === "log") {
        send("core:log", { operationId, ...parsed });
      } else if (parsed.type === "result" || parsed.type === "error") {
        parsedResult = parsed;
        send(parsed.type === "result" ? "core:result" : "core:error", {
          operationId,
          ...parsed,
        });
      } else {
        send("core:raw", { operationId, line, parsed });
      }
    } else {
      send("core:raw", { operationId, line });
    }
  });

  stderrReader.on("line", (line) => {
    writeOperationLog(logPath, `[stderr] ${line}`);
    send("core:stderr", { operationId, line });
  });

  try {
    const exitInfo = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    });

    stdoutReader.close();
    stderrReader.close();

    if (!parsedResult) {
      parsedResult = exitInfo.code === 0
        ? {
            ok: true,
            type: "result",
            command,
            message: "Comando completado.",
            data: {},
          }
        : {
            ok: false,
            type: "error",
            command,
            message: "El proceso terminó con error.",
            code: "EXIT_NONZERO",
          };
    }

    const finalResult = {
      ...parsedResult,
      operationId,
      logPath,
      exitCode: exitInfo.code,
      signal: exitInfo.signal ?? null,
      corePath,
    };

    writeOperationLog(logPath, `Exit code: ${exitInfo.code}`);
    if (exitInfo.signal) {
      writeOperationLog(logPath, `Signal: ${exitInfo.signal}`);
    }
    writeOperationLog(logPath, `Result: ${JSON.stringify(finalResult)}`);

    send("core:operation-end", finalResult);
    return finalResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finalResult = {
      ok: false,
      type: "error",
      command,
      message,
      code: "SPAWN_ERROR",
      operationId,
      logPath,
      corePath,
      exitCode: -1,
      signal: null,
    };

    writeOperationLog(logPath, `Error: ${message}`);
    send("core:operation-end", finalResult);
    throw new Error(message);
  } finally {
    activeOperation = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 920,
    minWidth: 1180,
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
  await ensureTempDir();
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
  const corePath = await resolveCorePath();
  return {
    appName: "FlashFix Toolkit",
    shortName: "FlashFix",
    longName: "Uncomplicated FlashFix Toolkit",
    coreFound: Boolean(corePath),
    corePath,
    logsDir: await ensureLogsDir(),
    tempDir: await ensureTempDir(),
    allowedCommands: [...ALLOWED_COMMANDS],
  };
});

ipcMain.handle("app:openLogsFolder", async () => {
  const folder = await ensureLogsDir();
  await shell.openPath(folder);
  return { ok: true, folder };
});

ipcMain.handle("app:selectFirmwareFolder", async () => {
  return showDirectoryPicker({ title: "Seleccionar carpeta de firmware" });
});

ipcMain.handle("app:selectJsonFile", async (_event, title) => {
  return showFilePicker({
    title: title || "Seleccionar archivo JSON",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
});

ipcMain.handle("app:selectAnyFile", async (_event, title) => {
  return showFilePicker({
    title: title || "Seleccionar archivo",
    filters: [],
  });
});

ipcMain.handle("core:detect", async () => runCoreCommand("detect"));
ipcMain.handle("core:deviceInfo", async () => runCoreCommand("device-info"));
ipcMain.handle("core:readPit", async () => runCoreCommand("read-pit"));
ipcMain.handle("core:analyzeFirmware", async (_event, firmwarePath) => {
  return runCoreCommand("analyze-firmware", [firmwarePath]);
});
ipcMain.handle("core:buildPlan", async (_event, firmwarePath, pitJsonPath) => {
  return runCoreCommand("build-plan", [firmwarePath, pitJsonPath]);
});
ipcMain.handle("core:flashPlan", async (_event, planJsonPath) => {
  return runCoreCommand("flash-plan", [planJsonPath]);
});
ipcMain.handle("core:cleanTemp", async () => runCoreCommand("clean-temp"));
