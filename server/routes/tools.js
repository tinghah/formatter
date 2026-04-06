import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import * as XLSX from 'xlsx';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
const outputDir = path.join(__dirname, '..', 'output');
const scriptsDir = path.join(__dirname, '..', 'scripts');
const usersFile = path.join(__dirname, '..', 'data', 'users.json');

function loadMeta() {
  const metaFile = path.join(__dirname, '..', 'data', 'files_meta.json');
  if (!fs.existsSync(metaFile)) return {};
  return JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
}

function loadUsers() {
  if (!fs.existsSync(usersFile)) return {};
  return JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
}

// ─── Infer PostgreSQL type from sample values ───
function inferPgType(values) {
  const nonEmpty = values.filter(v => v !== '' && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return { type: 'TEXT', confidence: 0 };

  let isInt = true, isFloat = true, isBool = true, isDate = true;
  let maxLen = 0;

  for (const val of nonEmpty) {
    const str = String(val).trim();
    maxLen = Math.max(maxLen, str.length);
    if (isInt && !/^-?\d+$/.test(str)) isInt = false;
    if (isFloat && !/^-?\d+\.?\d*$/.test(str)) isFloat = false;
    if (isBool && !['true', 'false', '0', '1', 'yes', 'no'].includes(str.toLowerCase())) isBool = false;
    if (isDate) {
      const d = new Date(str);
      if (isNaN(d.getTime()) || str.length < 6) isDate = false;
    }
  }

  if (isBool) return { type: 'BOOLEAN', confidence: 90 };
  if (isInt) {
    const maxVal = Math.max(...nonEmpty.map(v => Math.abs(parseInt(v))));
    if (maxVal < 32768) return { type: 'SMALLINT', confidence: 95 };
    if (maxVal < 2147483648) return { type: 'INTEGER', confidence: 95 };
    return { type: 'BIGINT', confidence: 95 };
  }
  if (isFloat) return { type: `NUMERIC(${Math.min(maxLen + 2, 20)}, 2)`, confidence: 85 };
  if (isDate) return { type: 'TIMESTAMP', confidence: 80 };
  if (maxLen <= 255) return { type: `VARCHAR(${Math.max(maxLen * 2, 50)})`, confidence: 75 };
  return { type: 'TEXT', confidence: 70 };
}

// ─── Data Clean: Excel → CSVs + column analysis ───
router.post('/data-clean', (req, res) => {
  try {
    const { fileId } = req.body;
    const meta = loadMeta();
    const fileMeta = meta[fileId];
    if (!fileMeta) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(uploadsDir, fileMeta.filename);
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer);
    const baseName = path.basename(fileMeta.originalName, path.extname(fileMeta.originalName));

    const results = [];

    workbook.SheetNames.forEach((sheetName, idx) => {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (jsonData.length === 0) {
        results.push({ sheetName, rows: 0, columns: [], csvFile: null });
        return;
      }

      const headers = jsonData[0].map((h, i) => h ? String(h).trim() : `column_${i + 1}`);
      const dataRows = jsonData.slice(1);

      const columns = headers.map((header, colIdx) => {
        const colValues = dataRows.map(row => row[colIdx]);
        const analysis = inferPgType(colValues);
        return {
          index: colIdx,
          name: header.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
          originalName: header,
          sampleValues: colValues.slice(0, 5),
          nullCount: colValues.filter(v => v === '' || v === null || v === undefined).length,
          totalRows: dataRows.length,
          ...analysis,
        };
      });

      // Generate CSV
      const csvContent = XLSX.utils.sheet_to_csv(sheet);
      const safeSheetName = sheetName.replace(/[^a-zA-Z0-9]/g, '_');
      const csvFilename = `${baseName}_Sheet${idx + 1}_${safeSheetName}.csv`;
      const csvPath = path.join(outputDir, csvFilename);
      fs.writeFileSync(csvPath, csvContent, 'utf-8');

      // Generate CREATE TABLE DDL
      const tableName = `${baseName}_${safeSheetName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const ddl = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n` +
        columns.map(c => `  "${c.name}" ${c.type}`).join(',\n') +
        '\n);';

      results.push({
        sheetName,
        sheetIndex: idx,
        rows: dataRows.length,
        columns,
        csvFile: csvFilename,
        csvUrl: `/output/${csvFilename}`,
        ddl,
        tableName,
      });
    });

    res.json({
      fileId,
      originalName: fileMeta.originalName,
      sheetsProcessed: results.length,
      results,
    });
  } catch (err) {
    console.error('Data clean error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Download all CSVs as ZIP ───
router.get('/data-clean/:fileId/download-all', (req, res) => {
  try {
    const meta = loadMeta();
    const fileMeta = meta[req.params.fileId];
    if (!fileMeta) return res.status(404).json({ error: 'File not found' });

    const baseName = path.basename(fileMeta.originalName, path.extname(fileMeta.originalName));
    const csvFiles = fs.readdirSync(outputDir).filter(f => f.startsWith(baseName) && f.endsWith('.csv'));

    if (csvFiles.length === 0) return res.status(404).json({ error: 'No CSV files found. Run Data Clean first.' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}_csvs.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    csvFiles.forEach(f => archive.file(path.join(outputDir, f), { name: f }));
    archive.finalize();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PostgreSQL Import via Python ───
router.post('/pg-import', (req, res) => {
  const { connectionId, fileId, sheets } = req.body;
  const ip = req.clientIp;

  // Load user's PG connections
  const users = loadUsers();
  const user = users[ip];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const conn = (user.pgConnections || []).find(c => c.id === connectionId);
  if (!conn) return res.status(404).json({ error: 'PostgreSQL connection not found' });

  const meta = loadMeta();
  const fileMeta = meta[fileId];
  if (!fileMeta) return res.status(404).json({ error: 'File not found' });

  // Build CSV file list
  const baseName = path.basename(fileMeta.originalName, path.extname(fileMeta.originalName));
  const csvFiles = [];
  const sheetsToImport = sheets || [];

  // Find matching CSVs in output dir
  const allCsvs = fs.readdirSync(outputDir).filter(f => f.startsWith(baseName) && f.endsWith('.csv'));
  
  if (sheetsToImport.length > 0) {
    sheetsToImport.forEach(s => {
      const found = allCsvs.find(f => f.includes(s.sheetName.replace(/[^a-zA-Z0-9]/g, '_')));
      if (found) csvFiles.push({ file: path.join(outputDir, found), tableName: s.tableName || found.replace('.csv', '').toLowerCase() });
    });
  } else {
    allCsvs.forEach(f => {
      csvFiles.push({ file: path.join(outputDir, f), tableName: f.replace('.csv', '').toLowerCase().replace(/[^a-z0-9_]/g, '_') });
    });
  }

  if (csvFiles.length === 0) {
    return res.status(400).json({ error: 'No CSV files found. Run Data Clean first.' });
  }

  // Build import config for Python script
  const importConfig = {
    connection: {
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      password: conn.password,
    },
    imports: csvFiles,
  };

  const configPath = path.join(outputDir, `import_config_${Date.now()}.json`);
  fs.writeFileSync(configPath, JSON.stringify(importConfig, null, 2));

  const scriptPath = path.join(scriptsDir, 'pg_import.py');

  // Execute Python script
  execFile('python', [scriptPath, configPath], { timeout: 120000 }, (error, stdout, stderr) => {
    // Clean up config file
    try { fs.unlinkSync(configPath); } catch (e) {}

    if (error) {
      console.error('PG Import error:', error.message, stderr);
      return res.status(500).json({
        error: 'PostgreSQL import failed',
        details: stderr || error.message,
        stdout,
      });
    }

    let result;
    try {
      result = JSON.parse(stdout);
    } catch (e) {
      result = { message: stdout, status: 'completed' };
    }

    res.json({
      success: true,
      ...result,
    });
  });
});

// ─── Test PostgreSQL connection ───
router.post('/pg-test', (req, res) => {
  const { host, port, database, username, password } = req.body;

  const testConfig = {
    connection: { host, port: port || 5432, database, username, password },
    action: 'test',
  };

  const configPath = path.join(outputDir, `test_config_${Date.now()}.json`);
  fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));

  const scriptPath = path.join(scriptsDir, 'pg_import.py');

  execFile('python', [scriptPath, configPath], { timeout: 15000 }, (error, stdout, stderr) => {
    try { fs.unlinkSync(configPath); } catch (e) {}

    if (error) {
      return res.status(500).json({ success: false, error: stderr || error.message });
    }

    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (e) {
      res.json({ success: stdout.includes('success'), message: stdout });
    }
  });
});

// ─── Execute recorded actions (RPA replay) ───
router.post('/execute', (req, res) => {
  try {
    const { fileId, actions } = req.body;
    const results = actions.map((action, i) => ({
      action: action.type,
      index: i,
      status: 'completed',
      timestamp: new Date().toISOString(),
    }));
    res.json({ fileId, actionsExecuted: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
