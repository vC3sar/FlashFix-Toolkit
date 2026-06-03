export const appState = {
  core: {
    available: false,
    path: null,
    version: null,
    logsDir: null,
    tempDir: null,
    licensesDir: null,
  },
  device: {
    connected: false,
    info: null,
  },
  firmware: {
    path: null,
    packages: [],
    analysis: null,
    binary: null,
  },
  pit: {
    loaded: false,
    path: null,
    txtPath: null,
    partitions: [],
  },
  flashPlan: {
    path: null,
    items: [],
    warnings: [],
    summary: null,
    resultPath: null,
    binary: null,
  },
  operation: {
    running: false,
    current: null,
    progress: 0,
    message: "",
    step: "",
  },
  logs: {
    entries: [],
    filter: "all",
    query: "",
    clearedAt: 0,
  },
  ui: {
    activeSection: "workspace",
  },
};

export function resetOperationState() {
  appState.operation.running = false;
  appState.operation.current = null;
  appState.operation.progress = 0;
  appState.operation.message = "";
  appState.operation.step = "";
}
