# Oh-My-OpenClaw 完全迁移到 SDK 类型 - 详细计划

**目标**: 完全使用 `openclaw/plugin-sdk` 类型，移除所有自定义类型定义

**SDK 类型来源**: `~/.npm-global/lib/node_modules/openclaw/dist/plugin-sdk/src/plugins/types.d.ts`

---

## 📋 需要修改的文件列表

### 第一阶段：核心类型和入口（2 个文件）

1. ✅ **src/types.ts** - 移除自定义类型，只导出 SDK 类型和项目特定类型
2. ✅ **src/index.ts** - 使用 SDK OpenClawPluginApi

### 第二阶段：Hooks（11 个文件）

3. src/hooks/comment-checker.ts
4. src/hooks/context-injector.ts
5. src/hooks/guardrail-injector.ts
6. src/hooks/keyword-detector/hook.ts
7. src/hooks/message-monitor.ts
8. src/hooks/session-sync.ts
9. src/hooks/spawn-guard.ts
10. src/hooks/startup.ts
11. src/hooks/subagent-tracker.ts
12. src/hooks/todo-enforcer.ts
13. src/hooks/todo-reminder.ts

### 第三阶段：Tools（9 个文件）

14. src/tools/checkpoint.ts
15. src/tools/look-at.ts
16. src/tools/omo-delegation.ts
17. src/tools/task-delegation.ts
18. src/tools/web-search.ts
19. src/tools/todo/index.ts
20. src/tools/todo/todo-create.ts
21. src/tools/todo/todo-list.ts
22. src/tools/todo/todo-update.ts

### 第四阶段：Commands（4 个文件）

23. src/commands/persona-commands.ts
24. src/commands/ralph-commands.ts
25. src/commands/status-commands.ts
26. src/commands/todo-commands.ts

### 第五阶段：Services（2 个文件）

27. src/services/ralph-loop.ts
28. src/services/webhook-bridge.ts

### 第六阶段：Utils（6 个文件）

29. src/utils/helpers.ts
30. src/utils/paths.ts
31. src/utils/persona-state.ts
32. src/utils/state.ts
33. src/utils/validation.ts
34. src/utils/webhook-client.ts

### 第七阶段：测试文件（10 个文件）

35. src/__tests__/commands.test.ts
36. src/__tests__/helpers/mock-factory.ts
37. src/__tests__/hooks.test.ts
38. src/__tests__/keyword-detector.test.ts
39. src/__tests__/persona.test.ts
40. src/__tests__/services.test.ts
41. src/__tests__/task-tools.test.ts
42. src/__tests__/tools.test.ts
43. src/__tests__/utils.test.ts
44. src/__tests__/webhook-bridge.test.ts

---

## 🔧 类型替换规则

### SDK 类型映射

| 旧类型 | 新 SDK 类型 | 来源 |
|--------|-----------|------|
| `OmocPluginApi` | `OpenClawPluginApi` | `openclaw/plugin-sdk` |
| `TypedHookContext` | 从事件对象和 `api.config`/`api.runtime` 获取 | N/A |
| `BeforePromptBuildEvent` | `PluginHookBeforePromptBuildEvent` | `openclaw/plugin-sdk` |
| `BeforePromptBuildResult` | `PluginHookBeforePromptBuildResult` | `openclaw/plugin-sdk` |
| `AgentEndEvent` | `PluginHookAgentEndEvent` | `openclaw/plugin-sdk` |
| `SessionStartEvent` | `PluginHookSessionStartEvent` | `openclaw/plugin-sdk` |
| `SessionEndEvent` | `PluginHookSessionEndEvent` | `openclaw/plugin-sdk` |
| `BeforeToolCallEvent` | `PluginHookBeforeToolCallEvent` | `openclaw/plugin-sdk` |
| `BeforeToolCallResult` | `PluginHookBeforeToolCallResult` | `openclaw/plugin-sdk` |
| `ToolResultPersistEvent` | `PluginHookToolResultPersistEvent` | `openclaw/plugin-sdk` |
| `MessageReceivedEvent` | `PluginHookMessageReceivedEvent` | `openclaw/plugin-sdk` |
| `SubagentEndedEvent` | `PluginHookSubagentEndedEvent` | `openclaw/plugin-sdk` |
| `PluginConfig` | 从 `api.config` + `api.pluginConfig` 提取 | N/A |
| `ToolResult` | `{ content: Array<{type: string, text: string}> }` | SDK 标准 |

### 配置访问

**旧方式**:
```typescript
import { getConfig } from './utils/config.js';
const config = getConfig(api);
```

**新方式**:
```typescript
// 直接从 api.config 和 api.pluginConfig 读取
const config = {
  max_ralph_iterations: api.config.max_ralph_iterations ?? 10,
  // ...
};
```

### Hook 签名变化

**旧方式**:
```typescript
api.on<BeforePromptBuildEvent, BeforePromptBuildResult>(
  'before_prompt_build',
  (event, ctx) => {
    // ctx.sessionKey, ctx.agentId
  }
);
```

**新方式**:
```typescript
api.on<PluginHookBeforePromptBuildEvent, PluginHookBeforePromptBuildResult>(
  'before_prompt_build',
  (event) => {
    // 从 api.config 或 api.runtime 获取上下文
  }
);
```

---

## ✅ 执行步骤

1. ✅ 更新 `src/types.ts` - 只导出 SDK 类型和项目特定类型
2. ✅ 更新 `src/index.ts` - 使用 SDK OpenClawPluginApi
3. 逐个更新 Hooks 文件
4. 逐个更新 Tools 文件
5. 逐个更新 Commands 文件
6. 逐个更新 Services 文件
7. 逐个更新 Utils 文件
8. 逐个更新测试文件
9. 验证 TypeScript 编译
10. 运行所有测试

---

## 📝 每个文件的修改模式

### 标准导入替换

```typescript
// 旧
import { OmocPluginApi, BeforePromptBuildEvent, ToolResult } from '../types.js';

// 新
import type { 
  OpenClawPluginApi,
  PluginHookBeforePromptBuildEvent,
} from 'openclaw/plugin-sdk';

// ToolResult 内联定义或从 SDK 导入
interface ToolResult {
  content: Array<{ type: string; text: string }>;
}
```

### 函数签名替换

```typescript
// 旧
export function registerHook(api: OmocPluginApi, config: PluginConfig) {
  api.on<BeforePromptBuildEvent, BeforePromptBuildResult>(...);
}

// 新
export function registerHook(api: OpenClawPluginApi) {
  api.on<PluginHookBeforePromptBuildEvent, PluginHookBeforePromptBuildResult>(...);
}
```

---

## ⚠️ 注意事项

1. **TypedHookContext 不再可用** - 需要从 `api.config`、`api.runtime` 或事件对象中提取上下文信息
2. **PluginConfig 不再集中定义** - 每个文件根据需要直接从 `api.config` 读取字段
3. **测试 mock 需要更新** - mock API 对象需要符合 SDK 类型
4. **每次修改后验证** - 修改一个文件后立即运行 `npm run typecheck` 和 `npm test`

---

*详细迁移计划 - 2026-04-02*
