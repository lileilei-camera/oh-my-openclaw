# Code Review: `/omoc_init add` Command

> **Scope**: `oh-my-openclaw/plugin` — `/omoc_init add` 子命令全链路代码
> **日期**: 2026-05-12
> **审查文件**:
> - `src/commands/init-commands.ts` — 命令入口和路由
> - `src/hooks/project-init/project-state.ts` — 状态管理
> - `src/hooks/project-init/init-template.ts` — 模板定义
> - `src/hooks/project-init/project-bootstrap.ts` — `before_prompt_build` 钩子

---

## 问题总览

| # | 严重度 | 类别 | 简述 | 文件:行号 |
|---|--------|------|------|-----------|
| 1 | **Critical** | 路径安全 | `isSubPath` 不解析 symlink，可绕过沙箱 | init-commands.ts:62 |
| 2 | **Critical** | 状态完整性 | `addAgentMdToProject` 接受不存在的文件路径，导致 bootstrap 阶段注入空内容 | project-state.ts:91 |
| 3 | **Major** | 并发安全 | 状态文件读写无锁/无原子性，多次快速 `add` 会丢状态 | project-state.ts:39-52 |
| 4 | **Major** | 路径规范化 | `agentMd` 以原始字符串存储，相同路径的不同写法产生重复 | project-state.ts:93 |
| 5 | **Major** | 模板注入 | 未校验 `projectPath`/`agentMdFile` 含 `${` 或 `\`，模板字符串注入 | init-template.ts / project-bootstrap.ts |
| 6 | **Major** | 错误 UX | 重复注册报错信息含糊，不告知已注册的路径是什么 | init-commands.ts:198 |
| 7 | **Major** | 类型重复 | `CommandCtx` 接口定义两次，第二个从未使用 | init-commands.ts:23-27, 117-120 |
| 8 | **Minor** | 边界情况 | `add` 子命令接受 `..` 开头路径后虽被 `isSubPath` 拦截，但错误信息泄露项目绝对路径 | init-commands.ts:196 |
| 9 | **Minor** | 边界情况 | 路径尾缀 `/` 或 `./` 导致存储不一致 | project-state.ts:93 |
| 10 | **Minor** | 未使用导入 | `existsSync, statSync, readFileSync` 部分未在 `add` 分支使用 | init-commands.ts:10 |
| 11 | **Minor** | 硬编码 | `expandPath` 的 fallback 硬编码为 `/home/lileilei` | init-commands.ts:75 |
| 12 | **Minor** | 无测试覆盖 | `project-state.ts` 和 `init-commands.ts` 无任何单元测试 | — |
| 13 | **Minor** | 状态清理 | `removeProject` 后若该 project 是 active，仅清空 active 不清 pendingInit | project-state.ts:78 |

---

## 详细分析

### 1. [Critical] `isSubPath` 不解析 symlink — 路径穿越漏洞

**文件**: `src/commands/init-commands.ts:62-65`

```typescript
function isSubPath(parent: string, child: string): boolean {
  const rel = resolve(child);
  const absParent = resolve(parent);
  return rel.startsWith(absParent + '/') || rel === absParent;
}
```

**问题**: `path.resolve` **不会解析符号链接**。如果 `project.path` 存储的是一个非 symlink 的真实路径，而 `subPathAgentMd` 中引用了一个 symlink（或 `project.path` 本身是 symlink 指向目录外），攻击者可以通过 symlink 逃逸出项目目录。

**攻击场景**:
```bash
# 假设项目目录是 /home/user/my-project
# 项目内存在 symlink: my-project/link -> /etc
/omoc_init add my-project link/passwd
# isSubPath 检查: resolve("/home/user/my-project/link/passwd")
#   = "/home/user/my-project/link/passwd"（不解析 symlink）
# 检查通过！但实际读取的是 /etc/passwd
```

**修复建议**: 使用 `fs.realpathSync` 解析 symlink 后再做比较：
```typescript
import { realpathSync } from 'fs';

function isSubPath(parent: string, child: string): boolean {
  let resolvedParent: string;
  try { resolvedParent = realpathSync(parent); }
  catch { resolvedParent = resolve(parent); }
  const resolvedChild = resolve(child); // child 可能不存在，用 resolve
  return resolvedChild.startsWith(resolvedParent + '/') || resolvedChild === resolvedParent;
}
```

---

### 2. [Critical] `addAgentMdToProject` 不校验文件存在性 — 空注入/误导

**文件**: `src/hooks/project-init/project-state.ts:91-97`

```typescript
export function addAgentMdToProject(workspaceDir: string, projectName: string, agentMd: string): boolean {
  const state = readState(workspaceDir);
  const project = state.projects.find((p) => p.name === projectName);
  if (!project) return false;
  if (project.agentMds.includes(agentMd)) return false;
  project.agentMds.push(agentMd);
  writeState(workspaceDir, state);
  return true;
}
```

**问题**: `agentMd` 参数原样存入 `agentMds` 数组，不校验目标文件是否存在、是否可读。后续 `project-bootstrap.ts` 的 `before_prompt_build` 钩子中：

```typescript
for (const agentMd of project.agentMds) {
  const fullPath = resolve(project.path, agentMd);
  if (!existsSync(fullPath)) {
    api.logger.warn(`[omoc:project-init] agent.md not found: ${fullPath}`);
    continue; // ← 静默跳过
  }
```

文件不存在时仅打日志并 `continue`，用户不会收到任何错误提示。更严重的是，如果用户通过 `add` 命令添加了一个路径但文件尚未创建，`setPendingInit` 会将模板注入给 agent，让 agent 去"创建或更新"该文件——但 `INIT_ADD_TEMPLATE` 中的 `\${projectPath}/\${agentMdFile}` 路径可能与用户预期的不一致（因为存储的是相对路径而非标准化路径）。

**修复建议**: 在 `addAgentMdToProject` 中增加文件存在性校验，或在 `init-commands.ts` 的 `add` 分支中调用前检查：
```typescript
const fullPath = resolve(project.path, subPathAgentMd);
if (!existsSync(fullPath)) {
  return { text: `⚠️ **Error**: File does not exist: \`${fullPath}\`` };
}
```

---

### 3. [Major] 状态文件读写无原子性 — 并发丢状态

**文件**: `src/hooks/project-init/project-state.ts` 全局

**问题**: 所有状态操作遵循 read-modify-write 模式：
```typescript
const state = readState(workspaceDir);  // 读取
// ... 修改 state ...
writeState(workspaceDir, state);         // 写入
```

两次快速执行 `/omoc_init add` 时：
1. 请求 A 读取 state（agentMds = ["AGENTS.md"]）
2. 请求 B 读取 state（agentMds = ["AGENTS.md"]）
3. 请求 A 写入 state（agentMds = ["AGENTS.md", "sub1/AGENT.md"]）
4. 请求 B 写入 state（agentMds = ["AGENTS.md", "sub2/AGENT.md"]）

结果：请求 A 的修改被 B 覆盖丢失。

**修复建议**: 使用文件锁（`proper-lockfile`）或原子写入（先写 `.tmp` 再 `rename`）。对于 Node.js，最简单的改进是在 `writeState` 中使用原子写入：
```typescript
import { renameSync } from 'fs';

export function writeState(workspaceDir: string, state: ActiveProjectState): void {
  const stateDir = getStateDir(workspaceDir);
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
  const tmpFile = getStateFile(workspaceDir) + '.tmp';
  writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
  renameSync(tmpFile, getStateFile(workspaceDir)); // 原子替换
}
```

注意：原子写入解决了写入崩溃导致文件损坏的问题，但不能完全解决并发 read-modify-write 竞争。如需完全解决，需要文件级锁。

---

### 4. [Major] `agentMd` 以原始字符串存储 — 路径规范化缺失

**文件**: `src/commands/init-commands.ts:188` → `src/hooks/project-init/project-state.ts:93`

**问题**: `addAgentMdToProject` 存储的是用户输入的原始字符串 `subPathAgentMd`（如 `./subdir/AGENT.md`、`subdir/../subdir/AGENT.md`、`subdir/AGENT.md`），而不做规范化。这导致：

1. **重复注册**: `subdir/AGENT.md` 和 `./subdir/AGENT.md` 被视为不同条目，`includes` 检查失败
2. **删除失败**: 用户用 `subdir/AGENT.md` 删除，但存储的是 `./subdir/AGENT.md`，`filter` 匹配不上
3. **去重逻辑形同虚设**: `project.agentMds.includes(agentMd)` 是字符串精确匹配

**修复建议**: 存储前用 `path.normalize` 规范化，且去掉前导 `./`：
```typescript
import { normalize, sep } from 'path';

function normalizeAgentMd(agentMd: string): string {
  let normalized = normalize(agentMd);
  // 去掉开头的 ./ 或 .\
  while (normalized.startsWith('.' + sep) || normalized === '.') {
    normalized = normalized.slice(2);
  }
  return normalized;
}
```

---

### 5. [Major] 模板字符串注入风险

**文件**: `src/hooks/project-init/project-bootstrap.ts:28-34`

```typescript
template = INIT_ADD_TEMPLATE
  .replace(/\$\{projectPath\}/g, pending.projectPath)
  .replace(/\$\{agentMdFile\}/g, pending.agentMdFile);
```

**问题**: `pending.projectPath` 和 `pending.agentMdFile` 直接来自用户输入，未经任何消毒。如果路径中包含 `${...}` 或反引号等字符，可能：

1. **注入额外占位符**: 如果 `agentMdFile` 为 `${projectPath}/evil`，第一次 `replace` 后变成 `.../evil` 路径，第二次 replace 可能再次匹配
2. **破坏模板结构**: 如果路径中包含 markdown 特殊字符（`#`、`*`、`` ` ``），生成的模板可能被渲染为意外内容

当前 `projectPath` 来自 `findProjectByName` 返回的已存储路径，相对可信。但 `agentMdFile` 直接来自 `subPathAgentMd`，用户可完全控制。

**修复建议**: 对注入模板的值做转义，或使用模板引擎（如 `mustache`）而非 `String.replace`：
```typescript
function safeReplace(template: string, key: string, value: string): string {
  return template.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value.replace(/[$`\\]/g, '\\$&'));
}
```

---

### 6. [Major] 重复注册错误信息含糊

**文件**: `src/commands/init-commands.ts:198-200`

```typescript
if (!added) {
  return {
    text: `⚠️ **Error**: This agent.md is already registered for project \`${projectName}\`.`,
  };
}
```

**问题**: 
1. 不告诉用户**已注册的具体路径**是什么
2. `addAgentMdToProject` 返回 `false` 有两种情况：(a) 项目不存在，(b) agentMd 已注册。但 `add` 分支在调用 `addAgentMdToProject` 前已检查了项目存在性，所以这里只可能是"已注册"。然而错误信息没有区分是因为**完全相同的路径**已注册，还是因为**规范化后相同的路径**已注册（见问题 #4）

**修复建议**: 返回已注册的完整列表：
```typescript
if (!added) {
  const project = findProjectByName(workspaceDir, projectName);
  const registered = project?.agentMds.map(p => `\`${p}\``).join(', ') || 'none';
  return {
    text: `⚠️ **Error**: This agent.md is already registered for project \`${projectName}\`.\n\nCurrently registered: ${registered}`,
  };
}
```

---

### 7. [Major] `CommandCtx` 接口定义两次

**文件**: `src/commands/init-commands.ts:23-27` 和 `src/commands/init-commands.ts:117-120`

```typescript
// 第一个定义 (行 23-27)
interface CommandCtx {
  args?: string;
  sessionKey?: string;
  config?: Record<string, unknown>;
}

// 第二个定义 (行 117-120) — shadow 第一个
interface CommandCtx {
  args?: string;
  workspaceDir?: string;
}
```

**问题**: 
1. 第二个 `CommandCtx` shadow 了第一个，但 `handler` 函数的参数 `ctx: CommandCtx` 实际收到的是框架传入的对象，只包含 `args` 和 `sessionKey`，**不包含** `workspaceDir`
2. `workspaceDir` 字段在第二个定义中存在，但实际是通过 `resolveWorkspaceDir(ctx)` 手动解析的，说明这个字段从未被框架填充
3. 第一个定义的 `config` 和 `sessionKey` 在 `resolveWorkspaceDir` 中使用，但如果第二个定义 shadow 了第一个，TypeScript 编译器可能不会正确推导类型

**修复建议**: 合并为一个接口，删除 `workspaceDir` 字段（它是计算得出的，不是框架注入的）：
```typescript
interface CommandCtx {
  args?: string;
  sessionKey?: string;
  config?: Record<string, unknown>;
}
```

---

### 8. [Minor] 错误信息泄露项目绝对路径

**文件**: `src/commands/init-commands.ts:196-198`

```typescript
return {
  text: `⚠️ **Error**: Target path must be within the project directory.\n\nProject: \`${project.path}\`\nTarget: \`${fullPath}\``,
};
```

**问题**: 当路径穿越检查失败时，错误信息暴露了项目的完整绝对路径。在多租户或共享环境中，这可能泄露敏感的路径结构信息。

**修复建议**: 使用相对路径或项目名代替绝对路径：
```typescript
return {
  text: `⚠️ **Error**: Target path must be within the project directory.\n\nProject: \`${projectName}\`\nTarget: \`${subPathAgentMd}\``,
};
```

---

### 9. [Minor] 路径尾缀 `/` 导致存储不一致

**问题**: 用户输入 `subdir/` 时，`resolve(project.path, 'subdir/')` 返回 `.../subdir`（去掉尾缀 `/`），但 `subPathAgentMd` 存储的仍是 `subdir/`。后续 `bootstrap` 钩子中 `resolve(project.path, 'subdir/')` 会得到相同结果，但去重检查时 `includes('subdir/')` 与 `includes('subdir')` 不匹配。

**修复建议**: 统一规范化存储路径（见问题 #4 的修复）。

---

### 10. [Minor] 部分导入未在 `add` 分支使用

**文件**: `src/commands/init-commands.ts:10`

```typescript
import { existsSync, statSync, readFileSync } from 'fs';
```

**问题**: 
- `existsSync` 和 `statSync` 在默认命令分支（非 `add`/`delete`/`list`...）中用于检查目录是否存在
- `readFileSync` 在整个文件中**从未使用**（状态读取由 `project-state.ts` 的 `readState` 完成）
- 对于 `add` 子命令本身，没有导入 `existsSync` 来校验文件存在性（见问题 #2）

**修复建议**: 移除 `readFileSync` 导入；在 `add` 分支中添加 `existsSync` 检查。

---

### 11. [Minor] `expandPath` 硬编码 fallback 路径

**文件**: `src/commands/init-commands.ts:75-76`

```typescript
const home = os.homedir() || process.env.HOME || '/home/lileilei';
```

**问题**: 硬编码了 `/home/lileilei` 作为最终 fallback。这显然是开发者的个人路径，不应该出现在生产代码中。

**修复建议**: 使用更通用的 fallback 或抛出错误：
```typescript
const home = os.homedir() || process.env.HOME;
if (!home) throw new Error('Cannot determine home directory');
```

---

### 12. [Minor] 无测试覆盖

**问题**: `project-state.ts`（37 行核心逻辑）、`init-commands.ts`（命令路由和参数解析）、`project-bootstrap.ts`（钩子注入逻辑）均无任何单元测试。整个 `project-init/` 目录下没有测试文件。

**修复建议**: 至少覆盖以下场景：
- `isSubPath` 的正常路径、越界路径、symlink 路径
- `addAgentMdToProject` 的重复添加、项目不存在、路径规范化
- `readState` / `writeState` 的文件不存在、JSON 解析失败、并发写入
- `resolveWorkspaceDir` 的各种 sessionKey 格式

---

### 13. [Minor] `removeProject` 不清理 `pendingInit`

**文件**: `src/hooks/project-init/project-state.ts:78-84`

```typescript
export function removeProject(workspaceDir: string, name: string): void {
  const state = readState(workspaceDir);
  state.projects = state.projects.filter((p) => p.name !== name);
  if (state.active === name) {
    state.active = null;
  }
  writeState(workspaceDir, state);
}
```

**问题**: 如果删除的项目恰好有 `pendingInit` 指向它（`pendingInit.projectName === name`），`pendingInit` 不会被清理。下一次 `before_prompt_build` 钩子仍会注入该项目的模板，但项目已不存在。

**修复建议**:
```typescript
if (state.pendingInit?.projectName === name) {
  state.pendingInit = null;
}
```

---

## 额外观察（非 bug）

### `INIT_ADD_TEMPLATE` 与 `INIT_TEMPLATE` 的差异

`INIT_ADD_TEMPLATE` 比 `INIT_TEMPLATE` 简短得多，但缺少一些关键指令：
- 没有提到 "如果已存在则改进而非重写"
- 没有提到要读取 CI/config/manifest 等高价值源
- 缺少 "Questions" 部分的指引

这可能导致 `add` 子命令生成的 agent.md 质量低于 `init` 子命令。

### `continueAgent: true` 的语义

`add` 命令返回 `continueAgent: true`，意味着 agent 会继续执行。但 `setPendingInit` 注入的是模板指令，agent 会收到一个"创建或更新 AGENTS.md"的指令。如果用户只是想注册一个已存在的 agent.md 文件（而不是让 agent 重新生成），这个行为可能不符合预期。

---

## 优先级建议的修复顺序

1. **P0**: 修复 `isSubPath` symlink 逃逸 (#1)
2. **P0**: `add` 分支增加文件存在性校验 (#2)
3. **P1**: 路径规范化存储 (#4)
4. **P1**: 状态文件原子写入 (#3)
5. **P1**: 模板注入消毒 (#5)
6. **P1**: 合并 `CommandCtx` 接口 (#7)
7. **P2**: 改进错误信息 (#6, #8)
8. **P2**: 清理 `removeProject` 的 pendingInit (#13)
9. **P2**: 移除无用导入和硬编码 (#10, #11)
10. **P2**: 补充测试覆盖 (#12)
