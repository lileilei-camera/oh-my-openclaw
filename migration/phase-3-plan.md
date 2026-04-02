# Phase 3 执行计划 - Hook 系统统一

**执行时间**: 2026-04-02 13:00  
**执行者**: Coder Agent  
**状态**: 进行中

---

## 📋 迁移目标

统一使用 `api.registerHook()`（SDK 标准 API），移除 `api.on()` 调用。

---

## 📝 需要迁移的文件

| 文件 | 当前使用 | 迁移优先级 | 复杂度 |
|------|---------|-----------|--------|
| `hooks/todo-enforcer.ts` | `api.on()` (before_prompt_build) | 高 | 中 |
| `hooks/todo-reminder.ts` | `api.on()` (agent_end, session_start, session_end) | 高 | 中 |
| `hooks/context-injector.ts` | `api.on()` (before_prompt_build) | 高 | 低 |
| `hooks/guardrail-injector.ts` | `api.on()` (before_prompt_build) | 高 | 低 |
| `hooks/keyword-detector/hook.ts` | `api.on()` (before_prompt_build) | 高 | 中 |
| `hooks/session-sync.ts` | `api.on()` (session_start) | 高 | 低 |
| `hooks/spawn-guard.ts` | `api.on()` (before_tool_call) | 高 | 中 |
| `hooks/subagent-tracker.ts` | `api.on()` (tool_result_persist) | 高 | 高 |

**总计**: 8 个文件，12 个 `api.on()` 调用

---

## 🔄 迁移模式

### 模式 1: before_prompt_build Hook

**迁移前**:
```typescript
api.on<BeforePromptBuildEvent, BeforePromptBuildResult>(
  'before_prompt_build',
  (_event: BeforePromptBuildEvent, ctx: TypedHookContext): BeforePromptBuildResult | void => {
    // ...
    return { prependContext: '...' };
  },
  { priority: 50 }
);
```

**迁移后**:
```typescript
api.registerHook(
  'before_prompt_build',
  (event: unknown): { prependContext?: string } | void => {
    // event 包含 prompt, messages, systemPrompt 等
    const prompt = (event as any).prompt;
    // ...
    return { prependContext: '...' };
  },
  { name: '...', description: '...', priority: 50 }
);
```

### 模式 2: agent_end Hook

**迁移前**:
```typescript
api.on<AgentEndEvent, void>(
  'agent_end',
  async (_event: AgentEndEvent, ctx: TypedHookContext): Promise<void> => {
    const sessionKey = ctx.sessionKey;
    // ...
  },
  { priority: 50 }
);
```

**迁移后**:
```typescript
api.registerHook(
  'agent_end',
  async (event: unknown): Promise<void> => {
    // event 包含 messages, success, error, durationMs
    // sessionKey 需要从 event 或其他来源获取
    const sessionKey = (event as any).sessionKey;
    // ...
  },
  { name: '...', description: '...', priority: 50 }
);
```

---

## ⚠️ 注意事项

### 1. 上下文获取

**问题**: `api.on()` 提供 `TypedHookContext`（包含 sessionKey, agentId 等），但 `api.registerHook()` 的事件对象结构可能不同

**解决方案**:
- 从事件对象中提取所需字段
- 必要时使用全局状态或闭包
- 对于 sessionKey，可能需要从 event.sessionKey 或 event.sessionId 获取

### 2. 优先级保持

**问题**: `api.on()` 的 `priority` 选项需要映射到 `api.registerHook()` 的 meta

**解决方案**:
```typescript
// 直接传递 priority 到 meta
api.registerHook('event', handler, { priority: 50 });
```

### 3. 类型安全

**问题**: 移除 `TypedHookContext` 后，类型安全性降低

**解决方案**:
- 使用类型断言 `(event as any).field`
- 添加运行时检查
- 后续 Phase 引入 SDK 标准类型

---

## 📊 迁移顺序

1. ✅ **简单 Hook** (无上下文依赖)
   - `guardrail-injector.ts`
   - `context-injector.ts`

2. ✅ **中等 Hook** (从事件获取上下文)
   - `keyword-detector/hook.ts`
   - `session-sync.ts`
   - `spawn-guard.ts`

3. ✅ **复杂 Hook** (多事件/复杂逻辑)
   - `todo-enforcer.ts`
   - `todo-reminder.ts`
   - `subagent-tracker.ts`

---

## ✅ 验收标准

- [ ] 所有 `api.on()` 调用替换为 `api.registerHook()`
- [ ] TypeScript 编译通过
- [ ] 所有测试通过（366 个）
- [ ] 移除废弃类型（`TypedHookContext`, `BeforePromptBuildEvent`, `BeforePromptBuildResult`）
- [ ] 代码功能不变

---

*Phase 3 迁移计划*
