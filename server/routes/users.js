import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const usersFile = path.join(__dirname, '..', 'data', 'users.json');

function loadUsers() {
  if (!fs.existsSync(usersFile)) return {};
  return JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
}
function saveUsers(data) {
  fs.writeFileSync(usersFile, JSON.stringify(data, null, 2));
}

// Get or auto-create user by IP (detected from middleware)
router.get('/me', (req, res) => {
  const ip = req.clientIp;
  const users = loadUsers();

  if (!users[ip]) {
    users[ip] = {
      id: ip,
      ip: ip,
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      recentFiles: [],
      preferences: { theme: 'dark' },
      toolboxes: [],
      pgConnections: [],
    };
    saveUsers(users);
  } else {
    users[ip].lastSeen = new Date().toISOString();
    saveUsers(users);
  }

  res.json(users[ip]);
});

// Update user
router.put('/me', (req, res) => {
  const ip = req.clientIp;
  const users = loadUsers();
  const existing = users[ip] || {};
  users[ip] = {
    ...existing,
    ...req.body,
    id: ip,
    ip: ip,
    lastSeen: new Date().toISOString(),
  };
  saveUsers(users);
  res.json(users[ip]);
});

// Add recent file
router.post('/me/recent', (req, res) => {
  const ip = req.clientIp;
  const users = loadUsers();
  if (!users[ip]) {
    users[ip] = {
      id: ip, ip, createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(), recentFiles: [],
      preferences: { theme: 'dark' }, toolboxes: [], pgConnections: [],
    };
  }
  const user = users[ip];
  user.recentFiles = user.recentFiles.filter(f => f.fileId !== req.body.fileId);
  user.recentFiles.unshift({
    fileId: req.body.fileId,
    originalName: req.body.originalName,
    openedAt: new Date().toISOString(),
  });
  user.recentFiles = user.recentFiles.slice(0, 20);
  user.lastSeen = new Date().toISOString();
  saveUsers(users);
  res.json(user);
});

// ===== PostgreSQL Connections CRUD =====

// Get all PG connections for this user
router.get('/me/pg-connections', (req, res) => {
  const ip = req.clientIp;
  const users = loadUsers();
  const user = users[ip];
  if (!user) return res.json([]);
  res.json(user.pgConnections || []);
});

// Add a PG connection
router.post('/me/pg-connections', (req, res) => {
  const ip = req.clientIp;
  const users = loadUsers();
  if (!users[ip]) {
    return res.status(404).json({ error: 'User not found' });
  }
  const conn = {
    id: `pg_${Date.now()}`,
    name: req.body.name || 'Untitled',
    host: req.body.host,
    port: req.body.port || 5432,
    database: req.body.database,
    username: req.body.username,
    password: req.body.password,
    createdAt: new Date().toISOString(),
  };
  if (!users[ip].pgConnections) users[ip].pgConnections = [];
  users[ip].pgConnections.push(conn);
  saveUsers(users);
  res.json(conn);
});

// Update a PG connection
router.put('/me/pg-connections/:connId', (req, res) => {
  const ip = req.clientIp;
  const users = loadUsers();
  if (!users[ip]) return res.status(404).json({ error: 'User not found' });
  const idx = (users[ip].pgConnections || []).findIndex(c => c.id === req.params.connId);
  if (idx < 0) return res.status(404).json({ error: 'Connection not found' });
  users[ip].pgConnections[idx] = { ...users[ip].pgConnections[idx], ...req.body, id: req.params.connId };
  saveUsers(users);
  res.json(users[ip].pgConnections[idx]);
});

// Delete a PG connection
router.delete('/me/pg-connections/:connId', (req, res) => {
  const ip = req.clientIp;
  const users = loadUsers();
  if (!users[ip]) return res.status(404).json({ error: 'User not found' });
  users[ip].pgConnections = (users[ip].pgConnections || []).filter(c => c.id !== req.params.connId);
  saveUsers(users);
  res.json({ message: 'Connection deleted' });
});

export default router;
