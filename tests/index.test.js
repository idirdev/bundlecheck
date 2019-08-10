'use strict';

/**
 * @file tests/index.test.js
 * @description Tests for bundlecheck package.
 * @author idirdev
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { analyzeFile, analyzeDir, formatSize, formatReport, checkBudget, getTopModules, summary, percentChange, parseBudget } = require('../src/index.js');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bundlecheck-test-'));
}

function writeFile(dir, name, content) {
  const fp = path.join(dir, name);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content);
  return fp;
}

test('analyzeFile returns correct raw size', () => {
  const dir = makeTmpDir();
  const content = 'const x = 1;';
  const fp = writeFile(dir, 'a.js', content);
  const result = analyzeFile(fp);
  assert.equal(result.raw, Buffer.byteLength(content));
});

test('analyzeFile gzip size is less than raw for compressible content', () => {
  const dir = makeTmpDir();
  const content = 'a'.repeat(1000);
  const fp = writeFile(dir, 'b.js', content);
  const result = analyzeFile(fp);
  assert.ok(result.gzip < result.raw, 'gzip should be smaller than raw for repetitive content');
});

test('analyzeFile brotli size is less than or equal to gzip for compressible content', () => {
  const dir = makeTmpDir();
  const content = 'function hello() { return "world"; }'.repeat(50);
  const fp = writeFile(dir, 'c.js', content);
  const result = analyzeFile(fp);
  assert.ok(result.brotli <= result.gzip, 'brotli should be <= gzip');
  assert.ok(result.raw > 0);
});

test('analyzeFile throws on missing file', () => {
  assert.throws(() => analyzeFile('/nonexistent/path/file.js'), /Cannot read file/);
});

test('analyzeDir finds .js files in directory', () => {
  const dir = makeTmpDir();
  writeFile(dir, 'dist/a.js', 'const a = 1;');
  writeFile(dir, 'dist/b.js', 'const b = 2;');
  writeFile(dir, 'dist/c.css', 'body {}');
  const results = analyzeDir(dir, '*.js');
  assert.equal(results.length, 2);
});

test('formatSize formats bytes correctly', () => {
  assert.equal(formatSize(0), '0 B');
  assert.equal(formatSize(500), '500 B');
  assert.ok(formatSize(2048).includes('KB'));
  assert.ok(formatSize(2 * 1024 * 1024).includes('MB'));
});

test('parseBudget parses KB correctly', () => {
  assert.equal(parseBudget('50KB'), 50 * 1024);
  assert.equal(parseBudget('1MB'), 1024 * 1024);
  assert.equal(parseBudget('500B'), 500);
});

test('checkBudget marks over-budget files', () => {
  const dir = makeTmpDir();
  const fp = writeFile(dir, 'big.js', 'x'.repeat(10000));
  const results = [analyzeFile(fp)];
  // budget of 1 byte — everything should be over
  const checked = checkBudget(results, '1B');
  assert.equal(checked[0].overBudget, true);
});

test('checkBudget marks under-budget files as OK', () => {
  const dir = makeTmpDir();
  const fp = writeFile(dir, 'tiny.js', 'x=1');
  const results = [analyzeFile(fp)];
  // budget of 10MB — should be fine
  const checked = checkBudget(results, '10MB');
  assert.equal(checked[0].overBudget, false);
});

test('percentChange calculates correctly', () => {
  assert.equal(percentChange(100, 150), 50);
  assert.equal(percentChange(200, 100), -50);
  assert.equal(percentChange(100, 100), 0);
});

test('percentChange handles zero original value', () => {
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(0, 100), 100);
});

test('formatReport produces table with headers', () => {
  const dir = makeTmpDir();
  const fp = writeFile(dir, 'app.js', 'const x = 1;');
  const results = [analyzeFile(fp)];
  const report = formatReport(results);
  assert.ok(report.includes('File'));
  assert.ok(report.includes('Raw'));
  assert.ok(report.includes('app.js'));
});

test('formatReport returns no-files message on empty input', () => {
  const report = formatReport([]);
  assert.ok(report.includes('No files'));
});

test('summary returns file count and sizes', () => {
  const dir = makeTmpDir();
  const fp = writeFile(dir, 'x.js', 'hello world');
  const results = [analyzeFile(fp)];
  const s = summary(results);
  assert.ok(s.includes('1 file'));
  assert.ok(s.includes('raw='));
});

test('getTopModules returns longest lines', () => {
  const dir = makeTmpDir();
  const fp = writeFile(dir, 'mod.js', 'short\n' + 'x'.repeat(200) + '\nmedium line here\n');
  const top = getTopModules(fp, 2);
  assert.equal(top.length, 2);
  assert.ok(top[0].length >= 200);
});
