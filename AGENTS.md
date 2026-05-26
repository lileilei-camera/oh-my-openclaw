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

## Architecture: Plugin Hook 回调参数与工作空间获取

> 经验来源: 2026-05-22 Project Guard 开发，详见 `plans/project-guard.md`

### Hook 回调的第二个参数 `ctx` 是 agent/session 上下文的唯一来源

所有 hook 回调都是 `(event, ctx) => { ... }` 形式。`ctx` 携带运行时 agent/session 信息：

| Hook | ctx 类型 | 关键字段 |
|------|---------|---------|
| `before_tool_call` | `PluginHookToolContext` | `agentId?`, `sessionKey?`, `sessionId?`, `toolName`, `toolCallId?` |
| `agent_end` | `PluginHookAgentContext` | `agentId?`, `sessionKey?`, `sessionId?` |
| `before_prompt_build` | `PluginHookAgentContext` | `agentId?`, `sessionKey?`, `workspaceDir?`, `modelProviderId?`, `modelId?` |

类型定义在 `openclaw/dist/plugin-sdk/src/plugins/hook-types.d.ts`。

### `api.config` 是全局配置快照，不含单一 agent 身份

```typescript
api.config.agentId    // ❌ undefined — OpenClawConfig 没有此字段
api.config.sessionKey // ❌ undefined — 同上
```

**原因**：同一 Gateway 可并发运行多 agent，agent 身份由 session 路由在运行时决定。

### 正确获取 agent 配置（workspace 等）

```typescript
// 1. agent 身份 → hook ctx（运行时决定）
ctx.agentId      // "coder"
ctx.sessionKey   // "agent:coder:main"

// 2. agent 配置 → api.config.agents.list[] 按 id 匹配
const agent = (api.config as any).agents?.list?.find(a => a.id === ctx.agentId);
agent?.workspace  // "/home/llli/.openclaw/workspace-coder"
```

`AgentConfig` 类型（`types.agents.d.ts:63`）：`{ id: string; workspace?: string; ... }`

### 工作空间获取方式演进

| 方式 | 代码 | 结果 |
|------|------|------|
| ❌ `api.config.agentId` | `api.config.agentId` | `undefined`（字段不存在） |
| ❌ 无依据拼接 | `join(home, 'workspace-' + agentId)` | `workspace-main` 错误（实际是 `workspace`） |
| ✅ 查 agent 配置 | `agents.list.find(a => a.id === agentId)?.workspace` | 配置中的真实路径 |

### `path.normalize()` 尾部斜杠陷阱

`normalize()` 按 POSIX 语义保留尾部 `/`：

```javascript
normalize("/home/user/project/")  // → "/home/user/project/"  ← 斜杠保留
normalize("/home/user/project")   // → "/home/user/project"
```

前缀匹配时 `".../project/" + sep` 产生 `".../project//"` 双斜杠，导致 `startsWith` 永不匹配。

**修复**：比较前 `stripTrailingSep`（`p.replace(/\/+$/, '') || '/'`）。

### 日志级别策略

| 级别 | 生产可见 | 适用场景 |
|------|---------|---------|
| `api.logger.debug()` | ❌ | 开发期详细追踪 |
| `api.logger.info()` | ✅（默认 level: info） | 关键路径决策点 |
| `api.logger.warn()` | ✅ | 越界/异常 |

**规则**：guard 决策路径（skip/pass/block）用 `info`，确保默认配置下可见。

### 编译后验证清单

1. `npx tsc --noEmit` — 类型检查
2. `npm run build` — 编译到 dist
3. 确认 dist 文件 mtime > 编译时间
4. 确认 Gateway 启动时间 > dist mtime（否则加载旧缓存）
5. 通过 Gateway 重启时日志中的 `[oh-my-openclaw] Initializing plugin vX.Y.Z` 确认版本

**注意**：symlink 安装的插件（`npm link`），源码路径不变，Node.js 缓存旧版。改 dist 后必须重启 Gateway。

### `parseCdTarget` 局限性

- 只能解析 `cd /some/path` 格式
- OpenClaw 可能在 exec 前注入 wrapper（`cd $workspaceDir && ...`），guard 看到的是 wrapper 的 cd
- 不含 `cd` 的命令（纯 `grep`、`ps` 等）返回 null，guard 直接 passthrough
