import type {
  OpenClawPluginApi,
  PluginHookAgentEndEvent,
  PluginHookAgentContext,
  PluginHookSessionStartEvent,
  PluginHookSessionEndEvent,
  PluginHookToolResultPersistEvent,
  PluginHookToolResultPersistContext,
  PluginHookToolResultPersistResult,
} from '../types.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../constants.js';
import { getIncompleteTodos, resetStore } from '../tools/todo/store.js';
import { getPluginConfig } from '../types.js';
// import { callHooksAgent, callHooksWake } from '../utils/webhook-client.js';

// Prevent agent_end → hooks/agent → agent_end infinite loop within 30s
const agentEndCooldowns = new Map<string, number>();
const AGENT_END_COOLDOWN_MS = 30_000;

const TODO_TOOL_NAMES = new Set([
  `${TOOL_PREFIX}todo_create`,
  `${TOOL_PREFIX}todo_list`,
  `${TOOL_PREFIX}todo_update`,
]);

const TURN_THRESHOLD = 10;

const REMINDER_MESSAGE = `

---
⚠️ [OMOC Todo Reminder] You have used ${TURN_THRESHOLD}+ tool calls without checking your todo list.

**Action required:** Call \`${TOOL_PREFIX}todo_list\` to review pending todos before continuing.
Ensure you are not drifting from the plan. Mark completed todos, update in-progress ones.`;

const sessionCounters = new Map<string, number>();

export function registerTodoReminder(api: OpenClawPluginApi): void {
  api.on<PluginHookToolResultPersistEvent, PluginHookToolResultPersistResult | void>(
    'tool_result_persist',
    (event: PluginHookToolResultPersistEvent, ctx: PluginHookToolResultPersistContext): PluginHookToolResultPersistResult | void => {
      const toolName = event.toolName;
      if (!toolName) return;

      const sessionKey = ctx.sessionKey ?? '__default__';

      if (TODO_TOOL_NAMES.has(toolName)) {
        sessionCounters.set(sessionKey, 0);
        return;
      }

      const current = sessionCounters.get(sessionKey) ?? 0;
      const next = current + 1;
      sessionCounters.set(sessionKey, next);

      if (next >= TURN_THRESHOLD && next % TURN_THRESHOLD === 0) {
        // Append reminder to the first text block in message content
        const blocks = event.message.content.map((block: Record<string, unknown>) => {
          if (block.type === 'text' && typeof block.text === 'string') {
            return { ...block, text: block.text + REMINDER_MESSAGE };
          }
          return block;
        });

        return {
          message: {
            ...event.message,
            content: blocks,
          },
        };
      }

      return;
    },
    { priority: 100 },
  );
}

export function registerAgentEndReminder(api: OpenClawPluginApi): void {
  api.on<PluginHookAgentEndEvent, void>(
    'agent_end',
    async (_event: PluginHookAgentEndEvent, ctx: PluginHookAgentContext): Promise<void> => {
      try {
        const sessionKey = ctx.sessionKey;
        api.logger.info(`${LOG_PREFIX} agent_end fired: sessionKey=${sessionKey ?? 'N/A'}`);
        const isDashboard = sessionKey && /:dashboard:[a-f0-9-]+$/.test(sessionKey);
        api.logger.info(`${LOG_PREFIX} agent_end isDashboard=${isDashboard}`);
        if (!isDashboard) return;

        // Cooldown: prevent rapid re-entry
        if (sessionKey) {
          const lastFired = agentEndCooldowns.get(sessionKey) ?? 0;
          if (Date.now() - lastFired < AGENT_END_COOLDOWN_MS) {
            api.logger.info(`${LOG_PREFIX} agent_end cooldown active, skipping (${Math.round((Date.now() - lastFired) / 1000)}s since last)`);
            return;
          }
          agentEndCooldowns.set(sessionKey, Date.now());
        }

        const incomplete = [
          ...getIncompleteTodos(sessionKey),
          ...getIncompleteTodos('__default__'),
        ];
        api.logger.info(`${LOG_PREFIX} agent_end incomplete count=${incomplete.length}`);
        if (incomplete.length > 0) {
          const summary = incomplete
            .map((t) => `  - [${t.status}] ${t.id}: ${t.content}`)
            .join('\n');
          api.logger.warn(`${LOG_PREFIX} Agent ended with ${incomplete.length} incomplete todo(s):\n${summary}`);
        }
      } catch (err) {
        api.logger.error(`${LOG_PREFIX} agent_end handler error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    { priority: 50 },
  );
}

function clearSession(sessionKey: string, api: OpenClawPluginApi, reason: string): void {
  resetStore(sessionKey);
  sessionCounters.delete(sessionKey);
  api.logger.info(`${LOG_PREFIX} Todo store cleared (${reason}, session=${sessionKey})`);
}

export function registerSessionCleanup(api: OpenClawPluginApi): void {
  api.on<PluginHookSessionStartEvent, void>(
    'session_start',
    async (event: PluginHookSessionStartEvent): Promise<void> => {
      if (event.resumedFrom) return;

      const sessionKey = (api.config.sessionKey as string) ?? (api.config.sessionId as string) ?? event.sessionId;
      if (!sessionKey) return;

      clearSession(sessionKey, api, 'new session');
    },
    { priority: 190 },
  );

  api.on<PluginHookSessionEndEvent, void>(
    'session_end',
    async (event: PluginHookSessionEndEvent): Promise<void> => {
      const sessionKey = (api.config.sessionId as string) ?? event.sessionId;
      if (!sessionKey) return;

      clearSession(sessionKey, api, 'session_end');
    },
    { priority: 50 },
  );
}

export function resetTodoReminderCounters(): void {
  sessionCounters.clear();
}

export { sessionCounters as _sessionCounters };
