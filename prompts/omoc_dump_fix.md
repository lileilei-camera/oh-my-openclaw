# 技术方案：omoc dump 修改为不触发额外 agent turn

## 现状

`/omoc dump /tmp/x.txt` → 写 flag 文件 → **需要用户再发一条消息** → `llm_input` 钩子触发 → dump

## 根因

`llm_input` 在 turn 即将提交 LLM 时触发。flag 写入后必须等**下一条用户消息**才触发新 turn。

## 方案：移到 `before_prompt_build`，同 turn 内完成

```
时序：
1. 用户发 "/omoc dump /tmp/2.txt"
2. 命令处理器 → 写 flag 文件
3. before_prompt_build 钩子触发（同 turn）→ 检测到 flag → dump → 清 flag
4. agent 正常处理用户消息
```

dump 在命令所在 turn 内完成，不需要额外消息触发。

## 实现要点

1. `dump-context.ts` 从 `llm_input` 迁移到 `before_prompt_build`
2. `before_prompt_build` 有 `event.prompt`（当前消息）和 `event.messages`（历史消息列表）
3. 缺少 `systemPrompt` 和 `tools` 信息——可通过读取 Gateway 内部对象或接受简略 dump
4. agent 仍需运行该 turn（无法在 `before_prompt_build` 中阻止 turn），LLM 会被调用但只处理用户消息本身

## 可选优化：静默 dump turn

如果 SDK 有 `before_agent_reply` 钩子（returns `{ silence: true }`），可在同 turn 触发 dump 后静默跳过 LLM 调用。需确认 SDK 类型中是否包含此钩子。
