import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { CONFIG_FILE, ensureSklzHome } from './utils.js';

const DEFAULT_CONFIG = {
  repos: [],
};

export function loadConfig() {
  ensureSklzHome();
  if (!existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config) {
  ensureSklzHome();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
