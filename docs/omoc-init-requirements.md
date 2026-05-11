# /omoc_init 需求文档

> 2026-05-11 · v3 · 用户已确认所有设计决策

---

## 1. 背景与约束

### 1.1 OpenClaw 命令限制
- 命令 handler **不能**直接把提示词注入上下文
- 命令只能设置标志/状态，然后通过 `continueAgent: true` 触发 agent turn
- 提示词注入必须在 `before_prompt_build` 钩子中完成
- 参考 `/omoc_mode` 的实现模式

### 1.2 OpenCode init 参考
- OpenCode 的 init 命令生成 `AGENTS.md` 在项目目录下
- 我们的 `omoc_init` 借鉴思路，但适配 OpenClaw 的命令+钩子架构

---

## 2. 项目文件

### 2.1 存储位置
```
~/.openclaw/workspace/.omoc-state/active-project
```

### 2.2 数据结构（JSON）

```json
{
  "projects": [
    {
      "name": "项目A",
      "path": "/path/to/project-a",
      "agentMds": [
        "AGENTS.md",
        "sub/dir/AGENTS.md"
      ]
    },
    {
      "name": "项目B",
      "path": "/path/to/project-b",
      "agentMds": [
        "AGENTS.md"
      ]
    }
  ],
  "active": "项目A",
  "pendingInit": {
    "type": "init",
    "projectName": "新项目",
    "projectPath": "/path/to/new-project",
    "agentMdFile": "AGENTS.md"
  }
}
```

### 2.3 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `projects` | array | 已注册的项目列表 |
| `projects[].name` | string | 项目名称（唯一标识） |
| `projects[].path` | string | 项目根目录路径 |
| `projects[].agentMds` | string[] | 项目描述文件列表（相对于项目路径），按注入顺序排列 |
| `active` | string \| null | 当前激活的项目名称，匹配 `projects[].name` |
| `pendingInit` | object \| null | pending 的 omoc_init 命令信息，钩子检测到此字段则注入 init 模板 |

### 2.4 文件不存在时的行为
- **自动创建**：读写 `active-project` 时如果文件不存在，自动创建并初始化为 `{ "projects": [], "active": null, "pendingInit": null }`

---

## 3. 命令设计

### 3.1 `/omoc_init <dir> [project-name]`

**用途**：初始化一个新项目

**参数**：
- `<dir>`: 项目根目录路径（必填）
- `[project-name]`: 项目名称（必填）

**流程**：
```
1. 命令 handler:
   a. 验证 dir 存在且是有效目录
   b. 检查 dir 是否已在 projects 中注册（按 path 查重）
   c. 验证 project-name 是否已存在（按 name 查重）
   d. 如果 project-name 为空 → 报错返回，提示用户指定项目名称
   e. 写入 pendingInit 字段到 active-project 文件
   f. 同时在 projects 中添加新项目条目（含初始 agentMds: ["AGENTS.md"]）
   g. 返回 continueAgent: true

2. before_prompt_build 钩子:
   a. 检测到 pendingInit 不为 null（type = "init"）
   b. 注入 init 模板（引导 agent 生成 AGENTS.md 内容）
   c. 清除 pendingInit 字段（自动清除）

3. Agent 收到提示词后:
   a. 分析项目结构
   b. 生成 AGENTS.md 内容
   c. 写入 dir/AGENTS.md
```

### 3.2 `/omoc_init add <project-name> <sub-path-agent-md>`

**用途**：为已注册项目添加额外的 agent.md 文件

**参数**：
- `<project-name>`: 已注册项目的名称
- `<sub-path-agent-md>`: 子路径下的 agent.md 文件（相对于项目路径）

**约束**：
- project-name 必须是已注册的项目
- 完整路径 = project-path + sub-path-agent-md
- 完整路径必须在 project-path 下（安全校验，防止路径穿越）
- agentMd 不能重复

**流程**：
```
1. 命令 handler:
   a. 按 name 查找匹配的项目
   b. 验证完整路径在项目路径下
   c. 检查 agentMd 是否已存在（避免重复）
   d. 将 agentMd 追加到项目的 agentMds 列表末尾
   e. 写入 pendingInit 字段（type = "add"）
   f. 返回 continueAgent: true

2. before_prompt_build 钩子:
   a. 检测到 pendingInit 不为 null（type = "add"）
   b. 注入 init-add 模板
   c. 清除 pendingInit 字段（自动清除）

3. Agent 收到提示词后:
   a. 分析子目录结构
   b. 生成子 agent.md 内容
   c. 写入指定路径
```

### 3.3 `/omoc_init delete <project-name> [agent-md]`

**用途**：删除项目或项目的某个 agent.md 文件

**参数**：
- `<project-name>`: 项目名称
- `[agent-md]`: 可选，指定要删除的 agent.md 文件

**行为**：
- 不指定 agent-md：从 projects 中移除整个项目；如果 active 指向该项目，同时设置 active = null
- 指定 agent-md：仅从 agentMds 列表中移除该文件（不删除实际文件）；如果移除后 agentMds 为空，提示用户

### 3.4 `/omoc_init list`

**用途**：列出所有已注册项目

**输出**：
```
已注册项目:
* 项目A (激活)
  路径: /path/to/project-a
  描述文件:
    - AGENTS.md
    - sub/dir/AGENTS.md
- 项目B
  路径: /path/to/project-b
  描述文件:
    - AGENTS.md
```

### 3.5 `/omoc_init set-active <project-name>`

**用途**：设置当前激活的项目

**参数**：
- `<project-name>`: 项目名称（匹配 `projects[].name`）

**行为**：
- 更新 active-project 文件的 `active` 字段
- 后续消息将注入该项目的 agent.md 内容
- 如果项目名不存在，报错返回

### 3.6 `/omoc_init off`

**用途**：取消激活当前项目

**行为**：
- 设置 `active` 为 null
- 后续消息不再注入任何项目上下文

---

## 4. before_prompt_build 钩子逻辑

```
1. 读取 active-project 文件（不存在则自动创建）

2. 检查 pendingInit 字段
   - 如果不为 null:
     - 根据 pendingInit.type 注入对应模板（init / add）
     - 清除 pendingInit 字段
     - 返回

3. 没有 pending 标志时:
   a. 检查 active 字段
   b. 如果 active 不为 null:
      - 在 projects 中找到匹配 active.name 的项目
      - 按 agentMds 列表中的顺序，依次读取每个文件
      - 依次注入到提示词中
   c. 如果 active 为 null 或项目不存在:
      - 不注入任何项目上下文
```

### 注入顺序
**按照项目描述文件（agentMds）数组中的顺序依次注入**，先注入的在前，后注入的追加。

### 冲突检测
- 钩子在注入多个 agent.md 时，检测内容是否有冲突
- 如果发现冲突，在提示词中追加冲突提示，指导用户修改
- 冲突示例：
  ```
  ⚠️ 检测到项目描述文件冲突：
  - AGENTS.md 第 X 行：规则A
  - sub/dir/AGENTS.md 第 Y 行：规则B
  请修改冲突的描述文件以保持一致性。
  ```

---

## 5. Init 模板内容

### 5.1 主 init 模板（/omoc_init）

> 来源：OpenCode `packages/opencode/src/command/template/initialize.txt`
> 授权：MIT License — Copyright (c) 2025 opencode

```
Create or update `AGENTS.md` for this repository.

The goal is a compact instruction file that helps future OpenCode sessions avoid mistakes and ramp up quickly. Every line should answer: "Would an agent likely miss this without help?" If not, leave it out.

User-provided focus or constraints (honor these):
$ARGUMENTS

## How to investigate

Read the highest-value sources first:
- `README*`, root manifests, workspace config, lockfiles
- build, test, lint, formatter, typecheck, and codegen config
- CI workflows and pre-commit / task runner config
- existing instruction files (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`)
- repo-local OpenCode config such as `opencode.json`

If architecture is still unclear after reading config and docs, inspect a small number of representative code files to find the real entrypoints, package boundaries, and execution flow. Prefer reading the files that explain how the system is wired together over random leaf files.

Prefer executable sources of truth over prose. If docs conflict with config or scripts, trust the executable source and only keep what you can verify.

## What to extract

Look for the highest-signal facts for an agent working in this repo:
- exact developer commands, especially non-obvious ones
- how to run a single test, a single package, or a focused verification step
- required command order when it matters, such as `lint -> typecheck -> test`
- monorepo or multi-package boundaries, ownership of major directories, and the real app/library entrypoints
- framework or toolchain quirks: generated code, migrations, codegen, build artifacts, special env loading, dev servers, infra deploy flow
- repo-specific style or workflow conventions that differ from defaults
- testing quirks: fixtures, integration test prerequisites, snapshot workflows, required services, flaky or expensive suites
- important constraints from existing instruction files worth preserving

Good `AGENTS.md` content is usually hard-earned context that took reading multiple files to infer.

## Questions

Only ask the user questions if the repo cannot answer something important. Use the `question` tool for one short batch at most.

Good questions:
- undocumented team conventions
- branch / PR / release expectations
- missing setup or test prerequisites that are known but not written down

Do not ask about anything the repo already makes clear.

## Writing rules

Include only high-signal, repo-specific guidance such as:
- exact commands and shortcuts the agent would otherwise guess wrong
- architecture notes that are not obvious from filenames
- conventions that differ from language or framework defaults
- setup requirements, environment quirks, and operational gotchas
- references to existing instruction sources that matter

Exclude:
- generic software advice
- long tutorials or exhaustive file trees
- obvious language conventions
- speculative claims or anything you could not verify
- content better stored in another file referenced via `opencode.json` `instructions`

When in doubt, omit.

Prefer short sections and bullets. If the repo is simple, keep the file simple. If the repo is large, summarize the few structural facts that actually change how an agent should work.

If `AGENTS.md` already exists at `${path}`, improve it in place rather than rewriting blindly. Preserve verified useful guidance, delete fluff or stale claims, and reconcile it with the current codebase.
```

### 5.2 Add 模板（/omoc_init add）

> 复用主 init 模板，仅需替换目标路径变量。

目标文件从 `${path}/AGENTS.md` 改为 `${path}/${subPathAgentMd}`，模板内容不变。

---

## 6. 设计决策（已确认）

| 问题 | 决策 |
|------|------|
| 项目条目何时添加 | **命令中完成**，不依赖 agent |
| 项目名称未指定 | **报错返回**，要求用户指定 |
| active-project 不存在 | **自动创建** |
| set-active 匹配方式 | **按 name 匹配** |
| 多个 agent.md 冲突 | **提示用户**，指导修改 |
| 写入路径限制 | **不限制**，但建议在项目路径下工作 |
| pendingInit 生命周期 | **自动清除**（钩子注入后清除） |

---

## 7. 文件结构

```
oh-my-openclaw/
├── plugin/
│   ├── src/
│   │   ├── commands/
│   │   │   ├── mode-commands.ts        # 已有
│   │   │   └── init-commands.ts        # 新建
│   │   ├── hooks/
│   │   │   ├── mode-switch/            # 已有
│   │   │   └── project-init/           # 新建
│   │   │       ├── project-state.ts    # active-project 文件读写
│   │   │       ├── init-template.ts    # init/add 模板
│   │   │       └── project-bootstrap.ts # before_prompt_build 钩子
│   │   └── index.ts                    # 注册新模块
│   └── ...
```

---

## 8. pendingInit 数据结构

```typescript
type PendingInit = {
  type: "init" | "add";
  projectName: string;
  projectPath: string;
  agentMdFile: string;       // 相对于 projectPath
  subPath?: string;          // add 类型时的子路径
};
```
