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
| **Planning** | Planner, Advisor, Reviewer | Create plans, analyze gaps, review |
| **Orchestration** | Delegate | Distribute tasks, verify completion |
| **Workers** | Coder, Expert, Architect, Explorer, Researcher, Looker, Frontend | Execute tasks, search, analyze, design |

All 11 personas listed in AGENTS.md. Each has a dedicated persona prompt in `plugin/agents/`.

### Model Configuration

Agent models are configured in `openclaw.json` → `agents.list`. The plugin resolves models at runtime via `readAgentModel(agentId)` — no local model config file needed. `config/categories.json` no longer contains model fields. See `plugin/src/utils/agent-model.ts`.

### Category Routing

`config/categories.json` maps intent → agent. The delegate-task tool resolves category → agentId → model from openclaw.json.

### Key God Nodes (knowledge graph)

1. `register()` — entry point, wires 10+ hooks, 20+ tools, 13+ commands
2. `readAgentModel()` — reads agent models from openclaw.json agents.list
3. `OMOC_AGENT_CONFIGS` — canonical agent definitions (model-free)
4. `toolResponse()` / `toolError()` — tool result handling
5. `LSPClient` — bridges LSP to Communities 6 and 9

### Conventions

- **All tools** register via `register*Tool(api)` — increments `toolCount`
- **All hooks** register via `register*Hook(api)` — increments `hookCount`
- **Async skill discovery** runs after sync registrations — `SkillMcpTool` and `SkillTool` depend on it
- **Config** lives in `config/categories.json` — never hardcoded
- **Tool restrictions** in `categories.json` → `tool_restrictions`: read-only agents deny write/edit/spawn; `multimodal-looker` allow only `read,image,group:ui,exec`

## Code Analysis Workflow

**Order of operations** when understanding code, fixing bugs, or adding features:

1. **Knowledge graph first** — `graphify-out/GRAPH_REPORT.md` for entry points, god nodes, community clusters. 71.5× cheaper than reading raw files. Update after changes: `graphify . --update`
2. **LSP tools** — `omoc_goto_definition`, `omoc_find_references`, `omoc_symbols`, `omoc_diagnostics` for precision tracing
3. **Wiki** — `wiki_search("query")` for verified-correct facts
4. **AST grep** — `omoc_ast_grep_search` / `omoc_ast_grep_replace` when LSP falls short
5. **Raw reading/grep** — last resort only

## Architecture: workspaceDir 传递

OpenClaw 采用多工作空间架构，每个子智能体有独立工作空间（如 `workspace-coder`），状态文件 `.omoc-state/` 按工作空间隔离。因此所有状态操作必须显式传递 `workspaceDir`，否则默认操作主工作空间，子智能体将无法感知状态变更。

```typescript
// 来源：钩子中 event.context.workspaceDir，命令中 CLI 上下文
const workspaceDir = event.context?.workspaceDir;
getActiveModeSync(workspaceDir);   // 读
setActiveMode(mode, workspaceDir); // 写
resetModeSync(workspaceDir);       // 重置
```
