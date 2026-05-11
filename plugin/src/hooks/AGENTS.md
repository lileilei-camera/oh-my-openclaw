# plugin/src/hooks — Hooks 目录

Oh-my-openclaw 插件的所有 Gateway hook 注册逻辑。

## 架构

每个文件导出一个 `register*` 函数，在 `plugin/src/index.ts` 中统一注册。

### Hook 清单

| 文件 | 功能 | 注册时机 |
|------|------|----------|
| `startup.ts` | 插件启动日志 | `gateway:startup` |
| `guardrail-injector.ts` | 防幻觉规则注入 | `before_prompt_build` (priority: 90) |
| `comment-checker.ts` | AI 废话注释检测 | `tool_result_persist` |
| `context-injector.ts` | 上下文收集注入 | `before_prompt_build` (priority: 50) |
| `message-monitor.ts` | 消息审计日志 | `message:sent` / `message:received` |
| `spawn-guard.ts` | 子代理生成保护（强制 agentId） | `before_tool_call` (priority: 150) |
| `subagent-tracker.ts` | 子代理生命周期跟踪 + 唤醒 | `tool_result_persist` + `subagent_ended` + `message:received` |
| `todo-enforcer.ts` | TODO 角色指令 + 未完成注入 | `agent:bootstrap` + `before_prompt_build` (priority: 60) |
| `todo-reminder.ts` | TODO 超时提醒 + 会话清理 | `tool_result_persist` + `agent_end` + `session_start/end` |

### 子目录

- `project-init/` — 项目管理状态 + /omoc_init 初始化模板
- `mode-switch/` — 多模式切换（plan/analyze/coding/search/ultrawork）

## 关键设计

### Priority 顺序（before_prompt_build）

```
150  spawn-guard (before_tool_call)
120  subagent_ended (subagent_ended)
100  persona (before_prompt_build)
 90  guardrail-injector
 60  todo-enforcer
 50  context-injector
```

### 状态管理

- `subagent-tracker` 通过 `webhook-bridge` 跟踪子代理 runId
- `todo-enforcer` 使用 `contextCollector` 注册角色指令
- `todo-reminder` 使用 Map 计数器跟踪工具调用次数
