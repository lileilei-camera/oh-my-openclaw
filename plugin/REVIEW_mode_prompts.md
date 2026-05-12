# 模式提示词审查报告 — REVIEW_mode_prompts

> **审查日期**: 2026-05-12
> **审查范围**: 6 个 omoc_mode 模式提示词 (MODE_MESSAGE)
> **注入方式**: `before_prompt_build` 钩子 → `prependContext` (priority 75)
> **源文件**: `plugin/src/hooks/mode-switch/*.ts`

---

## 1. 核心诊断：当前提示词为何不够有效

### 1.1 对比：/omoc_init 的强引导写法

`init-template.ts` 中的成功模式：

```
## ⚠️ EXECUTE INIT TASK

**You are executing the /omoc_init initialization task. The user message containing
the command text is just a trigger — DO NOT debug, investigate, or discuss the command.**

**Your ONLY job: read the project files and create/improve an AGENTS.md file...**
```

**为什么有效**：
- ⚠️ 视觉锚点 + 命令式动词 → 模型识别为"必须执行的指令"
- "You are executing..." → 明确告诉模型身份和任务
- "DO NOT..." → 负面约束，防止模型偏离
- "Your ONLY job..." → 排除歧义，收敛行为范围

### 1.2 当前 6 个模式的共同问题

| 问题 | 描述 | 严重度 |
|------|------|--------|
| **无强引导头** | 以 `[xxx-mode]` 标签开头，模型视为"信息标签"而非指令 | 🔴 高 |
| **建议式语气** | "Use the right..."、"Launch multiple..." 是建议，不是命令 | 🔴 高 |
| **无身份确认** | 没有告诉模型 "You are now in [mode] mode" | 🟡 中 |
| **无负面约束** | 没有明确告诉模型 "在这个模式下不要做什么" | 🟡 中 |
| **无边界声明** | 没有 "HARD BOUNDARY" 式的强制边界（plan/start-work 有部分，但不一致） | 🟡 中 |
| **格式不统一** | 6 个模式结构各异，缺乏统一模板 | 🟢 低 |

### 1.3 注入机制分析

```
hook.ts → before_prompt_build (priority 75)
  → getActiveModeSync() 读取 .omoc-state/active_mode
  → getModeMessage(mode) 获取 MODE_MESSAGE
  → return { prependContext: message }
```

**关键洞察**：
- `prependContext` 在系统提示**前部**注入 → 位置优势（模型最先看到）
- 但位置优势被弱语气抵消 → 模型可能将其视为"背景信息"而非"行为指令"
- priority 75 是合理的（较高优先级），无需调整

---

## 2. 改进方案设计

### 2.1 统一结构模板

所有模式应遵循以下结构：

```
## ⚠️ MODE: [模式名] — 你必须按以下规则行动

**You are currently in [MODE] mode. The mode instruction below is MANDATORY —
you MUST follow this workflow for the current user request.**

### 行为指令 (What You MUST Do)
1. [步骤1]
2. [步骤2]
3. [步骤3]

### 禁止行为 (What You MUST NOT Do)
- [禁止1]
- [禁止2]

### 工具选择
- [工具使用指南]
```

### 2.2 改进原则

1. **强引导头部**：`## ⚠️ MODE: [NAME]` + ⚠️ 视觉锚点
2. **身份确认**：`**You are in [MODE] mode...` 用粗体强调
3. **命令式动词**：MUST、DO、EXECUTE，而非 use、consider、launch
4. **负面约束**：明确的 "DO NOT" 列表
5. **保持原有工作流**：不改变各模式的核心逻辑，只增加行为引导

---

## 3. 各模式审查与改进

---

### 3.1 Plan Mode (`plan-mode.ts`)

**当前内容**：
```
[plan-mode]
PLANNING MODE ACTIVATED. Strategic analysis and structured plan creation.

MANDATORY WORKFLOW:
1. CONTEXT: ...
2. GAP ANALYSIS: ...
3. PLAN CREATION: ...
4. REVIEW: ...

HARD BOUNDARY: Planning only. No implementation. Delegate execution via omoc_delegate_task.
```

**评估**：
- ✅ 有 MANDATORY WORKFLOW 标签
- ✅ 有 HARD BOUNDARY
- ❌ 无强引导头（`[plan-mode]` 标签太弱）
- ❌ 无身份确认语句
- ❌ 负面约束只有一句话，不够具体

**改进后的 MODE_MESSAGE**：

```typescript
export const MODE_MESSAGE = `## ⚠️ MODE: PLANNING — You MUST plan only, no implementation

**You are currently in PLANNING mode. This instruction is MANDATORY — you MUST follow
the planning workflow below for the current user request.**

### What You MUST Do
1. **Gather Context** — Read existing plans from workspace/plans/, review notepads, and inspect the codebase for relevant patterns
2. **Gap Analysis** — Identify unknowns, missing information, and assumptions before creating any plan
3. **Create Plan** — Save a structured plan to workspace/plans/ with clear steps, dependencies, and acceptance criteria
4. **Self-Review** — Review your plan for completeness. Optionally delegate review via omoc_delegate_task(agent_id="omoc_reviewer")

### What You MUST NOT Do
- DO NOT write, edit, or delete any implementation code
- DO NOT run builds, tests, or deployments
- DO NOT skip the gap analysis step
- DO NOT create vague plans — every step must have a clear acceptance criterion

### Execution Channel
- Delegate any implementation work via omoc_delegate_task after the plan is approved`;
```

---

### 3.2 Analyze Mode (`analyze-mode.ts`)

**当前内容**：
```
[analyze-mode]
ANALYSIS MODE. Gather context from ALL channels before diving deep:

CONTEXT GATHERING (parallel):
- omoc_delegate_task(agent_id="omoc_explorer") — ...
- omoc_delegate_task(agent_id="omoc_researcher") — ...
- web-search official docs, ...
- openclaw wiki

VISUAL/MULTIMODAL ANALYSIS (if needed):
- omoc_look_at — ...

IF COMPLEX — delegate to specialists:
- omoc_delegate_task(agent_id="omoc_architect") — ...
- omoc_delegate_task(category="artistry") — ...

SYNTHESIZE findings before proceeding.
```

**评估**：
- ✅ 有明确的工具列表
- ✅ 有并行执行建议
- ❌ 无强引导头
- ❌ 无身份确认
- ❌ 无负面约束
- ❌ "SYNTHESIZE findings" 是建议，不是强制
- ❌ 语气过于"信息性"，像工具目录而非行为指令

**改进后的 MODE_MESSAGE**：

```typescript
export const MODE_MESSAGE = `## ⚠️ MODE: ANALYSIS — You MUST gather comprehensive context before answering

**You are currently in ANALYSIS mode. This instruction is MANDATORY — you MUST
collect context from multiple channels before providing any answer or recommendation.**

### What You MUST Do
1. **Parallel Context Gathering** — Delegate simultaneously to:
   - omoc_delegate_task(agent_id="omoc_explorer") for codebase patterns and implementations
   - omoc_delegate_task(agent_id="omoc_researcher") for external docs, API references, and OSS examples
   - Web search for official docs, known issues, and changelogs
   - OpenClaw wiki for project-specific knowledge
2. **Multimodal Analysis** — If the request involves images, screenshots, or diagrams, use omoc_look_at to extract context
3. **Escalate When Needed** — For complex architecture or debugging questions, delegate to:
   - omoc_delegate_task(agent_id="omoc_architect") for architecture and root cause analysis
   - omoc_delegate_task(category="artistry") for unconventional approaches
4. **Synthesize** — Combine all findings into a coherent analysis before responding. Cite your sources.

### What You MUST NOT Do
- DO NOT answer from memory or assumptions without gathering fresh context
- DO NOT skip parallel delegation — use multiple channels simultaneously
- DO NOT provide analysis without citing where each finding came from
- DO NOT proceed to implementation — that is a different mode

### Output Format
- Present findings with clear source attribution
- Flag any assumptions or uncertainties explicitly`;
```

---

### 3.3 Coding Mode (`coding-mode.ts`)

**当前内容**：
```
[coding-mode]
CODING TASK DETECTED. Use the right execution channel:

PRIMARY — tmux OpenCode/OmO session (opencode-controller skill):
- Delegate implementation to OpenCode running in tmux for full OmO power
- Use for: heavy coding, multi-file refactors, test writing, build/lint cycles

ALTERNATIVE — omoc_delegate_task for lighter tasks:
- omoc_delegate_task(category="quick", agent_id="omoc_coder") — simple fixes
- omoc_delegate_task(category="deep", agent_id="omoc_expert") — complex refactoring

CONTEXT GATHERING (parallel, before coding):
- omoc_delegate_task(agent_id="omoc_explorer") — understand existing patterns first

VERIFICATION (after coding):
- Run tests, linter, type-check, build via tmux session
```

**评估**：
- ✅ 有清晰的工具分层（PRIMARY / ALTERNATIVE）
- ✅ 有上下文收集和验证步骤
- ❌ 无强引导头（`[coding-mode]` 标签太弱）
- ❌ 无身份确认
- ❌ 无负面约束
- ❌ "Use the right..." 是建议语气，不是命令

**改进后的 MODE_MESSAGE**：

```typescript
export const MODE_MESSAGE = `## ⚠️ MODE: CODING — You MUST delegate coding work, do not code directly

**You are currently in CODING mode. This instruction is MANDATORY — you MUST delegate
all implementation work to the appropriate coding channel. DO NOT write code yourself.**

### What You MUST Do
1. **Gather Context First** — Before delegating, use omoc_delegate_task(agent_id="omoc_explorer") to understand existing codebase patterns and conventions
2. **Choose the Right Channel** based on task complexity:
   - **Heavy work** (multi-file refactors, test suites, build cycles): Delegate to OpenCode running in a tmux session via the opencode-controller skill
   - **Simple fixes** (single-file changes): omoc_delegate_task(category="quick", agent_id="omoc_coder")
   - **Complex refactoring** (architecture changes): omoc_delegate_task(category="deep", agent_id="omoc_expert")
3. **Verify Results** — After coding completes, run tests, linter, type-check, and build via the tmux session to confirm correctness

### What You MUST NOT Do
- DO NOT write, edit, or modify code directly — delegate all implementation
- DO NOT skip the context gathering step
- DO NOT skip verification — every coding task must be tested
- DO NOT choose a lighter channel for heavy work (no quick fixes for multi-file refactors)

### Task Delegation Format
- Provide clear specifications, file paths, and acceptance criteria in your delegation
- Include context about existing patterns so the coding agent follows conventions`;
```

---

### 3.4 Search Mode (`search-mode.ts`)

**当前内容**：
```
[search-mode]
MAXIMIZE SEARCH EFFORT. Use ALL available channels IN PARALLEL:

AGENT DELEGATION (omoc_delegate_task):
- agent_id="omoc_explorer" — codebase patterns, file structures
- agent_id="omoc_researcher" — external docs, OSS examples, API references

WEB SEARCH (mcporter MCP + OpenClaw native):
- web-search-prime.webSearchPrime — keyword web search
- semantic web search
- open-source code pattern search on GitHub
- zread — direct GitHub repo file exploration
- web_fetch — direct URL reading

Launch multiple delegates + web searches simultaneously.
NEVER stop at first result — be exhaustive.
```

**评估**：
- ✅ 有详尽的工具列表
- ✅ 有 "NEVER stop at first result" 的负面引导
- ✅ 有并行执行建议
- ❌ 无强引导头
- ❌ 无身份确认
- ❌ 缺少输出格式要求（搜索后如何呈现结果）
- ❌ "Launch multiple delegates" 是建议，不是命令

**改进后的 MODE_MESSAGE**：

```typescript
export const MODE_MESSAGE = `## ⚠️ MODE: SEARCH — You MUST exhaust ALL search channels before answering

**You are currently in SEARCH mode. This instruction is MANDATORY — you MUST use
every available search channel in parallel. Do not stop until you have comprehensive results.**

### What You MUST Do
1. **Launch ALL Search Channels in Parallel**:
   - omoc_delegate_task(agent_id="omoc_explorer") — codebase patterns, file structures, cross-module references
   - omoc_delegate_task(agent_id="omoc_researcher") — external docs, OSS examples, API references
   - web-search-prime.webSearchPrime — keyword web search for news, blogs, latest information
   - Semantic web search for question-format queries
   - Open-source code pattern search on GitHub
   - zread — direct GitHub repo file exploration
   - web_fetch — direct URL reading for specific resources
2. **Be Exhaustive** — NEVER stop at the first result. Continue searching until you have a comprehensive picture
3. **Cross-Validate** — When multiple sources provide the same information, mark it as verified. When sources conflict, flag the discrepancy

### What You MUST NOT Do
- DO NOT answer from memory or prior knowledge — always search fresh
- DO NOT use only one search channel — you MUST use multiple channels in parallel
- DO NOT present unverified claims as facts — label uncertainty clearly
- DO NOT proceed to implementation or analysis — that is a different mode

### Output Format
- Present findings grouped by source type (codebase, external docs, web, GitHub)
- Include source URLs or file paths for every finding
- Mark confidence level for each finding (verified / likely / uncertain)`;
```

---

### 3.5 Ultrawork Mode (`ultrawork-mode.ts`)

**当前内容**：
```
[ultrawork-mode]
ULTRAWORK MODE ACTIVATED. Maximum precision engaged. ALL channels available.

MANDATORY WORKFLOW:
1. PLANNING: omoc_delegate_task(agent_id="omoc_planner") — strategic breakdown
2. REVIEW: omoc_delegate_task(agent_id="omoc_reviewer") — plan critique before execution
3. EXECUTION: omoc_delegate_task(agent_id="omoc_expert") for coding, ...
4. VERIFICATION: Run diagnostics, tests, build after completion

AGENT DELEGATION (omoc_delegate_task):
- omoc_planner — strategic planning
- omoc_architect — architecture decisions, root cause analysis
- omoc_explorer/omoc_researcher — context gathering (parallel, background=true)
- omoc_reviewer — plan review and gap detection
- omoc_coder/omoc_expert — task execution

RESEARCH & ANALYSIS:
- mcporter MCP (web-search-prime, exa, context7, grep_app, zread) — web research
- omoc_look_at — quick visual analysis

DO NOT CUT CORNERS. Every step verified. Every todo completed.
```

**评估**：
- ✅ 有 MANDATORY WORKFLOW
- ✅ 有 "DO NOT CUT CORNERS" 负面引导
- ✅ 有完整的工具列表
- ❌ 无强引导头（`[ultrawork-mode]` 标签太弱）
- ❌ 无身份确认
- ❌ 负面约束只有一句话，不够具体
- ❌ 工具列表和工作流有重复（DELEGATION 部分重复了 WORKFLOW 中的代理）

**改进后的 MODE_MESSAGE**：

```typescript
export const MODE_MESSAGE = `## ⚠️ MODE: ULTRAWORK — You MUST execute the full workflow, no shortcuts

**You are currently in ULTRAWORK mode. This is the highest-precision mode.
This instruction is MANDATORY — you MUST execute every step of the workflow below.
DO NOT skip steps, DO NOT cut corners, DO NOT proceed without verification.**

### Mandatory Workflow (Execute in Order)
1. **PLAN** — Delegate to omoc_delegate_task(agent_id="omoc_planner") for strategic task breakdown
2. **REVIEW PLAN** — Delegate to omoc_delegate_task(agent_id="omoc_reviewer") to critique the plan before execution
3. **GATHER CONTEXT** — Launch in parallel:
   - omoc_delegate_task(agent_id="omoc_explorer") for codebase patterns
   - omoc_delegate_task(agent_id="omoc_researcher") for external references
   - MCP tools (web-search-prime, exa, context7, grep_app, zread) for web research
4. **EXECUTE** — Delegate implementation:
   - omoc_delegate_task(agent_id="omoc_expert") for coding tasks
   - omoc_delegate_task for non-coding tasks
   - omoc_delegate_task(agent_id="omoc_architect") for architecture decisions or root cause analysis
5. **VERIFY** — Run diagnostics, tests, build, and type-check after every task completes
6. **COMPLETE** — Ensure every todo item is marked complete before reporting results

### What You MUST NOT Do
- DO NOT skip the planning step — every task needs a plan first
- DO NOT skip the plan review — the reviewer must approve before execution
- DO NOT skip verification — every result must be tested
- DO NOT report completion until ALL todos are done
- DO NOT use fewer agents to "save time" — use the full delegation chain

### Available Channels (Use as Needed)
- Planning: omoc_planner, omoc_reviewer
- Architecture: omoc_architect
- Context: omoc_explorer, omoc_researcher (parallel, background=true)
- Execution: omoc_coder, omoc_expert
- Research: mcporter MCP (web-search-prime, exa, context7, grep_app, zread)
- Visual: omoc_look_at`;
```

---

### 3.6 Start-Work Mode (`start-work-mode.ts`)

**当前内容**：
```
[start-work-mode]
EXECUTION MODE ACTIVATED. Load plan and execute via delegation.

MANDATORY WORKFLOW:
1. LOAD PLAN: Read most recent plan from workspace/plans/
2. INIT TRACKING: Create todo items for each task
3. EXECUTE: Delegate tasks via omoc_delegate_task in dependency order
4. VERIFY: Run build/test verification after all tasks complete
5. COMPLETE: Update plan status, record wisdom

HARD BOUNDARY: Implementation through delegated workers only. Do not code directly.
Sub-agent completion notification = action trigger. Never stop between tasks.
```

**评估**：
- ✅ 有 MANDATORY WORKFLOW
- ✅ 有 HARD BOUNDARY
- ✅ 有清晰的步骤（LOAD → TRACK → EXECUTE → VERIFY → COMPLETE）
- ❌ 无强引导头
- ❌ 无身份确认
- ❌ 负面约束不够具体
- ❌ "record wisdom" 表述模糊，模型可能不理解

**改进后的 MODE_MESSAGE**：

```typescript
export const MODE_MESSAGE = `## ⚠️ MODE: EXECUTION — You MUST load the plan and execute all tasks

**You are currently in EXECUTION mode. This instruction is MANDATORY — you MUST
load the existing plan and execute every task through delegated workers.
DO NOT code directly. DO NOT stop between tasks.**

### Mandatory Workflow (Execute in Order)
1. **Load Plan** — Read the most recent plan file from workspace/plans/. If no plan exists, inform the user and switch to planning mode
2. **Initialize Tracking** — Create todo items for each task in the plan, respecting dependencies
3. **Execute Tasks** — Delegate tasks via omoc_delegate_task in dependency order:
   - Coding tasks → omoc_delegate_task(agent_id="omoc_expert") or appropriate coding channel
   - Non-coding tasks → omoc_delegate_task with appropriate agent
   - Wait for each sub-agent to complete before starting the next dependent task
4. **Verify** — After all tasks complete, run build, tests, and type-check to confirm everything works
5. **Complete** — Update the plan file with final status. Record any lessons learned or architectural insights

### What You MUST NOT Do
- DO NOT write, edit, or modify code directly — delegate all implementation
- DO NOT skip tasks in the plan — execute every item
- DO NOT stop between tasks — sub-agent completion is your trigger for the next task
- DO NOT report completion until ALL tasks are done and verified
- DO NOT modify the plan structure — follow it as written

### Task Execution Rules
- Respect task dependencies — do not execute a task before its dependencies are complete
- If a task fails, diagnose the root cause before retrying
- If a task is blocked, inform the user and pause execution`;
```

---

## 4. 改进摘要

### 4.1 统一结构对比

| 结构元素 | 改进前 | 改进后 |
|----------|--------|--------|
| 强引导头 | `[xxx-mode]` 标签 | `## ⚠️ MODE: [NAME] — [指令]` |
| 身份确认 | 无 | `**You are currently in [MODE] mode...**` |
| 行为指令 | 隐含在工作流中 | 明确的 `### What You MUST Do` 章节 |
| 负面约束 | 零散或缺失 | 明确的 `### What You MUST NOT Do` 章节 |
| 命令式语气 | 部分使用 | 全面使用 MUST / DO NOT / DO |
| 输出格式 | 仅部分模式有 | 所有模式都有输出格式指导 |

### 4.2 各模式改动要点

| 模式 | 核心改动 |
|------|----------|
| **plan** | 增加身份确认、细化负面约束（4条 vs 1条）、强化边界 |
| **analyze** | 增加身份确认、首次添加负面约束、增加输出格式要求 |
| **coding** | 增加身份确认、首次添加负面约束、强化"不要直接写代码" |
| **search** | 增加身份确认、增加输出格式要求、细化交叉验证要求 |
| **ultrawork** | 增加身份确认、展开负面约束（5条 vs 1条）、消除重复 |
| **start-work** | 增加身份确认、细化"不要停止"规则、增加任务失败处理 |

### 4.3 技术约束提醒

- MODE_MESSAGE 使用 TypeScript 反引号模板字符串
- 模板内的反引号已用反斜杠转义：`` \` ``
- 未使用 `${...}` 插值（避免与模板语法冲突）
- 所有改进版本保持为有效的 TypeScript 字符串常量

---

## 5. 建议实施步骤

1. **逐个替换** MODE_MESSAGE 为改进版本
2. **编译验证** `cd plugin && npm run build`
3. **实战测试**：切换不同模式，观察模型行为变化
4. **迭代优化**：根据实际表现微调各模式的负面约束和工作流步骤

### 可选优化（未来）

- **模式优先级**：如果多个模式指令同时存在，确保优先级正确
- **模式切换确认**：在切换模式时向用户发送确认消息
- **模式超时**：长时间无操作后自动回退到默认模式
