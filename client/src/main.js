/**
 * Excel Formatter — Main Application Entry
 */
import './styles/index.css';
import { createWorkspaceView } from './views/workspace.js';
import { createWorkbookView } from './views/workbook.js';
import { init as initToolManager } from './tools/toolManager.js';
import storage from './core/storage.js';
import api from './core/api.js';
import logger from './core/logger.js';

const app = document.getElementById('app');
let currentView = 'workspace';

function renderHeader() {
  const header = document.createElement('header');
  header.className = 'app-header';
  header.id = 'app-header';
  header.innerHTML = `
    <div class="logo">
      <div class="logo-icon">⚡</div>
      <span>Excel to Database</span>
    </div>
    <div class="header-actions">
      <span style="font-size: 12px; color: var(--text-muted);" id="user-ip-display">connecting...</span>
    </div>
  `;
  return header;
}

async function navigateTo(view, params = {}) {
  currentView = view;
  const content = document.getElementById('app-content');
  if (!content) return;

  content.innerHTML = '';

  if (view === 'workspace') {
    const workspace = createWorkspaceView({
      onFileOpen: (fileId) => navigateTo('workbook', { fileId }),
    });
    content.appendChild(workspace);
  } else if (view === 'workbook' && params.fileId) {
    const workbook = await createWorkbookView(params.fileId, {
      onBack: () => navigateTo('workspace'),
    });
    content.appendChild(workbook);
  }
}

async function init() {
  // Render shell
  app.innerHTML = '';
  app.appendChild(renderHeader());

  const content = document.createElement('div');
  content.id = 'app-content';
  content.style.cssText = 'flex: 1; display: flex; flex-direction: column; overflow: hidden;';
  app.appendChild(content);

  logger.info('🚀 Excel to Database starting...');

  // Identify user by IP
  try {
    const identity = await api.whoami();
    storage.setUserIp(identity.ip);
    const ipDisplay = document.getElementById('user-ip-display');
    if (ipDisplay) ipDisplay.textContent = `👤 ${identity.ip}`;
    logger.info(`User identified: ${identity.ip}`);

    // Ensure user exists on server
    await api.getMe();
    logger.info('User synced with server');
  } catch (e) {
    logger.warn('Server not available — running in offline mode');
    const ipDisplay = document.getElementById('user-ip-display');
    if (ipDisplay) ipDisplay.textContent = '⚠️ offline';
  }

  // Initialize tool manager
  await initToolManager();

  // Navigate to workspace
  await navigateTo('workspace');
  logger.success('✅ Ready');
}

// Boot
init().catch(err => {
  console.error('Failed to initialize:', err);
  app.innerHTML = `
    <div class="empty-state" style="height: 100vh;">
      <div class="empty-icon">❌</div>
      <h2>Failed to start</h2>
      <p>${err.message}</p>
    </div>
  `;
});
