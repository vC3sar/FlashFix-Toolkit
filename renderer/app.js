const packageSlots = ['BL', 'AP', 'CP', 'CSC', 'HOME_CSC'];

const state = {
  heimdallFound: false,
  heimdallPath: '',
  logsDir: '',
  allowedPartitions: [],
  deviceState: 'unknown',
  deviceDetail: 'Sin validar',
  busy: false,
  samsungPackages: {},
  expertRows: [
    {
      id: crypto.randomUUID(),
      partition: 'BOOT',
      file: null
    }
  ]
};

const els = {
  heimdallBadge: document.getElementById('heimdallBadge'),
  deviceBadge: document.getElementById('deviceBadge'),
  heimdallStatusText: document.getElementById('heimdallStatusText'),
  heimdallPathText: document.getElementById('heimdallPathText'),
  deviceStatusText: document.getElementById('deviceStatusText'),
  deviceDetailText: document.getElementById('deviceDetailText'),
  logsStatusText: document.getElementById('logsStatusText'),
  logsPathText: document.getElementById('logsPathText'),
  packageList: document.getElementById('packageList'),
  expertRows: document.getElementById('expertRows'),
  logStream: document.getElementById('logStream'),
  detectBtn: document.getElementById('detectBtn'),
  pitBtn: document.getElementById('pitBtn'),
  rebootBtn: document.getElementById('rebootBtn'),
  flashBtn: document.getElementById('flashBtn'),
  addRowBtn: document.getElementById('addRowBtn'),
  openLogsBtn: document.getElementById('openLogsBtn'),
  clearLogsBtn: document.getElementById('clearLogsBtn')
};

function labelDeviceState(deviceState) {
  switch (deviceState) {
    case 'detected':
      return 'Detectado';
    case 'not_detected':
      return 'No detectado';
    case 'driver_issue':
      return 'Driver o permisos';
    case 'error':
      return 'Error';
    default:
      return 'Desconocido';
  }
}

function bytesToHuman(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const value = unitIndex === 0 ? size : size.toFixed(1);
  return `${value} ${units[unitIndex]}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setDeviceState(deviceState, detail) {
  state.deviceState = deviceState;
  state.deviceDetail = detail;
  renderStatus();
}

function setBusy(value) {
  state.busy = value;
  renderStatus();
}

function updateButtonState() {
  const disableMainActions = state.busy || !state.heimdallFound;
  els.detectBtn.disabled = disableMainActions;
  els.pitBtn.disabled = disableMainActions;
  els.rebootBtn.disabled = disableMainActions;
  els.flashBtn.disabled = state.busy || !state.heimdallFound || !canFlashExpert();
  els.addRowBtn.disabled = state.busy;
  els.openLogsBtn.disabled = false;
  els.clearLogsBtn.disabled = false;
}

function renderStatus() {
  const heimdallStateLabel = state.heimdallFound ? 'Heimdall encontrado' : 'Heimdall no encontrado';
  els.heimdallBadge.textContent = state.heimdallFound ? 'Heimdall: listo' : 'Heimdall: faltante';
  els.deviceBadge.textContent = `Dispositivo: ${labelDeviceState(state.deviceState)}`;
  els.heimdallStatusText.textContent = heimdallStateLabel;
  els.heimdallPathText.textContent = state.heimdallPath || 'bin/heimdall.exe no localizado';
  els.deviceStatusText.textContent = labelDeviceState(state.deviceState);
  els.deviceDetailText.textContent = state.deviceDetail;
  els.logsStatusText.textContent = state.logsDir ? 'Disponible' : 'Pendiente';
  els.logsPathText.textContent = state.logsDir || 'logs/';
  updateButtonState();
}

function appendLog(level, message, timestamp = new Date().toISOString()) {
  const line = document.createElement('div');
  line.className = `log-line log-${level}`;
  line.innerHTML = `<span class="log-time">${escapeHtml(timestamp)}</span><span class="log-level">${escapeHtml(level)}</span><span class="log-message">${escapeHtml(message)}</span>`;
  els.logStream.appendChild(line);
  els.logStream.scrollTop = els.logStream.scrollHeight;
}

function clearLogView() {
  els.logStream.innerHTML = '';
}

function canFlashExpert() {
  return state.expertRows.length > 0 && state.expertRows.every((row) => {
    return ALLOWED_PARTITIONS.has(row.partition) && row.file && row.file.path;
  });
}

const ALLOWED_PARTITIONS = new Set([
  'BOOT',
  'RECOVERY',
  'SYSTEM',
  'VENDOR',
  'PRODUCT',
  'CACHE',
  'ODM',
  'MODEM',
  'HIDDEN'
]);

function renderSamsungPackages() {
  els.packageList.innerHTML = '';

  for (const slot of packageSlots) {
    const item = document.createElement('div');
    item.className = 'package-item';

    const file = state.samsungPackages[slot];
    const details = file
      ? `${file.name} · ${bytesToHuman(file.size)}`
      : 'Sin archivo';

    item.innerHTML = `
      <div class="package-meta">
        <span class="package-slot">${slot}</span>
        <strong>${details}</strong>
        <small>${file ? escapeHtml(file.path) : 'Selecciona un archivo para validar'} </small>
      </div>
      <div class="package-actions">
        <button data-slot="${slot}" class="secondary select-package-btn">Seleccionar</button>
      </div>
    `;

    els.packageList.appendChild(item);
  }

  els.packageList.querySelectorAll('.select-package-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const slot = button.getAttribute('data-slot');
      button.disabled = true;
      try {
        const selection = await window.flashfix.selectSamsungPackage(slot);
        if (selection) {
          state.samsungPackages[slot] = selection;
          appendLog('system', `Archivo validado para ${slot}: ${selection.name}`);
          renderSamsungPackages();
        }
      } catch (error) {
        appendLog('stderr', error.message || String(error));
      } finally {
        button.disabled = false;
      }
    });
  });
}

function renderExpertRows() {
  els.expertRows.innerHTML = '';

  for (const row of state.expertRows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'expert-row';

    const fileSummary = row.file
      ? `${row.file.name} · ${bytesToHuman(row.file.size)}`
      : 'Sin archivo';

    rowEl.innerHTML = `
      <select data-id="${row.id}" class="partition-select">
        ${Array.from(ALLOWED_PARTITIONS).map((partition) => {
          const selected = partition === row.partition ? 'selected' : '';
          return `<option value="${partition}" ${selected}>${partition}</option>`;
        }).join('')}
      </select>
      <div class="file-summary">
        <strong>${fileSummary}</strong>
        <small>${row.file ? escapeHtml(row.file.path) : 'Selecciona una imagen .img'}</small>
      </div>
      <div class="row-actions">
        <button data-id="${row.id}" class="secondary select-expert-btn">Seleccionar .img</button>
        <button data-id="${row.id}" class="secondary remove-expert-btn">Quitar</button>
      </div>
    `;

    els.expertRows.appendChild(rowEl);
  }

  els.expertRows.querySelectorAll('.partition-select').forEach((select) => {
    select.addEventListener('change', (event) => {
      const row = state.expertRows.find((item) => item.id === select.getAttribute('data-id'));
      if (!row) {
        return;
      }
      row.partition = event.target.value;
      renderExpertRows();
    });
  });

  els.expertRows.querySelectorAll('.select-expert-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-id');
      const row = state.expertRows.find((item) => item.id === id);
      if (!row) {
        return;
      }
      button.disabled = true;
      try {
        const selection = await window.flashfix.selectExpertImage(row.partition);
        if (selection) {
          row.file = selection;
          appendLog('system', `Imagen validada para ${row.partition}: ${selection.name}`);
          renderExpertRows();
        }
      } catch (error) {
        appendLog('stderr', error.message || String(error));
      } finally {
        button.disabled = false;
      }
    });
  });

  els.expertRows.querySelectorAll('.remove-expert-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-id');
      state.expertRows = state.expertRows.filter((item) => item.id !== id);
      if (state.expertRows.length === 0) {
        state.expertRows.push({
          id: crypto.randomUUID(),
          partition: 'BOOT',
          file: null
        });
      }
      renderExpertRows();
    });
  });

  updateButtonState();
}

async function refreshStatus() {
  const status = await window.flashfix.getStatus();
  state.heimdallFound = status.heimdallFound;
  state.heimdallPath = status.heimdallPath || '';
  state.logsDir = status.logsDir || '';
  state.allowedPartitions = status.allowedPartitions || [];
  renderStatus();
  renderSamsungPackages();
  renderExpertRows();
}

async function handleDetect() {
  setBusy(true);
  appendLog('system', 'Ejecutando detect...');
  try {
    const result = await window.flashfix.detectDevice();
    appendLog(result.success ? 'stdout' : 'stderr', result.message || 'Resultado recibido.');
    setDeviceState(result.deviceState || 'unknown', result.message || 'Sin detalle adicional.');
  } catch (error) {
    appendLog('stderr', error.message || String(error));
    setDeviceState('error', error.message || 'Error desconocido.');
  } finally {
    setBusy(false);
  }
}

async function handlePrintPit() {
  setBusy(true);
  appendLog('system', 'Ejecutando print-pit...');
  try {
    const result = await window.flashfix.printPit();
    appendLog(result.success ? 'stdout' : 'stderr', result.message || 'PIT procesado.');
    if (result.logPath) {
      appendLog('system', `Log guardado en ${result.logPath}`);
    }
    setDeviceState(result.deviceState || 'unknown', result.message || 'PIT completado.');
  } catch (error) {
    appendLog('stderr', error.message || String(error));
    setDeviceState('error', error.message || 'Error desconocido.');
  } finally {
    setBusy(false);
  }
}

async function handleReboot() {
  const confirmed = window.confirm(
    'Se enviará el comando de cierre/reinicio compatible con Heimdall.\n\n' +
    'Usa esto solo si el dispositivo está en Download Mode y entiendes que la respuesta puede variar según la versión de Heimdall.'
  );
  if (!confirmed) {
    return;
  }

  setBusy(true);
  appendLog('system', 'Ejecutando reinicio/cierre...');
  try {
    const result = await window.flashfix.rebootDevice();
    appendLog(result.success ? 'stdout' : 'stderr', result.message || 'Comando enviado.');
  } catch (error) {
    appendLog('stderr', error.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function handleFlashExpert() {
  if (!canFlashExpert()) {
    appendLog('stderr', 'Selecciona particiones válidas y archivos .img antes de flashear.');
    return;
  }

  const confirmed = window.confirm(
    'Vas a flashear particiones controladas con Heimdall.\n\n' +
    'Confirma que el firmware es correcto para el modelo exacto del dispositivo.\n' +
    'Este flujo no convierte automáticamente BL/AP/CP/CSC como Odin.'
  );
  if (!confirmed) {
    return;
  }

  const entries = state.expertRows.map((row) => ({
    partition: row.partition,
    filePath: row.file.path
  }));

  setBusy(true);
  appendLog('system', 'Ejecutando flasheo experto...');
  try {
    const result = await window.flashfix.flashExpert(entries);
    appendLog(result.success ? 'stdout' : 'stderr', result.message || 'Flasheo finalizado.');
    if (result.logPath) {
      appendLog('system', `Log guardado en ${result.logPath}`);
    }
    setDeviceState(result.deviceState || 'unknown', result.message || 'Flasheo completado.');
  } catch (error) {
    appendLog('stderr', error.message || String(error));
    setDeviceState('error', error.message || 'Error desconocido.');
  } finally {
    setBusy(false);
  }
}

function addExpertRow() {
  state.expertRows.push({
    id: crypto.randomUUID(),
    partition: 'BOOT',
    file: null
  });
  renderExpertRows();
}

function wireEvents() {
  els.detectBtn.addEventListener('click', handleDetect);
  els.pitBtn.addEventListener('click', handlePrintPit);
  els.rebootBtn.addEventListener('click', handleReboot);
  els.flashBtn.addEventListener('click', handleFlashExpert);
  els.addRowBtn.addEventListener('click', addExpertRow);
  els.clearLogsBtn.addEventListener('click', clearLogView);
  els.openLogsBtn.addEventListener('click', () => {
    window.flashfix.openLogsFolder().catch((error) => {
      appendLog('stderr', error.message || String(error));
    });
  });

  window.flashfix.onOperationStart((payload) => {
    appendLog('system', `Inicio: ${payload.commandLine}`);
  });

  window.flashfix.onOperationLog((payload) => {
    appendLog(payload.level, payload.line, payload.timestamp);
  });

  window.flashfix.onOperationEnd((payload) => {
    const result = payload.result || {};
    appendLog(result.success ? 'stdout' : 'stderr', result.message || 'Operación finalizada.');
    if (result.logPath) {
      appendLog('system', `Salida guardada en ${result.logPath}`);
    }
  });
}

wireEvents();
refreshStatus().catch((error) => {
  appendLog('stderr', error.message || String(error));
  setDeviceState('error', error.message || 'No se pudo cargar el estado inicial.');
});
