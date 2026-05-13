# Oh-My-OpenClaw — Agent Instructions

OpenClaw plugin — multi-agent orchestration with 11 personas, category-based model routing, todo enforcement, Ralph self-correcting loops, 20+ custom tools.

## Project at a Glance

| Item | Value |
|------|-------|
| **Type** | OpenClaw plugin (TypeScript, ESM) |
| **Package** | `@happycastle/oh-my-openclaw` |
| **Build** | `tsc` → `plugin/dist/` |
| **Test** | `vitest` (13 suites in `plugin/src/__tests__/`) |
| **Entry** | `plugin/src/index.ts` → `register()` |

## Developer Commands

```bash
cd plugin
npm run build        # tsc → dist/
npm run dev          # tsc --watch
npm run test         # vitest run
npm run typecheck    # tsc --noEmit
```

**⚠️ After any code change in `plugin/src/`**: `npm run build` to update `dist/`, then restart OpenClaw to load changes.

## Architecture

### 3-Layer Agent System

| Layer | Agents | Purpose |
|-------|--------|---------|
| **Planning** | Prometheus, Metis, Momus | Interview user, create/validate plans |
| **Orchestration** | Atlas | Distribute tasks, verify completion |
| **Workers** | Sisyphus-Junior, Hephaestus, Oracle, Explore, Librarian, Multimodal Looker, Frontend | Execute tasks |

### Category Routing

`config/categories.json` maps intent → model. Key: `quick`=qwen3-coder-next, `deep`=qwen3-coder-plus, `ultrabrain`=qwen3-max, `visual-engineering`=qwen3.5-plus.

### Key God Nodes (knowledge graph)

1. `register()` — entry point, wires 10+ hooks, 20+ tools, 13+ commands
2. `SkillMcpManager` — cross-community bridge (Communities 0,1,7,11)
3. `toolResponse()` / `toolError()` — tool result handling
4. `LSPClient` — bridges LSP to Communities 6 and 9
5. `getPluginConfig()` — config access across 18 edges

### Conventions

- **All tools** register via `register*Tool(api)` — increments `toolCount`
- **All hooks** register via `register*Hook(api)` — increments `hookCount`
- **Async skill discovery** runs after sync registrations — `SkillMcpTool` and `SkillTool` depend on it
- **Config** lives in `config/categories.json` — never hardcoded
- **Tool restrictions** in `categories.json` → `tool_restrictions`: `oracle/librarian/explore/metis/momus` deny write/edit/spawn; `multimodal-looker` allow only `read,image,group:ui,exec`

## Code Analysis Workflow

**Order of operations** when understanding code, fixing bugs, or adding features:

1. **Knowledge graph first** — `graphify-out/GRAPH_REPORT.md` for entry points, god nodes, community clusters. 71.5× cheaper than reading raw files. Update after changes: `graphify . --update`
2. **LSP tools** — `omoc_goto_definition`, `omoc_find_references`, `omoc_symbols`, `omoc_diagnostics` for precision tracing
3. **Wiki** — `wiki_search("query")` for verified-correct facts
4. **AST grep** — `omoc_ast_grep_search` / `omoc_ast_grep_replace` when LSP falls short
5. **Raw reading/grep** — last resort only
