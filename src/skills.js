import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { loadConfig } from './config.js';
import { syncRepo, getCommitHash } from './git.js';
import {
  REPOS_DIR, SKILLS_JSON, VENDORS, DEFAULT_VENDOR, getVendorByName, skillsInstallDir,
  info, success, warn, error, heading, table, c, log,
} from './utils.js';

// ── sklz.json (project-level) ──────────────────────────

function loadSkillsJson(cwd) {
  const p = resolve(cwd, SKILLS_JSON);
  if (!existsSync(p)) return { sklz: {} };
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8'));
    if (!data.sklz) data.sklz = {};
    return data;
  } catch {
    return { sklz: {} };
  }
}

function saveSkillsJson(cwd, data) {
  writeFileSync(resolve(cwd, SKILLS_JSON), JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ── Skill discovery ────────────────────────────────────

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Returns a flat object with top-level keys and a nested `metadata` map.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fm = {};
  const lines = match[1].split(/\r?\n/);
  let inMetadata = false;

  for (const line of lines) {
    if (!line.trim()) continue;

    if (inMetadata && /^\s{2,}/.test(line)) {
      const m = line.trim().match(/^([\w-]+):\s*"?([^"]*)"?\s*$/);
      if (m) {
        fm.metadata[m[1]] = m[2].trim();
      }
      continue;
    }

    inMetadata = false;
    const m = line.match(/^([\w-]+):\s*(.*?)\s*$/);
    if (m) {
      if (m[1] === 'metadata') {
        inMetadata = true;
        fm.metadata = {};
      } else {
        fm[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  }

  return fm;
}

/**
 * Read skill metadata from SKILL.md frontmatter.
 */
function readSkillMeta(skillDir) {
  const skillMdPath = resolve(skillDir, 'SKILL.md');
  if (!existsSync(skillMdPath)) return null;
  try {
    const content = readFileSync(skillMdPath, 'utf-8');
    const fm = parseFrontmatter(content);
    if (!fm || !fm.name) return null;

    const meta = fm.metadata || {};
    const tags = meta.tags
      ? meta.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    return {
      name: fm.name,
      version: meta.version || '0.0.0',
      description: fm.description || '',
      tags,
    };
  } catch {
    return null;
  }
}

/**
 * Discover all skills across all registered repos.
 * Returns: [{ name, version, description, tags, repoName, repoUrl, localPath }]
 */
export function discoverSkills({ sync = true } = {}) {
  const config = loadConfig();
  const skills = [];

  for (const repo of config.repos) {
    const repoPath = resolve(REPOS_DIR, repo.name);

    if (sync) {
      try {
        syncRepo(repo.url, repo.name);
      } catch {
        warn(`Skipping ${repo.name} — could not sync`);
        continue;
      }
    }

    if (!existsSync(repoPath)) continue;

    // Determine directories to scan: if a top-level 'skills/' folder exists, scan inside it;
    // otherwise fall back to scanning top-level directories directly.
    const skillsSubdir = resolve(repoPath, 'skills');
    const scanRoot = existsSync(skillsSubdir) && statSync(skillsSubdir).isDirectory()
      ? skillsSubdir
      : repoPath;

    const entries = readdirSync(scanRoot);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const entryPath = resolve(scanRoot, entry);
      if (!statSync(entryPath).isDirectory()) continue;

      const meta = readSkillMeta(entryPath);
      if (!meta) continue;

      skills.push({
        name: meta.name || entry,
        version: meta.version || '0.0.0',
        description: meta.description || '',
        tags: meta.tags || [],
        repoName: repo.name,
        repoUrl: repo.url,
        localPath: entryPath,
      });
    }
  }

  return skills;
}

// ── List ────────────────────────────────────────────────

export function listAvailableSkills({ tag, search } = {}) {
  let skills = discoverSkills();

  if (tag) {
    const t = tag.toLowerCase();
    skills = skills.filter(s => s.tags.some(st => st.toLowerCase().includes(t)));
  }

  if (search) {
    const q = search.toLowerCase();
    skills = skills.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  heading('Available skills');
  if (tag) log(c('dim', `  filtered by tag: ${tag}`));
  if (search) log(c('dim', `  search: ${search}`));
  log();

  table(
    ['Repo', 'Skill', 'Version', 'Tags'],
    skills.map(s => [s.repoName, s.name, s.version, s.tags.join(', ')])
  );
  log();

  return skills;
}

// ── Vendor prompt ───────────────────────────────────────

async function promptVendor() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  log(`\n${c('bold', 'Choose a vendor')} ${c('dim', '(where skills will be installed):')}\n`);
  VENDORS.forEach((v, i) => {
    const num = c('cyan', `${i + 1}.`);
    const dflt = i === 0 ? c('dim', '  (default)') : '';
    log(`  ${num} ${v.name}${dflt}  ${c('dim', v.dir + '/skills/')}`);
  });

  return new Promise((resolve) => {
    rl.question(`\n  Enter number [1]: `, (answer) => {
      rl.close();
      const n = parseInt(answer, 10);
      if (!answer.trim() || isNaN(n) || n < 1 || n > VENDORS.length) {
        resolve(DEFAULT_VENDOR);
      } else {
        resolve(VENDORS[n - 1].name);
      }
    });
  });
}

// ── Vendor detection ────────────────────────────────────

function findInstalledSkillDir(name, cwd) {
  for (const vendor of VENDORS) {
    const dir = resolve(cwd, vendor.dir, 'skills', name);
    if (existsSync(dir)) return { vendorName: vendor.name, skillDir: dir, installDir: `${vendor.dir}/skills` };
  }
  return null;
}

function detectProjectVendor(cwd) {
  for (const vendor of VENDORS) {
    const dir = resolve(cwd, vendor.dir, 'skills');
    if (existsSync(dir)) return vendor.name;
  }
  return null;
}

// ── Install ─────────────────────────────────────────────

function copySkillToProject(skill, vendorName, cwd) {
  const installDir = skillsInstallDir(vendorName);
  const destDir = resolve(cwd, installDir, skill.name);
  mkdirSync(destDir, { recursive: true });

  cpSync(skill.localPath, destDir, { recursive: true });

  const sjData = loadSkillsJson(cwd);
  const repoPath = resolve(REPOS_DIR, skill.repoName);

  sjData.sklz[skill.name] = {
    repo: skill.repoUrl,
    repoName: skill.repoName,
    version: skill.version,
    commit: getCommitHash(repoPath),
    installedAt: new Date().toISOString(),
    tags: skill.tags,
  };
  saveSkillsJson(cwd, sjData);

  return installDir;
}

export async function installSkills(names, { tag, vendor: vendorFlag, cwd = process.cwd() } = {}) {
  const allSkills = discoverSkills();

  let toInstall = [];

  if (tag) {
    const t = tag.toLowerCase();
    toInstall = allSkills.filter(s => s.tags.some(st => st.toLowerCase().includes(t)));
    if (toInstall.length === 0) {
      warn(`No skills found with tag "${tag}"`);
      return;
    }
  } else if (names && names.length > 0) {
    for (const nameArg of names) {
      let repoFilter = null;
      let skillName = nameArg;

      if (nameArg.includes('/')) {
        const parts = nameArg.split('/');
        repoFilter = parts[0];
        skillName = parts[1];
      }

      const match = allSkills.find(s => {
        const nameMatch = s.name === skillName;
        const repoMatch = repoFilter ? s.repoName === repoFilter : true;
        return nameMatch && repoMatch;
      });

      if (match) {
        toInstall.push(match);
      } else {
        warn(`Skill not found: ${nameArg}`);
      }
    }
  } else {
    // No args — install all skills listed in sklz.json (like npm install)
    const sjData = loadSkillsJson(cwd);
    const listed = Object.keys(sjData.sklz);
    if (listed.length === 0) {
      warn('No skills in sklz.json and no names given. Run "sklz install <name>" to install.');
      return;
    }
    for (const name of listed) {
      const match = allSkills.find(s => s.name === name);
      if (match) {
        toInstall.push(match);
      } else {
        warn(`Skill not found in any repo: ${name}`);
      }
    }
  }

  if (toInstall.length === 0) {
    warn('No skills to install');
    return;
  }

  // Resolve vendor: flag > existing vendor dir in project > interactive prompt > default
  let vendorName;

  if (vendorFlag) {
    const v = getVendorByName(vendorFlag);
    if (!v) {
      const names = VENDORS.map(v => `"${v.name}"`).join(', ');
      error(`Unknown vendor "${vendorFlag}". Available: ${names}`);
      return;
    }
    vendorName = v.name;
  } else if ((vendorName = detectProjectVendor(cwd))) {
    // reuse detected vendor silently
  } else if (process.stdout.isTTY) {
    vendorName = await promptVendor();
  } else {
    vendorName = DEFAULT_VENDOR;
  }

  const installDir = skillsInstallDir(vendorName);

  heading(`Installing ${toInstall.length} skill(s) → ${c('cyan', installDir + '/')}...`);
  log();

  for (const skill of toInstall) {
    info(`Installing ${c('bold', skill.name)} (${skill.version}) from ${skill.repoName}`);
    try {
      copySkillToProject(skill, vendorName, cwd);
      success(`Installed ${skill.name} → ${installDir}/${skill.name}/`);
    } catch (e) {
      error(`Failed to install ${skill.name}: ${e.message}`);
    }
  }
  log();
}

// ── Update ──────────────────────────────────────────────

export function updateSkills(names, { cwd = process.cwd() } = {}) {
  const sjData = loadSkillsJson(cwd);
  const installed = Object.keys(sjData.sklz);

  if (installed.length === 0) {
    warn('No skills installed in this project. Run "sklz install <name>" first.');
    return;
  }

  const toUpdate = names && names.length > 0
    ? names.filter(n => {
        if (!sjData.sklz[n]) {
          warn(`Skill "${n}" is not installed — skipping`);
          return false;
        }
        return true;
      })
    : installed;

  if (toUpdate.length === 0) return;

  // Re-sync repos and discover latest
  const allSkills = discoverSkills({ sync: true });

  heading(`Updating ${toUpdate.length} skill(s)...`);
  log();

  let updated = 0;
  for (const name of toUpdate) {
    const entry = sjData.sklz[name];
    const latest = allSkills.find(s => s.name === name && s.repoUrl === entry.repo);

    if (!latest) {
      warn(`Skill "${name}" no longer found in repo ${entry.repoName} — skipping`);
      continue;
    }

    const repoPath = resolve(REPOS_DIR, latest.repoName);
    const newCommit = getCommitHash(repoPath);

    if (newCommit === entry.commit && latest.version === entry.version) {
      info(`${name} is already up to date (${entry.version} @ ${entry.commit})`);
      continue;
    }

    info(`Updating ${c('bold', name)}: ${entry.version}@${entry.commit} → ${latest.version}@${newCommit}`);
    try {
      const found = findInstalledSkillDir(name, cwd);
      copySkillToProject(latest, found ? found.vendorName : DEFAULT_VENDOR, cwd);
      success(`Updated ${name}`);
      updated++;
    } catch (e) {
      error(`Failed to update ${name}: ${e.message}`);
    }
  }

  log();
  if (updated > 0) {
    success(`${updated} skill(s) updated`);
  } else {
    info('All skills are up to date');
  }
  log();
}

// ── Uninstall ───────────────────────────────────────────

export function uninstallSkill(name, { cwd = process.cwd() } = {}) {
  const sjData = loadSkillsJson(cwd);

  if (!sjData.sklz[name]) {
    error(`Skill "${name}" is not installed in this project`);
    return;
  }

  const found = findInstalledSkillDir(name, cwd);
  if (found) {
    rmSync(found.skillDir, { recursive: true, force: true });
  }

  delete sjData.sklz[name];
  saveSkillsJson(cwd, sjData);
  success(`Uninstalled ${c('bold', name)}`);
}

// ── Status ──────────────────────────────────────────────

export function statusSkills({ cwd = process.cwd() } = {}) {
  const sjData = loadSkillsJson(cwd);
  const installed = Object.entries(sjData.sklz);

  heading('Installed skills in this project');
  log();

  if (installed.length === 0) {
    log(c('dim', '  No skills installed. Run "sklz install <name>" to install.'));
    log();
    return;
  }

  table(
    ['Skill', 'Version', 'Location', 'Repo', 'Commit', 'Installed'],
    installed.map(([name, meta]) => {
      const found = findInstalledSkillDir(name, cwd);
      return [
        name,
        meta.version,
        found ? found.installDir + '/' : c('dim', 'not found'),
        meta.repoName,
        meta.commit,
        meta.installedAt?.slice(0, 10) || '—',
      ];
    })
  );
  log();
}
