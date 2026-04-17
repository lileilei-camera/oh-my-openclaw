# Persona 重命名替换计划

**日期**: 2026-04-18  
**状态**: 草案（待审核）  
**目标**: 将希腊神话风格的 Persona 名称替换为功能缩写名称（方案二）  
**注意**: 
- Looker 和 Frontend 保留原名不变
- **中文描述（persona-prompts.ts）不替换，保持原样**
- Hephaestus → **Expert**
- Atlas → **Delegate**（"任务委派"的英文）

---

## 🎯 全局映射表

| 旧 ID | 新 ID | 旧文件名 | 新文件名 | 旧显示名 | 新显示名 | 备注 |
|-------|-------|---------|---------|---------|---------|------|
| `omoc_planner` | `omoc_planner` | `prometheus.md` | `planner.md` | Prometheus | Planner | |
| `omoc_delegate` | `omoc_delegate` | `atlas.md` | `delegate.md` | Atlas | Delegate | |
| `omoc_coder` | `omoc_coder` | `sisyphus-junior.md` | `coder.md` | Sisyphus-Junior | Coder | |
| `omoc_expert` | `omoc_expert` | `hephaestus.md` | `expert.md` | Hephaestus | Expert | |
| `omoc_architect` | `omoc_architect` | `oracle.md` | `architect.md` | Oracle | Architect | |
| `omoc_explorer` | `omoc_explorerr` | `explore.md` | `explorer.md` | Explore | Explorer | |
| `omoc_researcher` | `omoc_researcher` | `librarian.md` | `researcher.md` | Librarian | Researcher | |
| `omoc_advisor` | `omoc_advisor` | `metis.md` | `advisor.md` | Metis | Advisor | |
| `omoc_reviewer` | `omoc_reviewer` | `momus.md` | `reviewer.md` | Momus | Reviewer | |
| `omoc_looker` | `omoc_looker` | `multimodal-looker.md` | `multimodal-looker.md` | Multimodal Looker | Multimodal Looker | **不变** |
| `omoc_frontend` | `omoc_frontend` | `frontend.md` | `frontend.md` | Frontend | Frontend | **不变** |

---

## 📁 Phase 1: 插件源码替换（逐 Persona 执行）

### 涉及文件清单

以下文件需要替换：

```
plugin/agents/                          (9 个 .md 文件重命名, 2 个不变)
plugin/src/agents/agent-ids.ts          (AGENT_MD_MAP, AGENT_TIER_MAP, ORCHESTRATOR_IDS, WORKER_IDS, ALL_AGENT_IDS)
plugin/src/agents/agent-configs.ts      (OMOC_AGENT_CONFIGS 数组)
plugin/src/agents/persona-prompts.ts    (PERSONA_DESCRIPTIONS_CN, DEFAULT_PERSONA_ID)
plugin/hooks/persona-bootstrap/handler.ts    (AGENT_MD_MAP)
plugin/hooks/persona-bootstrap/handler.test.ts (测试用例)
plugin/src/commands/persona-commands.ts (命令处理)
plugin/src/cli/setup.ts                 (setup 配置)
plugin/src/hooks/keyword-detector/*.ts  (模式文件)
plugin/src/shared/case-insensitive.ts   (大小写处理)
plugin/src/__tests__/*.test.ts          (测试文件)
plugin/src/tools/*/constants.ts,tools.ts (工具常量)
```

---

### 1.1 Prometheus → Planner

```bash
cd ~/.openclaw/workspace/oh-my-openclaw

mv plugin/agents/prometheus.md plugin/agents/planner.md

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  "s/omoc_planner/omoc_planner/g" {} +

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  -e "s/'Prometheus'/'Planner'/g" \
  -e "s/\"Prometheus\"/\"Planner\"/g" \
  -e "s/🔥/📋/g" \
  {} +

sed -i "s/omoc_planner: 'prometheus'/omoc_planner: 'planner'/" \
  plugin/src/agents/agent-ids.ts \
  plugin/hooks/persona-bootstrap/handler.ts

sed -i \
  -e "s/name: 'Prometheus'/name: 'Planner'/" \
  -e "s/emoji: '🔥'/emoji: '📋'/" \
  -e "s/theme: 'Strategic Planner'/theme: 'Planner'/" \
  plugin/src/agents/agent-configs.ts

# ⚠️ 不替换 persona-prompts.ts 中的中文描述（保持原样）
```

---

### 1.2 Atlas → Delegate

```bash
cd ~/.openclaw/workspace/oh-my-openclaw

mv plugin/agents/atlas.md plugin/agents/delegate.md

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  "s/omoc_delegate/omoc_delegate/g" {} +

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  -e "s/'Atlas'/'Delegate'/g" \
  -e "s/\"Atlas\"/\"Delegate\"/g" \
  {} +

sed -i "s/omoc_delegate: 'atlas'/omoc_delegate: 'delegate'/" \
  plugin/src/agents/agent-ids.ts \
  plugin/hooks/persona-bootstrap/handler.ts

sed -i \
  -e "s/name: 'Atlas'/name: 'Delegate'/" \
  -e "s/theme: 'Task Orchestrator'/theme: 'Delegate'/" \
  plugin/src/agents/agent-configs.ts

sed -i "s/DEFAULT_PERSONA_ID = 'omoc_delegate'/DEFAULT_PERSONA_ID = 'omoc_delegate'/" \
  plugin/src/agents/persona-prompts.ts

sed -i "s/omoc_delegate: 'planner'/omoc_delegate: 'orchestrator'/" \
  plugin/src/agents/agent-ids.ts

# ⚠️ 不替换 persona-prompts.ts 中的中文描述（保持原样）
```

---

### 1.3 Sisyphus → Coder

```bash
cd ~/.openclaw/workspace/oh-my-openclaw

mv plugin/agents/sisyphus-junior.md plugin/agents/coder.md

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  "s/omoc_coder/omoc_coder/g" {} +

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  -e "s/'Sisyphus-Junior'/'Coder'/g" \
  -e "s/\"Sisyphus-Junior\"/\"Coder\"/g" \
  -e "s/🪨/💻/g" \
  {} +

sed -i "s/omoc_coder: 'sisyphus-junior'/omoc_coder: 'coder'/" \
  plugin/src/agents/agent-ids.ts \
  plugin/hooks/persona-bootstrap/handler.ts

sed -i \
  -e "s/name: 'Sisyphus-Junior'/name: 'Coder'/" \
  -e "s/emoji: '🪨'/emoji: '💻'/" \
  -e "s/theme: 'Implementation Worker'/theme: 'Coder'/" \
  plugin/src/agents/agent-configs.ts

# ⚠️ 不替换 persona-prompts.ts 中的中文描述（保持原样）
```

---

### 1.4 Hephaestus → Expert

```bash
cd ~/.openclaw/workspace/oh-my-openclaw

mv plugin/agents/hephaestus.md plugin/agents/expert.md

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  "s/omoc_expert/omoc_expert/g" {} +

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  -e "s/'Hephaestus'/'Expert'/g" \
  -e "s/\"Hephaestus\"/\"Expert\"/g" \
  -e "s/🔨/⚙️/g" \
  {} +

sed -i "s/omoc_expert: 'hephaestus'/omoc_expert: 'expert'/" \
  plugin/src/agents/agent-ids.ts \
  plugin/hooks/persona-bootstrap/handler.ts

sed -i \
  -e "s/name: 'Hephaestus'/name: 'Expert'/" \
  -e "s/emoji: '🔨'/emoji: '⚙️'/" \
  -e "s/theme: 'Deep Implementation'/theme: 'Expert'/" \
  plugin/src/agents/agent-configs.ts

# ⚠️ 不替换 persona-prompts.ts 中的中文描述（保持原样）
```

---

### 1.5 Oracle → Architect

```bash
cd ~/.openclaw/workspace/oh-my-openclaw

mv plugin/agents/oracle.md plugin/agents/architect.md

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  "s/omoc_architect/omoc_architect/g" {} +

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  -e "s/'Oracle'/'Architect'/g" \
  -e "s/\"Oracle\"/\"Architect\"/g" \
  -e "s/🏛️/🏗️/g" \
  {} +

sed -i "s/omoc_architect: 'oracle'/omoc_architect: 'architect'/" \
  plugin/src/agents/agent-ids.ts \
  plugin/hooks/persona-bootstrap/handler.ts

sed -i \
  -e "s/name: 'Oracle'/name: 'Architect'/" \
  -e "s/emoji: '🏛️'/emoji: '🏗️'/" \
  -e "s/theme: 'Architecture Consultant'/theme: 'Architect'/" \
  plugin/src/agents/agent-configs.ts

# ⚠️ 不替换 persona-prompts.ts 中的中文描述（保持原样）
```

---

### 1.6 Explore → Explorer

```bash
cd ~/.openclaw/workspace/oh-my-openclaw

mv plugin/agents/explore.md plugin/agents/explorer.md

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  "s/omoc_explorer/omoc_explorerr/g" {} +

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  -e "s/'Explore'/'Explorer'/g" \
  -e "s/\"Explore\"/\"Explorer\"/g" \
  -e "s/🔍/🔎/g" \
  {} +

sed -i "s/omoc_explorerr: 'explore'/omoc_explorerr: 'explorer'/" \
  plugin/src/agents/agent-ids.ts \
  plugin/hooks/persona-bootstrap/handler.ts

sed -i \
  -e "s/name: 'Explore'/name: 'Explorer'/" \
  -e "s/emoji: '🔍'/emoji: '🔎'/" \
  -e "s/theme: 'Codebase Search'/theme: 'Explorer'/" \
  plugin/src/agents/agent-configs.ts

# ⚠️ 不替换 persona-prompts.ts 中的中文描述（保持原样）
```

---

### 1.7 Librarian → Researcher

```bash
cd ~/.openclaw/workspace/oh-my-openclaw

mv plugin/agents/librarian.md plugin/agents/researcher.md

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  "s/omoc_researcher/omoc_researcher/g" {} +

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  -e "s/'Librarian'/'Researcher'/g" \
  -e "s/\"Librarian\"/\"Researcher\"/g" \
  -e "s/📚/🔬/g" \
  {} +

sed -i "s/omoc_researcher: 'librarian'/omoc_researcher: 'researcher'/" \
  plugin/src/agents/agent-ids.ts \
  plugin/hooks/persona-bootstrap/handler.ts

sed -i \
  -e "s/name: 'Librarian'/name: 'Researcher'/" \
  -e "s/emoji: '📚'/emoji: '🔬'/" \
  -e "s/theme: 'Documentation Research'/theme: 'Researcher'/" \
  plugin/src/agents/agent-configs.ts

# ⚠️ 不替换 persona-prompts.ts 中的中文描述（保持原样）
```

---

### 1.8 Metis → Advisor

```bash
cd ~/.openclaw/workspace/oh-my-openclaw

mv plugin/agents/metis.md plugin/agents/advisor.md

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  "s/omoc_advisor/omoc_advisor/g" {} +

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  -e "s/'Metis'/'Advisor'/g" \
  -e "s/\"Metis\"/\"Advisor\"/g" \
  -e "s/🧠/💡/g" \
  {} +

sed -i "s/omoc_advisor: 'metis'/omoc_advisor: 'advisor'/" \
  plugin/src/agents/agent-ids.ts \
  plugin/hooks/persona-bootstrap/handler.ts

sed -i \
  -e "s/name: 'Metis'/name: 'Advisor'/" \
  -e "s/emoji: '🧠'/emoji: '💡'/" \
  -e "s/theme: 'Pre-Planning Analyst'/theme: 'Advisor'/" \
  plugin/src/agents/agent-configs.ts

# ⚠️ 不替换 persona-prompts.ts 中的中文描述（保持原样）
```

---

### 1.9 Momus → Reviewer

```bash
cd ~/.openclaw/workspace/oh-my-openclaw

mv plugin/agents/momus.md plugin/agents/reviewer.md

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  "s/omoc_reviewer/omoc_reviewer/g" {} +

find plugin/src plugin/hooks -name "*.ts" -not -path "*/node_modules/*" -exec sed -i \
  -e "s/'Momus'/'Reviewer'/g" \
  -e "s/\"Momus\"/\"Reviewer\"/g" \
  -e "s/🎭/📝/g" \
  {} +

sed -i "s/omoc_reviewer: 'momus'/omoc_reviewer: 'reviewer'/" \
  plugin/src/agents/agent-ids.ts \
  plugin/hooks/persona-bootstrap/handler.ts

sed -i \
  -e "s/name: 'Momus'/name: 'Reviewer'/" \
  -e "s/emoji: '🎭'/emoji: '📝'/" \
  -e "s/theme: 'Plan Reviewer'/theme: 'Reviewer'/" \
  plugin/src/agents/agent-configs.ts

# ⚠️ 不替换 persona-prompts.ts 中的中文描述（保持原样）
```

---

### 1.10 Looker（不变）

**Looker 保留原名，不做任何替换。**

### 1.11 Frontend（不变）

**Frontend 保留原名，不做任何替换。**

---

### Phase 1 验证

```bash
# 全局搜索确认无残留旧名（排除 looker 和 frontend）
grep -rn "omoc_planner\|omoc_delegate\|omoc_coder\|omoc_expert\|omoc_architect\|omoc_explorer\|omoc_researcher\|omoc_advisor\|omoc_reviewer" \
  plugin/src/ plugin/hooks/ --include="*.ts" | grep -v node_modules

# 应该返回空（如果没有遗漏）
# 注意: omoc_looker 和 omoc_frontend 是保留名，不需要搜索
```

---

## 📁 Phase 2: 文档替换

### 2.1 features.md

```bash
cd ~/.openclaw/workspace/oh-my-openclaw

sed -i \
  -e "s/omoc_planner/omoc_planner/g" \
  -e "s/omoc_delegate/omoc_delegate/g" \
  -e "s/omoc_coder/omoc_coder/g" \
  -e "s/omoc_expert/omoc_expert/g" \
  -e "s/omoc_architect/omoc_architect/g" \
  -e "s/omoc_explorer/omoc_explorerr/g" \
  -e "s/omoc_researcher/omoc_researcher/g" \
  -e "s/omoc_advisor/omoc_advisor/g" \
  -e "s/omoc_reviewer/omoc_reviewer/g" \
  docs/reference/features.md

sed -i \
  -e "s/Prometheus/Planner/g" \
  -e "s/Atlas/Delegate/g" \
  -e "s/Sisyphus-Junior/Coder/g" \
  -e "s/Hephaestus/Expert/g" \
  -e "s/Oracle/Architect/g" \
  -e "s/Explore/Explorer/g" \
  -e "s/Librarian/Researcher/g" \
  -e "s/Metis/Advisor/g" \
  -e "s/Momus/Reviewer/g" \
  docs/reference/features.md
```

### 2.2 README.md

```bash
sed -i \
  -e "s/omoc_planner/omoc_planner/g" \
  -e "s/omoc_delegate/omoc_delegate/g" \
  -e "s/omoc_coder/omoc_coder/g" \
  -e "s/omoc_expert/omoc_expert/g" \
  -e "s/omoc_architect/omoc_architect/g" \
  -e "s/omoc_explorer/omoc_explorerr/g" \
  -e "s/omoc_researcher/omoc_researcher/g" \
  -e "s/omoc_advisor/omoc_advisor/g" \
  -e "s/omoc_reviewer/omoc_reviewer/g" \
  -e "s/Prometheus/Planner/g" \
  -e "s/Atlas/Delegate/g" \
  -e "s/Sisyphus-Junior/Coder/g" \
  -e "s/Hephaestus/Expert/g" \
  -e "s/Oracle/Architect/g" \
  -e "s/Explore/Explorer/g" \
  -e "s/Librarian/Researcher/g" \
  -e "s/Metis/Advisor/g" \
  -e "s/Momus/Reviewer/g" \
  README.md
```

---

## 📁 Phase 2.5: 全局校验

> **目的**：确保整个 `plugin/` 目录中所有旧名称已被完全替换，无遗漏。

```bash
cd ~/.openclaw/workspace/oh-my-openclaw

# 1. 搜索所有旧 ID（所有文件类型，应该返回空）
echo "=== 检查旧 ID ==="
grep -rn "omoc_planner\|omoc_delegate\|omoc_coder\|omoc_expert\|omoc_architect\|omoc_explorer\|omoc_researcher\|omoc_advisor\|omoc_reviewer" \
  plugin/ | grep -v node_modules

# 2. 搜索所有旧显示名（所有文件类型，应该返回空）
echo "=== 检查旧显示名 ==="
grep -rn "'Prometheus'\|\"Prometheus\"\|'Atlas'\|\"Atlas\"\|'Sisyphus-Junior'\|\"Sisyphus-Junior\"\|'Hephaestus'\|\"Hephaestus\"\|'Oracle'\|\"Oracle\"\|'Explore'\|\"Explore\"\|'Librarian'\|\"Librarian\"\|'Metis'\|\"Metis\"\|'Momus'\|\"Momus\"" \
  plugin/ | grep -v node_modules

# 3. 搜索所有旧 .md 文件名（应该返回空）
echo "=== 检查旧文件名 ==="
ls plugin/agents/prometheus.md plugin/agents/atlas.md plugin/agents/sisyphus-junior.md plugin/agents/hephaestus.md plugin/agents/oracle.md plugin/agents/explore.md plugin/agents/librarian.md plugin/agents/metis.md plugin/agents/momus.md 2>/dev/null

# 4. 确认新文件已存在
echo "=== 确认新文件 ==="
ls plugin/agents/planner.md plugin/agents/delegate.md plugin/agents/coder.md plugin/agents/expert.md plugin/agents/architect.md plugin/agents/explorer.md plugin/agents/researcher.md plugin/agents/advisor.md plugin/agents/reviewer.md
```

**通过标准**：前三项搜索全部返回空，第四项列出所有新文件 ✅

---

## 📁 Phase 3: OpenClaw 配置替换

### 3.1 openclaw.json

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak

sed -i \
  -e "s/omoc_planner/omoc_planner/g" \
  -e "s/omoc_delegate/omoc_delegate/g" \
  -e "s/omoc_coder/omoc_coder/g" \
  -e "s/omoc_expert/omoc_expert/g" \
  -e "s/omoc_architect/omoc_architect/g" \
  -e "s/omoc_explorer/omoc_explorerr/g" \
  -e "s/omoc_researcher/omoc_researcher/g" \
  -e "s/omoc_advisor/omoc_advisor/g" \
  -e "s/omoc_reviewer/omoc_reviewer/g" \
  ~/.openclaw/openclaw.json

python3 -c "import json; json.load(open('$HOME/.openclaw/openclaw.json'))" && echo "✅ JSON 正确" || echo "❌ JSON 错误"
```

### 3.2 删除工作空间目录

```bash
# 删除旧的 Agent 工作空间目录
for dir in \
  "$HOME/.openclaw/workspace-omoc_planner" \
  "$HOME/.openclaw/workspace-omoc_planner" \
  "$HOME/.openclaw/workspace-omoc_delegate" \
  "$HOME/.openclaw/workspace-omoc_delegate" \
  "$HOME/.openclaw/workspace-omoc_coder" \
  "$HOME/.openclaw/workspace-omoc_coder" \
  "$HOME/.openclaw/workspace-omoc_expert" \
  "$HOME/.openclaw/workspace-omoc_expert" \
  "$HOME/.openclaw/workspace-omoc_architect" \
  "$HOME/.openclaw/workspace-omoc_architect" \
  "$HOME/.openclaw/workspace-omoc_explorer" \
  "$HOME/.openclaw/workspace-omoc_explorerr" \
  "$HOME/.openclaw/workspace-omoc_researcher" \
  "$HOME/.openclaw/workspace-omoc_researcher" \
  "$HOME/.openclaw/workspace-omoc_advisor" \
  "$HOME/.openclaw/workspace-omoc_advisor" \
  "$HOME/.openclaw/workspace-omoc_reviewer" \
  "$HOME/.openclaw/workspace-omoc_reviewer"; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    echo "已删除工作目录: $dir"
  fi
done
```

### 3.3 删除 Agent 运行时目录

```bash
# 删除 ~/.openclaw/agents/ 目录下的 Omoc Agent（旧名+新名）
for dir in \
  "$HOME/.openclaw/agents/omoc_planner" \
  "$HOME/.openclaw/agents/omoc_planner" \
  "$HOME/.openclaw/agents/omoc_delegate" \
  "$HOME/.openclaw/agents/omoc_delegate" \
  "$HOME/.openclaw/agents/omoc_coder" \
  "$HOME/.openclaw/agents/omoc_coder" \
  "$HOME/.openclaw/agents/omoc_expert" \
  "$HOME/.openclaw/agents/omoc_expert" \
  "$HOME/.openclaw/agents/omoc_architect" \
  "$HOME/.openclaw/agents/omoc_architect" \
  "$HOME/.openclaw/agents/omoc_explorer" \
  "$HOME/.openclaw/agents/omoc_explorerr" \
  "$HOME/.openclaw/agents/omoc_researcher" \
  "$HOME/.openclaw/agents/omoc_researcher" \
  "$HOME/.openclaw/agents/omoc_advisor" \
  "$HOME/.openclaw/agents/omoc_advisor" \
  "$HOME/.openclaw/agents/omoc_reviewer" \
  "$HOME/.openclaw/agents/omoc_reviewer"; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    echo "已删除 Agent 运行时: $dir"
  fi
done
```

### 3.4 active-persona 状态文件

```bash
cat ~/.openclaw/workspace/.omoc-state/active-persona 2>/dev/null
# 如果是旧 ID，记录日志即可（运行时会重新创建）
```

---

## 📁 Phase 4: 编译与验证

### 4.1 编译

```bash
cd ~/.openclaw/workspace/oh-my-openclaw/plugin && npm run build
```

### 4.2 测试

```bash
npm test
```

### 4.3 配置验证

```bash
openclaw doctor
```

---

## ⚠️ 注意事项

1. **替换顺序**: 先 ID（`omoc_xxx`），再显示名，最后文件名映射
2. **大小写敏感**: 处理所有大小写变体
3. **Emoji 替换**: 每个 persona 的 emoji 一并更新
4. **中文描述**: persona-prompts.ts 中的中文描述**不替换**，保持原样
5. **测试文件**: 断言和 mock 数据与源码同步更新
6. **JSON 配置**: openclaw.json 修改后必须验证格式

---

## 📝 待确认事项

- [ ] 新名字是否都满意？
- [ ] 新 emoji 是否合适？
- [ ] 是否需要保留旧名字作为别名（向后兼容）？
- [ ] 工作空间目录是否需要迁移？
- [ ] agent-models.json 是否需要更新 key？
