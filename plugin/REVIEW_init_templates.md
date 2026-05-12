# 审查报告：`/omoc_init` 模板安全性与正确性

**审查日期:** 2026-05-12
**审查范围:** `init-template.ts`, `project-bootstrap.ts`, `init-commands.ts`, `project-state.ts`

---

## 1. 总体结论

两个模板（`INIT_TEMPLATE` 和 `INIT_ADD_TEMPLATE`）**整体设计合理，未发现严重安全问题或路径错误**。模型不会被引导去操作 `.omoc-state/` 内部状态文件。存在 2 个低优先级问题，建议改进。

---

## 2. 逐项审查

### 2.1 模板输出路径正确性

#### `INIT_TEMPLATE`（`/omoc_init <dir> <name>`）

**路径注入链路：**
```
init-commands.ts: setPendingInit({ type: 'init', projectPath: dir, agentMdFile: 'AGENTS.md' })
project-bootstrap.ts: safeReplace(INIT_TEMPLATE, 'projectPath', dir) → safeReplace(..., 'agentMdFile', 'AGENTS.md')
最终模板: Write the AGENTS.md to: `/home/user/my-project/AGENTS.md`
```

✅ **路径正确。** `dir` 经 `expandPath()` 展开为绝对路径，`agentMdFile` 硬编码为 `'AGENTS.md'`，组合后始终指向目标项目根目录下的 AGENTS.md。

#### `INIT_ADD_TEMPLATE`（`/omoc_init add <name> <sub-path>`）

**路径注入链路：**
```
init-commands.ts: setPendingInit({ type: 'add', projectPath: project.path, agentMdFile: subPathAgentMd })
  - subPathAgentMd 是相对于 project.path 的路径，已通过 isSubPath() 校验
最终模板: Target file: `/home/user/my-project/src/subdir`
          Write the AGENTS.md to: `/home/user/my-project/src/subdir`
```

✅ **路径正确。** `isSubPath()` 确保 `subPathAgentMd` 在 `project.path` 之下，组合后的完整路径始终合法且位于项目目录内。

---

### 2.2 `.omoc-state/active-project` 状态文件隔离

**审查方法：**
1. 检查模板源码（`init-template.ts`）中是否包含 `.omoc-state`、`state`、`pendingInit`、`active-project` 等关键词
2. 检查模板中是否有模糊指令（如 "update the project config"、"modify settings" 等）

**结果：**

- ✅ `INIT_TEMPLATE` 和 `INIT_ADD_TEMPLATE` **均不包含** `.omoc-state` 或任何状态管理相关的关键词
- ✅ 模板中**没有**引导模型读取、写入、修改任何状态文件的指令
- ✅ 模板指令聚焦于：读取项目源码 → 提取高价值事实 → 写入 AGENTS.md
- ✅ `safeReplace` 仅替换 `${projectPath}` 和 `${agentMdFile}`，不注入任何内部状态信息

**结论：状态文件隔离完全合规。** 模型对 `.omoc-state/` 内部实现一无所知，这是正确的设计——插件实现细节与 AI 指令完全解耦。

---

### 2.3 模板注入变量替换

#### safeReplace 实现分析

```typescript
function safeReplace(template: string, key: string, value: string): string {
  const escaped = value.replace(/[$`\\]/g, '\\$&');
  return template.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), escaped);
}
```

- 转义顺序：`\` → `\\`，`$` → `\$`，`` ` `` → `` \` ``
- 防止 Markdown 反引号内的模板变量二次展开
- 防止 `$` 字符在模板中被误识别为变量引用

✅ **替换逻辑安全且正确。** 正常路径值不含特殊字符，转义是防御性措施。

#### 发现的小问题

**问题 #1 — `INIT_TEMPLATE` 中一处措辞不够精确**

源码：
```
If \`AGENTS.md\` already exists at \`\${projectPath}\`, improve it in place
```

替换后：
```
If `AGENTS.md` already exists at `/home/user/my-project`, improve it in place
```

**问题：** 这暗示 AGENTS.md 文件位于 `projectPath` 目录下。实际上 AGENTS.md 的完整路径是 `${projectPath}/${agentMdFile}`（当前 `agentMdFile` 硬编码为 `AGENTS.md`，所以实际结果正确）。

**风险等级：** 低（当前无实际 bug，因为 `agentMdFile` 恰好是 `AGENTS.md`）

**建议：** 改为 `` If `AGENTS.md` already exists at `\`${projectPath}/${agentMdFile}\``, improve it in place `` 以保持精确性。

---

**问题 #2 — `INIT_ADD_TEMPLATE` 的 Target 区块中 `projectPath` 可能冗余**

源码：
```
## Target
- Project path: \`\${projectPath}\`
- Target file: \`\${projectPath}/\${agentMdFile}\`
```

替换后：
```
## Target
- Project path: `/home/user/my-project`
- Target file: `/home/user/my-project/src/subdir`
```

**问题：** `Project path` 行本身不提供额外价值——`Target file` 已经包含了完整路径。对于子目录初始化场景，模型更关心的是"目标文件在哪"。

**风险等级：** 极低（纯信息冗余，不会导致错误行为）

**建议：** 保留或删除均可。如果保留，可改为更语义化的描述：
```
## Target
- Subdirectory: `src/subdir` (relative to project root)
- Output file: `/home/user/my-project/src/subdir`
```
但这需要注入子目录的相对路径，当前模板没有 `${subPath}` 变量（虽然 `PendingInit` 接口有 `subPath?` 字段但未被 `safeReplace` 使用）。

---

### 2.4 整体模板设计

#### INIT_TEMPLATE vs INIT_ADD_TEMPLATE 差异

| 维度 | INIT_TEMPLATE | INIT_ADD_TEMPLATE |
|------|--------------|-------------------|
| 适用范围 | 整个项目 | 单个子目录 |
| 调查范围 | 根目录 + 全局配置 | 子目录 + 父目录 |
| 提取内容 | 架构、入口点、CI 等 | 子目录目的、依赖关系 |
| 写作规则 | 高信号 + 排除通用内容 | 仅子目录特定内容 |

✅ **差异合理。** 两个模板的粒度和关注点区分清晰，符合 `init` vs `add` 的语义。

#### 模板安全性

- ✅ 无外部 URL 或网络资源引用
- ✅ 无命令执行引导
- ✅ 模板内容为纯文本指令，不含可执行代码
- ✅ 变量替换使用 `safeReplace` 防注入
- ✅ 模型指令明确限制行为："read project files and create/improve AGENTS.md"

#### 模板长度

- `INIT_TEMPLATE` 约 60 行 — 内容全面但不冗余，各段落目的明确
- `INIT_ADD_TEMPLATE` 约 30 行 — 精简，聚焦子目录

✅ **长度适当。**

---

## 3. 问题汇总

| # | 问题描述 | 严重度 | 状态 |
|---|---------|--------|------|
| 1 | `INIT_TEMPLATE` 中 "exists at `${projectPath}`" 措辞不够精确（应为 `${projectPath}/${agentMdFile}`） | 低 | 建议改进 |
| 2 | `INIT_ADD_TEMPLATE` 中 `Project path` 行冗余 | 极低 | 可选改进 |

## 4. 未发现问题的关键领域

| 领域 | 状态 | 说明 |
|------|------|------|
| 路径注入正确性 | ✅ 无问题 | 两种场景路径均正确 |
| 状态文件隔离 | ✅ 无问题 | 模板完全不暴露内部状态 |
| 模板注入安全 | ✅ 无问题 | safeReplace 正确转义 |
| 变量替换逻辑 | ✅ 无问题 | 替换顺序和格式正确 |
| 子命令边界 | ✅ 无问题 | init vs add 的模板选择正确 |
| 路径遍历防护 | ✅ 无问题 | isSubPath 校验 + expandPath 规范化 |

---

## 5. 结论

**两个模板可以安全使用。** 未发现需要立即修复的安全问题或功能缺陷。问题 #1 建议在下次迭代中修正以提高精确性，问题 #2 为可选优化。
