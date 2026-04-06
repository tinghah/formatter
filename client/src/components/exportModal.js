/**
 * Export Modal — multi-sheet selection for export to server
 */
export function createExportModal(sheetNames, onExport) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>🚀 Export to Recent Files</h3>
        <button class="btn-icon close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Select the sheets you want to include in the exported workbook.</p>
        <div class="sheet-selection-list">
          <div class="selection-actions" style="margin-bottom:8px;">
            <button class="btn-text btn-sm" id="select-all-sheets">Select All</button>
            <button class="btn-text btn-sm" id="deselect-all-sheets">Deselect All</button>
          </div>
          ${sheetNames.map((name, i) => `
            <label class="sheet-checkbox">
              <input type="checkbox" data-index="${i}" checked>
              <span>${name}</span>
            </label>
          `).join('')}
        </div>
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;">
           <input type="text" id="export-filename-input" placeholder="Enter output filename..." class="pg-input">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="final-export-btn">🚀 Export Selected Sheets</button>
        <button class="btn close-modal">Cancel</button>
      </div>
    </div>
  `;

  // Interaction logic
  const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
  modal.querySelector('#select-all-sheets').onclick = () => checkboxes.forEach(cb => cb.checked = true);
  modal.querySelector('#deselect-all-sheets').onclick = () => checkboxes.forEach(cb => cb.checked = false);

  const close = () => modal.remove();
  modal.querySelectorAll('.close-modal').forEach(b => b.onclick = close);

  modal.querySelector('#final-export-btn').onclick = () => {
    const selectedIndices = Array.from(checkboxes).filter(cb => cb.checked).map(cb => parseInt(cb.dataset.index));
    const filename = modal.querySelector('#export-filename-input').value.trim();
    if (selectedIndices.length === 0) {
       alert('Please select at least one sheet');
       return;
    }
    onExport(selectedIndices, filename);
    close();
  };

  return modal;
}

export default { createExportModal };
