import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import filesRouter from './routes/files.js';
import usersRouter from './routes/users.js';
import toolsRouter from './routes/tools.js';

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.SERVER_PORT || 5555;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for local network access
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Inject client IP into request — used as user identity
app.use((req, res, next) => {
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  // Normalize IPv6 localhost to IPv4
  if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';
  // Strip ::ffff: prefix
  if (ip && ip.startsWith('::ffff:')) ip = ip.slice(7);
  req.clientIp = ip;
  next();
});

// Ensure data directories exist
const dirs = [
  path.join(__dirname, 'data'),
  path.join(__dirname, 'data', 'uploads'),
  path.join(__dirname, 'output'),
  path.join(__dirname, 'scripts'),
];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize users.json if it doesn't exist
const usersFile = path.join(__dirname, 'data', 'users.json');
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify({}, null, 2));
}

// Static serve output files
app.use('/output', express.static(path.join(__dirname, 'output')));

// Routes
app.use('/api/files', filesRouter);
app.use('/api/users', usersRouter);
app.use('/api/tools', toolsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), clientIp: req.clientIp });
});

// Get client IP endpoint (used by frontend to identify user)
app.get('/api/whoami', (req, res) => {
  res.json({ 
    ip: req.clientIp === '127.0.0.1' ? getLanIp() : req.clientIp,
    lanIp: getLanIp() 
  });
});

app.listen(PORT, () => {
  const lanIp = getLanIp();
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║     ⚡ Excel to Database Server      ║');
  console.log(`  ║     Port: ${PORT}                       ║`);
  console.log(`  ║     LAN:  ${lanIp}:${PORT}              ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log(`  📁 Uploads: ${path.join(__dirname, 'data', 'uploads')}`);
  console.log(`  📤 Output:  ${path.join(__dirname, 'output')}`);
  console.log('');
});
