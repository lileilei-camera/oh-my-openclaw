import type { OpenClawPluginApi } from '../types.js';
import { LOG_PREFIX } from '../constants.js';
import { setActiveMode, resetMode } from '../hooks/mode-switch/mode-state.js';
import { listModes, isValidMode, ModeId } from '../hooks/mode-switch/mode-registry.js';
import { homedir } from 'os';
import { join, resolve } from 'path';

/**
 * Extract agent ID from sessionKey (e.g., "agent:coder:feishu:direct:..." → "coder")
 */
function extractAgentIdFromSessionKey(sessionKey: string | undefined): string | undefined {
  if (!sessionKey) return undefined;
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match ? match[1] : undefined;
}

/**
 * Resolve workspace directory for a given agent ID.
 * Mirrors the pattern from persona-commands.ts.
 */
function resolveWorkspaceForAgent(ctx: any): string | undefined {
  const sessionKey = ctx.sessionKey as string | undefined;
  const agentId = extractAgentIdFromSessionKey(sessionKey);

  if (!agentId) {
    return undefined;
  }

  const agentsList = ctx.config?.agents?.list as Array<{ id: string; workspace?: string }> | undefined;
  if (agentsList) {
    const agentConfig = agentsList.find((agent) => agent.id === agentId);
    if (agentConfig?.workspace) {
      const workspace = agentConfig.workspace;
      if (workspace.startsWith('~')) {
        return join(homedir(), workspace.slice(1));
      }
      return resolve(workspace);
    }
  }

  if (agentId !== 'main' && agentId !== 'default') {
    return join(homedir(), '.openclaw', `workspace-${agentId}`);
  }

  return join(homedir(), '.openclaw', 'workspace');
}

export function registerModeCommands(api: OpenClawPluginApi) {
  api.registerCommand({
    name: 'omoc_mode',
    description: 'Activate, switch, or list omoc modes',
    acceptsArgs: true,
    handler: async (ctx: { args?: string; sessionKey?: string }) => {
      const argsRaw = (ctx.args ?? '').trim();
      const workspaceDir = resolveWorkspaceForAgent(ctx);

      if (!argsRaw) {
        // Show current mode
        const { getActiveModeSync } = await import('../hooks/mode-switch/mode-state.js');
        const currentMode = getActiveModeSync(workspaceDir);
        return {
          text: currentMode
            ? `# OmOC Mode\n\nCurrent mode: **${currentMode}**\n\nUse \`/omoc_mode list\` to see available modes, or \`/omoc_mode <name>\` to switch.`
            : '# OmOC Mode\n\nNo mode is currently active.\n\nUse `/omoc_mode list` to see available modes.',
        };
      }

      if (argsRaw.toLowerCase() === 'off') {
        await resetMode(workspaceDir);
        return {
          text: '# OmOC Mode: OFF\n\nMode injection deactivated. System prompt will not include mode context.',
        };
      }

      if (argsRaw.toLowerCase() === 'list') {
        const { getActiveModeSync } = await import('../hooks/mode-switch/mode-state.js');
        const currentMode = getActiveModeSync(workspaceDir);
        const modes = listModes();
        const lines = modes.map((m) => {
          const active = m.id === currentMode ? ' ← **active**' : '';
          return `| \`${m.id}\` | ${m.label} | ${m.description} |${active}`;
        });

        return {
          text: [
            '# OmOC Modes',
            '',
            `**Active**: ${currentMode ? `**${currentMode}**` : '_none_'}`,
            '',
            '| Command | Label | Description |',
            '|---------|-------|-------------|',
            ...lines,
            '',
            'Usage: `/omoc_mode <name>` — e.g., `/omoc_mode coding`',
          ].join('\n'),
        };
      }

      // args 可能包含 "mode 后续描述"（如 "coding 帮我分析这个文件"）
      // 需要从 args 中分离 mode 和后续描述
      const parts = argsRaw.split(/\s+/);
      const modeName = parts[0].toLowerCase();
      const remainingText = parts.length > 1 ? parts.slice(1).join(' ') : '';

      if (!isValidMode(modeName)) {
        const modes = listModes();
        const available = modes.map((m) => `\`${m.id}\``).join(', ');
        return {
          text: `# Unknown Mode: "${modeName}"\n\nAvailable modes: ${available}\n\nUse \`/omoc_mode list\` for details.`,
        };
      }

      await setActiveMode(modeName as ModeId, workspaceDir);
      api.logger.info(`${LOG_PREFIX} Mode switched to ${modeName}`);

      // continueAgent: true 触发 agent turn（Gateway 设计：必须用这个才能触发 agent）
      // 注意：continueAgent: true 时 reply 会被 Gateway 丢弃
      // 所以 mode 切换确认由 agent 在回复中自然带上，不需要单独回复
      return {
        continueAgent: true,
      };
    },
  });
}
