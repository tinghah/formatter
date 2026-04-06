/**
 * Spreadsheet component — wraps jspreadsheet-ce
 * Renders Excel data in an interactive grid
 */
import jspreadsheet from 'jspreadsheet-ce';
import 'jspreadsheet-ce/dist/jspreadsheet.css';
import 'jsuites/dist/jsuites.css';
import api from '../core/api.js';
import logger from '../core/logger.js';

let currentInstance = null;
let container = null;
let onChangeCallbacks = [];
let saveTimeout = null;
let currentFileId = null;
let currentSheetName = null;

export function onChange(fn) {
  onChangeCallbacks.push(fn);
  return () => { onChangeCallbacks = onChangeCallbacks.filter(c => c !== fn); };
}

function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (!currentInstance || !currentFileId || !currentSheetName) return;
    try {
      const data = currentInstance.getData();
      // Since we now treat the entire grid as data (including first row),
      // we can save it directly.
      await api.saveFileData(currentFileId, currentSheetName, data);
      logger.info(`💾 Autosaved: ${currentSheetName}`);
    } catch (err) {
      logger.error(`❌ Autosave failed: ${err.message}`);
    }
  }, 2000); // 2 second debounce
}

export function renderSpreadsheet(targetEl, sheetData, sheetName, fileId) {
  container = targetEl;
  currentFileId = fileId;
  currentSheetName = sheetName;

  // Destroy previous instance
  if (currentInstance) {
    try { jspreadsheet.destroy(targetEl); } catch (e) { /* ignore */ }
    targetEl.innerHTML = '';
    currentInstance = null;
  }

  if (!sheetData || !sheetData.data || sheetData.data.length === 0) {
    targetEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No data in this sheet</p>
      </div>`;
    return null;
  }

  const tableData = sheetData.data;
  
  // Fill rows to have consistent col count if needed
  const maxCols = tableData.reduce((max, row) => Math.max(max, row.length), 10);
  const columns = [];
  for (let i = 0; i < maxCols; i++) {
    columns.push({
      width: 130,
      align: 'left',
      // By NOT providing a title, jspreadsheet defaults to A, B, C...
    });
  }

  try {
    currentInstance = jspreadsheet(targetEl, {
      data: tableData,
      columns,
      defaultColWidth: 120,
      tableOverflow: true,
      tableWidth: '100%',
      tableHeight: '100%',
      freezeColumns: 0, // Disable internal freeze — our CSS is better for row handles
      allowInsertRow: true,
      allowInsertColumn: true,
      allowDeleteRow: true,
      allowDeleteColumn: true,
      allowRenameColumn: true,
      columnSorting: true,
      search: false, // Removed search item from top
      onchange: (instance, cell, colIdx, rowIdx, value, oldValue) => {
        const action = {
          type: 'editCell',
          row: parseInt(rowIdx),
          col: parseInt(colIdx),
          value,
          oldValue,
          timestamp: Date.now(),
        };
        onChangeCallbacks.forEach(fn => fn(action));
        logDetailedAction('editCell', action);
        debouncedSave();
      },
      oninsertrow: (instance, rowIdx) => {
        const action = { type: 'insertRow', row: rowIdx, timestamp: Date.now() };
        onChangeCallbacks.forEach(fn => fn(action));
        logDetailedAction('insertRow', action);
        debouncedSave();
      },
      ondeleterow: (instance, rowIdx) => {
        const action = { type: 'deleteRow', row: rowIdx, timestamp: Date.now() };
        onChangeCallbacks.forEach(fn => fn(action));
        logDetailedAction('deleteRow', action);
        debouncedSave();
      },
      oninsertcolumn: (instance, colIdx) => {
        const action = { type: 'insertColumn', col: colIdx, timestamp: Date.now() };
        onChangeCallbacks.forEach(fn => fn(action));
        logDetailedAction('insertColumn', action);
        debouncedSave();
      },
      ondeletecolumn: (instance, colIdx) => {
        const action = { type: 'deleteColumn', col: colIdx, timestamp: Date.now() };
        onChangeCallbacks.forEach(fn => fn(action));
        logDetailedAction('deleteColumn', action);
        debouncedSave();
      },
      onsort: (instance, colIdx, order) => {
        const action = { type: 'sort', col: colIdx, order, timestamp: Date.now() };
        onChangeCallbacks.forEach(fn => fn(action));
        logDetailedAction('sort', action);
        debouncedSave();
      },
    });

    logger.info(`Rendered sheet "${sheetName}" — ${tableData.length} rows × ${columns.length} cols`);
  } catch (err) {
    logger.error(`Failed to render spreadsheet: ${err.message}`);
    targetEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Error rendering sheet</p>
      </div>`;
  }

  return currentInstance;
}

function getColLetter(n) {
  let letter = '';
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function logDetailedAction(type, data) {
  let msg = '';
  const sheet = currentSheetName || 'Sheet';
  switch (type) {
    case 'editCell':
      msg = `Update value "${data.value}" in cell ${getColLetter(data.col)}${data.row + 1}`;
      break;
    case 'insertRow':
      msg = `Inserted new row at index ${data.row + 1}`;
      break;
    case 'deleteRow':
      msg = `Deleted row ${data.row + 1}`;
      break;
    case 'insertColumn':
      msg = `Inserted column at index ${getColLetter(data.col)}`;
      break;
    case 'deleteColumn':
      msg = `Deleted column ${getColLetter(data.col)}`;
      break;
    case 'sort':
      msg = `Sorted column ${getColLetter(data.col)} (${data.order === 0 ? 'ASC' : 'DESC'})`;
      break;
  }
  if (msg) logger.info(`${msg}`);
}

export function getInstance() {
  return currentInstance;
}

export function getData() {
  if (!currentInstance) return [];
  return currentInstance.getData();
}

export default { renderSpreadsheet, getInstance, getData, onChange };
