/**
 * Workspace View — Upload 25% left | Recent Files 75% right
 */
import { createFileCard } from '../components/fileCard.js';
import storage from '../core/storage.js';
import api from '../core/api.js';
import logger from '../core/logger.js';

export function createWorkspaceView({ onFileOpen }) {
  const view = document.createElement('div');
  view.className = 'workspace-view';
  view.id = 'workspace-view';

  // ── LEFT (25%): Upload Zone ──
  const left = document.createElement('div');
  left.className = 'workspace-left';
  left.innerHTML = `
    <div class="workspace-hero">
      <h1>Excel to Database</h1>
      <p>Upload, view, clean, and transform your Excel files</p>
    </div>
    <div class="upload-zone" id="upload-zone">
      <div class="upload-icon">📤</div>
      <h3>Upload File</h3>
      <p>Drop a file here or click to browse<br>
        <span style="color:var(--text-muted);font-size:10px;">.xls .xlsx .xlsm .xlsb .csv .ods — Max 50MB</span>
      </p>
      <input type="file" id="file-input" accept=".xls,.xlsx,.xlsm,.xlsb,.csv,.ods">
    </div>
  `;

  // ── RIGHT (75%): Recent Files ──
  const right = document.createElement('div');
  right.className = 'workspace-right';
  right.innerHTML = `
    <h2>📂 Recent Files</h2>
    <div class="recent-grid" id="recent-grid"></div>
  `;

  view.appendChild(left);
  view.appendChild(right);

  const uploadZone = left.querySelector('#upload-zone');
  const fileInput = left.querySelector('#file-input');
  const recentGrid = right.querySelector('#recent-grid');

  // Upload zone events
  uploadZone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') fileInput.click();
  });

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleUpload(file);
    fileInput.value = '';
  });

  async function handleUpload(file) {
    const sizeKB = (file.size / 1024).toFixed(1);
    logger.info(`📤 Uploading: ${file.name} (${sizeKB} KB)`);

    const origHTML = uploadZone.innerHTML;
    uploadZone.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
        <div class="spinner"></div>
        <div style="font-size:13px;font-weight:500;">Uploading...</div>
        <div style="font-size:11px;color:var(--text-muted);">${file.name}</div>
      </div>
    `;
    uploadZone.style.pointerEvents = 'none';

    try {
      const result = await api.uploadFile(file);
      logger.success(`✅ Uploaded: ${result.originalName} — ${result.sheets.length} sheet(s)`);

      await storage.addRecentFile({
        fileId: result.id,
        originalName: result.originalName,
        sheets: result.sheets,
        size: file.size,
      });
      try {
        await api.addRecentToServer({ fileId: result.id, originalName: result.originalName });
      } catch (e) {}

      onFileOpen(result.id);
    } catch (err) {
      logger.error(`❌ Upload failed: ${err.message}`);
      uploadZone.innerHTML = origHTML;
      uploadZone.style.pointerEvents = '';
      // Re-attach
      const newInput = uploadZone.querySelector('#file-input');
      if (newInput) {
        newInput.addEventListener('change', (e) => {
          const f = e.target.files[0];
          if (f) handleUpload(f);
          newInput.value = '';
        });
      }
    }
  }

  // Load recent files
  async function loadRecent() {
    const recent = await storage.getRecentFiles();
    let serverFiles = [];
    try { serverFiles = await api.listFiles(); } catch (e) {}

    const merged = recent.map(r => {
      const sf = serverFiles.find(f => f.id === r.fileId);
      return { ...r, ...(sf || {}), fileId: r.fileId };
    });

    recentGrid.innerHTML = '';

    if (merged.length === 0) {
      recentGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
          <div class="empty-icon">📁</div>
          <p style="color: var(--text-muted); font-size: 13px;">No recent files — upload an Excel file to get started</p>
        </div>
      `;
      return;
    }

    merged.forEach(file => {
      const card = createFileCard(file, {
        onClick: (f) => {
          logger.info(`Opening: ${f.originalName}`);
          onFileOpen(f.fileId || f.id);
        },
        onDelete: async (f) => {
          await storage.removeRecentFile(f.fileId || f.id);
          loadRecent();
          logger.info(`Removed from recent: ${f.originalName}`);
        },
      });
      recentGrid.appendChild(card);
    });
  }

  setTimeout(loadRecent, 100);
  return view;
}

export default { createWorkspaceView };
