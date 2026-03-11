import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPOS_DIR, info, success, error, warn } from './utils.js';

function exec(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', ...opts }).trim();
}

/**
 * Clone a repo into ~/.sklz/repos/<name> or pull if already cloned.
 * Returns the local path.
 */
export function syncRepo(url, name) {
  const localPath = resolve(REPOS_DIR, name);

  if (existsSync(resolve(localPath, '.git'))) {
    info(`Updating ${name}...`);
    try {
      exec('git pull --ff-only', { cwd: localPath });
      success(`${name} is up to date`);
    } catch (e) {
      warn(`Could not pull ${name}: ${e.message}`);
      info('Using cached version');
    }
  } else {
    info(`Cloning ${name}...`);
    try {
      exec(`git clone --depth 1 "${url}" "${localPath}"`);
      success(`Cloned ${name}`);
    } catch (e) {
      error(`Failed to clone ${url}: ${e.message}`);
      throw new Error(`Clone failed for ${url}`);
    }
  }

  return localPath;
}

/**
 * Force re-pull a specific repo (used in update flows).
 */
export function pullRepo(name) {
  const localPath = resolve(REPOS_DIR, name);
  if (!existsSync(resolve(localPath, '.git'))) {
    throw new Error(`Repo ${name} not found locally`);
  }

  // Unshallow if needed, then pull
  try {
    exec('git fetch --unshallow', { cwd: localPath });
  } catch {
    // already unshallowed or full clone — ignore
  }

  exec('git pull --ff-only', { cwd: localPath });
  return localPath;
}

/**
 * Get the current HEAD commit short hash.
 */
export function getCommitHash(repoPath) {
  try {
    return exec('git rev-parse --short HEAD', { cwd: repoPath });
  } catch {
    return 'unknown';
  }
}

/**
 * Full clone (no --depth) for when we need history.
 */
export function fullClone(url, name) {
  const localPath = resolve(REPOS_DIR, name);
  if (existsSync(resolve(localPath, '.git'))) {
    try {
      exec('git fetch --unshallow', { cwd: localPath });
    } catch {
      // already full
    }
    exec('git pull --ff-only', { cwd: localPath });
  } else {
    exec(`git clone "${url}" "${localPath}"`);
  }
  return localPath;
}
