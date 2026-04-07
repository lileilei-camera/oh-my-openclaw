import type { OpenClawPluginApi } from '../types.js';
import { LOG_PREFIX } from '../constants.js';
import { getActivePersona, setActivePersonaId, resetPersonaState, replaceAgentsMd, restoreAgentsMdToDefault } from '../utils/persona-state.js';
import { resolvePersonaId, listPersonas, readPersonaPrompt, DEFAULT_PERSONA_ID } from '../agents/persona-prompts.js';
import { homedir } from 'os';
import { join, resolve } from 'path';

function getDisplayName(personaId: string): string {
  const persona = listPersonas().find((p) => p.id === personaId);
  return persona ? `${persona.emoji} ${persona.displayName}` : personaId;
}

/**
 * Extract agent ID from sessionKey (e.g., "agent:coder:feishu:direct:..." → "coder")
 */
function extractAgentIdFromSessionKey(sessionKey: string | undefined): string | undefined {
  if (!sessionKey) return undefined;
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match ? match[1] : undefined;
}

/**
 * Resolve workspace directory for a given agent ID by looking up the agent configuration.
 * This is the general solution - no hardcoding of agent names.
 */
function resolveWorkspaceForAgent(ctx: any): string | undefined {
  const sessionKey = ctx.sessionKey as string | undefined;
  const agentId = extractAgentIdFromSessionKey(sessionKey);
  
  if (!agentId) {
    // Fallback to OPENCLAW_PROFILE env var or default workspace
    return undefined;
  }
  
  // Look up agent in ctx.config.agents.list
  const agentsList = ctx.config?.agents?.list as Array<{ id: string; workspace?: string }> | undefined;
  if (agentsList) {
    const agentConfig = agentsList.find((agent) => agent.id === agentId);
    if (agentConfig?.workspace) {
      // Resolve ~ to home directory
      const workspace = agentConfig.workspace;
      if (workspace.startsWith('~')) {
        return join(homedir(), workspace.slice(1));
      }
      return resolve(workspace);
    }
  }
  
  // Fallback: construct workspace name from agent ID (convention-based)
  // e.g., agentId "coder" → ~/.openclaw/workspace-coder
  if (agentId !== 'main' && agentId !== 'default') {
    return join(homedir(), '.openclaw', `workspace-${agentId}`);
  }
  
  // Default workspace for main agent
  return join(homedir(), '.openclaw', 'workspace');
}

export function registerPersonaCommands(api: OpenClawPluginApi) {
  api.registerCommand({
    name: 'omoc',
    description: 'OmOC mode — activate, switch, or list personas',
    acceptsArgs: true,
    handler: async (ctx: { args?: string; sessionKey?: string }) => {
       api.logger.info(`${LOG_PREFIX} /omoc command received — raw ctx.args: ${JSON.stringify(ctx.args)}, ctx keys: ${JSON.stringify(Object.keys(ctx))}`);
       const args = (ctx.args ?? '').trim().toLowerCase();
       api.logger.info(`${LOG_PREFIX} Parsed args: "${args}" (length: ${args.length})`);
       
       // Log context for debugging
       const agentId = extractAgentIdFromSessionKey(ctx.sessionKey);
       api.logger.info(`${LOG_PREFIX} Extracted agentId from sessionKey: ${agentId}`);
       api.logger.info(`${LOG_PREFIX} Command ctx.sessionKey: ${ctx.sessionKey}`);
       
       // Resolve workspace directory using general method
       const workspaceDir = resolveWorkspaceForAgent(ctx);
       api.logger.info(`${LOG_PREFIX} Resolved workspaceDir: ${workspaceDir}`);

      if (!args) {
        const previousId = await getActivePersona(workspaceDir);
        await setActivePersonaId(DEFAULT_PERSONA_ID, workspaceDir);
        const content = await readPersonaPrompt(DEFAULT_PERSONA_ID);
        await replaceAgentsMd(content, workspaceDir);
        const name = getDisplayName(DEFAULT_PERSONA_ID);

        const switchNote =
          previousId && previousId !== DEFAULT_PERSONA_ID
            ? `\n\nSwitched from **${getDisplayName(previousId)}**.`
            : '';

        return {
          text: `# OmOC Mode: ON\n\nActive persona: **${name}**${switchNote}\n\nAGENTS.md replaced with persona prompt. Your next message will use this persona.\n\nUse \`/omoc list\` to see available personas, or \`/omoc <name>\` to switch.`,
        };
      }

      if (args === 'off') {
        const wasActive = await getActivePersona(workspaceDir);
        const wasName = wasActive ? getDisplayName(wasActive) : null;
        await resetPersonaState(workspaceDir);
        await restoreAgentsMdToDefault(workspaceDir);
        return {
          text: wasName
            ? `# OmOC Mode: OFF\n\nPersona **${wasName}** deactivated. AGENTS.md restored to default.`
            : '# OmOC Mode: OFF\n\nNo persona was active. AGENTS.md restored to default.',
        };
      }

      if (args === 'list') {
        const personas = listPersonas();
        const activeId = await getActivePersona(workspaceDir);
        const lines = personas.map((p) => {
          const active = p.id === activeId ? ' ← **active**' : '';
          return `| ${p.emoji} | \`${p.shortName}\` | ${p.displayName} | ${p.descriptionCn} | \`${p.model}\` |${active}`;
        });

        return {
          text: [
            '# OmOC Personas',
            '',
            `**Active**: ${activeId ? `**${getDisplayName(activeId)}**` : '_none_'}`,
            '',
            '| | Command | Name | 描述 | 模型 |',
            '|---|---------|------|------|------|',
            ...lines,
            '',
            'Usage: `/omoc <command>` — e.g., `/omoc prometheus`',
          ].join('\n'),
        };
      }

      const resolvedId = resolvePersonaId(args);
      if (!resolvedId) {
        const personas = listPersonas();
        const available = personas.map((p) => `\`${p.shortName}\``).join(', ');
        return {
          text: `# Unknown Persona: "${args}"\n\nAvailable personas: ${available}\n\nUse \`/omoc list\` for details.`,
        };
      }

      const previousId = await getActivePersona(workspaceDir);
      await setActivePersonaId(resolvedId, workspaceDir);
      const content = await readPersonaPrompt(resolvedId);
      await replaceAgentsMd(content, workspaceDir);
      const displayName = getDisplayName(resolvedId);
      const switched = listPersonas().find((p) => p.id === resolvedId);

      const switchNote =
        previousId && previousId !== resolvedId
          ? `\n\nSwitched from **${getDisplayName(previousId)}**.`
          : '';

      return {
        text: `# Persona Switched\n\nActive persona: **${displayName}**${switchNote}\n\nAGENTS.md replaced. Your next message will use the ${switched?.theme ?? 'persona'} prompt.`,
      };
    },
  });
}
