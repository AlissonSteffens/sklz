# sklz

```
         [■]
          │
  ┌───◎───┘    ___| | __| |____
  │           / __| |/ /| |_  /
 [ ]          \__ \   < | |/ /
              |___/_|\_\|_/___|
```

<!-- UNDER DEVELOPMENT -->
> **sklz is in early development.** The API and features are not finalized. If you're interested in using or contributing, please reach out!

**npm, but for skills.**

You don't copy-paste components across all your repositories. You don't manually track changes and propagate them to every project that uses them. You use npm.

**sklz** brings the same philosophy to agent skills. Skills are libraries — it doesn't make sense to version them inside every repo, duplicating files and polluting your git history. Version only your `sklz.json` and run `sklz install` to get all your dependencies. Done.

```bash
npm install -g @alissonsteffens/sklz
```

```bash
# Register a skills repository
sklz repo add https://github.com/my-org/design-skills.git

# Install a skill
sklz install button-spec

# Install all skills tagged "design-system"
sklz install --tag design-system

# Update everything
sklz update
```

Commit only `sklz.json`. Your teammates run `sklz install` and they're in sync — just like `npm install`. On first install in a project, sklz asks which tool you're using (or detects it automatically).

---

## Why

Today, most teams manage agent skills by copying `SKILL.md` files into their repos. This works until:
- You have 10 repos using the same skill and need to update it
- Someone changes a skill in one repo and forgets the other 9
- Your git history is full of diffs from skill files nobody wrote by hand
- New team members have to figure out which skills to copy from where

You already solved this problem for code with package managers. **sklz** solves it for skills.

---

## How it works

1. You register git repos that contain skills (your org's, open source, whatever)
2. sklz clones them locally and keeps them synced via `git pull`
3. When you install a skill, it copies the files to `.agents/skills/<name>/`
4. A `sklz.json` in your project root tracks what's installed, from where, and at which commit

No databases. No APIs. Just git and files. Uses the `git` already configured on your machine — if you can clone the repo, sklz can use it.

---

## Vendors

When you run `sklz install`, sklz asks which tool you're using and installs the skills to the right directory. You can also pass `--vendor` directly to skip the prompt. The vendor choice is not stored — you pick it each time you install.

| Vendor | Skills directory |
|---|---|
| **Claude Code** _(default)_ | `.claude/skills/` |
| GitHub Copilot | `.github/skills/` |
| Google Antigravity | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| Custom | `.skills/` |

```bash
sklz install my-skill --vendor "GitHub Copilot"
```


---

## Commands

### Repositories

```bash
sklz repo add <url> [--as <alias>]   # Register a skills source
sklz repo remove <name>              # Remove from registry
sklz repo list                       # Show registered repos
sklz repo sync                       # Pull latest from all repos
```

### Skills

```bash
sklz list [--tag <tag>]              # Browse available skills
sklz search <query>                  # Search by name, description, or tag
sklz install                                   # Install all skills from sklz.json
sklz install <name...>                         # Install specific skill(s)
sklz install <name...> --vendor "Claude Code"  # Install to a specific vendor
sklz install --tag <tag>                       # Install all skills matching a tag
sklz update [name...]                          # Update installed skills
sklz uninstall <name>                          # Remove a skill from project
sklz status                                    # Show installed skills and their locations
```

### Disambiguation

If two repos have a skill with the same name:

```bash
sklz install design-skills/button-spec
```

---

## sklz.json

This is the only file you commit. It looks like this:

```json
{
  "sklz": {
    "button-spec": {
      "repo": "https://github.com/my-org/design-skills.git",
      "repoName": "design-skills",
      "version": "1.2.0",
      "commit": "a1b2c3d",
      "installedAt": "2026-03-10T14:30:00.000Z",
      "tags": ["design-system", "ui"]
    }
  }
}
```

Your `.gitignore` (example for Claude Code):

```
.claude/skills/
```

New dev joins the team? They run `sklz install` and everything is there.

---

## Skills repo structure

A skills repo is a regular git repository. Skills can live at the root or inside a top-level `skills/` subdirectory — sklz detects either layout automatically:

```
my-skills-repo/          (root layout)
├── button-spec/
│   ├── SKILL.md
│   └── templates/
│       └── button.css
├── react-patterns/
│   └── SKILL.md
└── ci-pipeline/
    └── SKILL.md
```

```
my-skills-repo/          (skills/ layout)
└── skills/
    ├── button-spec/
    │   ├── SKILL.md
    │   └── templates/
    │       └── button.css
    ├── react-patterns/
    │   └── SKILL.md
    └── ci-pipeline/
        └── SKILL.md
```

### SKILL.md frontmatter

Skill metadata is declared in the `SKILL.md` frontmatter. `name` and `description` are required. Use `metadata.version` for versioning and `metadata.tags` (comma-separated) for tag-based filtering.

```markdown
---
name: button-spec
description: Button component specification for the design system. Use when working with button components.
metadata:
  version: "1.2.0"
  tags: design-system, ui, components
---
```

---

## Requirements

- Node.js >= 18
- `git` configured with access to your repos (SSH keys, tokens, whatever you already use)

---

## License

MIT
