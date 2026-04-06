/**
 * File Card component for recent files grid
 */

export function createFileCard(file, { onClick, onDelete }) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.id = `file-card-${file.fileId || file.id}`;

  const ext = (file.originalName || '').split('.').pop()?.toLowerCase() || 'xlsx';
  const icons = { xlsx: '📊', xls: '📗', csv: '📄', xlsm: '📕', xlsb: '📘', ods: '📙' };
  const icon = icons[ext] || '📊';

  const size = file.size ? formatSize(file.size) : '';
  const date = file.openedAt ? formatDate(file.openedAt) : (file.uploadedAt ? formatDate(file.uploadedAt) : '');
  const sheetCount = file.sheets ? `${file.sheets.length} sheet${file.sheets.length !== 1 ? 's' : ''}` : '';

  card.innerHTML = `
    <div class="file-icon">${icon}</div>
    <div class="file-name" title="${file.originalName || ''}">${file.originalName || 'Unknown'}</div>
    <div class="file-meta">${[sheetCount, size, date].filter(Boolean).join(' · ')}</div>
    <button class="btn-icon file-delete" title="Remove">✕</button>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('.file-delete')) return;
    onClick?.(file);
  });

  card.querySelector('.file-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    onDelete?.(file);
  });

  return card;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export default { createFileCard };
