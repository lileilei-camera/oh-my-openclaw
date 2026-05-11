---
name: oh-my-openclaw
description: Oh-My-OpenClaw (OmOC) — multi-agent orchestration plugin for OpenClaw. Category-based model routing, todo enforcer, ralph loop, 28+ custom tools, and 11 agent personas.
---

# Oh-My-OpenClaw (OmOC) — Agent Guide

OpenClaw plugin for multi-agent orchestration. Version **0.21.3**. Package: `@happycastle/oh-my-openclaw`.

---

## Quick Commands

```bash
# Install + setup
openclaw plugins install @lileilei-camera/oh-my-openclaw
openclaw omoc-setup            # inject 11 agent configs into openclaw.json5

# All npm commands run from plugin/ directory
cd ~/.openclaw/workspace/oh-my-openclaw/plugin
npm run build                  # tsc → dist/
npm run test                   # vitest run (v8 coverage)
npm run typecheck              # tsc --noEmit (also used as lint)
npm run dev                    # tsc --watch
```

**Build order**: `typecheck` → `test` → `build`. `prepublishOnly` enforces all three.

---

## Architecture

Plugin entry: `plugin/src/index.ts`. Uses OpenClaw Plugin SDK (`openclaw/plugin-sdk`).

### Directory Map (source-level)

```
plugin/src/
  index.ts                    — Plugin entry, all registrations
  cli.ts                      — CLI entry
  version.ts                  — VERSION constant
  types.ts                    — PLUGIN_ID, getPluginConfig
  constants.ts

  commands/                   — Slash command handlers
    ralph-commands.ts         — /ralph_loop, /ralph_stop
    status-commands.ts        — /omoc_status, /omoc_health, /omoc_config
    persona-commands.ts       — /omoc, /omoc_personas
    todo-commands.ts          — /todos + 3 todo commands
    mode-commands.ts          — /omoc_mode
    init-commands.ts          — /omoc_init (+ subcommands: add, delete, list, set-active, off)

  hooks/                      — before_prompt_build / message / agent hooks
    startup.ts                — gateway:startup logging
    todo-enforcer.ts          — Injects TODO continuation
    comment-checker.ts        — 11 regex patterns kill AI slop
    message-monitor.ts        — Outbound message audit
    subagent-tracker.ts       — Sub-agent tracking
    context-injector.ts       — Project context injection
    guardrail-injector.ts     — Safety guardrails
    spawn-guard.ts            — Validates sub-agent spawns
    mode-switch/hook.ts       — Mode switching
    project-init/             — omoc_init: project registration + AGENTS.md bootstrap
      project-state.ts        — active-project file读写 (~/.omoc-state/active-project)
      init-template.ts        — init/add templates
      project-bootstrap.ts    — before_prompt_build hook
    todo-reminder.ts          — 3 hooks: reminder, agent-end, session cleanup

  tools/                      — 28+ tool contracts (see openclaw.plugin.json)
    delegate-task/            — omoc_delegate: category-based model routing
    background-task/          — omoc_background_task/output/cancel
    slashcommand/             — omoc_slashcommand
    omo-delegation.ts         — omo_delegate: OpenCode ACP
    look-at/                  — omoc_look_at: multimodal analysis
    checkpoint.ts             — omoc_checkpoint
    web-search.ts             — omoc_web_search
    todo/                     — omoc_todo_create/list/update
    grep/                     — omoc_grep
    glob/                     — omoc_glob
    interactive-bash/         — omoc_interactive-bash (tmux PTY)
    session-manager/          — omoc_list / omoc_read
    lsp/                      — goto_definition, find_references, symbols, diagnostics, rename
    ast-grep/                 — ast_grep_search / ast_grep_replace
    call-omo-agent/           — omoc_call_omo_agent (explore/librarian)
    skill-mcp/                — omoc_skill_mcp
    skill/                    — omoc_skill

  features/
    claude-code-mcp-loader/   — Claude Code MCP loader
    context-collector.ts      — Context collection
    skill-loader/             — Skill discovery (builtin, user, project)
    skill-mcp-manager/        — MCP server lifecycle

  services/
    ralph-loop.ts             — Self-correcting execution loop (hard cap: 100)
    webhook-bridge.ts         — External notifications

  shared/                     — Utilities (case, config dir, frontmatter, file utils, logger)
  utils/                      — persona-state, helpers, paths, state, validation
  agents/                     — agent-ids.ts, agent-configs.ts, persona-prompts.ts
  __tests__/                  — Vitest test suite
```

Other key paths:
- `plugin/agents/` — Agent persona profiles (markdown prompts)
- `plugin/skills/` — Skill definitions (markdown)
- `plugin/workflows/` — Workflow templates
- `plugin/openclaw.plugin.json` — Plugin manifest + configSchema
- `plugin/config/agent-models.json` — Model presets

### Config Schema

All config fields **must** be declared in `configSchema` within `openclaw.plugin.json`. OpenClaw uses strict validation — unknown fields cause plugin rejection.

Key config fields: `max_ralph_iterations` (0-100), `todo_enforcer_enabled`, `comment_checker_enabled`, `hooks_token` (sensitive), `gateway_url`, `webhook_bridge_enabled`, `checkpoint_dir`.

After editing `openclaw.plugin.json`, always run `openclaw doctor`.

---

## Build & Test

- **Work directory**: `plugin/` — all npm commands run here
- **TypeScript**: strict mode (`strict: true`). `rootDir: src`, `outDir: dist`, `module: NodeNext`
- **Tests**: Vitest, v8 coverage. Pattern: `src/__tests__/**/*.test.ts`
- **tsconfig excludes**: `**/*.test.ts` from compilation
- **typeRoots**: includes `~/.npm-global/lib/node_modules/@types` for local OpenClaw types

---

## Release

**Automated via semantic-release. Never manually bump versions.**

- `master` → stable releases (minor/patch/major)
- `dev` → prereleases (`-dev.x` suffix)
- Conventional commits: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`
- `semantic-release` uses `pkgRoot: plugin`
- Git assets committed: `plugin/package.json`, `plugin/openclaw.plugin.json`

---

## Plugin Development Conventions

### Adding a New Tool

1. Create under `plugin/src/tools/<name>/` (or single file if small)
2. Export `register<Name>Tool(api)` function
3. Register in `plugin/src/index.ts`
4. Add contract name to `openclaw.plugin.json` → `contracts.tools[]`
5. If config needed, add to `configSchema` in `openclaw.plugin.json`
6. Run `openclaw doctor`

### Adding a New Hook

1. Create file under `plugin/src/hooks/`
2. Export `register<Name>(api)` or `register<Name>Hook(registry)` function
3. Register in `plugin/src/index.ts`

### Adding a New Command

1. Add to `plugin/src/commands/<name>-commands.ts`
2. Export `register<Name>Commands(api)`
3. Register in `plugin/src/index.ts`
4. Increment `commandCount` by actual number of commands registered

---

## Key Patterns

### Registration Counters

`index.ts` tracks `hookCount`, `toolCount`, `commandCount`, `serviceCount`. Increment by actual number of items registered (e.g., `toolCount += 4` for 4 todo tools).

### Tool Registration

```typescript
export function registerXxxTool(api: OpenClawPluginApi) {
  api.registerTool({
    name: 'omoc_xxx',
    description: '...',
    parameters: TypeBoxSchema,
    handler: async (params, ctx) => { ... }
  });
}
```

### Hook Registration

```typescript
export function registerXxx(api: OpenClawPluginApi) {
  api.registerHook('before_prompt_build', async (ctx) => { ... });
}
```

### Skill Discovery (async, deferred)

Skills are discovered asynchronously after sync registration. Tool registrations that depend on discovered skills (skill-mcp, skill) are wrapped in an IIFE inside `register()`.

---

## Gotchas

- **`plugin/` is the npm package root** — repo root is NOT an npm project
- **`dist/` is gitignored** — always build before testing plugin loading
- **`workspace/` and `.sisyphus/` are gitignored** — runtime data, not tracked
- **SDK types** in `plugin/src/` — may need updates when OpenClaw SDK changes
- **`openclaw.plugin.json` `files` field** controls npm publish contents — keep in sync
- **persona-bootstrap hook removed** — replaced by `agent:bootstrap` internal hook
- **session-sync removed** — AGENTS.md is no longer auto-modified by the plugin
- **`config/categories.json`** referenced in docs/README is generated by `omoc-setup`, not checked into the repo
- **No `.github/` in workspace** — CI workflows exist in the git repo but not the workspace copy

## Agent Personas (Bundled)

Profiles in `plugin/agents/`:

| File | Role |
|------|------|
| planner.md | Strategic planning (Prometheus) |
| coder.md | Primary worker (Sisyphus-Junior) |
| expert.md | Deep technical work (Hephaestus/Oracle) |
| explorer.md | Codebase exploration (Explore) |
| researcher.md | Documentation & research (Librarian) |
| reviewer.md | Plan/code review (Momus/Metis) |
| advisor.md | Pre-planning consulting (Metis) |
| architect.md | Architecture decisions (Oracle) |
| delegate.md | Delegation orchestration (Atlas) |
| frontend.md | UI/UX implementation (Frontend) |
| multimodal-looker.md | Visual analysis (Multimodal Looker) |

---

## Skills (Bundled)

Definitions in `plugin/skills/`:

| Skill | Purpose |
|-------|---------|
| git-master.md | Git workflows, commit surgery, history archaeology |
| frontend-ui-ux.md | Design-first UI development |
| comment-checker.md | Anti-AI-slop code quality guard |
| openclaw-look-at.md | OpenClaw native multimodal (image/pdf) |
| web-search.md | Web search integration |
| delegation-prompt.md | Delegation patterns |
| multimodal-analysis.md | Multimodal analysis workflows |
| opencode-controller.md | OpenCode/OmO delegation via tmux |
| tmux.md | tmux session orchestration |
| tmux-agents.md | Agent spawning/monitoring in tmux |
| workflow-*.md | Workflow templates (ultrawork, plan, start-work, tool-patterns, auto-rescue) |
| steering-words.md | Task steering vocabulary |
