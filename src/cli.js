import { createRequire } from 'module';
import { addRepo, removeRepo, listRepos, syncAllRepos } from './registry.js';
import { listAvailableSkills, installSkills, updateSkills, uninstallSkill, statusSkills } from './skills.js';
import { c, log, heading, error } from './utils.js';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json');

// ── Argument parsing (zero deps) ───────────────────────

function parseArgs(argv) {
  const args = { _: [], flags: {} };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args.flags[key] = next;
        i++;
      } else {
        args.flags[key] = true;
      }
    } else if (a.startsWith('-') && a.length === 2) {
      const key = a.slice(1);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args.flags[key] = next;
        i++;
      } else {
        args.flags[key] = true;
      }
    } else {
      args._.push(a);
    }
  }

  return args;
}

// ── Help texts ─────────────────────────────────────────

function printHelp() {
  const logo = [
    `         ${c('cyan', '[■]')}`,
    `          ${c('cyan', '│')}`,
    `  ${c('cyan', '┌───◎───┘')}   ${c('bold', ' ___| | __| |____')}`,
    `  ${c('cyan', '│')}           ${c('bold', '/ __| |/ /| |_  /')}`,
    ` ${c('cyan', '[ ]')}          ${c('bold', '\\__ \\   < | |/ /')} `,
    `              ${c('bold', '|___/_|\\_\\|_/___|')}`,
    `                          ${c('dim', `v${VERSION}`)}`,
  ].join('\n');

  log(`
${logo}

${c('bold', 'USAGE')}
  sklz <command> [options]

${c('bold', 'REPO COMMANDS')}
  ${c('cyan', 'repo add <url> [--as <name>]')}  Register a git repo as a skill source
  ${c('cyan', 'repo remove <name>')}             Remove a repo from registry
  ${c('cyan', 'repo list')}                      List registered repos

${c('bold', 'SKILL COMMANDS')}
  ${c('cyan', 'list [--tag <t>]')}               List available skills from repos
  ${c('cyan', 'search <query>')}                 Search skills by name/description/tag
  ${c('cyan', 'install <n...> [--tag <t>] [--vendor <v>]')}  Install skill(s) into current project
  ${c('cyan', 'update [name...]')}               Update installed skills (all or specific)
  ${c('cyan', 'uninstall <name>')}               Remove a skill from current project
  ${c('cyan', 'status')}                         Show skills installed in current project
`);
}

// ── Command router ─────────────────────────────────────

export async function run(argv) {
  const { _, flags } = parseArgs(argv);

  if (flags.v || flags.version) {
    log(VERSION);
    return;
  }

  if (flags.h || flags.help || _.length === 0) {
    printHelp();
    return;
  }

  const cmd = _[0];
  const sub = _[1];
  const rest = _.slice(2);

  switch (cmd) {
    // ── repo ──
    case 'repo': {
      switch (sub) {
        case 'add': {
          const url = rest[0] || _[2];
          if (!url) {
            error('Missing URL. Usage: sklz repo add <url> [--as <name>]');
            return;
          }
          addRepo(url, flags.as);
          break;
        }
        case 'remove':
        case 'rm': {
          const name = rest[0] || _[2];
          if (!name) {
            error('Missing name. Usage: sklz repo remove <name>');
            return;
          }
          removeRepo(name);
          break;
        }
        case 'list':
        case 'ls':
          listRepos();
          break;
        case 'sync':
          syncAllRepos();
          break;
        default:
          error(`Unknown repo command: ${sub}`);
          log('Available: add, remove, list, sync');
      }
      break;
    }

    // ── list ──
    case 'list':
    case 'ls':
      listAvailableSkills({ tag: flags.tag, search: flags.search });
      break;

    // ── search ──
    case 'search':
    case 'find': {
      const query = _.slice(1).join(' ');
      if (!query) {
        error('Missing search query. Usage: sklz search <query>');
        return;
      }
      listAvailableSkills({ search: query });
      break;
    }

    // ── install ──
    case 'install':
    case 'i': {
      const names = _.slice(1);
      await installSkills(names.length > 0 ? names : null, { tag: flags.tag, vendor: flags.vendor });
      break;
    }

    // ── update ──
    case 'update':
    case 'up': {
      const names = _.slice(1);
      updateSkills(names.length > 0 ? names : null);
      break;
    }

    // ── uninstall ──
    case 'uninstall':
    case 'un':
    case 'remove': {
      const name = _[1];
      if (!name) {
        error('Missing skill name. Usage: sklz uninstall <name>');
        return;
      }
      uninstallSkill(name);
      break;
    }

    // ── status ──
    case 'status':
    case 'st':
      statusSkills();
      break;

    default:
      error(`Unknown command: ${cmd}`);
      printHelp();
  }
}
