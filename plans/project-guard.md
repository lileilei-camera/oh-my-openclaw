# Project Guard — 项目路径保护

**状态**: 设计中  
**创建**: 2026-05-21  
**更新**: 2026-05-21

---

## 目标

防止 agent 在多个项目间串操作：
- agent 临时被叫去另一个项目看代码 → 回来时可能忘了切回
- write/edit/exec 到错误项目 → 弹窗提醒

## 设计决策

| 决策 | 结论 |
|------|------|
| 拦截哪些工具 | write、edit、exec |
| 不拦截哪些 | read、grep、glob、web_*、lsp_*、ast-grep*、sessions_spawn、omo_delegate 等 |
| exec 路径判断 | 只追踪 command 里的 cd，不解析其他路径 |
| 授权粒度 | 单次 / 本轮（agent_end 清零） |
| 永久授权 | 不做 |
| 无 active project | 不拦截 |
| 子目录继承 | 授权 /a/b → /a/b/c 自动放行；反之不行 |
| prompt 软约束 | **修改 project-bootstrap.ts，在项目汇总信息块中追加路径保护说明** |

## 安全区

```
safe_zone = active_project_path ∪ workspace_dir ∪ /tmp ∪ turn_grants（本轮）
```

## 授权按钮映射

| 按钮 | SDK 值 | 行为 |
|------|--------|------|
| 单次 | allow-once | 仅本次调用放行 |
| 本轮 | allow-always | 当前 turn 放行，agent_end 清零 |
| 拒绝 | deny | 阻止本次调用 |

## 文件结构

```
src/hooks/project-guard/
  ├── guard-types.ts        # 类型定义 + 常量
  ├── guard-core.ts         # 核心函数（安全检查、cd 解析、授权管理）
  └── guard-register.ts     # 注册 before_tool_call hook + agent_end hook

需修改的现有文件:
  src/hooks/project-init/project-bootstrap.ts  # 在项目汇总信息后注入路径保护说明
  src/index.ts                                  # 注册 registerProjectGuard
```

---

## 任务

### 任务 1: guard-types.ts — 类型定义

- [ ] 常量：`WRITE_TOOLS = ['write', 'edit']`, `EXEC_TOOL = 'exec'`
- [ ] `TurnGrantStore` 类型：`Map<string, Set<string>>`
- [ ] 模块级 turnGrantStore 实例

### 任务 2: guard-core.ts — 核心逻辑

- [ ] `getActiveProjectPath(workspaceDir)` — 读 active-project 返回路径，无则 null
- [ ] `isInSafeZone(absolutePath, safeZone)` — 前缀匹配 project/workspace/tmp/turnGrants
- [ ] `parseCdTarget(command, workdir?, workspaceDir?)`
  - 正则 `/\\bcd\\s+(~?\\/?[\\w.\\-\\/]+)(?:\\s*(?:;|\\||&{1,2}|\\s*$))/gm`
  - 取最后一个匹配
  - `~/x` → `$HOME/x`；`/abs` → normalize；`rel` → workdir + rel → normalize
  - 无匹配 → null（放行）
- [ ] `addTurnGrant(sessionKey, path)` — 存入 store
- [ ] `clearTurnGrants(sessionKey)` — agent_end 清空
- [ ] `getTurnGrants(sessionKey)` — 返回 Set

### 任务 3: guard-register.ts — 钩子注册

- [ ] `registerProjectGuard(api)`
  - 检查 active project 是否存在 → 无则跳过
  - **before_tool_call — write/edit**:
    ```
    resolve(path) → isInSafeZone → 放行
    否则 requireApproval → allow-once 放行 / allow-always addTurnGrant / deny block
    ```
  - **before_tool_call — exec**:
    ```
    parseCdTarget(command, workdir) → null 则放行
    isInSafeZone → 放行
    否则 requireApproval（同上）
    ```
  - **agent_end** — `clearTurnGrants(sessionKey)`

### 任务 4: 修改 project-bootstrap.ts — prompt 软约束

- [ ] 在 `projectInfo` 字符串后追加路径保护说明，放在 agent.md 内容之前：

```typescript
const guardPrompt = [
  ``,
  `### 🔒 项目路径保护`,
  `  - 始终以 **${project.path}** 为当前工作目录`,
  `  - 偶尔需切到项目外查信息（如 cd /other && ls），完成后**立刻切回项目路径**`,
  `  - write/edit/exec 越界会弹窗请求授权`,
].join('\n');

parts.push(projectInfo + '\n' + guardPrompt);
```

### 任务 5: 注册到 index.ts

- [ ] import `registerProjectGuard`
- [ ] `registerProjectGuard(api); hookCount += 2;`

---

## 核心函数设计

### `parseCdTarget(command, workdir?, workspaceDir?)`

```
正则：/\bcd\s+(~?\/?[\w.\-\/]+)(?:\s*(?:;|\||&{1,2}|\s*$))/gm
取最后一个匹配

路径处理：
  ~/x         → $HOME/x
  /absolute   → normalize 原样返回
  relative    → (workdir || workspaceDir) + '/' + relative → normalize
  无匹配      → null（无 cd，放行）
```

### `isInSafeZone(path, safeZone)`

```
checkPrefixes = [projectPath, workspaceDir, '/tmp', ...turnGrants]
path === prefix 或 path.startsWith(prefix + '/') → true
```

### 弹窗内容

```
⚠️ 项目边界越界

当前项目：{name}
项目路径：{path}
操作目录：{target}

安全区域：
  • 项目目录
  • 工作空间
  • /tmp

[单次] [本轮] [拒绝]
```

## 边界情况

| 情况 | 处理 |
|------|------|
| 无 active project | 不注册 hook |
| path 相对路径 | resolve 基于 workspaceDir |
| cd 多级 | 取最后一个 |
| cd 用变量 | 正则不匹配 → null → 放行 |
| workdir 未提供 | 默认 workspaceDir |
| ~ 展开 | process.env.HOME |
