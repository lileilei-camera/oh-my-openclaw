import type {
  OpenClawPluginApi,
  PluginHookBeforePromptBuildEvent,
  PluginHookBeforePromptBuildResult,
} from '../../types.js';
import { LOG_PREFIX } from '../../constants.js';
import { getModeMessage, getModeLabel, isValidMode, ModeId } from './mode-registry.js';
import { getActiveModeSync, resetModeSync } from './mode-state.js';
import { OFF_MARKER, getActivePersonaSync } from '../../utils/persona-state.js';
import { listPersonas } from '../../agents/persona-prompts.js';
import { resolveOpenClawWorkspaceDir } from '../../utils/paths.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
      const lines: string[] = [
        `━━━ 🔔 当前模式：${label} ━━━`,
        `你现在处于 **${label}** 模式，${label} 模式的规则我已经发给你，按照规则执行任务。`,
        `如果你看不到规则，停下来告诉我。`,
      ];

      // Add persona context — read from disk (sync, same as mode)
      const ws = resolveOpenClawWorkspaceDir(workspaceDir);
      const personaFile = join(ws, '.omoc-state', 'active-persona');
      let activePersona = getActivePersonaSync();
      if (!activePersona && existsSync(personaFile)) {
        try {
          const raw = readFileSync(personaFile, 'utf-8').trim();
          if (raw && raw !== OFF_MARKER) activePersona = raw;
        } catch { /* ignore */ }
      }
      if (activePersona) {
        const personas = listPersonas();
        const info = personas.find((p) => p.id === activePersona);
        if (info) {
          lines.push(
            '',
            `━━━ 🎭 当前角色：${info.displayName}（${info.descriptionCn}）━━━`,
            `你当前扮演 **${info.displayName}**，该角色的规则已注入到系统上下文，按照角色规则执行任务。`,
          );
        }
      }

      const appendGuidance = lines.join('\n');

      // start-work 是一次性模式：注入后立即关闭
      if (mode === 'start-work') {
        resetModeSync(workspaceDir);
      }

      api.logger.info(`${LOG_PREFIX} before_prompt_build [${sessionKey.substring(0, 16)}…]: mode=${mode}`);

      return { prependContext: message, appendContext: appendGuidance };
    },
    { priority: 75 },
  );
}
