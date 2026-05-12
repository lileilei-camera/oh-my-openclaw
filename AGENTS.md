# AGENTS.md — Oh-My-OpenClaw (OmOC)

> Agent orchestration framework for OpenClaw — 3-layer planning → orchestration → execution with category-based model routing.

## Project overview

Oh-My-OpenClaw ports oh-my-opencode patterns into an OpenClaw-native TypeScript plugin + Markdown skill system. It provides 11 specialized agent personas, category-based model routing, and self-correcting execution loops — all through messaging channels (Discord, Telegram, etc.).

**Language**: TypeScript (ES2022, NodeNext modules)
**Build**: `tsc` → `plugin/dist/`
**Test**: vitest (167 tests)
**Release**: semantic-release with conventional commits, `@semantic-release/npm` with `pkgRoot: plugin`

## Essential developer commands

All commands run from the `plugin/` subdirectory:

```bash
cd plugin

# Install deps
npm install

# Build (TypeScript → dist/)
npm run build        # tsc

# Type-check (no emit) — also used as lint
npm run typecheck    # tsc --noEmit
npm run lint         # alias for typecheck

# Test
npm run test                     # vitest run
npm run test:coverage            # vitest run --coverage (v8)
npm run test:watch               # vitest (watch mode)

# Pre-publish check
npm run prepublishOnly           # typecheck → test → build
```

**CI order** (from `.github/workflows/ci.yml`): `npm ci → typecheck → test → build`

### Release

```bash
git tag v0.1.0
git push origin v0.1.0   # triggers .github/workflows/publish.yml
```

Requires `NPM_TOKEN` in GitHub repo secrets. Version sync script: `node scripts/sync-version.mjs <version>`.

## Architecture at a glance

```
oh-my-openclaw/
  SKILL.md                    # Main skill doc (agent instructions)
  config/
    categories.json           # Category→model mapping, agents, skills, tmux config
  plugin/
    src/
      index.ts                # Plugin entry point (registers hooks, tools, commands, services)
      cli.ts                  # CLI entry (omoc-setup wizard)
      types.ts                # Core TypeScript types
      constants.ts            # Constants
      version.ts              # Version
      commands/               # Slash commands (init, mode, persona, ralph, status, todo)
      hooks/                  # Plugin hooks (todo-enforcer, comment-checker, spawn-guard, etc.)
      tools/                  # Native tools (delegate, checkpoint, todo, lsp, glob, grep, etc.)
      services/               # Background services
      agents/                 # Agent-related logic
      features/               # Feature modules
      shared/                 # Shared utilities
      utils/                  # Utility functions
      __tests__/              # Vitest test files (*.test.ts)
    agents/                   # Markdown agent persona definitions
    skills/                   # Markdown skill definitions
    workflows/                # Workflow definitions
    openclaw.plugin.json      # Plugin manifest (tools, configSchema)
    package.json              # npm package (publish root)
    vitest.config.ts          # Test config
    tsconfig.json             # TypeScript config
```

### Plugin manifest (`plugin/openclaw.plugin.json`)

Declares tool contracts, config schema, and is the source of truth for available OmOC tools. Key tools: `omoc_delegate`, `omo_delegate`, `omoc_checkpoint`, `omoc_todo_*`, `omoc_glob`, `omoc_grep`, `omoc_interactive-bash`, LSP tools, AST tools.

### Category routing (`config/categories.json`)

Single config file for all model routing. Categories: `quick`, `deep`, `ultrabrain`, `visual-engineering`, `multimodal`, `artistry`, `unspecified-low`, `unspecified-high`, `writing`. Each maps to a model with agents and alternatives.

## Key conventions

- **Plugin code lives in `plugin/src/`**; root-level files are skill docs, config, and release setup.
- **Test files**: `plugin/src/__tests__/*.test.ts` — vitest with `globals: true`.
- **Agent personas**: Markdown files in `plugin/agents/` (planner.md, coder.md, etc.) — loaded dynamically by hooks.
- **Skills**: Markdown files in `plugin/skills/` — loaded on trigger keywords.
- **Never push to `dist/`** — it's compiled output. Only commit `src/` changes.
- **Conventional commits**: `feat:`, `fix:`, `perf:`, `refactor:` trigger releases. `docs:`, `style:`, `test:`, `chore:`, `ci:` are hidden.

## Code analysis tools

Prefer LSP tools over raw reading/grep when analyzing TypeScript code:

- `omoc_goto_definition` — jump to symbol definition
- `omoc_find_references` — find all usages across the project
- `omoc_symbols` — file outline (scope=document) or workspace search (scope=workspace + query)
- `omoc_diagnostics` — check for errors/warnings before building
- `omoc_rename` — safe cross-file symbol rename

Fallback when LSP is unavailable:

- `omoc_ast_grep_search` — AST pattern search (supports `$VAR` meta-variables)
- `omoc_ast_grep_replace` — AST-aware cross-file refactoring

## Project wiki

Use the OpenClaw wiki knowledge base (if available) to supplement code-level understanding with design rationale, team conventions, and historical context.

- **Check availability**: `openclaw wiki status`
- **Search**: `wiki_search("query")` or `openclaw wiki search "query"` — find relevant wiki pages by topic.
- **Read a page**: `wiki_get("lookup")` or `openclaw wiki get <page-id>` — read detailed context from a specific page.
- **Search modes**: `--mode find-person` / `--mode route-question` / `--mode source-evidence`

If wiki knowledge is unavailable, rely solely on project source code and documentation.
