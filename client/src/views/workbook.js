/**
 * Workbook View — 75% spreadsheet | 25% panels (logs top, tools bottom)
 * Both horizontal (left/right) and vertical (logs/tools) splits are draggable.
 * Download button shows format picker dropdown for result files.
 */
import { renderSpreadsheet, onChange as onSpreadsheetChange, getInstance as getSpreadsheetInstance } from '../components/spreadsheet.js';
import { createLogPanel } from '../components/logPanel.js';
import { createToolPanel } from '../components/toolPanel.js';
import { createExcelToolbar } from '../components/excelToolbar.js';
import { createExportModal } from '../components/exportModal.js';
import { recordAction, getIsRecording } from '../tools/recorder.js';
import api from '../core/api.js';
import storage from '../core/storage.js';
import logger from '../core/logger.js';

let fileData = null;
let activeSheet = 0;

export async function createWorkbookView(fileId, { onBack }) {
  const view = document.createElement('div');
  view.className = 'workbook-view';
  view.id = 'workbook-view';

  // Loading
  view.innerHTML = `
    <div class="loading-overlay" style="width:100%;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <div class="spinner"></div>
        <span style="font-size:13px;color:var(--text-secondary);">Loading workbook...</span>
      </div>
    </div>
  `;

  try {
    fileData = await api.getFileData(fileId);
    logger.info(`📊 Loaded: ${fileData.originalName}`);

    await storage.addRecentFile({
      fileId: fileData.id,
      originalName: fileData.originalName,
      sheets: fileData.sheets,
      size: fileData.size,
    });
    api.addRecentToServer({
      fileId: fileData.id,
      originalName: fileData.originalName,
    }).catch(() => {});
  } catch (err) {
    logger.error(`Failed to load file: ${err.message}`);
    view.innerHTML = `
      <div class="empty-state" style="width:100%;">
        <div class="empty-icon">⚠️</div>
        <h2 style="font-size:18px;margin:12px 0 8px;">Failed to load file</h2>
        <p style="color:var(--text-muted);">${err.message}</p>
        <button class="btn" id="back-to-workspace" style="margin-top:16px;">← Back to Workspace</button>
      </div>
    `;
    view.querySelector('#back-to-workspace')?.addEventListener('click', onBack);
    return view;
  }

  // ===== BUILD LAYOUT =====
  view.innerHTML = '';

  // ── LEFT PANEL (75%) ──
  const leftPanel = document.createElement('div');
  leftPanel.className = 'workbook-left';
  leftPanel.id = 'workbook-left';

  // File info bar
  const infoBar = document.createElement('div');
  infoBar.className = 'file-info-bar';
  const sheetCount = fileData.sheets?.length || Object.keys(fileData.sheetsData || {}).length;
  const fileSize = fileData.size ? `${(fileData.size / 1024).toFixed(1)} KB` : '';
  infoBar.innerHTML = `
    <button class="back-btn" id="back-btn">← Back</button>
    <span style="width:1px;height:16px;background:var(--border-subtle);"></span>
    <span class="file-name-display" style="cursor:pointer;" title="Click to rename">📊 ${fileData.originalName}</span>
    <span class="badge">${sheetCount} sheet${sheetCount !== 1 ? 's' : ''}</span>
    ${fileSize ? `<span style="color:var(--text-muted);font-size:11px;">${fileSize}</span>` : ''}
    <span style="margin-left:auto;display:flex;gap:4px;">
      <button class="btn btn-sm btn-primary" id="export-server-btn" title="Export current sheets as a new workbook in Recent Files">🚀 Export</button>
      <div class="download-dropdown" id="download-dropdown">
        <button class="btn btn-sm" id="download-btn">⬇ Download</button>
        <div class="download-menu" id="download-menu" style="display:none;">
          <button class="download-menu-item" data-format="xlsx">📗 Excel Workbook <span class="dl-ext">.xlsx</span></button>
          <button class="download-menu-item" data-format="csv">📄 CSV (active sheet) <span class="dl-ext">.csv</span></button>
          <button class="download-menu-item" data-format="csv-all">📦 All Sheets CSV <span class="dl-ext">.zip</span></button>
          <button class="download-menu-item" data-format="original">📎 Original File <span class="dl-ext">original</span></button>
        </div>
      </div>
    </span>
  `;
  leftPanel.appendChild(infoBar);
  
  // Toolbar
  const toolbar = createExcelToolbar({
    onAction: (action, params) => handleToolbarAction(action, params)
  });
  leftPanel.appendChild(toolbar);

  const fileNameDisplay = infoBar.querySelector('.file-name-display');
  fileNameDisplay.addEventListener('click', async () => {
    const newName = prompt('Rename file:', fileData.originalName);
    if (newName && newName !== fileData.originalName) {
      try {
        await api.renameFile(fileId, newName);
        fileData.originalName = newName;
        fileNameDisplay.innerHTML = `📊 ${newName}`;
        logger.success(`Renamed file to: ${newName}`);
      } catch (err) {
        logger.error(`Rename failed: ${err.message}`);
      }
    }
  });

  // Handle Header Actions
  infoBar.querySelector('#export-server-btn').addEventListener('click', handleExportToServer);

  // Spreadsheet container
  const spreadsheetEl = document.createElement('div');
  spreadsheetEl.className = 'spreadsheet-container';
  spreadsheetEl.id = 'spreadsheet-el';
  leftPanel.appendChild(spreadsheetEl);

  // Sheet tabs
  const sheetTabs = document.createElement('div');
  sheetTabs.className = 'sheet-tabs';
  sheetTabs.id = 'sheet-tabs';
  leftPanel.appendChild(sheetTabs);

  // ── HORIZONTAL RESIZE HANDLE ──
  const resizeH = document.createElement('div');
  resizeH.className = 'resize-handle';
  resizeH.id = 'resize-handle';

  // ── RIGHT PANEL (25%) ──
  const rightPanel = document.createElement('div');
  rightPanel.className = 'workbook-right';
  rightPanel.id = 'workbook-right';

  // Log panel (top half)
  const logPanel = createLogPanel();
  logPanel.style.flex = '0 0 auto';
  rightPanel.appendChild(logPanel);

  // Vertical resize handle (between log & tool)
  const resizeV = document.createElement('div');
  resizeV.className = 'resize-handle-v';
  resizeV.id = 'resize-handle-v';
  rightPanel.appendChild(resizeV);

  // Tool panel (bottom half)
  const toolPanel = createToolPanel(fileId, {
    onToolActivate: (toolId) => {
      logger.info(`Tool activated: ${toolId}`);
    },
  });
  toolPanel.style.flex = '1';
  rightPanel.appendChild(toolPanel);

  // Assemble
  view.appendChild(leftPanel);
  view.appendChild(resizeH);
  view.appendChild(rightPanel);

  // ===== RENDER SHEETS =====
  const sheetNames = Object.keys(fileData.sheetsData || {});

  function renderSheet(idx) {
    activeSheet = idx;
    const name = sheetNames[idx];
    const data = fileData.sheetsData[name];
    renderSpreadsheet(spreadsheetEl, data, name, fileId);

    sheetTabs.querySelectorAll('.sheet-tab').forEach((tab, i) => {
      tab.classList.toggle('active', i === idx);
    });
  }

  function refreshSheetTabs() {
    sheetTabs.innerHTML = '';
    sheetNames.forEach((name, idx) => {
      const tab = document.createElement('div');
      tab.className = `sheet-tab ${idx === activeSheet ? 'active' : ''}`;
      tab.innerHTML = `<span>${name}</span>`;
      
      // Select sheet
      tab.addEventListener('click', () => renderSheet(idx));
      
      // Rename on double-click
      tab.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const newName = prompt('Rename sheet:', name);
        if (newName && newName !== name) handleRenameSheet(name, newName);
      });

      // Context menu for duplicate/delete
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, [
          { label: '✏️ Rename', action: () => tab.dispatchEvent(new Event('dblclick')) },
          { label: '👯 Duplicate', action: () => handleDuplicateSheet(name) },
          { label: '🗑️ Delete', action: () => handleDeleteSheet(name), danger: true },
        ]);
      });
      
      sheetTabs.appendChild(tab);
    });
  }

  refreshSheetTabs();
  if (sheetNames.length > 0) {
    setTimeout(() => renderSheet(0), 50);
  }

  // ===== EVENT WIRING =====

  // Back button
  infoBar.querySelector('#back-btn').addEventListener('click', onBack);

  // ── Download dropdown ──
  const dlBtn = infoBar.querySelector('#download-btn');
  const dlMenu = infoBar.querySelector('#download-menu');

  dlBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dlMenu.style.display = dlMenu.style.display === 'none' ? 'block' : 'none';
  });

  // Close dropdown on outside click
  document.addEventListener('click', () => {
    dlMenu.style.display = 'none';
  });

  dlMenu.querySelectorAll('.download-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const format = item.dataset.format;
      dlMenu.style.display = 'none';
      handleDownload(format);
    });
  });

  function handleDownload(format) {
    switch (format) {
      case 'xlsx':
        logger.info('⬇ Downloading result as XLSX...');
        window.open(`/api/files/${fileId}/download?format=xlsx`, '_blank');
        break;
      case 'csv':
        // Download current sheet CSV (from data clean output)
        logger.info('⬇ Downloading active sheet as CSV...');
        window.open(`/api/files/${fileId}/download?format=csv&sheet=${activeSheet}`, '_blank');
        break;
      case 'csv-all':
        logger.info('📦 Downloading all sheets as CSV ZIP...');
        api.downloadDataCleanZip(fileId);
        break;
      case 'original':
        logger.info('⬇ Downloading original file...');
        window.open(`/api/files/${fileId}/download`, '_blank');
        break;
    }
  }

  async function handleExportToServer() {
    const modal = createExportModal(sheetNames, async (selectedIndices, customFilename) => {
      try {
        logger.info(`🚀 Starting selective export of ${selectedIndices.length} sheet(s)...`);
        const sheetsToExport = selectedIndices.map(idx => {
          const name = sheetNames[idx];
          // If active sheet, get live data from jspreadsheet
          if (idx === activeSheet) {
            const instance = getSpreadsheetInstance();
            return { name, data: instance.getData() };
          }
          return { name, data: fileData.sheetsData[name].data };
        });

        const outputName = customFilename || fileData.originalName.replace(/\.[^/.]+$/, "");
        const result = await api.exportWorkbook(outputName, sheetsToExport);
        logger.success(`✅ Export Successful: "${outputName}" saved to Recent Files`);
      } catch (err) {
        logger.error(`Export failed: ${err.message}`);
      }
    });
    document.body.appendChild(modal);
  }

  function handleRenameSheet(oldName, newName) {
    if (!fileData.sheetsData[oldName]) return;
    fileData.sheetsData[newName] = fileData.sheetsData[oldName];
    delete fileData.sheetsData[oldName];
    const idx = sheetNames.indexOf(oldName);
    if (idx !== -1) sheetNames[idx] = newName;
    logger.info(`Renamed sheet "${oldName}" to "${newName}"`);
    refreshSheetTabs();
    if (activeSheet === idx) renderSheet(idx);
  }

  function handleDuplicateSheet(sheetName) {
    const newName = `${sheetName}_Copy`;
    fileData.sheetsData[newName] = JSON.parse(JSON.stringify(fileData.sheetsData[sheetName]));
    sheetNames.push(newName);
    logger.info(`Duplicated sheet "${sheetName}" as "${newName}"`);
    refreshSheetTabs();
    renderSheet(sheetNames.length - 1);
  }

  function handleDeleteSheet(sheetName) {
    if (sheetNames.length <= 1) {
      logger.warn('Cannot delete the last sheet');
      return;
    }
    if (!confirm(`Are you sure you want to delete sheet "${sheetName}"?`)) return;
    
    delete fileData.sheetsData[sheetName];
    const idx = sheetNames.indexOf(sheetName);
    sheetNames.splice(idx, 1);
    logger.info(`Deleted sheet "${sheetName}"`);
    
    refreshSheetTabs();
    renderSheet(0);
  }

  function refreshSheetTabs() {
    sheetTabs.innerHTML = '';
    // Re-run the loop logic or just call a sub-function
    // I'll make a smaller inner function for this if needed, 
    // but for simplicity I'll just trigger a component refresh if this were React.
    // In Vanilla, I'll just manually re-build them:
    sheetNames.forEach((name, idx) => {
       const tab = document.createElement('div');
       tab.className = `sheet-tab ${idx === activeSheet ? 'active' : ''}`;
       tab.innerHTML = `<span>${name}</span>`;
       tab.onclick = () => renderSheet(idx);
       tab.ondblclick = () => handleRenameSheet(name, prompt('Rename:', name));
       tab.oncontextmenu = (e) => {
         e.preventDefault();
         showContextMenu(e.clientX, e.clientY, [
            { label: '✏️ Rename', action: () => tab.ondblclick() },
            { label: '👯 Duplicate', action: () => handleDuplicateSheet(name) },
            { label: '🗑️ Delete', action: () => handleDeleteSheet(name), danger: true },
         ]);
       };
       sheetTabs.appendChild(tab);
    });
  }

  function showContextMenu(x, y, items) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = `context-menu-item ${item.danger ? 'danger' : ''}`;
      el.textContent = item.label;
      el.onclick = () => {
        item.action();
        menu.remove();
      };
      menu.appendChild(el);
    });
    
    document.body.appendChild(menu);
    const remove = () => menu.remove();
    setTimeout(() => document.addEventListener('click', remove, { once: true }), 10);
    return menu;
  }

  function handleToolbarAction(action, params) {
    const instance = getSpreadsheetInstance();
    if (!instance) return;

    const selection = instance.getSelection();
    if (!selection) return;

    switch (action) {
      case 'bold':
        applyStyle(instance, selection, 'font-weight', 'bold');
        break;
      case 'italic':
        applyStyle(instance, selection, 'font-style', 'italic');
        break;
      case 'formatDate':
        applyDateFormat(instance, selection, params.format);
        break;
      case 'validate':
        runDataValidation(instance);
        break;
    }
  }

  function applyStyle(instance, range, property, value) {
    const [x1, y1, x2, y2] = range;
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        const style = {};
        style[property] = value;
        instance.setStyle(x, y, style);
      }
    }
  }

  function applyDateFormat(instance, range, format) {
    const [x1, y1, x2, y2] = range;
    let count = 0;
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        const val = instance.getValueFromCoords(x, y);
        if (val) {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            // Very simple ISO format for now (Postgres friendly)
            const formatted = d.toISOString().split('T')[0];
            instance.setValueFromCoords(x, y, formatted);
            count++;
          }
        }
      }
    }
    logger.info(`📅 Formatted ${count} dates in selection`);
  }

  function runDataValidation(instance) {
    logger.info('🔍 Validating sheet data...');
    const data = instance.getData();
    let issues = 0;
    data.forEach((row, y) => {
      row.forEach((val, x) => {
        // Simple numeric check for sample validation
        if (val && !isNaN(val) && String(val).trim() !== '') {
          // It's a number, but check if it's too large or something?
        }
        // Check for common error strings
        if (String(val).toLowerCase().includes('err') || String(val).includes('#')) {
          instance.setStyle(x, y, { 'background-color': '#ff4d4d', 'color': 'white' });
          issues++;
        }
      });
    });
    if (issues > 0) logger.warn(`🔍 Validation: ${issues} problematic cells marked in RED`);
    else logger.success('🔍 Validation: Sheet passed basic checks');
  }

  // Spreadsheet change tracking for recorder
  onSpreadsheetChange((action) => {
    if (getIsRecording()) {
      recordAction({ ...action, sheet: sheetNames[activeSheet] });
    }
  });

  // ===== HORIZONTAL DRAG RESIZE =====
  let isResizingH = false;

  resizeH.addEventListener('mousedown', (e) => {
    isResizingH = true;
    resizeH.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (isResizingH) {
      const viewRect = view.getBoundingClientRect();
      const pct = ((e.clientX - viewRect.left) / viewRect.width) * 100;
      const clamped = Math.max(30, Math.min(85, pct));
      leftPanel.style.width = `${clamped}%`;
      rightPanel.style.width = `${100 - clamped}%`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizingH) {
      isResizingH = false;
      resizeH.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });

  // ===== VERTICAL DRAG RESIZE (logs / tools) =====
  let isResizingV = false;

  resizeV.addEventListener('mousedown', (e) => {
    isResizingV = true;
    resizeV.classList.add('active');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (isResizingV) {
      const rightRect = rightPanel.getBoundingClientRect();
      const offsetY = e.clientY - rightRect.top;
      const totalH = rightRect.height;
      const pct = (offsetY / totalH) * 100;
      const clamped = Math.max(15, Math.min(85, pct));
      logPanel.style.flex = 'none';
      toolPanel.style.flex = 'none';
      logPanel.style.height = `${clamped}%`;
      toolPanel.style.height = `${100 - clamped}%`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizingV) {
      isResizingV = false;
      resizeV.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });

  return view;
}

export default { createWorkbookView };
