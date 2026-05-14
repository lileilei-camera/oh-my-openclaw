import type {
  OpenClawPluginApi,
  PluginHookBeforePromptBuildEvent,
  PluginHookBeforePromptBuildResult,
} from '../../types.js';
import { LOG_PREFIX } from '../../constants.js';
import { getModeMessage, getModeLabel, isValidMode, ModeId } from './mode-registry.js';
import { getActiveModeSync, resetModeSync } from './mode-state.js';

/*
 * Mode switch hook — reads .omoc-state/active_mode and injects mode context.
 */
export function registerModeSwitch(api: OpenClawPluginApi): void {
  api.on(
    'before_prompt_build',
    (event: PluginHookBeforePromptBuildEvent, ctx: { sessionKey?: string }): PluginHookBeforePromptBuildResult | void => {
      const sessionKey = ctx.sessionKey;
      if (!sessionKey) return;

      // Debug: log event context keys
      api.logger.info(`${LOG_PREFIX} [DEBUG] before_prompt_build sessionKey=${sessionKey}, ctxKeys=${Object.keys(ctx).join(',')}, eventCtxKeys=${event.context ? Object.keys(event.context).join(',') : 'none'}`);

      // Get workspaceDir from event context or fallback to ctx
      const workspaceDir = (event as any).context?.workspaceDir || (ctx as any).workspaceDir;
      const mode = getActiveModeSync(workspaceDir);
      if (!mode || mode === 'off') return;

      if (!isValidMode(mode)) return;

      const message = getModeMessage(mode as ModeId);
      if (!message) return;

      const label = getModeLabel(mode as ModeId);
      const appendGuidance = `你现在处于 **${label}** 模式,${label} 模式的规则我已经发给你，按照规则执行任务，如果你看不到规则，停下来告诉我。`;

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
