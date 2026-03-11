import { loadConfig, saveConfig } from './config.js';
import { syncRepo } from './git.js';
import { repoNameFromUrl, info, success, warn, error, heading, table, c } from './utils.js';

/**
 * Add a repo to the registry.
 */
export function addRepo(url, alias) {
  const config = loadConfig();
  const name = alias || repoNameFromUrl(url);

  const existing = config.repos.find(r => r.name === name || r.url === url);
  if (existing) {
    warn(`Repo already registered: ${c('bold', existing.name)} (${existing.url})`);
    return;
  }

  // Clone/sync immediately
  syncRepo(url, name);

  config.repos.push({
    name,
    url,
    addedAt: new Date().toISOString(),
  });
  saveConfig(config);
  success(`Repo ${c('bold', name)} registered`);
}

/**
 * Remove a repo from the registry.
 */
export function removeRepo(nameOrUrl) {
  const config = loadConfig();
  const idx = config.repos.findIndex(
    r => r.name === nameOrUrl || r.url === nameOrUrl
  );

  if (idx === -1) {
    error(`Repo not found: ${nameOrUrl}`);
    info('Run "sklz repo list" to see registered repos');
    return;
  }

  const removed = config.repos.splice(idx, 1)[0];
  saveConfig(config);
  success(`Removed ${c('bold', removed.name)} (${removed.url})`);
  info('Note: cached clone kept in ~/.sklz/repos/ — remove manually if needed');
}

/**
 * List all registered repos.
 */
export function listRepos() {
  const config = loadConfig();
  heading('Registered repositories');
  console.log();

  table(
    ['Name', 'URL', 'Added'],
    config.repos.map(r => [r.name, r.url, r.addedAt?.slice(0, 10) || '—'])
  );
  console.log();
}

/**
 * Sync all registered repos (git pull).
 */
export function syncAllRepos() {
  const config = loadConfig();
  if (config.repos.length === 0) {
    warn('No repos registered. Run "sklz repo add <url>" first.');
    return;
  }

  heading('Syncing all repositories...');
  console.log();

  for (const repo of config.repos) {
    syncRepo(repo.url, repo.name);
  }
  console.log();
}

/**
 * Get list of repos from config (raw data).
 */
export function getRepos() {
  return loadConfig().repos;
}
