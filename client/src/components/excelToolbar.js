/**
 * Excel Toolbar — formatting and data preparation tools
 */
export function createExcelToolbar(opts = {}) {
  const toolbar = document.createElement('div');
  toolbar.className = 'excel-toolbar';
  toolbar.innerHTML = `
    <div class="toolbar-group">
      <button class="tb-btn" data-action="bold" title="Bold"><b>B</b></button>
      <button class="tb-btn" data-action="italic" title="Italic"><i>I</i></button>
      <div class="tb-divider"></div>
      <select class="tb-select" id="date-format-select" title="Date Format">
        <option value="">Date Format...</option>
        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
        <option value="YYYY/MM/DD">YYYY/MM/DD</option>
      </select>
      <button class="tb-btn" data-action="formatDate" title="Apply date format to selected cells">📅 Apply</button>
      <div class="tb-divider"></div>
      <button class="tb-btn" data-action="validate" title="Validate data for database import">🔍 Validate Data</button>
    </div>
    <div class="toolbar-group" style="margin-left:auto;">
      <span class="toolbar-status" id="toolbar-status">Ready</span>
    </div>
  `;

  const { onAction } = opts;

  toolbar.querySelectorAll('.tb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const format = toolbar.querySelector('#date-format-select').value;
      if (onAction) onAction(action, { format });
    });
  });

  return toolbar;
}

export default { createExcelToolbar };
