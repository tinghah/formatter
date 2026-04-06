import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.xls', '.xlsx', '.xlsm', '.xlsb', '.csv', '.ods'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
});

// File metadata store
const metaFile = path.join(__dirname, '..', 'data', 'files_meta.json');
function loadMeta() {
  if (!fs.existsSync(metaFile)) return {};
  return JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
}
function saveMeta(data) {
  fs.writeFileSync(metaFile, JSON.stringify(data, null, 2));
}

// Upload a file
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Fix UTF-8 Mojibake in originalName (Multer common issue)
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const filePath = file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer);

    const sheets = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      return {
        name,
        rows: jsonData.length,
        cols: range.e.c + 1,
        preview: jsonData.slice(0, 5),
      };
    });

    const id = path.basename(file.filename, path.extname(file.filename));
    const meta = loadMeta();
    meta[id] = {
      id,
      originalName: originalName,
      filename: file.filename,
      size: file.size,
      sheets: sheets.map(s => ({ name: s.name, rows: s.rows, cols: s.cols })),
      uploadedAt: new Date().toISOString(),
    };
    saveMeta(meta);

    res.json({
      id,
      originalName: originalName,
      sheets,
      message: 'File uploaded successfully',
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List all files
router.get('/list', (req, res) => {
  const meta = loadMeta();
  const files = Object.values(meta).sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );
  res.json(files);
});

// Get file data (all sheets as JSON)
router.get('/:id', (req, res) => {
  try {
    const meta = loadMeta();
    const fileMeta = meta[req.params.id];
    if (!fileMeta) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(uploadsDir, fileMeta.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer);
    const sheets = {};
    workbook.SheetNames.forEach(name => {
      const sheet = workbook.Sheets[name];
      sheets[name] = {
        data: XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }),
        range: sheet['!ref'],
        merges: sheet['!merges'] || [],
      };
    });

    res.json({
      ...fileMeta,
      sheetsData: sheets,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update file data (persist changes to server)
router.put('/:id', express.json({ limit: '50mb' }), (req, res) => {
  try {
    const { sheetName, data } = req.body;
    const meta = loadMeta();
    const fileMeta = meta[req.params.id];
    if (!fileMeta) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(uploadsDir, fileMeta.filename);
    
    // Read current workbook using buffer for ESM compatibility
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer);
    
    // Convert new data to worksheet
    const newWs = XLSX.utils.aoa_to_sheet(data);
    
    // Update the specific sheet
    workbook.Sheets[sheetName] = newWs;
    
    // Write back to file using buffer
    const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    fs.writeFileSync(filePath, outBuffer);
    
    // Update meta sheets info (rows/cols may have changed)
    const range = XLSX.utils.decode_range(newWs['!ref'] || 'A1');
    const sheetIdx = fileMeta.sheets.findIndex(s => s.name === sheetName);
    if (sheetIdx !== -1) {
      fileMeta.sheets[sheetIdx].rows = data.length;
      fileMeta.sheets[sheetIdx].cols = range.e.c + 1;
    }
    saveMeta(meta);

    res.json({ success: true, message: `Sheet "${sheetName}" saved successfully` });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download file with format options (?format=xlsx|csv|original, &sheet=0)
router.get('/:id/download', (req, res) => {
  try {
    const meta = loadMeta();
    const fileMeta = meta[req.params.id];
    if (!fileMeta) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(uploadsDir, fileMeta.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

    const format = req.query.format || 'original';
    const sheetIdx = parseInt(req.query.sheet) || 0;
    const baseName = path.basename(fileMeta.originalName, path.extname(fileMeta.originalName));

    if (format === 'original') {
      return res.download(filePath, fileMeta.originalName);
    }

    // Read workbook
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer);

    if (format === 'xlsx') {
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`);
      return res.send(Buffer.from(buffer));
    }

    if (format === 'csv') {
      const sheetName = workbook.SheetNames[sheetIdx] || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}_${sheetName}.csv"`);
      return res.send(csv);
    }

    // Fallback
    return res.download(filePath, fileMeta.originalName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export current spreadsheet state back as a new CSV workbook (saved to recent)
router.post('/export', express.json({ limit: '50mb' }), (req, res) => {
  try {
    const { originalName, sheets } = req.body;
    if (!sheets || sheets.length === 0) return res.status(400).json({ error: 'No sheet data provided' });

    const id = uuidv4();
    const filename = `${id}.xlsx`; 
    
    const filePath = path.join(uploadsDir, filename);
    const workbook = XLSX.utils.book_new();
    
    const metaSheets = [];
    sheets.forEach(s => {
      const ws = XLSX.utils.aoa_to_sheet(s.data);
      XLSX.utils.book_append_sheet(workbook, ws, s.name);
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      metaSheets.push({
        name: s.name,
        rows: s.data.length,
        cols: range.e.c + 1
      });
    });

    const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    fs.writeFileSync(filePath, outBuffer);

    const meta = loadMeta();
    meta[id] = {
      id,
      originalName: `Exported_${originalName || 'Untitled'}.xlsx`,
      filename: `${id}.xlsx`,
      size: outBuffer.length,
      sheets: metaSheets,
      uploadedAt: new Date().toISOString(),
    };
    saveMeta(meta);

    res.json({ success: true, id, message: 'Exported successfully to Recent Files' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename a file
router.patch('/:id/rename', express.json(), (req, res) => {
  try {
    const { newName } = req.body;
    if (!newName) return res.status(400).json({ error: 'newName is required' });

    const meta = loadMeta();
    if (!meta[req.params.id]) return res.status(404).json({ error: 'File not found' });

    meta[req.params.id].originalName = newName;
    saveMeta(meta);

    res.json({ message: 'File renamed successfully', originalName: newName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a file
router.delete('/:id', (req, res) => {
  const meta = loadMeta();
  const fileMeta = meta[req.params.id];
  if (!fileMeta) return res.status(404).json({ error: 'File not found' });

  const filePath = path.join(uploadsDir, fileMeta.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  delete meta[req.params.id];
  saveMeta(meta);

  res.json({ message: 'File deleted' });
});

export default router;
