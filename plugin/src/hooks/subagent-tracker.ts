import type {
  OpenClawPluginApi,
  PluginHookSubagentEndedEvent,
  PluginHookToolResultPersistEvent,
  PluginHookToolResultPersistContext,
  PluginHookMessageReceivedEvent,
  PluginHookMessageContext,
} from '../types.js';
import { LOG_PREFIX } from '../constants.js';
import { trackSubagentSpawn, clearSubagentTracking, getCallerSessionKey, getTrackedSubagents } from '../services/webhook-bridge.js';
import { callHooksWake } from '../utils/webhook-client.js';
import { getPluginConfig } from '../types.js';

const SPAWN_TOOL_NAME = 'sessions_spawn';

function extractSpawnResult(content: string): { runId: string; childSessionKey: string; task: string } | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.status === 'accepted' && parsed.runId && parsed.childSessionKey) {
      return {
        runId: parsed.runId,
        childSessionKey: parsed.childSessionKey,
        task: parsed.task ?? '',
      };
    }
  } catch {
    const runIdMatch = content.match(/runId["\s:]+["']?([a-zA-Z0-9_-]+)/);
    const sessionKeyMatch = content.match(/childSessionKey["\s:]+["']?([a-zA-Z0-9:_-]+)/);
    if (runIdMatch && sessionKeyMatch) {
      return {
        runId: runIdMatch[1],
        childSessionKey: sessionKeyMatch[1],
        task: '',
      };
    }
  }

  return null;
}

/**
 * Extracts plain text from AgentMessage content blocks.
 */
function extractText(content: Array<{ type: string; [key: string]: unknown }>): string {
  return content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text' && typeof (c as Record<string, unknown>).text === 'string')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('');
}

/**
 * Tries to find a tracked sub-agent from the message content.
 * Uses multiple strategies: runId match, childSessionKey match.
 * Falls back to keyword detection for single-tracked-agent case
 * only when multiple strong announce indicators are present.
 */
function findTrackedSubagentInContent(content: string): string | null {
  const tracked = getTrackedSubagents();
  if (tracked.size === 0) return null;

  // Strategy 1: Direct runId match in content
  const runIdMatch = content.match(/runId["\s:=]+["']?([a-zA-Z0-9_-]+)/);
  if (runIdMatch && tracked.has(runIdMatch[1])) {
    return runIdMatch[1];
  }

  // Strategy 2: childSessionKey match in content
  for (const [runId, entry] of tracked) {
    if (content.includes(entry.childSessionKey)) {
      return runId;
    }
  }

  // Strategy 3: Strong announce indicators (require at least 2)
  // Only used for unambiguous single-tracked-agent case
  if (tracked.size === 1) {
    const strongIndicators = [
      'Sub-agent', 'subagent', 'sub_agent',
      'Result:', 'Summary:',
    ];
    const matchCount = strongIndicators.filter((kw) => content.includes(kw)).length;
    // Require at least 2 strong indicators to avoid false positives
    if (matchCount >= 2) {
      const [onlyRunId] = tracked.keys();
      return onlyRunId;
    }
  }

  return null;
}

export function registerSubagentTracker(api: OpenClawPluginApi): void {
  api.on<PluginHookToolResultPersistEvent, void>(
    'tool_result_persist',
    (event: PluginHookToolResultPersistEvent, ctx: PluginHookToolResultPersistContext): void => {
      if (event.toolName !== SPAWN_TOOL_NAME) return;

      const content = extractText(event.message.content);
      const spawnResult = extractSpawnResult(content);

      if (spawnResult) {
        trackSubagentSpawn({
          ...spawnResult,
          spawnedAt: Date.now(),
          callerSessionKey: ctx.sessionKey,
        });
        api.logger.info(`${LOG_PREFIX} Tracking sub-agent spawn: runId=${spawnResult.runId}, callerSession=${ctx.sessionKey ?? 'unknown'}`);
      }
    },
    { priority: 100 },
  );

  api.on<PluginHookSubagentEndedEvent, void>(
    'subagent_ended',
    async (event: PluginHookSubagentEndedEvent): Promise<void> => {
      const runId = typeof event?.runId === 'string' ? event.runId : undefined;
      if (!runId) return;

      const tracked = getTrackedSubagents();
      const wasTracked = tracked.has(runId);
      const callerSession = getCallerSessionKey(runId);
      clearSubagentTracking(runId);

      if (!wasTracked) return;

      api.logger.info(`${LOG_PREFIX} subagent_ended received: runId=${runId} (callerSession=${callerSession ?? 'unknown'})`);

      const config = getPluginConfig(api);
      if (config.webhook_bridge_enabled && config.gateway_url && config.hooks_token) {
        const requesterSessionKey = typeof (api.config.requesterSessionKey as string) === 'string'
          ? (api.config.requesterSessionKey as string)
          : undefined;
        const wakeMessage = requesterSessionKey
          ? `[System] Sub-agent completed (runId=${runId}, requester=${requesterSessionKey}). Process the result and continue pending work.`
          : `[System] Sub-agent completed (runId=${runId}). Process the result and continue pending work.`;

        const result = await callHooksWake(
          wakeMessage,
          { gateway_url: config.gateway_url, hooks_token: config.hooks_token },
          api.logger,
        );

        if (result.ok) {
          api.logger.info(`${LOG_PREFIX} Wake triggered from subagent_ended: runId=${runId}`);
        } else {
          api.logger.warn(`${LOG_PREFIX} Wake from subagent_ended failed: ${result.error ?? `status ${result.status}`}`);
        }
      }
    },
    { priority: 120 },
  );

  api.on<PluginHookMessageReceivedEvent, void>(
    'message_received',
    async (event: PluginHookMessageReceivedEvent, _ctx: PluginHookMessageContext): Promise<void> => {
      const content = event.content ?? '';

      // Skip empty/short messages
      if (content.length < 10) return;

      // Try to find a tracked sub-agent in this message
      const matchedRunId = findTrackedSubagentInContent(content);
      if (!matchedRunId) return;

      // Found a match — this is likely a sub-agent announce
      const callerSession = getCallerSessionKey(matchedRunId);
      clearSubagentTracking(matchedRunId);
      api.logger.info(`${LOG_PREFIX} Sub-agent announce detected: runId=${matchedRunId} (callerSession=${callerSession ?? 'unknown'})`);

      // Use /hooks/wake to directly inject into main session and trigger heartbeat
      const config = getPluginConfig(api);
      if (config.webhook_bridge_enabled && config.gateway_url && config.hooks_token) {
        void callHooksWake(
          `[System] Sub-agent completed (runId=${matchedRunId}). Process the announce result and continue any pending work.`,
          { gateway_url: config.gateway_url, hooks_token: config.hooks_token },
          api.logger,
        ).then((result) => {
          if (result.ok) {
            api.logger.info(`${LOG_PREFIX} Wake triggered after sub-agent announce: runId=${matchedRunId}`);
          } else {
            api.logger.warn(`${LOG_PREFIX} Wake after announce failed: ${result.error ?? `status ${result.status}`}`);
          }
        });
      }
    },
    { priority: 100 },
  );
}

export { extractSpawnResult };
