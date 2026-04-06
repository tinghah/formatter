/**
 * Column Info component — shows data type suggestions for PostgreSQL
 */

const PG_TYPES = [
  'VARCHAR(50)', 'VARCHAR(100)', 'VARCHAR(255)',
  'TEXT',
  'SMALLINT', 'INTEGER', 'BIGINT',
  'NUMERIC(10,2)', 'NUMERIC(20,4)',
  'BOOLEAN',
  'DATE', 'TIMESTAMP', 'TIMESTAMPTZ',
  'UUID', 'JSONB',
];

let containerEl = null;
let columnsData = [];

export function createColumnInfo() {
  const wrapper = document.createElement('div');
  wrapper.className = 'column-info';
  wrapper.id = 'column-info-panel';
  wrapper.innerHTML = `
    <div class="column-info-header">Column Types (PostgreSQL)</div>
    <div id="col-rows" class="empty-state" style="padding:12px;">
      <span style="font-size:12px; color: var(--text-muted);">
        Run Data Clean to see column analysis
      </span>
    </div>
  `;
  containerEl = wrapper;
  return wrapper;
}

export function updateColumnInfo(columns) {
  columnsData = columns;
  if (!containerEl) return;

  const colRows = containerEl.querySelector('#col-rows');
  if (!columns || columns.length === 0) {
    colRows.innerHTML = '<span style="color: var(--text-muted); font-size:12px;">No columns</span>';
    colRows.className = 'empty-state';
    return;
  }

  colRows.className = '';
  let html = '';
  columns.forEach((col, i) => {
    html += `
      <div class="col-row">
        <span class="col-name" title="${col.originalName || col.name}">${col.name}</span>
        <select class="col-type-select" data-col-index="${i}">
          ${PG_TYPES.map(t => `<option value="${t}" ${col.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          ${!PG_TYPES.includes(col.type) ? `<option value="${col.type}" selected>${col.type}</option>` : ''}
        </select>
      </div>
    `;
  });
  colRows.innerHTML = html;

  // Listen for changes
  colRows.querySelectorAll('.col-type-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.colIndex);
      columnsData[idx].type = e.target.value;
    });
  });
}

export function getColumnTypes() {
  return columnsData.map(c => ({ name: c.name, type: c.type }));
}

export default { createColumnInfo, updateColumnInfo, getColumnTypes };
