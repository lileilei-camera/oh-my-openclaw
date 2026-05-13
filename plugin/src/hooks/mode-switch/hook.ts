import type {
  OpenClawPluginApi,
  PluginHookBeforePromptBuildEvent,
  PluginHookBeforePromptBuildResult,
} from '../../types.js';
import { LOG_PREFIX } from '../../constants.js';
import { getModeMessage, getModeLabel, isValidMode, ModeId } from './mode-registry.js';
import { getActiveModeSync, resetModeSync } from './mode-state.js';

/**
 * Mode switch hook — reads .omoc-state/active_mode and injects mode context.
 */
export function registerModeSwitch(api: OpenClawPluginApi): void {
  api.on(
    'before_prompt_build',
    (event: PluginHookBeforePromptBuildEvent, ctx: { sessionKey?: string }): PluginHookBeforePromptBuildResult | void => {
      const sessionKey = ctx.sessionKey;
      if (!sessionKey) return;

      const mode = getActiveModeSync();
      if (!mode || mode === 'off') return;

      if (!isValidMode(mode)) return;

      const message = getModeMessage(mode as ModeId);
      if (!message) return;

      const label = getModeLabel(mode as ModeId);
      const appendGuidance = `你现在处于 **${label}** 模式，请严格按照 ${label} 模式的规则执行。`;

      // start-work 是一次性模式：注入后立即关闭
      if (mode === 'start-work') {
        resetModeSync();
      }

      api.logger.info(`${LOG_PREFIX} before_prompt_build [${sessionKey.substring(0, 16)}…]: mode=${mode}`);

      return { prependContext: message, appendContext: appendGuidance };
    },
    { priority: 75 },
  );
}
