# Oh-My-OpenClaw — Agent Instructions

Oh-My-OpenClaw (OmOC) is an **OpenClaw plugin** providing multi-agent orchestration: 11 specialized personas, category-based model routing, todo enforcement, Ralph self-correcting loops, and 20+ custom tools.

## Project at a Glance

| Item | Value |
|------|-------|
| **Type** | OpenClaw plugin (TypeScript, ESM) |
| **Package** | `@happycastle/oh-my-openclaw` |
| **Version** | 0.21.3 |
| **Build** | `tsc` → `dist/` |
| **Test** | `vitest` (13 test files in `plugin/src/__tests__/`) |
| **Entry** | `plugin/src/index.ts` → `register()` |

## Developer Commands

```bash
cd plugin

npm run build        # tsc → dist/
npm run dev          # tsc --watch
npm run test         # vitest run
npm run test:watch   # vitest (interactive)
npm run test:coverage # vitest run --coverage
npm run typecheck    # tsc --noEmit (same as lint)
npm run lint         # tsc --noEmit
```

**Install + test flow**: after changes in `plugin/src/`, run `npm run build` to update `dist/`, then restart OpenClaw or reload the plugin to see changes.

## Architecture

### 3-Layer Agent System

| Layer | Agents | Purpose |
|-------|--------|---------|
| **Planning** | Prometheus, Metis, Momus | Interview user, create/validate plans |
| **Orchestration** | Atlas | Distribute tasks, verify completion |
| **Workers** | Sisyphus-Junior, Hephaestus, Oracle, Explore, Librarian, Multimodal Looker, Frontend | Execute tasks |

### Category Routing (model selection)

Categories in `config/categories.json` map intent to models. Key defaults:
- `quick` → `bailian/qwen3-coder-next`
- `deep` → `bailian/qwen3-coder-plus`
- `ultrabrain` → `bailian/qwen3-max-2026-01-23`
- `visual-engineering` → `bailian/qwen3.5-plus`

### Plugin Structure

```
plugin/src/
  index.ts              # Entry — register() wires everything
  types.ts              # Plugin types + config schema
  version.ts            # VERSION constant
  hooks/                # OpenClaw lifecycle hooks
    todo-enforcer.ts    # Forces task completion via system prompt
    comment-checker.ts  # Detects/removes AI slop comments
    subagent-tracker.ts  # Tracks spawned sub-agents
    context-injector.ts  # Injects context into sessions
    guardrail-injector.ts
    spawn-guard.ts      # Validates session_spawn calls
    mode-switch/        # Agent mode switching
    project-init/       # Auto-init for new projects
    todo-reminder.ts    # Todo reminders + session cleanup
  tools/                # Custom tool registrations
    delegate-task/       # omoc_delegate
    background-task/     # background output/cancel
    lsp/                 # LSP: goto/refs/symbols/diagnostics/rename
    ast-grep/            # AST search + replace
    session-manager/     # session list + read
    todo/                # 4 todo tools
    grep/                # grep tool
    glob/                # glob tool
    interactive-bash/    # PTY bash in tmux
    look-at/             # Multimodal analysis
    checkpoint.ts        # Save/load execution state
    web-search.ts        # Web search tool
    omo-delegation.ts    # Delegate to OpenCode via ACP
    slashcommand/        # Slash command executor
    call-omo-agent/      # Call OmO sub-agents
    skill/               # Skill management
    skill-mcp/           # Skill MCP server
  commands/             # CLI commands
    ralph-commands.ts    # /ralph_loop, /ralph_stop
    status-commands.ts   # /omoc_health, /omoc_config
    persona-commands.ts  # /omoc, /omoc_personas
    todo-commands.ts     # /todos + 3 todo commands
    mode-commands.ts     # /omoc_mode
    init-commands.ts     # /omoc_init
  features/
    skill-loader/        # Discover & merge builtin/user/project skills
    skill-mcp-manager/   # SkillMcpManager (cross-community bridge)
  services/
    ralph-loop.ts        # Self-correcting execution loop
    webhook-bridge.ts    # Webhook bridge service
  __tests__/            # Vitest test files (13 suites)
```

### Key God Nodes (from knowledge graph)

1. `register()` — plugin entry point, wires 10+ hooks, 20+ tools, 13+ commands
2. `SkillMcpManager` — cross-community bridge (Communities 0, 1, 7, 11)
3. `toolResponse()` / `toolError()` — tool result/error handling
4. `LSPClient` — bridges LSP to Communities 6 and 9
5. `getPluginConfig()` — config access across 18 edges

## Tool Restrictions

Read-only agents (deny write/edit/spawn): `oracle`, `librarian`, `explore`, `metis`, `momus`
Limited agents (allow only): `multimodal-looker` → `read, image, group:ui, exec`

Config in `config/categories.json` → `tool_restrictions`.

## Conventions

- **All tools register via `register*Tool(api)` functions** — each increments `toolCount`
- **All hooks register via `register*Hook(api)` functions** — each increments `hookCount`
- **Async skill discovery** runs after sync registrations — `SkillMcpTool` and `SkillTool` depend on it
- **Config** lives in `config/categories.json` — not hardcoded
- **Tests** in `plugin/src/__tests__/` — 13 suites covering hooks, tools, commands, services

## Analysis workflow

When you need to understand code, fix bugs, or add features, follow this order:

1. **Knowledge graph — big picture first**: Read `graphify-out/GRAPH_REPORT.md` to identify entry points, key modules, and community clusters. Use `graphify query` or `graphify path` for targeted context. This is ~71.5× cheaper than reading raw source files.
2. **LSP tools — precision analysis**: Use `omoc_goto_definition`, `omoc_find_references`, `omoc_symbols` to trace exact call chains and symbol relationships. Prefer these over raw grep.
3. **Wiki — verified knowledge**: If the wiki exists (`openclaw wiki status`), search it for relevant context. The wiki contains verified-correct facts accumulated over time.
4. **Raw reading/grep — last resort**: Only fall back to reading files and grep when the above tools don't cover it.

## Code analysis tools

Prefer LSP tools over raw reading/grep when analyzing code:

- `omoc_goto_definition` — jump to symbol definition
- `omoc_find_references` — find all usages across the project
- `omoc_symbols` — file outline (scope=document) or workspace search (scope=workspace + query)
- `omoc_diagnostics` — check for errors/warnings before building
- `omoc_rename` — safe cross-file symbol rename

Fallback when LSP is unavailable:
- `omoc_ast_grep_search` — AST pattern search (supports `$VAR` meta-variables)
- `omoc_ast_grep_replace` — AST-aware cross-file refactoring

## Project knowledge graph

A knowledge graph exists at `graphify-out/`. Before grepping or reading raw source files, check the graph for context:

- **Read the report**: `graphify-out/GRAPH_REPORT.md` — identifies entry points, god nodes, and community clusters. ~71.5× cheaper than reading raw files.
- **Semantic query**: `graphify query "..."` — natural-language search across the graph.
- **Trace a path**: `graphify path "FromNode" "ToNode"` — find coupling chains for impact analysis.
- **Explain a node**: `graphify explain "NodeName"` — plain-language explanation of a specific component.
- **Update after changes**: `graphify . --update` — incremental rebuild after edits.

If graphify is not available, fall back to reading source files directly.

## Project wiki

The OpenClaw wiki is a continuously growing knowledge base of **verified-correct facts** about this project. Entries are added over time — it may or may not have what you need, but if it does, the information is reliable.

**When to use**: Whenever you encounter something unfamiliar or need context beyond the code — commands, conventions, setup steps, gotchas, infrastructure details.

- **Check availability**: `openclaw wiki status`
- **Search**: `wiki_search("query")` or `openclaw wiki search "query"` — find relevant wiki pages by topic.
- **Read a page**: `wiki_get("lookup")` or `openclaw wiki get <page-id>` — read detailed context from a specific page.
- **Search modes**: `--mode find-person` / `--mode route-question` / `--mode source-evidence`

If wiki has no relevant entries, rely solely on project source code and documentation.
