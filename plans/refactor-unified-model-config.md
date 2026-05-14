# 重构：统一模型配置到 openclaw.json

**日期**: 2026-05-14  
**目标**: 插件所有模型查询统一从 `openclaw.json` → `agents.list` 读取，删除插件内重复的模型配置。

## 背景

Agent 模型当前配置在三个地方，只有 `openclaw.json` 是真实生效的：

| 位置 | 作用 | 问题 |
|------|------|------|
| `plugin/config/agent-models.json` | 代理模型参考 | 与 openclaw.json 重复 |
| `config/categories.json` | delegate-task 模型路由 | 模型字段从未被运行时加载 |
| `delegate-task/constants.ts` | `DEFAULT_CATEGORY_MODELS` | 硬编码，与 openclaw.json 脱节 |
| `openclaw.json` agents.list | **唯一可信源** | ✅ |

## 步骤

### 1. 新增工具函数 `readAgentModel(agentId)`

- 文件: `plugin/src/utils/agent-model.ts`
- 读 `~/.openclaw/openclaw.json`
- 从 `agents.list` 找该 agent 的 `model`
- 没找到返回 `agents.defaults.model.primary`

### 2. 改 `agent-configs.ts`

- `getModelForAgent()` 调用 `readAgentModel()`
- `OMOC_AGENT_CONFIGS` 不显式设 `model` 字段，让 OpenClaw 走默认
- `agent-models.json` 原是首次配置时导入模型用的，此处不再需要

### 3. 删除 `plugin/config/agent-models.json`

### 4. 删除 `delegate-task/constants.ts` 中的 `DEFAULT_CATEGORY_MODELS`

### 5. 改 `delegate-task/tools.ts`

- 通过 `DEFAULT_CATEGORY_AGENTS` 拿到 agentId
- 调 `readAgentModel()` 拿模型名
- 显式传入 `sessions_spawn`

### 6. 清理 `config/categories.json`

- 删除所有 category 的 `model` 和 `alternatives` 字段

### 7. 构建 + 测试

```bash
cd plugin && npm run build && npm run test
```
