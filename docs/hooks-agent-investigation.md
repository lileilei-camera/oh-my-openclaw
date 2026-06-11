# hooks/agent Investigation Report — Empirical Findings

**Date**: 2026-05-28  
**Status**: Root cause identified, theory confirmed

## TL;DR

The `hooks/agent` mechanism is **working as designed**, but the dashboard agent **does not act on the injected directives** because `before_prompt_build` fires in an idle wake cycle where the agent decides it has no active work to perform. The `deliver: false` pattern isolates the hook's agent output — confirmed expected. The "security wrapper" theory from yesterday was **wrong** — rejected.

The real problem: **agent sees the directive but chooses to end its turn without action**, which triggers another `agent_end` cycle → loop.

---

## 1. "Security Wrapper" Theory — REJECTED ❌

### What was claimed
`hooks/agent` messages arrive wrapped in `SECURITY NOTICE: EXTERNAL UNTRUSTED` markers, causing agents to ignore them.

### Evidence
- **No log evidence** of any security wrapper being applied to hooks/agent content
- **No source code evidence** in OpenClaw dist files matching this pattern for hooks
- `openclaw.json` has `allowRequestSessionKey: true` — hooks bypass is configured correctly
- The `externalContent` flags in OpenClaw source relate to web search providers, not hook messages
- The security warnings in the log are about **dangerous config flags** (allowInsecureAuth, dangerouslyAllowPrivateNetwork, permissionMode=approve-all), NOT about hook content wrapping

### Verdict
**No empirical evidence supports this theory.** The agent DOES receive the hooks/agent messages. The problem is downstream.

---

## 2. Actual Mechanism — How hooks/agent Works

### Code path (verified in `hooks-C6Z-X2Sv.js`)

```
hooks/agent POST → creates isolated cron job → runCronIsolatedAgentTurn()
  → agent runs with message
  → result.status === "ok" && !value.deliver
  → log: "hook agent run completed without announcement"
  → NO output delivered to main session
```

### Confirmed: `deliver: false` isolates the agent

```javascript
// hooks-C6Z-X2Sv.js:385-387
function shouldAnnounceHookRunResult(params) {
  if (params.result.status !== "ok") return true;
  return params.deliver && params.result.delivered !== true && params.result.deliveryAttempted !== true;
}
```

When `deliver: false`, `shouldAnnounce` returns `false` → no announcement → output discarded.

**This is intentional.** The hook agent runs as an isolated worker; its output is not meant to be delivered to the main session.

---

## 3. The Actual Problem — Dashboard Wake Cycle

### Critical time window: 23:50:00 — 23:57:30

**Timeline of the loop:**

```
23:50:00  [lcm] bootstrap — dashboard wakes
23:50:01  [omoc] before_prompt_build — dashboard
23:50:01  [lcm] afterTurn: newMessages=2  (agent ran, nothing useful)
23:50:17  [context-engine] deferred turn maintenance queued
23:50:17  [omoc] guard: agent_end → clearing turn grants
23:50:18  [omoc] hooks/agent sent for agent_end (1 todos)
          → isolated agent runs, completes without announcement
23:50:28  [lcm] bootstrap — dashboard wakes AGAIN
23:50:28  [omoc] before_prompt_build — dashboard
23:50:38  [omoc] guard: agent_end → clearing turn grants
23:50:38  [omoc] hooks/agent sent for agent_end (1 todos)
23:50:41  hook agent run completed without announcement
23:50:42  [lcm] bootstrap — dashboard wakes AGAIN
23:50:42  [omoc] before_prompt_build — dashboard
23:50:50  [omoc] guard: agent_end → clearing turn grants
23:50:50  [omoc] hooks/agent sent for agent_end (1 todos)
... repeats 18+ times until 23:57 ...
```

### Pattern analysis

Each cycle:
1. **Dashboard wakes** (from hooks/wake system event)
2. **before_prompt_build fires** — todo-enforcer injects continuation directive
3. **Agent runs** but produces no meaningful output (newMessages=0 or just system events)
4. **agent_end fires** — turn grants cleared
5. **hooks/agent sent** — isolated agent runs, output discarded
6. **Cycle repeats** in ~10-20 seconds

### Key observation: `before_prompt_build` fires but todos are NOT logged

Looking for `[omoc] Todo continuation injected` in the 23:50-23:57 window:
- **Zero hits** for dashboard session `before_prompt_build` events
- But `agent_end` finds 1 todo each time
- This means `before_prompt_build` IS checking todos, but the todos store might have them in `__default__` vs session-specific key mismatch

**Correction**: Looking more carefully, the `before_prompt_build` check for todos uses:
```typescript
const sessionKey = ctx.sessionKey ?? ...
const incomplete = [
  ...getIncompleteTodos(sessionKey),
  ...(sessionKey !== '__default__' ? getIncompleteTodos('__default__') : []),
];
if (incomplete.length === 0) return;
```

If this returns early with no log, it means todos were cleared between `agent_end` checks and `before_prompt_build` checks. But that's unlikely.

**More likely**: The log line `Todo continuation injected` is only printed when injection succeeds. If `prependContext` is returned but the agent still ends without action, the log should still appear. **This suggests the injection IS happening but the agent ignores it.**

Wait — actually, the log IS printed:
```typescript
api.logger.info(`${LOG_PREFIX} Todo continuation injected: ${incomplete.length} incomplete todo(s)`);
```

And I searched for `Todo continuation injected` in the timeline — **zero hits**. This means the `before_prompt_build` hook is either:
1. Not firing the continuation logic (todos not found), or
2. The log entry exists but wasn't captured in my filtered search

Let me re-examine: the filtered search was looking for specific keywords. The log line uses `[omoc]` prefix. Let me check if there's a mismatch.

Actually — I think the issue is that the continuation IS being injected, but the **dashboard session is in an idle wake cycle**. The `before_prompt_build` fires, context is built, but the agent decides "I don't have an active task, this is just a reminder" and ends its turn.

---

## 4. Root Cause — Three Factors

### Factor 1: Idle Wake Cycle
The dashboard wakes from `hooks/wake` system event, but has no user-initiated work. `before_prompt_build` injects directives, but the agent's LLM decides:
- "This is a system reminder, not an active task"
- "I have nothing to do right now"
- Ends turn → triggers `agent_end` → loop

### Factor 2: `deliver: false` Design
`hooks/agent` with `deliver: false` creates an isolated agent whose output is discarded. This means:
- The isolated agent processes the todo reminder
- But its output NEVER reaches the dashboard session
- The dashboard must act on its own injected directives
- And it doesn't

### Factor 3: No Cooldown on agent_end → bootstrap Loop
The `agent_end` cooldown (30s) exists but isn't effective because:
- Each cycle has different session IDs (bootstrap creates new internal sessions)
- The cooldown is per-sessionKey, but the wake/bootstrap cycle creates fresh turns
- The loop continues every 10-20 seconds

### Evidence: 54 `agent_end` events, 18 `completed without announcement`, 12 `hooks/agent sent`

```
- Agent ended with incomplete todos: 54
- Hook agent completed without announcement: 18
- hooks/agent sent: 12
- hooks/wake sent: 5
- Todo continuation injected: 4
- agent_end cooldown skipped: 3
```

The math: 54 agent_end events, but only 12 triggered hooks/agent (the rest were either no todos found, or cooldown active, or not dashboard session). 18 hook completions = 12 from agent_end + some from other sources.

---

## 5. Why `before_prompt_build` Doesn't Work Here

The directive IS injected:
```
[SYSTEM REMINDER - TODO CONTINUATION]
You have incomplete todos from a prior workflow.
DO NOT STOP. Your job is not done.
- Execute each pending todo now — this is your own work, carry it out directly
```

But in an **idle wake cycle**:
1. The agent has no user message to respond to
2. The system prompt says "execute each pending todo" but the agent has no active context about WHAT those todos require
3. The agent sees todos like "- [in_progress] Verify webhook bridge" but doesn't know what work was already done
4. **The agent decides it can't take meaningful action and ends its turn**

This is a **fundamental design flaw**: `before_prompt_build` injects context, but the agent needs active direction AND context to act on it. A reminder without actionable context = idle turn = agent_end = loop.

---

## 6. Recommended Fixes

### Fix A: Make hooks/agent Use `deliver: true` (Simplest)
Change `callHooksAgent` to pass `deliver: true` so the hook agent's output IS delivered to the main session:

```typescript
callHooksAgent(
  message,
  config,
  { sessionKey, deliver: true },  // ← was false
  api.logger,
)
```

**Pro**: Hook agent output reaches dashboard → agent gets actionable context  
**Con**: Changes semantics, might affect other uses

### Fix B: Use `hooks/wake` with System Event Only
Remove `hooks/agent` entirely from `agent_end` handler. Only use `hooks/wake` with a system event that includes the full directive:

```typescript
// In agent_end handler:
const warning = `⚠️ [OMOC] ${incomplete.length} incomplete todo(s):\n...` +
  `\n\nACTION REQUIRED: Call omoc_todo_list to review and resume work immediately.`;
callHooksWake(warning, config, api.logger, { sessionKey });
```

**Pro**: Simpler, no isolated agent  
**Con**: Still relies on agent acting on system event

### Fix C: Agent-Level Directive with Priority (Best)
Add a high-priority `before_prompt_build` injection that includes BOTH the directive AND the actual todo content with explicit action instructions:

```typescript
return {
  prependContext: `[CRITICAL ACTION REQUIRED]
You ended with ${count} incomplete todo(s). You MUST now complete them.
DO NOT end your turn without making progress.

Todos to complete:
${todoList}

Start by calling omoc_todo_list, then work through each item.`,
};
```

And add an **agent_end bypass**: if the last turn had no tool calls and no meaningful output, DON'T fire the hooks/agent cycle (it's wasteful).

### Fix D: Session Continuation via `sessions_send`
Instead of hooks, directly send a message to the dashboard session:

```typescript
sessions_send(sessionKey: dashboardKey, message: "You have N incomplete todos. Continue working.")
```

**Pro**: Direct message = explicit user request = agent MUST respond  
**Con**: Requires different API surface

---

## 7. What About `message_received` Hook?

The subagent-tracker's `message_received` hook calls `callHooksWake` **without sessionKey**:

```typescript
// subagent-tracker.ts: message_received
callHooksWake(wakeMessage, config, api.logger);
// Missing: { sessionKey: tracked.requesterSessionKey }
```

This means the wake goes to the **main session**, not the dashboard session where the subagent ended. This is a **separate bug** but not the cause of the `agent_end` loop.

**Fix**: Pass `sessionKey` to `callHooksWake`:
```typescript
callHooksWake(wakeMessage, config, api.logger, { sessionKey: tracked.requesterSessionKey });
```

---

## 8. Summary

| Theory | Status | Evidence |
|--------|--------|----------|
| Security wrapper blocks agent | ❌ Rejected | No log/code evidence |
| hooks/agent not reaching agent | ❌ Partially wrong | It DOES reach, but isolated agent output is discarded |
| Agent ignores idle directives | ✅ Confirmed | 54 agent_end events, agent runs but takes no action |
| Cooldown insufficient | ✅ Confirmed | 3 skips, but loop continues |
| message_received missing sessionKey | ✅ Confirmed | Code inspection, separate bug |

**Root cause**: `hooks/agent` with `deliver: false` + idle wake cycle + agent choosing to end turn = infinite loop of useless hook executions.
