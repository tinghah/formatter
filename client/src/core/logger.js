/**
 * Centralized logging system
 * Pushes log entries to the UI log panel in real time
 */

const MAX_LOGS = 500;
let logs = [];
let listeners = [];

function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function addLog(level, message) {
  const entry = { level, message, time: now(), id: Date.now() + Math.random() };
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs = logs.slice(-MAX_LOGS);
  listeners.forEach(fn => fn(entry, logs));
  return entry;
}

export function info(msg) { return addLog('info', msg); }
export function success(msg) { return addLog('success', msg); }
export function warn(msg) { return addLog('warn', msg); }
export function error(msg) { return addLog('error', msg); }

export function getLogs() { return [...logs]; }
export function clearLogs() { logs = []; listeners.forEach(fn => fn(null, [])); }

export function onLog(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export default { info, success, warn, error, getLogs, clearLogs, onLog };
