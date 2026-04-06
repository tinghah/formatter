/**
 * Action Recorder — RPA-like recording of user spreadsheet actions
 */
import storage from '../core/storage.js';
import logger from '../core/logger.js';

let actions = [];
let isRecording = false;
let recordingName = '';

export function startRecording(name = 'Untitled Recording') {
  actions = [];
  isRecording = true;
  recordingName = name;
  logger.info(`🎬 Recording started: "${name}"`);
}

export function stopRecording() {
  isRecording = false;
  return { actions: [...actions], count: actions.length };
}

export function recordAction(action) {
  if (!isRecording) return;
  const desc = `${action.type}${action.row !== undefined ? ` [R${action.row + 1}]` : ''}${action.col !== undefined ? ` [C${action.col + 1}]` : ''}${action.value !== undefined ? ` -> ${action.value}` : ''}`;
  actions.push({
    ...action,
    timestamp: Date.now(),
    index: actions.length,
    description: desc,
  });
  logger.info(`🔴 ${desc}`);
}

export function getIsRecording() {
  return isRecording;
}

export function getCurrentActions() {
  return [...actions];
}

export function getRecordedActions() {
  return [...actions];
}

export function clearRecordedActions() {
  actions = [];
}

export async function saveRecordingToDisk(recording) {
  await storage.saveRecording(recording);
  logger.success(`Recording "${recording.name}" saved (${recording.actionCount} actions)`);
}

export async function getRecordings() {
  return storage.getRecordings();
}

export function replayActions(spreadsheetInstance, actions) {
  if (!spreadsheetInstance) {
    logger.error('No spreadsheet instance to replay on');
    return;
  }

  logger.info(`▶️ Replaying ${actions.length} actions...`);

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'editCell':
          spreadsheetInstance.setValueFromCoords(action.col, action.row, action.value);
          break;
        case 'insertRow':
          spreadsheetInstance.insertRow();
          break;
        case 'deleteRow':
          spreadsheetInstance.deleteRow(action.row);
          break;
        case 'insertColumn':
          spreadsheetInstance.insertColumn();
          break;
        case 'deleteColumn':
          spreadsheetInstance.deleteColumn(action.col);
          break;
        default:
          logger.warn(`Unknown action type: ${action.type}`);
      }
    } catch (err) {
      logger.error(`Replay error at action ${action.index}: ${err.message}`);
    }
  }

  logger.success('▶️ Replay complete');
}

export default {
  startRecording,
  stopRecording,
  recordAction,
  getIsRecording,
  getCurrentActions,
  getRecordedActions,
  clearRecordedActions,
  saveRecordingToDisk,
  getRecordings,
  replayActions,
};
