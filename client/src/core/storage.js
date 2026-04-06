/**
 * Browser-side storage using localForage (IndexedDB)
 * User identity is based on server-detected IPv4 address
 */
import localforage from 'localforage';

const mainStore = localforage.createInstance({ name: 'excelFormatter', storeName: 'main' });
const toolStore = localforage.createInstance({ name: 'excelFormatter', storeName: 'toolboxes' });
const recordingStore = localforage.createInstance({ name: 'excelFormatter', storeName: 'recordings' });

// User IP (set after server call)
let _userIp = null;

export function setUserIp(ip) {
  _userIp = ip;
  localStorage.setItem('ef_user_ip', ip);
}

export function getUserIp() {
  if (_userIp) return _userIp;
  return localStorage.getItem('ef_user_ip') || '127.0.0.1';
}

// Recent Files
export async function getRecentFiles() {
  return (await mainStore.getItem('recentFiles')) || [];
}

export async function addRecentFile(file) {
  let recent = await getRecentFiles();
  recent = recent.filter(f => f.fileId !== file.fileId);
  recent.unshift({ ...file, openedAt: new Date().toISOString() });
  recent = recent.slice(0, 20);
  await mainStore.setItem('recentFiles', recent);
  return recent;
}

export async function removeRecentFile(fileId) {
  let recent = await getRecentFiles();
  recent = recent.filter(f => f.fileId !== fileId);
  await mainStore.setItem('recentFiles', recent);
  return recent;
}

// Toolbox configs
export async function getToolboxes() {
  return (await toolStore.getItem('toolboxes')) || [];
}

export async function saveToolbox(toolbox) {
  const toolboxes = await getToolboxes();
  const idx = toolboxes.findIndex(t => t.id === toolbox.id);
  if (idx >= 0) toolboxes[idx] = toolbox;
  else toolboxes.push(toolbox);
  await toolStore.setItem('toolboxes', toolboxes);
  return toolboxes;
}

export async function deleteToolbox(id) {
  let toolboxes = await getToolboxes();
  toolboxes = toolboxes.filter(t => t.id !== id);
  await toolStore.setItem('toolboxes', toolboxes);
  return toolboxes;
}

// Recordings
export async function getRecordings() {
  return (await recordingStore.getItem('recordings')) || [];
}

export async function saveRecording(recording) {
  const recordings = await getRecordings();
  recordings.push(recording);
  await recordingStore.setItem('recordings', recordings);
  return recordings;
}

// Preferences
export async function getPreferences() {
  return (await mainStore.getItem('preferences')) || { theme: 'dark' };
}

export async function setPreferences(prefs) {
  await mainStore.setItem('preferences', prefs);
}

// Data Clean results cache
export async function cacheCleanResults(fileId, results) {
  await mainStore.setItem(`cleanResults_${fileId}`, results);
}

export async function getCachedCleanResults(fileId) {
  return await mainStore.getItem(`cleanResults_${fileId}`);
}

export default {
  setUserIp, getUserIp,
  getRecentFiles, addRecentFile, removeRecentFile,
  getToolboxes, saveToolbox, deleteToolbox,
  getRecordings, saveRecording,
  getPreferences, setPreferences,
  cacheCleanResults, getCachedCleanResults,
};
