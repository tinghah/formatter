/**
 * Log Panel component — displays process logs in real time
 */
import logger from '../core/logger.js';

export function createLogPanel() {
  const panel = document.createElement('div');
    panel.className = 'panel log-panel collapsed'; // Starts collapsed by default
    panel.innerHTML = `
    <div class="panel-header">
      <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" id="log-collapse-toggle">
        <span class="collapse-icon">▶</span>
        <h3>📋 Logs</h3>
      </div>
      <div class="header-actions">
        <button class="btn-icon" id="log-clear-btn" title="Clear logs">🗑️</button>
        <button class="btn-icon" id="log-scroll-btn" title="Scroll to bottom">⬇️</button>
      </div>
    </div>
    <div class="panel-body" id="log-body"></div>
    `;

    const collapseToggle = panel.querySelector('#log-collapse-toggle');
    const collapseIcon = panel.querySelector('.collapse-icon');
    
    collapseToggle.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      collapseIcon.textContent = panel.classList.contains('collapsed') ? '▶' : '▼';
    });

  const body = panel.querySelector('#log-body');
  const clearBtn = panel.querySelector('#log-clear-btn');
  const scrollBtn = panel.querySelector('#log-scroll-btn');
  let autoScroll = true;

  function addEntry(entry) {
    if (!entry) {
      body.innerHTML = '';
      return;
    }
    const el = document.createElement('div');
    el.className = `log-entry log-${entry.level}`;
    el.innerHTML = `
      <span class="log-time">${entry.time}</span>
      <span class="log-msg">${escapeHtml(entry.message)}</span>
    `;
    body.appendChild(el);
    if (autoScroll) body.scrollTop = body.scrollHeight;
  }

  // Render existing logs
  logger.getLogs().forEach(addEntry);

  // Subscribe to new logs
  logger.onLog((entry, allLogs) => {
    if (!entry) {
      body.innerHTML = '';
      return;
    }
    addEntry(entry);
  });

  clearBtn.addEventListener('click', () => logger.clearLogs());
  scrollBtn.addEventListener('click', () => {
    body.scrollTop = body.scrollHeight;
    autoScroll = true;
  });

  body.addEventListener('scroll', () => {
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 20;
    autoScroll = atBottom;
  });

  return panel;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export default { createLogPanel };
