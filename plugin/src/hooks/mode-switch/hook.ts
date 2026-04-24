import type {
  OpenClawPluginApi,
  PluginHookBeforePromptBuildEvent,
  PluginHookBeforePromptBuildResult,
} from '../../types.js';
import { LOG_PREFIX } from '../../constants.js';
import { getModeMessage, isValidMode } from './mode-registry.js';
import { getActiveModeSync } from './mode-state.js';

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

      const message = getModeMessage(mode);
      if (!message) return;

      api.logger.info(`${LOG_PREFIX} before_prompt_build [${sessionKey.substring(0, 16)}…]: mode=${mode}`);

      return { prependContext: message };
    },
    { priority: 75 },
  );
}
