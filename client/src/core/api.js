/**
 * API wrapper for backend communication
 */
const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ─── Identity ───
export function whoami() {
  return request('/whoami');
}

// ─── Files ───
export async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/files/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

export function listFiles() {
  return request('/files/list');
}

export function getFileData(id) {
  return request(`/files/${id}`);
}

export function deleteFile(id) {
  return request(`/files/${id}`, { method: 'DELETE' });
}

export function saveFileData(id, sheetName, data) {
  return request(`/files/${id}`, { method: 'PUT', body: JSON.stringify({ sheetName, data }) });
}

export function renameFile(id, newName) {
  return request(`/files/${id}/rename`, { method: 'PATCH', body: JSON.stringify({ newName }) });
}

// ─── Users (IP-based) ───
export function getMe() {
  return request('/users/me');
}

export function updateMe(data) {
  return request('/users/me', { method: 'PUT', body: JSON.stringify(data) });
}

export function addRecentToServer(fileInfo) {
  return request('/users/me/recent', { method: 'POST', body: JSON.stringify(fileInfo) });
}

// ─── PostgreSQL Connections ───
export function getPgConnections() {
  return request('/users/me/pg-connections');
}

export function addPgConnection(conn) {
  return request('/users/me/pg-connections', { method: 'POST', body: JSON.stringify(conn) });
}

export function updatePgConnection(connId, data) {
  return request(`/users/me/pg-connections/${connId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deletePgConnection(connId) {
  return request(`/users/me/pg-connections/${connId}`, { method: 'DELETE' });
}

export function testPgConnection(conn) {
  return request('/tools/pg-test', { method: 'POST', body: JSON.stringify(conn) });
}

export function pgImport(connectionId, fileId, sheets) {
  return request('/tools/pg-import', { method: 'POST', body: JSON.stringify({ connectionId, fileId, sheets }) });
}

// ─── Tools ───
export function runDataClean(fileId) {
  return request('/tools/data-clean', { method: 'POST', body: JSON.stringify({ fileId }) });
}

export function executeActions(fileId, actions) {
  return request('/tools/execute', { method: 'POST', body: JSON.stringify({ fileId, actions }) });
}

export function downloadDataCleanZip(fileId) {
  window.open(`${BASE}/tools/data-clean/${fileId}/download-all`, '_blank');
}

export function exportWorkbook(originalName, sheets) {
  return request('/files/export', { method: 'POST', body: JSON.stringify({ originalName, sheets }) });
}

export default {
  whoami, uploadFile, listFiles, getFileData, deleteFile, saveFileData, renameFile, exportWorkbook,
  getMe, updateMe, addRecentToServer,
  getPgConnections, addPgConnection, updatePgConnection, deletePgConnection,
  testPgConnection, pgImport,
  runDataClean, executeActions, downloadDataCleanZip,
};
