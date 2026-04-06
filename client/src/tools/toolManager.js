/**
 * Tool Manager — registry for tools, save/load toolboxes
 */
import storage from '../core/storage.js';
import logger from '../core/logger.js';

const builtInTools = [
  {
    id: 'data-clean',
    name: 'Data Clean',
    icon: '🧹',
    description: 'Convert Excel sheets to CSV files with PostgreSQL column type analysis',
    builtin: true,
  },
];

let userToolboxes = [];

export async function init() {
  userToolboxes = await storage.getToolboxes();
  logger.info(`Tool Manager initialized — ${builtInTools.length} built-in, ${userToolboxes.length} user toolboxes`);
}

export function getBuiltInTools() {
  return [...builtInTools];
}

export function getUserToolboxes() {
  return [...userToolboxes];
}

export async function createToolbox(name) {
  const toolbox = {
    id: `tb_${Date.now()}`,
    name,
    tools: [],
    createdAt: new Date().toISOString(),
  };
  userToolboxes = await storage.saveToolbox(toolbox);
  logger.success(`Created toolbox: "${name}"`);
  return toolbox;
}

export async function addToolToToolbox(toolboxId, tool) {
  const tb = userToolboxes.find(t => t.id === toolboxId);
  if (!tb) throw new Error('Toolbox not found');
  tb.tools.push(tool);
  userToolboxes = await storage.saveToolbox(tb);
  return tb;
}

export async function removeToolbox(toolboxId) {
  userToolboxes = await storage.deleteToolbox(toolboxId);
  logger.info('Toolbox removed');
}

export default { init, getBuiltInTools, getUserToolboxes, createToolbox, addToolToToolbox, removeToolbox };
