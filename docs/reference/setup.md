# omoc-setup 参考文档

`openclaw omoc-setup` — Oh-My-OpenClaw 一站式配置工具。

**源文件**：`plugin/src/cli/setup.ts` （~1044 行）

---

## CLI 选项

```
Usage: openclaw omoc-setup [options]

Oh-My-OpenClaw 一站式配置工具。
无参数时进入交互式 4 步向导。

Examples:
  openclaw omoc-setup                              # Interactive setup
  openclaw omoc-setup --provider anthropic         # Silent install
  openclaw omoc-setup --dry-run                    # Preview changes
  openclaw omoc-setup --start_log                  # Start session viewer
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--config <path>` | auto | OpenClaw 配置文件路径（默认自动查找） |
| `--provider <name>` | — | 跳过交互，静默安装 agent。有效值见 [Provider 预设](#provider-预设) |
| `--force` | false | 覆盖已存在的 OmOC agent 配置 |
| `--dry-run` | false | 仅预览变更，不写入文件 |
| `--start_log` | false | 启动 session log viewer（`127.0.0.1:8765`） |
| `--stop_log` | false | 停止 session log viewer |
| `--restart_log` | false | 重启 session log viewer |

---

## 运行模式

### 1. 交互式向导（默认）

不带 `--provider` 参数时，进入 4 步向导：

```
Step 1/4: Provider
  - 列出可用 provider 预设（含 custom）
  - 选 custom 则手动输入每个 agent tier 的模型

Step 2/4: Model Preview
  - 展示每个 tier 对应的模型配置
  - 用户确认后继续

Step 3/4: MCP Servers
  - Core servers 默认启用
  - Optional servers 逐个确认（Y/n）

Step 4/4: Plugin Features
  - todo_enforcer — 强制任务追踪
  - planner_guard — 禁止 prometheus 编辑代码
  - webhook_bridge — 主动提醒（hooks/wake）
```

### 2. 静默安装（`--provider`）

```bash
openclaw omoc-setup --provider deepseek
```

跳过交互，直接用预设注入所有 agent 配置。

### 3. 预览（`--dry-run`）

```bash
openclaw omoc-setup --dry-run
openclaw omoc-setup --provider anthropic --dry-run
```

展示将要写入的内容，不实际修改文件。

### 4. Session Log Viewer 管理

```bash
openclaw omoc-setup --start_log     # 启动
openclaw omoc-setup --stop_log      # 停止
openclaw omoc-setup --restart_log   # 重启
```

**实现**：`plugin/src/services/session-viewer/manager.ts`

- `child_process.spawn` 启动独立进程（detached）
- PID 写入 `.session-viewer.pid`
- `SIGTERM` 优雅停止 → `SIGKILL` 强制终止
- 端口 8765 被占用时自动尝试 8766、8767...
- 访问方式：`ssh -L 8765:127.0.0.1:8765 llli@<host>` → `http://127.0.0.1:8765`

---

## 写入 Config 的完整流程

`runSetup()` 按以下顺序写入 `openclaw.json`：

```
 1. mergeAgentConfigs()
    └─ agents.list[] 注入 11 个 OmOC agent

 2. syncWorkspacePersonas()          ★ 常被忽略
    └─ plugin/agents/{name}.md → workspace-{agent}/AGENTS.md

 3. applyPlannerGuard()
    └─ omoc_planner.tools.deny 添加 write/edit/spawn

 4. Plugin Settings
    ├─ pluginSettings.oh-my-openclaw.todo_enforcer_enabled
    ├─ pluginSettings.oh-my-openclaw.webhook_bridge_enabled
    └─ pluginSettings.oh-my-openclaw.hooks_token

 5. Hooks Config
    ├─ hooks.enabled = true
    ├─ hooks.token (webhook 启用时)
    └─ hooks.internal
        ├─ enabled = true
        ├─ entries["persona-bootstrap"] = { enabled: true }
        └─ load.extraDirs[] += plugin/hooks/

 6. mcporter MCP Servers
    └─ mcp 配置注入
```

### 安全措施

| 措施 | 说明 |
|------|------|
| `--dry-run` | 全流程预览，不写盘 |
| 自动备份 | 写入前创建 `{config}.bak` |
| YAML 拒绝 | `yaml/yml` 不支持，引导转 JSON5 |
| 路径遍历防护 | agentId/sessionId 含 `..` 时拒绝 |

---

## 2. syncWorkspacePersonas 详解

`runSetup` 合并完 agent 列表后，检查 `added` 和 `updated` 列表，逐一把 persona 定义文件复制到对应 agent 的 workspace：

```
mergeAgentConfigs → { added: ["omoc_coder", ...], updated: [] }
         │
         ▼
syncWorkspacePersonas(changedAgents)
  │
  ├── 查 AGENT_MD_MAP: "omoc_coder" → "coder"
  ├── 读 plugin/agents/coder.md
  ├── mkdir -p ~/.openclaw/workspace-coder
  └── 写 ~/.openclaw/workspace-coder/AGENTS.md
```

**Agent → Workspace 映射**（11 个 agent）：

| agentId | persona 文件 | workspace 目录 |
|---------|-------------|----------------|
| `omoc_planner` | `prometheus.md` | `~/.openclaw/workspace-planner` |
| `omoc_orchestrator` | `atlas.md` | `~/.openclaw/workspace-orchestrator` |
| `omoc_reasoning` | `oracle.md` | `~/.openclaw/workspace-reasoning` |
| `omoc_coder` | `sisyphus.md` | `~/.openclaw/workspace-coder` |
| `omoc_expert` | `hephaestus.md` | `~/.openclaw/workspace-expert` |
| `omoc_delegate` | `delegate.md` | `~/.openclaw/workspace-delegate` |
| `omoc_architect` | `architect.md` | `~/.openclaw/workspace-architect` |
| `omoc_advisor` | `advisor.md` | `~/.openclaw/workspace-advisor` |
| `omoc_explorer` | `explore.md` | `~/.openclaw/workspace-explorer` |
| `omoc_reviewer` | `momus.md` | `~/.openclaw/workspace-reviewer` |
| `omoc_researcher` | `librarian.md` | `~/.openclaw/workspace-researcher` |

| `omoc_looker` | `multimodal-looker.md` | `~/.openclaw/workspace-looker` |
| `omoc_frontend` | `frontend.md` | `~/.openclaw/workspace-frontend` |

---

## Provider 预设

| provider | 标签 |
|----------|------|
| `anthropic` | Anthropic (Claude) |
| `openai` | OpenAI (GPT) |
| `google` | Google (Gemini) |
| `bailian` | Alibaba Bailian (Qwen) |
| `custom` | 手动输入每个 tier 的模型 ID |

**4 个 tier**（对应不同 agent 组）：

| Tier | Agent | 说明 |
|------|-------|------|
| `planner` | prometheus | 战略规划 |
| `orchestrator` | atlas | 编排 |
| `reasoning` | oracle | 深度推理 |
| `analysis` | metis, momus | 分析/审查 |
| `worker` | sisyphus | 实现 |
| `deep-worker` | hephaestus | 深度实现 |
| `search` | explore | 代码搜索 |
| `research` | librarian | 文档研究 |
| `visual` | looker, frontend | 视觉/前端 |

**源**：`plugin/src/cli/model-presets.ts`

---

## 核心函数索引

| 函数 | 行 | 导出 | 职责 |
|------|-----|------|------|
| `findConfigPath` | ~50 | `export` | 多路径搜索配置文件 |
| `validateConfigShape` | ~80 | — | 校验 config 结构 |
| `parseConfig` | ~105 | `export` | JSON5 解析 + 校验 |
| `serializeConfig` | ~109 | `export` | JSON5 序列化 |
| `mergeAgentConfigs` | ~115 | `export` | 合并 agent 列表 |
| `applyProviderToConfigs` | ~145 | `export` | provider preset → model |
| `runInteractiveSetup` | ~290 | `export` | 4 步交互向导 |
| `syncWorkspacePersonas` | **451** | `export` | persona → workspace AGENTS.md |
| `resolvePluginHooksPath` | ~478 | — | 计算 hooks 目录路径 |
| `applyInternalHooksConfig` | **524** | `export` | 注入 persona-bootstrap hook |
| `applyPlannerGuard` | **569** | `export` | prometheus tool deny |
| `runSetup` | **589** | `export` | 主流程 |
| `registerSetupCli` | ~740 | `export` | Commander.js CLI 注册 |

---

## 依赖

| 模块 | 用途 |
|------|------|
| `model-presets.ts` | Provider 预设、tier 映射 |
| `mcporter-setup.ts` | MCP server 配置注入 |
| `agent-configs.ts` | OmOC agent 定义 |
| `agent-ids.ts` | Agent ID ↔ persona 映射 |
| `constants.ts` | `PLANNER_DENY` 工具列表 |
| `session-viewer/manager.ts` | Session log viewer 进程管理 |
| `json5` | 外部依赖：JSON5 解析 |

---

## 已知问题

| 严重度 | 问题 | 位置 |
|--------|------|------|
| 🟡 | `restartViewer` wait 循环无延迟，CPU spin ~3s | `manager.ts` |
| 🟡 | `runSetup` 分 6 次 `writeFileSync`，应批量写 | `setup.ts:589+` |
| 🟡 | 文件 ~1044 行，建议拆分 | `setup.ts` |
| 🟡 | `runCustomProviderFlow` 误打印 "Step 1/3" | `setup.ts` |
| 🟡 | 无单元测试 | — |

---

**最后更新**：2026-05-15
