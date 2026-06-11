#!/usr/bin/env node
/**
 * Append Vitest coverage actuals vs coverage-thresholds.mjs to GITHUB_STEP_SUMMARY.
 * Used by .github/workflows/test.yml after pnpm test.
 */
import fs from 'node:fs';

import { GLOBAL_THRESHOLDS } from '../coverage-thresholds.mjs';

const summaryPath = 'coverage/coverage-summary.json';
const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;

if (!fs.existsSync(summaryPath)) {
  process.exit(0);
}

if (!stepSummaryPath) {
  console.warn('GITHUB_STEP_SUMMARY is not set; skipping coverage summary.');
  process.exit(0);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')).total;
const metrics = ['lines', 'statements', 'functions', 'branches'];
const rows = metrics.map((key) => `| ${key} | ${summary[key].pct}% |`).join('\n');
const thresholdRows = metrics.map((key) => `| ${key} | ${GLOBAL_THRESHOLDS[key]}% |`).join('\n');
const body = [
  '## Coverage',
  '',
  '### Actual',
  '| Metric | % |',
  '|---|---|',
  rows,
  '',
  '### Required (coverage-thresholds.mjs)',
  '| Metric | % |',
  '|---|---|',
  thresholdRows,
].join('\n');

fs.appendFileSync(stepSummaryPath, `${body}\n`);
