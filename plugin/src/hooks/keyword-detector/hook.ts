import type {
  OpenClawPluginApi,
  PluginHookBeforePromptBuildEvent,
  PluginHookBeforePromptBuildResult,
} from '../../types.js';
import { LOG_PREFIX } from '../../constants.js';
import { detectKeywords, WORKFLOW_PERSONA_MAP } from './detector.js';
import { setActivePersonaId, getActivePersonaSync } from '../../utils/persona-state.js';

/**
 * Keyword detector — simplified version.
 * 
 * Uses ONLY `before_prompt_build` hook because:
 * - event.prompt = raw user message (verified via gateway logs)
 * - ctx.sessionKey = session identifier (available in this hook)
 * 
 * No need for message_received, session_start, session_end,
 * session store lookups, or Map-based caching.
 */
export function registerKeywordDetector(api: OpenClawPluginApi): void {
  api.on(
    'before_prompt_build',
    (event: PluginHookBeforePromptBuildEvent, ctx: { sessionKey?: string }): PluginHookBeforePromptBuildResult | void => {
      const sessionKey = ctx.sessionKey;
      if (!sessionKey) return;

      const userMessage = event.prompt?.trim();
      if (!userMessage) return;

      const currentPersona = getActivePersonaSync();
      const detected = detectKeywords(userMessage, currentPersona);
      if (detected.length === 0) return;

      const merged = detected.map((k) => k.message).join('\n\n');

      api.logger.info(`${LOG_PREFIX} before_prompt_build [${sessionKey.substring(0, 16)}…]: "${userMessage.substring(0, 80)}"`);
      api.logger.info(`${LOG_PREFIX} Keyword detected: ${detected.map((k) => k.type).join(', ')}`);

      // Switch persona if a workflow keyword was matched
      const workflowHit = detected.find((k) => k.type in WORKFLOW_PERSONA_MAP);
      if (workflowHit) {
        const personaId = WORKFLOW_PERSONA_MAP[workflowHit.type]!;
        setActivePersonaId(personaId)
          .then(() => api.logger.info(`${LOG_PREFIX} Persona switched to ${personaId}`))
          .catch((err) => api.logger.error(`${LOG_PREFIX} Persona switch failed`, err));
      }

      return { prependContext: merged };
    },
    { priority: 75 },
  );
}
