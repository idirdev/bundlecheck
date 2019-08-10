#!/usr/bin/env node
'use strict';

/**
 * @file bin/cli.js
 * @description CLI for bundlecheck — analyze JavaScript bundle sizes.
 * @author idirdev
 */

const path = require('path');
const fs = require('fs');
const { analyzeFile, analyzeDir, formatReport, checkBudget, summary } = require('../src/index.js');

const args = process.argv.slice(2);

function parseArgs(argv) {
  const opts = {
    target: '.',
    pattern: '*.js',
    budget: null,
    json: false,
    gzip: true,
    brotli: true,
    ignore: ['node_modules', '.git'],
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pattern' && argv[i + 1]) {
      opts.pattern = argv[++i];
    } else if (a === '--budget' && argv[i + 1]) {
      opts.budget = argv[++i];
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--gzip') {
      opts.gzip = true;
      opts.brotli = false;
    } else if (a === '--brotli') {
      opts.brotli = true;
      opts.gzip = false;
    } else if (a === '--ignore' && argv[i + 1]) {
      opts.ignore = argv[++i].split(',').map(s => s.trim());
    } else if (a === '--help' || a === '-h') {
      console.log([
        'Usage: bundlecheck <file|dir> [options]',
        '',
        'Options:',
        '  --pattern "*.js"    File pattern when analyzing a directory (default: *.js)',
        '  --budget 50KB       Fail if any file gzip size exceeds budget',
        '  --json              Output as JSON',
        '  --gzip              Show only gzip column',
        '  --brotli            Show only brotli column',
        '  --ignore a,b        Directory names to ignore (default: node_modules,.git)',
        '  -h, --help          Show help',
      ].join('\n'));
      process.exit(0);
    } else if (!a.startsWith('--')) {
      opts.target = a;
    }
  }

  return opts;
}

const opts = parseArgs(args);
const absTarget = path.resolve(opts.target);

let results;
try {
  const stat = fs.statSync(absTarget);
  if (stat.isDirectory()) {
    results = analyzeDir(absTarget, opts.pattern, opts.ignore);
  } else {
    results = [analyzeFile(absTarget)];
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}

if (opts.budget) {
  results = checkBudget(results, opts.budget);
}

if (opts.json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(formatReport(results, { showGzip: opts.gzip, showBrotli: opts.brotli }));
  console.log(summary(results));
}

const overBudget = results.filter(r => r.overBudget);
process.exit(overBudget.length > 0 ? 1 : 0);
