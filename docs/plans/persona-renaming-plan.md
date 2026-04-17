# Persona 重命名替换计划

**日期**: 2026-04-18  
**状态**: 草案（待审核）  
**目标**: 将希腊神话风格的 Persona 名称替换为功能缩写名称（方案二）

---

## 🎯 目标映射表

| 旧名 (ID) | 旧文件名 | 新名 (ID) | 新文件名 | 职责 |
|-----------|---------|-----------|---------|------|
| `omoc_prometheus` | `prometheus.md` | `omoc_planner` | `planner.md` | 规划师 |
| `omoc_atlas` | `atlas.md` | `omoc_orchestrator` | `orchestrator.md` | 编排者 |
| `omoc_sisyphus` | `sisyphus-junior.md` | `omoc_coder` | `coder.md` | 编码员 |
| `omoc_hephaestus` | `hephaestus.md` | `omoc_specialist` | `specialist.md` | 专家 |
| `omoc_oracle` | `oracle.md` | `omoc_architect` | `architect.md` | 架构师 |
| `omoc_explore` | `explore.md` | `omoc_explorer` | `explorer.md` | 探索者 |
| `omoc_librarian` | `librarian.md` | `omoc_researcher` | `researcher.md` | 研究员 |
| `omoc_metis` | `metis.md` | `omoc_advisor` | `advisor.md` | 顾问 |
| `omoc_momus` | `momus.md` | `omoc_reviewer` | `reviewer.md` | 审查员 |
| `omoc_looker` | `multimodal-looker.md` | `omoc_analyst` | `analyst.md` | 分析师 |
| `omoc_frontend` | `frontend.md` | `omoc_frontend` | `frontend.md` | 前端（不变） |

---

## 📁 Phase 1: 插件源码替换

### 1.1 Persona 文件重命名

**目录**: `plugin/agents/`

```bash
# 需要重命名的文件（10 个）
prometheus.md        → planner.md
atlas.md             → orchestrator.md
sisyphus-junior.md   → coder.md
hephaestus.md        → specialist.md
oracle.md            → architect.md
explore.md           → explorer.md
librarian.md         → researcher.md
metis.md             → advisor.md
momus.md             → reviewer.md
multimodal-looker.md → analyst.md
frontend.md          → （保持不变）
```

### 1.2 核心代码映射表替换

**文件**: `plugin/hooks/persona-bootstrap/handler.ts`

```typescript
// 当前内容（约第 18-29 行）
const AGENT_MD_MAP: Record<string, string> = {
  omoc_prometheus: 'prometheus',
  omoc_atlas: 'atlas',
  omoc_sisyphus: 'sisyphus-junior',
  omoc_hephaestus: 'hephaestus',
  omoc_oracle: 'oracle',
  omoc_explore: 'explore',
  omoc_librarian: 'librarian',
  omoc_metis: 'metis',
  omoc_momus: 'momus',
  omoc_looker: 'multimodal-looker',
  omoc_frontend: 'frontend',
};

// 替换为
const AGENT_MD_MAP: Record<string, string> = {
  omoc_planner: 'planner',
  omoc_orchestrator: 'orchestrator',
  omoc_coder: 'coder',
  omoc_specialist: 'specialist',
  omoc_architect: 'architect',
  omoc_explorer: 'explorer',
  omoc_researcher: 'researcher',
  omoc_advisor: 'advisor',
  omoc_reviewer: 'reviewer',
  omoc_analyst: 'analyst',
  omoc_frontend: 'frontend',
};
```

### 1.3 命令与描述替换

**文件**: `plugin/src/commands/persona-commands.ts`

需要替换的位置：
- `DEFAULT_PERSONA_ID` → `'omoc_orchestrator'`
- `AGENT_MD_MAP` 或类似映射表
- `PERSONA_DESCRIPTIONS_CN` 显示名
- `WORKFLOW_PERSONA_MAP` 工作流映射
- 任何硬编码的旧 persona ID

**文件**: `plugin/src/agents/persona-prompts.ts`（如存在）
- persona 加载逻辑中的 ID 引用
- `listPersonas()` 返回的数据

### 1.4 测试文件更新

**文件**: `plugin/src/__tests__/persona.test.ts`
- 所有测试用例中的 persona ID
- 断言中的显示名
- 命令行测试参数（如 `/omoc atlas` → `/omoc orchestrator`）

**文件**: `plugin/src/__tests__/persona-bootstrap.test.ts`
- 钩子测试中的 persona ID
- 状态文件断言

**文件**: `plugin/hooks/persona-bootstrap/handler.test.ts`
- 钩子实现测试中的 persona ID
- 文件名断言

### 1.5 其他源码文件搜索

```bash
# 全局搜索旧名字引用
grep -rn "prometheus\|omoc_prometheus" plugin/src/ plugin/hooks/ --include="*.ts"
grep -rn "atlas\|omoc_atlas" plugin/src/ plugin/hooks/ --include="*.ts"
grep -rn "sisyphus\|omoc_sisyphus" plugin/src/ plugin/hooks/ --include="*.ts"
grep -rn "hephaestus\|omoc_hephaestus" plugin/src/ plugin/hooks/ --include="*.ts"
grep -rn "oracle\|omoc_oracle" plugin/src/ plugin/hooks/ --include="*.ts"
grep -rn "metis\|omoc_metis" plugin/src/ plugin/hooks/ --include="*.ts"
grep -rn "momus\|omoc_momus" plugin/src/ plugin/hooks/ --include="*.ts"
grep -rn "librarian\|omoc_librarian" plugin/src/ plugin/hooks/ --include="*.ts"
grep -rn "looker\|omoc_looker" plugin/src/ plugin/hooks/ --include="*.ts"
grep -rn "explore\|omoc_explore" plugin/src/ plugin/hooks/ --include="*.ts"
```

可能涉及的文件：
- `plugin/src/hooks/keyword-detector/hook.ts`
- `plugin/src/utils/persona-state.ts`
- `plugin/src/cli/setup.ts`
- `plugin/src/index.ts`
- 其他可能有硬编码引用的文件

---

## 📁 Phase 2: 文档替换

### 2.1 features.md

**文件**: `docs/reference/features.md`

需要替换的部分：
- **Personas 章节**（约第 188-312 行）：11 行表格全部替换
- **/omoc 命令示例**：命令参数替换
- **描述文本**：所有提到旧名字的地方

### 2.2 README.md

**文件**: `README.md`

需要替换的部分：
- 快速开始示例
- Persona 列表
- 命令示例

### 2.3 HOOK.md

**文件**: `plugin/hooks/persona-bootstrap/HOOK.md`

如果其中引用了 persona 名字，需要更新。

### 2.4 其他文档搜索

```bash
grep -rn "prometheus\|atlas\|sisyphus\|hephaestus\|oracle\|metis\|momus\|librarian\|looker" docs/ --include="*.md"
```

可能涉及：
- `docs/guide/overview.md`
- `docs/reference/configuration.md`
- 其他指南文档

---

## 📁 Phase 3: OpenClaw 配置替换

### 3.1 openclaw.json

**文件**: `~/.openclaw/openclaw.json`

需要修改的 JSON 路径：
```json
{
  "agents": {
    "list": [
      // 每个 agent 对象的 id 字段
      { "id": "omoc_prometheus" } → { "id": "omoc_planner" }
      { "id": "omoc_atlas" } → { "id": "omoc_orchestrator" }
      // ... 共 11 个
    ]
  }
}
```

### 3.2 Agent 工作空间目录

**目录**: `~/.openclaw/workspace-*/`

需要检查并重命名：
```bash
~/.openclaw/workspace-omoc_prometheus/   → ~/.openclaw/workspace-omoc_planner/
~/.openclaw/workspace-omoc_atlas/        → ~/.openclaw/workspace-omoc_orchestrator/
~/.openclaw/workspace-omoc_sisyphus/     → ~/.openclaw/workspace-omoc_coder/
# ... 以此类推
```

**注意**: 需要同时更新 `openclaw.json` 中对应的 `workspace` 字段（如果有）。

### 3.3 运行时状态文件

**文件**: `~/.openclaw/workspace/.omoc-state/active-persona`

- 如果当前值是旧 ID（如 `omoc_atlas`），需要更新为 `omoc_orchestrator`
- 检查是否有其他状态文件引用旧 ID

---

## 📁 Phase 4: 编译与验证

### 4.1 重新编译插件

```bash
cd ~/.openclaw/workspace/oh-my-openclaw/plugin
npm run build
```

### 4.2 运行全量测试

```bash
cd ~/.openclaw/workspace/oh-my-openclaw/plugin
npm test
```

确保所有测试通过。

### 4.3 验证 OpenClaw 配置

```bash
openclaw doctor
```

确保配置无错误。

### 4.4 功能验证

1. 测试 `/omoc list` 命令
2. 测试 `/omoc orchestrator` 切换
3. 测试 `/omoc off` 关闭
4. 验证 persona 注入是否正常工作

### 4.5 Git 提交

```bash
cd ~/.openclaw/workspace/oh-my-openclaw
git add -A
git commit -m "rename: replace mythological persona names with functional abbreviations"
```

---

## ⚠️ 风险点分析

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 遗漏某个引用 | 插件运行时错误 | 全局 grep 验证，逐个文件检查 |
| 测试未更新 | 测试失败 | 运行全量测试，修复所有失败用例 |
| 配置不一致 | Agent 无法启动 | openclaw doctor 验证，手动检查 JSON |
| 工作空间迁移失败 | 丢失运行时状态 | **先备份再操作** |
| 编译失败 | 无法使用新插件 | 保留旧版本备份，可回退 |

---

## 📋 执行顺序

```
1. 备份当前状态
   ├── 备份 plugin/agents/ 目录
   ├── 备份 ~/.openclaw/openclaw.json
   └── 备份 ~/.openclaw/workspace/.omoc-state/

2. Phase 1: 插件源码替换
   ├── 重命名 .md 文件
   ├── 更新 handler.ts
   ├── 更新 persona-commands.ts
   ├── 更新测试文件
   └── 全局搜索验证

3. Phase 2: 文档替换
   ├── features.md
   ├── README.md
   └── 其他文档

4. Phase 3: 配置替换
   ├── openclaw.json
   ├── 工作空间目录迁移
   └── active-persona 状态更新

5. Phase 4: 编译验证
   ├── npm run build
   ├── npm test
   ├── openclaw doctor
   └── 功能验证

6. Git 提交
```

---

## ⏱️ 预估工作量

| 阶段 | 预计时间 | 复杂度 |
|------|---------|--------|
| Phase 1: 源码 | 15-20 分钟 | 中 |
| Phase 2: 文档 | 10 分钟 | 低 |
| Phase 3: 配置 | 10 分钟 | 中 |
| Phase 4: 验证 | 5 分钟 | 低 |
| **总计** | **40-45 分钟** | |

---

## 📝 待确认事项

- [ ] 新名字是否都满意？
- [ ] 是否需要保留旧名字作为别名（向后兼容）？
- [ ] 工作空间目录是否需要迁移？
- [ ] 是否需要同时更新 git 远程仓库？
