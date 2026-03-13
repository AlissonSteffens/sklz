import { resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, existsSync } from 'node:fs';

// ── Paths ──────────────────────────────────────────────

export const SKLZ_HOME = resolve(homedir(), '.sklz');
export const REPOS_DIR = resolve(SKLZ_HOME, 'repos');
export const CONFIG_FILE = resolve(SKLZ_HOME, 'config.json');
export const SKILLS_JSON = 'sklz.json';

// ── Vendors ────────────────────────────────────────────

export const VENDORS = [
  { name: 'Claude Code',         dir: '.claude' },
  { name: 'GitHub Copilot',      dir: '.github' },
  { name: 'Google Antigravity',  dir: '.agents' },
  { name: 'Cursor',              dir: '.cursor' },
  { name: 'Custom',              dir: '.skills' },
];

export const DEFAULT_VENDOR = 'Claude Code';

export function getVendorByName(name) {
  const v = VENDORS.find(v => v.name.toLowerCase() === name.toLowerCase());
  return v || null;
}

export function skillsInstallDir(vendorName) {
  const v = getVendorByName(vendorName) || getVendorByName(DEFAULT_VENDOR);
  return `${v.dir}/skills`;
}

export function ensureSklzHome() {
  if (!existsSync(SKLZ_HOME)) mkdirSync(SKLZ_HOME, { recursive: true });
  if (!existsSync(REPOS_DIR)) mkdirSync(REPOS_DIR, { recursive: true });
}

// ── Logging ────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

export function c(color, text) {
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

export function log(msg = '') {
  console.log(msg);
}

export function info(msg) {
  console.log(`${c('cyan', '●')} ${msg}`);
}

export function success(msg) {
  console.log(`${c('green', '✔')} ${msg}`);
}

export function warn(msg) {
  console.log(`${c('yellow', '⚠')} ${msg}`);
}

export function error(msg) {
  console.error(`${c('red', '✖')} ${msg}`);
}

export function heading(msg) {
  console.log(`\n${c('bold', msg)}`);
}

// ── Table ──────────────────────────────────────────────

export function table(headers, rows) {
  if (rows.length === 0) {
    log(c('dim', '  (empty)'));
    return;
  }

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i] || '').length))
  );

  const sep = '  ';
  const headerLine = headers
    .map((h, i) => c('dim', h.toUpperCase().padEnd(colWidths[i])))
    .join(sep);
  log(`  ${headerLine}`);

  for (const row of rows) {
    const line = row
      .map((cell, i) => String(cell || '').padEnd(colWidths[i]))
      .join(sep);
    log(`  ${line}`);
  }
}

// ── Misc ───────────────────────────────────────────────

export function repoNameFromUrl(url) {
  let name = basename(url);
  name = name.replace(/\.git$/, '');
  return name;
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
