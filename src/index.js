'use strict';

/**
 * @module bundlecheck
 * @description Analyze JavaScript bundle sizes with gzip/brotli estimates.
 * @author idirdev
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Format a byte count as a human-readable string (B, KB, MB).
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Calculate the percentage change between two values.
 * @param {number} a - Original value.
 * @param {number} b - New value.
 * @returns {number} Percentage change (positive = increase, negative = decrease).
 */
function percentChange(a, b) {
  if (a === 0) return b === 0 ? 0 : 100;
  return Math.round(((b - a) / a) * 10000) / 100;
}

/**
 * Analyze a single file for raw, gzip, and brotli sizes.
 * @param {string} filePath - Absolute path to the file.
 * @returns {{file:string, raw:number, gzip:number, brotli:number}}
 */
function analyzeFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath);
  } catch (err) {
    throw new Error('Cannot read file: ' + filePath + ' — ' + err.message);
  }

  const raw    = content.length;
  const gzip   = zlib.gzipSync(content, { level: 9 }).length;
  const brotli = zlib.brotliCompressSync(content, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;

  return { file: filePath, raw, gzip, brotli };
}

/**
 * Recursively find files matching a glob-like pattern in a directory.
 * Supports simple wildcards like *.js, *.{js,css}.
 * @param {string} dir - Directory to search.
 * @param {string} [pattern='*.js'] - Filename pattern (supports * wildcard).
 * @param {string[]} [ignore=['node_modules','.git']] - Names to ignore.
 * @returns {Array<{file:string, raw:number, gzip:number, brotli:number}>}
 */
function analyzeDir(dir, pattern, ignore) {
  pattern = pattern || '*.js';
  ignore  = ignore  || ['node_modules', '.git'];

  // Build a regex from the glob pattern
  const regexStr = pattern
    .replace(/\.\{([^}]+)\}/g, (_, exts) => '(\\.(' + exts.split(',').map(e => e.trim().replace('.', '')).join('|') + '))')
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*');
  const re = new RegExp('^' + regexStr + '$', 'i');

  const results = [];

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      if (ignore.includes(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && re.test(entry.name)) {
        try {
          results.push(analyzeFile(full));
        } catch (_) {
          // skip unreadable files
        }
      }
    }
  }

  walk(path.resolve(dir));
  return results;
}

/**
 * Parse a budget string like "50KB", "1MB", "500B" into bytes.
 * @param {string} budgetStr
 * @returns {number} Budget in bytes.
 */
function parseBudget(budgetStr) {
  if (!budgetStr) return 0;
  const m = String(budgetStr).trim().match(/^([\d.]+)\s*(B|KB|MB|GB)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] || 'B').toUpperCase();
  const multipliers = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  return Math.round(n * (multipliers[unit] || 1));
}

/**
 * Check results against a size budget (gzip size by default).
 * @param {Array<{file:string, raw:number, gzip:number, brotli:number}>} results
 * @param {string|number} budget - Budget string like "50KB" or number of bytes.
 * @returns {Array<{file:string, raw:number, gzip:number, brotli:number, overBudget:boolean, budgetBytes:number}>}
 */
function checkBudget(results, budget) {
  const budgetBytes = typeof budget === 'number' ? budget : parseBudget(budget);
  return results.map(r => ({
    ...r,
    overBudget: r.gzip > budgetBytes,
    budgetBytes,
  }));
}

/**
 * Basic analysis of top large string chunks or identifiers in a JS file.
 * Returns the top N longest lines (a rough proxy for large chunks).
 * @param {string} filePath
 * @param {number} [topN=5]
 * @returns {Array<{line:number, length:number, preview:string}>}
 */
function getTopModules(filePath, topN = 5) {
  let src;
  try {
    src = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return [];
  }
  return src.split('\n')
    .map((line, i) => ({ line: i + 1, length: line.length, preview: line.slice(0, 80) }))
    .sort((a, b) => b.length - a.length)
    .slice(0, topN);
}

/**
 * Format an array of file analysis results as a human-readable report.
 * @param {Array<{file:string, raw:number, gzip:number, brotli:number}>} results
 * @param {object} [opts={}]
 * @param {boolean} [opts.showGzip=true]
 * @param {boolean} [opts.showBrotli=true]
 * @returns {string}
 */
function formatReport(results, opts = {}) {
  if (results.length === 0) return 'No files analyzed.\n';

  const showGzip   = opts.showGzip   !== false;
  const showBrotli = opts.showBrotli !== false;

  const header = ['File', 'Raw'];
  if (showGzip)   header.push('Gzip');
  if (showBrotli) header.push('Brotli');
  if (results[0] && 'overBudget' in results[0]) header.push('Budget');

  const rows = results.map(r => {
    const row = [path.basename(r.file), formatSize(r.raw)];
    if (showGzip)   row.push(formatSize(r.gzip));
    if (showBrotli) row.push(formatSize(r.brotli));
    if ('overBudget' in r) row.push(r.overBudget ? 'OVER' : 'OK');
    return row;
  });

  const cols = header.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] || '').length)));
  const fmt = row => row.map((cell, i) => (cell || '').padEnd(cols[i])).join('  ');
  const sep = cols.map(c => '-'.repeat(c)).join('  ');

  return [fmt(header), sep, ...rows.map(fmt)].join('\n') + '\n';
}

/**
 * Return a summary string of the bundle analysis.
 * @param {Array<{file:string, raw:number, gzip:number, brotli:number}>} results
 * @returns {string}
 */
function summary(results) {
  if (results.length === 0) return 'No files analyzed.';
  const totalRaw    = results.reduce((s, r) => s + r.raw, 0);
  const totalGzip   = results.reduce((s, r) => s + r.gzip, 0);
  const totalBrotli = results.reduce((s, r) => s + r.brotli, 0);
  const over = results.filter(r => r.overBudget).length;
  let msg = `${results.length} file${results.length !== 1 ? 's' : ''}: raw=${formatSize(totalRaw)}, gzip=${formatSize(totalGzip)}, brotli=${formatSize(totalBrotli)}.`;
  if (over > 0) msg += ` ${over} over budget.`;
  return msg;
}

module.exports = { analyzeFile, analyzeDir, formatSize, formatReport, checkBudget, getTopModules, summary, percentChange, parseBudget };
