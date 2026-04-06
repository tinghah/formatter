/**
 * Tool Panel — built-in tools, saved automation tools, recorder with save dialog
 */
import logger from '../core/logger.js';
import api from '../core/api.js';
import storage from '../core/storage.js';
import { createColumnInfo, updateColumnInfo } from './columnInfo.js';
import { startRecording, stopRecording, getIsRecording, getRecordedActions, clearRecordedActions, replayActions, recordAction } from '../tools/recorder.js';
import { getInstance as getSpreadsheetInstance } from './spreadsheet.js';

let activeToolId = null;
let panelEl = null;
let currentFileId = null;
let currentCleanResults = null;
let savedAutomations = [];

export function createToolPanel(fileId, opts = {}) {
  currentFileId = fileId;

  const panel = document.createElement('div');
  panel.className = 'panel tool-panel';
  panel.innerHTML = `
    <div class="panel-header">
      <h3>🔧 Panel Tools</h3>
      <div class="header-actions">
        <button class="btn btn-sm" id="recorder-toggle" title="Record user actions">⏺ Record</button>
      </div>
    </div>
    <div class="panel-body" id="tool-body">
      <div id="tool-list"></div>
      <div id="saved-automations-list"></div>
      <div id="recording-status" style="display:none;"></div>
      <div id="save-recording-dialog" style="display:none;"></div>
      <div id="clean-results-container"></div>
      <div id="pg-import-container" style="display:none;"></div>
      <div id="column-info-container"></div>
    </div>
  `;

  panelEl = panel;
  const toolList = panel.querySelector('#tool-list');
  const recorderBtn = panel.querySelector('#recorder-toggle');
  const recordingStatus = panel.querySelector('#recording-status');
  const saveDialog = panel.querySelector('#save-recording-dialog');

  // Default tools
  const tools = [
    { id: 'data-clean', name: '🧹 Data Clean', desc: 'Sheets → CSV files + column type analysis' },
    { id: 'pg-import', name: '🐘 Import to PostgreSQL', desc: 'Upload CSV data into a PostgreSQL database' },
  ];

  tools.forEach(tool => {
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.id = `tool-${tool.id}`;
    card.innerHTML = `
      <div class="tool-name">${tool.name}</div>
      <div class="tool-desc">${tool.desc}</div>
    `;
    card.addEventListener('click', () => activateTool(tool.id));
    toolList.appendChild(card);
  });

  // Load and render saved automations
  loadSavedAutomations();

  // ── Recorder toggle ──
  recorderBtn.addEventListener('click', () => {
    if (!getIsRecording()) {
      // Start recording
      startRecording();
      recorderBtn.innerHTML = '⏹ Stop';
      recorderBtn.classList.add('btn-danger');
      recordingStatus.style.display = 'block';
      recordingStatus.innerHTML = `
        <div class="recording-indicator">
          <span class="rec-dot"></span>
          Recording actions...
        </div>
      `;
      logger.info('🎬 Recording started');
    } else {
      // Stop recording → show save dialog
      stopRecording();
      recorderBtn.innerHTML = '⏺ Record';
      recorderBtn.classList.remove('btn-danger');
      recordingStatus.style.display = 'none';
      logger.success('🎬 Recording stopped');

      const actions = getRecordedActions();
      if (actions.length === 0) {
        logger.warn('No actions were recorded');
        return;
      }

      // Show save dialog
      showSaveRecordingDialog(actions);
    }
  });

  // Init column info container
  const colContainer = panel.querySelector('#column-info-container');
  colContainer.appendChild(createColumnInfo());

  return panel;
}

// ── Save Recording Dialog ──
function showSaveRecordingDialog(actions) {
  const dialog = panelEl.querySelector('#save-recording-dialog');
  dialog.style.display = 'block';
  dialog.innerHTML = `
    <div class="clean-result-card" style="border-color: var(--accent-2);">
      <h4 style="color: var(--accent-2);">💾 Save Automation</h4>
      <div class="result-stats" style="margin-bottom:8px;">${actions.length} action(s) recorded</div>
      <div class="save-recording-form">
        <input type="text" id="automation-name-input" placeholder="Enter a name for this automation..." autofocus>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" id="save-automation-btn" style="flex:1;">Save Automation</button>
          <button class="btn btn-sm" id="discard-automation-btn">Discard</button>
        </div>
      </div>
    </div>
  `;

  const nameInput = dialog.querySelector('#automation-name-input');
  const saveBtn = dialog.querySelector('#save-automation-btn');
  const discardBtn = dialog.querySelector('#discard-automation-btn');

  // Focus input
  setTimeout(() => nameInput.focus(), 50);

  // Enter key saves
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.style.borderColor = 'var(--error)';
      nameInput.placeholder = 'Please enter a name!';
      return;
    }

    const automation = {
      id: `auto_${Date.now()}`,
      name,
      actions: [...actions],
      createdAt: new Date().toISOString(),
      actionCount: actions.length,
    };

    // Save to browser storage
    savedAutomations.push(automation);
    await storage.saveToolbox({ id: automation.id, ...automation });

    logger.success(`💾 Saved automation: "${name}" (${actions.length} actions)`);
    clearRecordedActions();
    dialog.style.display = 'none';

    // Re-render automation list
    renderSavedAutomations();
  });

  discardBtn.addEventListener('click', () => {
    clearRecordedActions();
    dialog.style.display = 'none';
    logger.info('Recording discarded');
  });
}

// ── Load saved automations from storage ──
async function loadSavedAutomations() {
  const toolboxes = await storage.getToolboxes();
  savedAutomations = toolboxes.filter(t => t.actions); // only those with recorded actions
  renderSavedAutomations();
}

// ── Render saved automation tool cards ──
function renderSavedAutomations() {
  const container = panelEl.querySelector('#saved-automations-list');
  container.innerHTML = '';

  if (savedAutomations.length === 0) return;

  const header = document.createElement('div');
  header.className = 'column-info-header';
  header.style.marginTop = '8px';
  header.textContent = 'Saved Automations';
  container.appendChild(header);

  savedAutomations.forEach(auto => {
    const card = document.createElement('div');
    card.className = 'tool-card automation-tool';
    card.innerHTML = `
      <div class="tool-name">🤖 ${escapeHtml(auto.name)}</div>
      <div class="tool-desc">${auto.actionCount} action(s) — ${new Date(auto.createdAt).toLocaleString()}</div>
      <div class="tool-actions">
        <button class="btn btn-sm btn-primary auto-play-btn" data-id="${auto.id}">▶ Run</button>
        <button class="btn btn-sm auto-rename-btn" data-id="${auto.id}">✏️</button>
        <button class="btn btn-sm btn-danger auto-delete-btn" data-id="${auto.id}">✕</button>
      </div>
    `;

    // Play button
    card.querySelector('.auto-play-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      replayAutomation(auto);
    });

    // Rename button
    card.querySelector('.auto-rename-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      renameAutomation(auto);
    });

    // Delete button
    card.querySelector('.auto-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      savedAutomations = savedAutomations.filter(a => a.id !== auto.id);
      await storage.deleteToolbox(auto.id);
      renderSavedAutomations();
      logger.info(`Deleted automation: "${auto.name}"`);
    });

    container.appendChild(card);
  });
}

// ── Replay an automation on the live spreadsheet ──
async function replayAutomation(auto) {
  const instance = getSpreadsheetInstance();
  if (!instance) {
    logger.error('No active spreadsheet to replay on. Open a workbook first.');
    return;
  }

  logger.info(`▶ Running automation: "${auto.name}" (${auto.actionCount} actions)...`);

  let completed = 0;
  let errors = 0;

  for (const action of auto.actions) {
    try {
      switch (action.type) {
        case 'editCell':
          instance.setValueFromCoords(action.col, action.row, action.value);
          logger.info(`  ✎ Cell (${action.row}, ${action.col}) → "${action.value}"`);
          break;
        case 'insertRow':
          instance.insertRow();
          logger.info(`  + Inserted row`);
          break;
        case 'deleteRow':
          instance.deleteRow(action.row);
          logger.info(`  − Deleted row ${action.row}`);
          break;
        case 'insertColumn':
          instance.insertColumn();
          logger.info(`  + Inserted column`);
          break;
        case 'deleteColumn':
          instance.deleteColumn(action.col);
          logger.info(`  − Deleted column ${action.col}`);
          break;
        case 'sort':
          instance.orderBy(action.col, action.order);
          logger.info(`  ↕ Sorted column ${action.col}`);
          break;
        case 'activateTool':
          // Re-trigger the tool (e.g., Data Clean)
          logger.info(`  🔨 Triggering Tool: ${action.toolId}`);
          await activateTool(action.toolId);
          break;
        default:
          logger.warn(`  ⚠ Unknown action: ${action.type}`);
      }
      completed++;
    } catch (err) {
      errors++;
      logger.error(`  ✕ Action ${action.type} failed: ${err.message}`);
    }
  }

  if (errors === 0) {
    logger.success(`✅ Automation "${auto.name}" completed — ${completed}/${auto.actionCount} actions executed on workbook`);
  } else {
    logger.warn(`⚠ Automation "${auto.name}" done — ${completed} succeeded, ${errors} failed`);
  }
}

// ── Rename an automation ──
function renameAutomation(auto) {
  const newName = prompt('Rename automation:', auto.name);
  if (newName && newName.trim()) {
    auto.name = newName.trim();
    storage.saveToolbox({ id: auto.id, ...auto });
    renderSavedAutomations();
    logger.info(`Renamed to: "${auto.name}"`);
  }
}

// ── Activate a built-in tool ──
async function activateTool(toolId) {
  if (!panelEl) return;

  const cards = panelEl.querySelectorAll('.tool-card:not(.automation-tool)');
  cards.forEach(c => c.classList.remove('active'));

  if (activeToolId === toolId) {
    activeToolId = null;
    panelEl.querySelector('#clean-results-container').innerHTML = '';
    panelEl.querySelector('#pg-import-container').style.display = 'none';
    return;
  }

  activeToolId = toolId;
  const card = panelEl.querySelector(`#tool-${toolId}`);
  if (card) card.classList.add('active');

  if (toolId === 'data-clean' && currentFileId) {
    if (getIsRecording()) recordAction({ type: 'activateTool', toolId: 'data-clean' });
    panelEl.querySelector('#pg-import-container').style.display = 'none';
    await runDataClean();
  } else if (toolId === 'pg-import') {
    if (getIsRecording()) recordAction({ type: 'activateTool', toolId: 'pg-import' });
    await showPgImportUI();
  }
}

async function runDataClean() {
  logger.info('🧹 Running Data Clean...');
  const resultsContainer = panelEl.querySelector('#clean-results-container');
  resultsContainer.innerHTML = '<div style="display:flex;justify-content:center;padding:16px;"><div class="spinner"></div></div>';

  try {
    const result = await api.runDataClean(currentFileId);
    currentCleanResults = result;
    await storage.cacheCleanResults(currentFileId, result);

    logger.success(`Data Clean complete — ${result.sheetsProcessed} sheet(s) processed`);

    let html = '<div class="clean-results">';
    html += `<div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;padding:5px 8px;background:var(--bg-card);border-radius:var(--radius-sm);">
      ✅ ${result.sheetsProcessed} sheet(s) exported to CSV</div>`;

    result.results.forEach(sheet => {
      logger.info(`📄 ${sheet.sheetName}: ${sheet.rows} rows → ${sheet.csvFile}`);
      html += `
        <div class="clean-result-card">
          <h4>📄 ${sheet.sheetName} <span class="badge">${sheet.rows} rows</span></h4>
          <div class="result-stats">${sheet.columns.length} columns → ${sheet.csvFile || 'empty'}</div>
          ${sheet.csvFile ? `<div style="margin-top:6px;display:flex;gap:4px;">
            <a href="/output/${sheet.csvFile}" download class="btn btn-sm">⬇ CSV</a>
          </div>` : ''}
          ${sheet.ddl ? `<details style="margin-top:4px;"><summary>View DDL</summary><div class="ddl-block">${escapeHtml(sheet.ddl)}</div></details>` : ''}
        </div>
      `;

      if (sheet.columns.length > 0) {
        updateColumnInfo(sheet.columns);
      }
    });

    html += `<div style="display:flex;gap:6px;margin-top:8px;">
      <button class="btn btn-primary btn-sm" id="download-all-btn" style="flex:1;">📦 Download All CSVs (ZIP)</button>
    </div>`;
    html += '</div>';
    resultsContainer.innerHTML = html;

    resultsContainer.querySelector('#download-all-btn')?.addEventListener('click', () => {
      api.downloadDataCleanZip(currentFileId);
      logger.info('📦 Downloading all CSVs as ZIP...');
    });
  } catch (err) {
    logger.error(`Data Clean failed: ${err.message}`);
    resultsContainer.innerHTML = `<div class="clean-result-card" style="border-color:var(--error);">
      <h4 style="color:var(--error);">❌ Error</h4>
      <div class="result-stats">${err.message}</div>
    </div>`;
  }
}

// ─── PostgreSQL Import UI ───
async function showPgImportUI() {
  const container = panelEl.querySelector('#pg-import-container');
  container.style.display = 'block';

  if (!currentCleanResults) {
    currentCleanResults = await storage.getCachedCleanResults(currentFileId);
  }

  if (!currentCleanResults) {
    container.innerHTML = `
      <div class="clean-result-card" style="border-color:var(--warning);">
        <h4 style="color:var(--warning);">⚠️ Run Data Clean First</h4>
        <div class="result-stats">You need to run Data Clean before importing to PostgreSQL</div>
        <button class="btn btn-sm" style="margin-top:6px;" id="run-clean-first-btn">🧹 Run Data Clean</button>
      </div>`;
    container.querySelector('#run-clean-first-btn')?.addEventListener('click', async () => {
      await activateTool('data-clean');
      setTimeout(() => { activeToolId = null; activateTool('pg-import'); }, 500);
    });
    return;
  }

  let connections = [];
  try { connections = await api.getPgConnections(); } catch (e) {}

  let html = '<div class="clean-results">';
  html += '<div class="column-info-header">PostgreSQL Connections</div>';

  if (connections.length > 0) {
    html += '<div id="pg-connection-list">';
    connections.forEach(conn => {
      html += `
        <div class="tool-card pg-conn-card" data-conn-id="${conn.id}" style="margin-bottom:4px;">
          <div class="tool-name">🔗 ${escapeHtml(conn.name)}</div>
          <div class="tool-desc">${escapeHtml(conn.host)}:${conn.port} / ${escapeHtml(conn.database)}</div>
          <div style="margin-top:4px;display:flex;gap:4px;">
            <button class="btn btn-sm pg-use-btn" data-conn-id="${conn.id}">📤 Import</button>
            <button class="btn btn-sm pg-test-btn" data-conn-id="${conn.id}">🔌 Test</button>
            <button class="btn btn-sm btn-danger pg-del-btn" data-conn-id="${conn.id}">✕</button>
          </div>
        </div>`;
    });
    html += '</div>';
  } else {
    html += '<div style="font-size:11px;color:var(--text-muted);margin:6px 0;">No saved connections</div>';
  }

  html += `
    <button class="btn btn-sm" id="add-pg-conn-btn" style="width:100%;margin-top:6px;">+ Add New Connection</button>
    <div id="pg-form-container" style="display:none;"></div>
    <div id="pg-import-status"></div>
  </div>`;

  container.innerHTML = html;

  container.querySelectorAll('.pg-use-btn').forEach(btn => {
    btn.addEventListener('click', () => handlePgImport(btn.dataset.connId));
  });

  container.querySelectorAll('.pg-test-btn').forEach(btn => {
    btn.addEventListener('click', () => handlePgTest(btn.dataset.connId, connections));
  });

  container.querySelectorAll('.pg-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api.deletePgConnection(btn.dataset.connId);
      logger.info('Connection deleted');
      showPgImportUI();
    });
  });

  container.querySelector('#add-pg-conn-btn')?.addEventListener('click', () => showPgConnectionForm());
}

function showPgConnectionForm() {
  const formContainer = panelEl.querySelector('#pg-form-container');
  formContainer.style.display = 'block';
  formContainer.innerHTML = `
    <div class="clean-result-card" style="margin-top:6px;">
      <h4>🐘 New Connection</h4>
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:6px;">
        <input class="pg-input" id="pg-name" placeholder="Connection Name" value="My Database">
        <input class="pg-input" id="pg-host" placeholder="Host" value="localhost">
        <input class="pg-input" id="pg-port" placeholder="Port" value="5432" type="number">
        <input class="pg-input" id="pg-database" placeholder="Database Name">
        <input class="pg-input" id="pg-username" placeholder="Username" value="postgres">
        <input class="pg-input" id="pg-password" placeholder="Password" type="password">
        <div style="display:flex;gap:4px;margin-top:2px;">
          <button class="btn btn-primary btn-sm" id="pg-save-conn-btn" style="flex:1;">Save & Test</button>
          <button class="btn btn-sm" id="pg-cancel-conn-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;

  formContainer.querySelector('#pg-cancel-conn-btn').addEventListener('click', () => {
    formContainer.style.display = 'none';
  });

  formContainer.querySelector('#pg-save-conn-btn').addEventListener('click', async () => {
    const conn = {
      name: formContainer.querySelector('#pg-name').value,
      host: formContainer.querySelector('#pg-host').value,
      port: parseInt(formContainer.querySelector('#pg-port').value) || 5432,
      database: formContainer.querySelector('#pg-database').value,
      username: formContainer.querySelector('#pg-username').value,
      password: formContainer.querySelector('#pg-password').value,
    };

    if (!conn.host || !conn.database || !conn.username) {
      logger.warn('Please fill in host, database, and username');
      return;
    }

    logger.info(`Testing connection to ${conn.host}:${conn.port}/${conn.database}...`);
    try {
      const testResult = await api.testPgConnection(conn);
      if (testResult.success) {
        logger.success(`✅ Connected: ${testResult.version || ''}`);
        await api.addPgConnection(conn);
        logger.success(`Saved connection: ${conn.name}`);
        formContainer.style.display = 'none';
        showPgImportUI();
      } else {
        logger.error(`❌ ${testResult.error}`);
      }
    } catch (err) {
      logger.error(`❌ Test failed: ${err.message}`);
      await api.addPgConnection(conn);
      logger.warn('Connection saved despite test failure');
      formContainer.style.display = 'none';
      showPgImportUI();
    }
  });
}

async function handlePgTest(connId, connections) {
  const conn = connections.find(c => c.id === connId);
  if (!conn) return;
  logger.info(`Testing: ${conn.name}...`);
  try {
    const result = await api.testPgConnection(conn);
    if (result.success) logger.success(`✅ ${conn.name}: Connected`);
    else logger.error(`❌ ${conn.name}: ${result.error}`);
  } catch (err) {
    logger.error(`❌ Test failed: ${err.message}`);
  }
}

async function handlePgImport(connId) {
  if (!currentCleanResults) { logger.warn('Run Data Clean first'); return; }

  const statusEl = panelEl.querySelector('#pg-import-status');
  statusEl.innerHTML = '<div style="display:flex;align-items:center;gap:6px;padding:8px;"><div class="spinner"></div><span style="font-size:11px;">Importing...</span></div>';

  logger.info('🐘 Starting PostgreSQL import...');

  try {
    const sheets = currentCleanResults.results.filter(s => s.csvFile).map(s => ({
      sheetName: s.sheetName, tableName: s.tableName,
    }));

    const result = await api.pgImport(connId, currentFileId, sheets);

    if (result.success) {
      logger.success(`✅ Import complete — ${result.total_rows_imported} rows → ${result.tables_processed} table(s)`);
      statusEl.innerHTML = `<div class="clean-result-card" style="border-color:var(--success);margin-top:6px;">
        <h4 style="color:var(--success);">✅ Import Successful</h4>
        <div class="result-stats">${result.total_rows_imported} rows → ${result.tables_processed} table(s)</div>
      </div>`;
    } else {
      logger.error(`❌ Import failed`);
      statusEl.innerHTML = `<div class="clean-result-card" style="border-color:var(--error);margin-top:6px;">
        <h4 style="color:var(--error);">❌ Failed</h4>
        <div class="result-stats">${result.error || 'Unknown error'}</div>
      </div>`;
    }
  } catch (err) {
    logger.error(`Import error: ${err.message}`);
    statusEl.innerHTML = `<div class="clean-result-card" style="border-color:var(--error);margin-top:6px;">
      <h4 style="color:var(--error);">❌ Error</h4>
      <div class="result-stats">${err.message}</div>
    </div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function isCurrentlyRecording() {
  return getIsRecording();
}

export default { createToolPanel, isCurrentlyRecording };
