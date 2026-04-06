/**
 * Data Clean tool — front-end logic
 * Triggers server-side Excel → CSV conversion + column analysis
 */
import api from '../core/api.js';
import logger from '../core/logger.js';

export async function runDataClean(fileId) {
  logger.info('🧹 Initiating Data Clean process...');

  try {
    const result = await api.runDataClean(fileId);

    logger.success(`✅ Data Clean complete: ${result.sheetsProcessed} sheet(s)`);

    result.results.forEach(sheet => {
      if (sheet.csvFile) {
        logger.info(`  📄 ${sheet.sheetName} → ${sheet.csvFile} (${sheet.rows} rows, ${sheet.columns.length} cols)`);
      } else {
        logger.warn(`  ⚠️ ${sheet.sheetName} — empty sheet, skipped`);
      }
    });

    return result;
  } catch (err) {
    logger.error(`❌ Data Clean failed: ${err.message}`);
    throw err;
  }
}

export function downloadAllCsvs(fileId) {
  api.downloadDataCleanZip(fileId);
  logger.info('📦 Started ZIP download for all CSVs');
}

export default { runDataClean, downloadAllCsvs };
