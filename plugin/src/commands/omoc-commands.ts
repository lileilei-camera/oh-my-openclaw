/**
 * Unified /omoc command
 *
 * Replaces the previous /omoc, /omoc_mode, /omoc_init with a single entry point.
 * Subcommands are dispatched by the first argument.
 *
 * Usage:
 *   /omoc                        → activate default persona
 *   /omoc person <name>          → switch persona
 *   /omoc person list            → list personas
 *   /omoc person off             → deactivate persona
 *   /omoc mode <name>            → switch mode
 *   /omoc mode list              → list modes
 *   /omoc mode off               → deactivate mode
 *   /omoc init <dir> <name>      → initialize project
 *   /omoc add <name> <path>      → add agent.md to project
 *   /omoc delete <name> [file]   → delete project or agent.md
 *   /omoc list                   → list projects
 *   /omoc set-active <name>      → activate project
 *   /omoc off                    → deactivate persona/project/mode
 *   /omoc status                 → view status
 *   /omoc start-work             → start work mode
 */

import type { OpenClawPluginApi } from '../types.js';
import { LOG_PREFIX } from '../constants.js';
import { join, resolve, isAbsolute } from 'path';
import { existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import * as os from 'os';

// ── Persona imports ──────────────────────────────────────────────────────────
import { getActivePersona, setActivePersonaId, resetPersonaState } from '../utils/persona-state.js';
import { resolvePersonaId, listPersonas, DEFAULT_PERSONA_ID } from '../agents/persona-prompts.js';

// ── Mode imports ─────────────────────────────────────────────────────────────
import { setActiveMode, resetMode } from '../hooks/mode-switch/mode-state.js';
import { listModes, isValidMode, ModeId } from '../hooks/mode-switch/mode-registry.js';
import { getActiveModeSync } from '../hooks/mode-switch/mode-state.js';

// ── Project/Init imports ─────────────────────────────────────────────────────
import {
  addProject,
  addAgentMdToProject,
  removeProject,
  removeAgentMdFromProject,
  findProjectByName,
  findProjectByPath,
  setActiveProject,
  setPendingInit,
  getActiveProject,
  readState,
} from '../hooks/project-init/project-state.js';

// ── Shared helpers ───────────────────────────────────────────────────────────

function extractAgentIdFromSessionKey(sessionKey: string | undefined): string | undefined {
  if (!sessionKey) return undefined;
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match ? match[1] : undefined;
}

function resolveWorkspaceDir(ctx: { args?: string; sessionKey?: string; config?: Record<string, unknown> }): string | undefined {
  const agentId = extractAgentIdFromSessionKey(ctx.sessionKey);
  if (!agentId) return undefined;

  const config = ctx.config as Record<string, any> | undefined;
  if (config) {
    const agentsList = config?.agents?.list as Array<{ id: string; workspace?: string }> | undefined;
    if (agentsList) {
      const agentConfig = agentsList.find((a) => a.id === agentId);
      if (agentConfig?.workspace) {
        const w = agentConfig.workspace;
        return w.startsWith('~') ? join(os.homedir(), w.slice(1)) : resolve(w);
      }
    }
    const defaultWorkspace = config.workspace as string | undefined;
    if (defaultWorkspace) return defaultWorkspace;
  }

  if (agentId !== 'main' && agentId !== 'default') {
    return join(os.homedir(), '.openclaw', `workspace-${agentId}`);
  }
  return join(os.homedir(), '.openclaw', 'workspace');
}

function expandPath(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    const home = os.homedir() || process.env.HOME;
    if (!home) throw new Error('Cannot determine home directory');
    return p === '~' ? home : resolve(home, p.slice(2));
  }
  return isAbsolute(p) ? resolve(p) : resolve(process.cwd(), p);
}

function timestamp(): string {
  const d = new Date();
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const eh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const em = String(Math.abs(offset) % 60).padStart(2, '0');
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${sign}${eh}${em}`
  );
}

function personaDisplayName(personaId: string): string {
  const p = listPersonas().find((x) => x.id === personaId);
  return p ? `${p.emoji} ${p.displayName}` : personaId;
}

// ── Subcommand handlers ──────────────────────────────────────────────────────

async function handlePersona(
  api: OpenClawPluginApi,
  workspaceDir: string | undefined,
  subArgs: string[],
): Promise<{ text?: string; continueAgent?: boolean }> {
  const action = (subArgs[0] ?? '').toLowerCase();

  if (!action) {
    // /omoc person — activate default
    const previousId = await getActivePersona(workspaceDir);
    await setActivePersonaId(DEFAULT_PERSONA_ID, workspaceDir);
    const name = personaDisplayName(DEFAULT_PERSONA_ID);
    const switched =
      previousId && previousId !== DEFAULT_PERSONA_ID
        ? `\n\nSwitched from **${personaDisplayName(previousId)}**.`
        : '';
    return {
      text: `# OmOC Persona\n\nActive persona: **${name}**${switched}\n\nUse \`/omoc person list\` to see available personas, or \`/omoc person <name>\` to switch.`,
    };
  }

  if (action === 'list') {
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
        `**Active**: ${activeId ? `**${personaDisplayName(activeId)}**` : '_none_'}`,
        '',
        '| | Command | Name | 描述 | 模型 |',
        '|---|---------|------|------|------|',
        ...lines,
        '',
        'Usage: `/omoc person <name>` — e.g., `/omoc person delegate`',
      ].join('\n'),
    };
  }

  if (action === 'off') {
    const wasActive = await getActivePersona(workspaceDir);
    const wasName = wasActive ? personaDisplayName(wasActive) : null;
    await resetPersonaState(workspaceDir);
    return {
      text: wasName
        ? `# OmOC Persona: OFF\n\nPersona **${wasName}** deactivated.`
        : '# OmOC Persona: OFF\n\nNo persona was active.',
    };
  }

  // /omoc person <name>
  const resolvedId = resolvePersonaId(action);
  if (!resolvedId) {
    const personas = listPersonas();
    const available = personas.map((p) => `\`${p.shortName}\``).join(', ');
    return {
      text: `# Unknown Persona: "${action}"\n\nAvailable personas: ${available}`,
    };
  }

  const previousId = await getActivePersona(workspaceDir);
  await setActivePersonaId(resolvedId, workspaceDir);
  const switched =
    previousId && previousId !== resolvedId
      ? `\n\nSwitched from **${personaDisplayName(previousId)}**.`
      : '';
  return {
    text: `# Persona Switched\n\nActive persona: **${personaDisplayName(resolvedId)}**${switched}`,
  };
}

async function handleMode(
  api: OpenClawPluginApi,
  workspaceDir: string | undefined,
  subArgs: string[],
): Promise<{ text?: string; continueAgent?: boolean }> {
  const action = (subArgs[0] ?? '').toLowerCase();

  if (!action) {
    const currentMode = getActiveModeSync(workspaceDir);
    return {
      text: currentMode
        ? `# OmOC Mode\n\nCurrent mode: **${currentMode}**\n\nUse \`/omoc mode list\` to see available modes, or \`/omoc mode <name>\` to switch.`
        : '# OmOC Mode\n\nNo mode is currently active.\n\nUse `/omoc mode list` to see available modes.',
    };
  }

  if (action === 'list') {
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
        'Usage: `/omoc mode <name>` — e.g., `/omoc mode coding`',
      ].join('\n'),
    };
  }

  if (action === 'off') {
    await resetMode(workspaceDir);
    return {
      text: '# OmOC Mode: OFF\n\nMode injection deactivated.',
    };
  }

  // /omoc mode <name>
  if (!isValidMode(action)) {
    const modes = listModes();
    const available = modes.map((m) => `\`${m.id}\``).join(', ');
    return { text: `# Unknown Mode: "${action}"\n\nAvailable modes: ${available}` };
  }

  await setActiveMode(action as ModeId, workspaceDir);
  api.logger.info(`${LOG_PREFIX} Mode switched to ${action}`);

  // Check if there's a task message after the mode name
  const taskMessage = subArgs.slice(1).join(' ').trim();
  if (taskMessage) {
    // Mode switch + task: let agent continue to execute the task in the new mode
    return { continueAgent: true };
  }
  // Pure mode switch: just confirm, no agent continuation
  return {
    text: `# Mode Switched\n\nActive mode: **${action}**.\n\nSend your next message and the agent will respond in this mode.`,
  };
}

function handleProject(
  api: OpenClawPluginApi,
  workspaceDir: string,
  subArgs: string[],
): { text?: string; continueAgent?: boolean } {
  // Parse: /omoc init <dir> <name>  OR  /omoc <subcommand> ...
  const first = (subArgs[0] ?? '').trim();
  const firstLower = first.toLowerCase();

  if (!first) {
    return {
      text:
        '# OmOC Init\n\n' +
        'Usage:\n' +
        '- `/omoc init <dir> <project-name>` — Initialize a new project\n' +
        '- `/omoc add <project-name> <sub-path-agent-md>` — Add extra agent.md\n' +
        '- `/omoc delete <project-name> [agent-md]` — Remove project or agent.md\n' +
        '- `/omoc list` — List all projects\n' +
        '- `/omoc set-active <project-name>` — Activate a project\n' +
        '- `/omoc off` — Deactivate current project',
    };
  }

  // --- init <dir> <name> ---
  if (firstLower === 'init') {
    const dir = subArgs[1] ? expandPath(subArgs[1]) : '';
    const projectName = subArgs[2]?.trim();

    if (!dir || !projectName) {
      return { text: '⚠️ **Error**: Directory and project name required.\n\nUsage: `/omoc init <dir> <project-name>`' };
    }
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      return { text: `⚠️ **Error**: Directory does not exist: \`${dir}\`` };
    }

    api.logger.info(`[omoc:init] dir=[${dir}] projectName=[${projectName}]`);

    let effectiveName = projectName;
    const existingByPath = findProjectByPath(workspaceDir, dir);
    if (existingByPath) {
      const existingByName = findProjectByName(workspaceDir, projectName);
      if (!existingByName && projectName !== existingByPath.name) {
        effectiveName = projectName;
      } else {
        effectiveName = existingByPath.name;
      }
    }

    if (!findProjectByName(workspaceDir, effectiveName)) {
      addProject(workspaceDir, { name: effectiveName, path: dir, agentMds: ['AGENTS.md'] });
    }
    setActiveProject(workspaceDir, effectiveName);
    setPendingInit(workspaceDir, {
      type: 'init',
      projectName: effectiveName,
      projectPath: dir,
      agentMdFile: 'AGENTS.md',
    });
    return { continueAgent: true };
  }

  // --- add <name> <path> ---
  if (firstLower === 'add') {
    const projectName = subArgs[1]?.trim();
    const subPath = subArgs.slice(2).join(' ').trim();
    if (!projectName || !subPath) {
      return { text: '⚠️ **Error**: Both project name and path required.\n\nUsage: `/omoc add <project-name> <path>`' };
    }
    const project = findProjectByName(workspaceDir, projectName);
    if (!project) {
      return { text: `⚠️ **Error**: Project not found: \`${projectName}\`` };
    }
    let absolutePath = expandPath(subPath);
    if (!existsSync(absolutePath)) {
      return { text: `⚠️ **Error**: Path does not exist: \`${absolutePath}\`` };
    }
    if (statSync(absolutePath).isDirectory()) {
      absolutePath = join(absolutePath, 'AGENTS.md');
    }
    addAgentMdToProject(workspaceDir, projectName, absolutePath);
    setPendingInit(workspaceDir, {
      type: 'add',
      projectName,
      projectPath: project.path,
      agentMdFile: absolutePath,
      subPath: absolutePath,
    });
    return { continueAgent: true };
  }

  // --- delete <name> [agent-md] ---
  if (firstLower === 'delete') {
    const projectName = subArgs[1]?.trim();
    const agentMd = subArgs.slice(2).join(' ').trim();
    if (!projectName) {
      return { text: '⚠️ **Error**: Project name required.\n\nUsage: `/omoc delete <project-name> [agent-md]`' };
    }
    const project = findProjectByName(workspaceDir, projectName);
    if (!project) {
      return { text: `⚠️ **Error**: Project not found: \`${projectName}\`` };
    }
    if (agentMd) {
      const removed = removeAgentMdFromProject(workspaceDir, projectName, agentMd);
      if (!removed) return { text: `⚠️ agent.md not found in project: \`${agentMd}\`` };
      return { text: `✅ Removed \`${agentMd}\` from project \`${projectName}\`.` };
    } else {
      removeProject(workspaceDir, projectName);
      return { text: `✅ Removed project \`${projectName}\`.` };
    }
  }

  // --- list ---
  if (firstLower === 'list') {
    return { text: formatProjectList(workspaceDir) };
  }

  // --- set-active <name> ---
  if (firstLower === 'set-active') {
    const projectName = subArgs[1]?.trim();
    if (!projectName) {
      return { text: '⚠️ **Error**: Project name required.\n\nUsage: `/omoc set-active <project-name>`' };
    }
    const project = findProjectByName(workspaceDir, projectName);
    if (!project) return { text: `⚠️ **Error**: Project not found: \`${projectName}\`` };
    setActiveProject(workspaceDir, projectName);
    return { text: `✅ Activated project: **${projectName}**` };
  }

  // --- off ---
  if (firstLower === 'off') {
    setActiveProject(workspaceDir, null);
    return { text: '✅ Project context injection deactivated.' };
  }

  // Bare <dir> <name> — legacy /omoc_init style
  const dir = expandPath(first);
  const projectName = subArgs[1]?.trim();
  if (projectName && existsSync(dir) && statSync(dir).isDirectory()) {
    let effectiveName = projectName;
    const existingByPath = findProjectByPath(workspaceDir, dir);
    if (existingByPath) {
      const existingByName = findProjectByName(workspaceDir, projectName);
      if (!existingByName && projectName !== existingByPath.name) {
        effectiveName = projectName;
      } else {
        effectiveName = existingByPath.name;
      }
    }
    if (!findProjectByName(workspaceDir, effectiveName)) {
      addProject(workspaceDir, { name: effectiveName, path: dir, agentMds: ['AGENTS.md'] });
    }
    setActiveProject(workspaceDir, effectiveName);
    setPendingInit(workspaceDir, {
      type: 'init',
      projectName: effectiveName,
      projectPath: dir,
      agentMdFile: 'AGENTS.md',
    });
    return { continueAgent: true };
  }

  return { text: '⚠️ Unknown subcommand. Use `/omoc` for usage.' };
}

function formatProjectList(workspaceDir: string): string {
  const state = readState(workspaceDir);
  if (!state.projects.length) return 'No projects registered yet.';

  const lines: string[] = ['# Registered Projects', ''];
  if (state.active) {
    const activeProject = state.projects.find((p) => p.name === state.active);
    if (activeProject) {
      lines.push(`🟢 **Active**: **${activeProject.name}** (\`${activeProject.path}\`)`);
      lines.push('');
    }
  } else {
    lines.push('⚪ No active project set.');
    lines.push('');
  }

  const sorted = [...state.projects].sort((a, b) => {
    if (a.name === state.active && b.name !== state.active) return -1;
    if (a.name !== state.active && b.name === state.active) return 1;
    return 0;
  });

  lines.push('| # | Name | Path | Active |');
  lines.push('|---|------|------|--------|');
  sorted.forEach((p, i) => {
    const isActive = p.name === state.active ? '✅ **Yes**' : 'No';
    lines.push(`| ${i + 1} | **${p.name}**${p.name === state.active ? ' 🟢' : ''} | \`${p.path}\` | ${isActive} |`);
  });

  return lines.join('\n');
}

// ── Main registration ────────────────────────────────────────────────────────

export function registerOmocCommands(api: OpenClawPluginApi) {
  api.registerCommand({
    name: 'omoc',
    description: 'OmOC unified command — persona, mode, init, and project management',
    acceptsArgs: true,
    handler: async (ctx: { args?: string; sessionKey?: string; config?: Record<string, unknown> }) => {
      api.logger.info(`${LOG_PREFIX} /omoc received — args: ${JSON.stringify(ctx.args)}`);

      const argsRaw = (ctx.args ?? '').trim();
      const workspaceDir = resolveWorkspaceDir(ctx);

      if (!argsRaw) {
        return handleHelp();
      }

      const parts = argsRaw.split(/\s+/);
      const first = parts[0].toLowerCase();
      const rest = parts.slice(1);

      // ── Dispatch by first argument ───────────────────────────────────────

      // Person / persona subcommand
      if (first === 'person' || first === 'persona' || first === 'personas') {
        return handlePersona(api, workspaceDir, rest);
      }

      // Mode subcommand
      if (first === 'mode' || first === 'modes') {
        return handleMode(api, workspaceDir, rest);
      }

      // Init / project subcommands
      if (first === 'init' || first === 'project' || first === 'projects' ||
          first === 'add' || first === 'delete' ||
          first === 'list' || first === 'set-active' || first === 'off') {
        if (!workspaceDir) {
          api.logger.warn('[omoc] Cannot resolve workspaceDir');
          return { text: '⚠️ **Error**: Cannot determine workspace directory.' };
        }
        api.logger.info(`[omoc] workspaceDir=[${workspaceDir}]`);
        return handleProject(api, workspaceDir, parts);
      }

      // start-work alias
      if (first === 'start-work' || first === 'start_work' || first === 'startwork') {
        if (!workspaceDir) {
          return { text: '⚠️ **Error**: Cannot determine workspace directory.' };
        }
        await setActiveMode('start-work', workspaceDir);
        api.logger.info(`${LOG_PREFIX} /omoc start-work triggered`);
        return { continueAgent: true };
      }

      // dump
      if (first === 'dump') {
        if (!workspaceDir) {
          return { text: '⚠️ **Error**: Cannot determine workspace directory.' };
        }
        const dumpOutPath = rest[0]
          ? expandPath(rest[0])
          : join(workspaceDir, '.omoc-dumps', `llm-input-${timestamp()}.json`);

        const stateDir = join(workspaceDir, '.omoc-state');
        if (!existsSync(stateDir)) {
          mkdirSync(stateDir, { recursive: true });
        }
        writeFileSync(join(stateDir, 'dump_next_turn'), dumpOutPath, 'utf-8');
        api.logger.info(`${LOG_PREFIX} [dump] Flag set → ${dumpOutPath}`);
        return {
          text: `📦 已设置 dump 标志，**下次发送消息时**将 dump 完整上下文到:\n\`${dumpOutPath}\``,
          continueAgent: false,
        };
      }

      // help
      if (first === 'help' || first === 'h' || first === '-h' || first === '--help') {
        return handleHelp();
      }

      // /plan alias → omoc mode plan
      if (first === 'plan') {
        return handleMode(api, workspaceDir, ['plan']);
      }

      // status alias
      if (first === 'status') {
        return handleStatus(api, workspaceDir);
      }

      // Legacy fallback: try persona first, then mode
      // This maintains backward compatibility with `/omoc <persona-name>`
      const resolvedPersona = resolvePersonaId(first);
      if (resolvedPersona) {
        const previousId = await getActivePersona(workspaceDir);
        await setActivePersonaId(resolvedPersona, workspaceDir);
        const switched =
          previousId && previousId !== resolvedPersona
            ? `\n\nSwitched from **${personaDisplayName(previousId)}**.`
            : '';
        return {
          text: `# Persona Switched\n\nActive persona: **${personaDisplayName(resolvedPersona)}**${switched}`,
        };
      }

      // Unknown
      return {
        text:
          '# OmOC Unified Command\n\n' +
          `Unknown subcommand: \`${first}\`\n\n` +
          'Usage:\n' +
          '- `/omoc person <name>` — Switch persona\n' +
          '- `/omoc person list` — List personas\n' +
          '- `/omoc person off` — Deactivate persona\n' +
          '- `/omoc mode <name>` — Switch mode\n' +
          '- `/omoc mode list` — List modes\n' +
          '- `/omoc mode off` — Deactivate mode\n' +
          '- `/omoc init <dir> <name>` — Initialize project\n' +
          '- `/omoc add <name> <path>` — Add agent.md\n' +
          '- `/omoc delete <name>` — Remove project\n' +
          '- `/omoc list` — List projects\n' +
          '- `/omoc set-active <name>` — Activate project\n' +
          '- `/omoc off` — Deactivate project\n' +
          '- `/omoc start-work` — Start work mode\n' +
          '- `/omoc status` — View status',
      };
    },
  });

  // ── Backward compatibility aliases ─────────────────────────────────────
  // These forward to the unified handler so old slash commands still work.

  api.registerCommand({
    name: 'omoc_mode',
    description: 'Activate, switch, or list omoc modes (alias for /omoc mode)',
    acceptsArgs: true,
    handler: async (ctx: { args?: string; sessionKey?: string; config?: Record<string, unknown> }) => {
      const workspaceDir = resolveWorkspaceDir(ctx);
      const argsRaw = (ctx.args ?? '').trim();
      const parts = argsRaw ? argsRaw.split(/\s+/) : [];
      return handleMode(api, workspaceDir, parts);
    },
  });

  api.registerCommand({
    name: 'omoc_init',
    description: 'Initialize or manage project agent.md files (alias for /omoc init)',
    acceptsArgs: true,
    handler: async (ctx: { args?: string; sessionKey?: string; config?: Record<string, unknown> }) => {
      const workspaceDir = resolveWorkspaceDir(ctx);
      if (!workspaceDir) {
        api.logger.warn('[omoc_init] Cannot resolve workspaceDir');
        return { text: '⚠️ **Error**: Cannot determine workspace directory.' };
      }
      const argsRaw = (ctx.args ?? '').trim();
      const parts = argsRaw ? argsRaw.split(/\s+/) : [];
      return handleProject(api, workspaceDir, parts);
    },
  });

  // /start-work legacy alias
  api.registerCommand({
    name: 'start-work',
    description: 'Start work mode (alias for /omoc start-work)',
    acceptsArgs: true,
    handler: async (ctx: { args?: string; sessionKey?: string; config?: Record<string, unknown> }) => {
      const workspaceDir = resolveWorkspaceDir(ctx);
      if (!workspaceDir) {
        return { text: '⚠️ **Error**: Cannot determine workspace directory.' };
      }
      await setActiveMode('start-work', workspaceDir);
      api.logger.info(`${LOG_PREFIX} /start-work triggered`);
      return { continueAgent: true };
    },
  });

  // /plan alias → /omoc mode plan
  api.registerCommand({
    name: 'plan',
    description: 'Enter planning mode (alias for /omoc mode plan)',
    acceptsArgs: true,
    handler: async (ctx: { args?: string; sessionKey?: string; config?: Record<string, unknown> }) => {
      const workspaceDir = resolveWorkspaceDir(ctx);
      if (!workspaceDir) {
        return { text: '⚠️ **Error**: Cannot determine workspace directory.' };
      }
      await setActiveMode('plan', workspaceDir);
      api.logger.info(`${LOG_PREFIX} /plan triggered`);
      return { continueAgent: true };
    },
  });
}

function handleHelp(): { text: string } {
  return {
    text:
      '# OmOC Help\n\n' +
      '## Persona\n' +
      '- `/omoc person <name>` — Switch to a persona\n' +
      '- `/omoc person list` — List available personas\n' +
      '- `/omoc person off` — Deactivate persona\n' +
      '- `/omoc` — Activate default persona\n\n' +
      '## Mode\n' +
      '- `/omoc mode <name>` — Switch to a mode\n' +
      '- `/omoc mode list` — List available modes\n' +
      '- `/omoc mode off` — Deactivate mode\n' +
      '- `/omoc start-work` — Start work mode\n\n' +
      '## Project\n' +
      '- `/omoc init <dir> <name>` — Initialize a new project\n' +
      '- `/omoc add <name> <path>` — Add agent.md to project\n' +
      '- `/omoc delete <name> [file]` — Remove project or agent.md\n' +
      '- `/omoc list` — List registered projects\n' +
      '- `/omoc set-active <name>` — Activate a project\n' +
      '- `/omoc off` — Deactivate project context\n\n' +
      '## Debug\n' +
      '- `/omoc dump [path]` — Dump LLM input to file on next turn\n\n' +
      '## Other\n' +
      '- `/omoc status` — View current persona & mode\n' +
      '- `/omoc help` — Show this help\n\n' +
      '## Aliases\n' +
      '`/omoc_mode` → `/omoc mode` · `/omoc_init` → `/omoc init` · `/start-work` → `/omoc start-work` · `/plan` → `/omoc mode plan`\n\n' +
      '## Related Commands\n' +
      '- `/omoc_ralph_loop` — Start the Ralph Loop self-completion mechanism\n' +
      '- `/omoc_ralph_stop` — Stop the active Ralph Loop\n' +
      '- `/omoc_todos` — Show current todo list'
  };
}

async function handleStatus(
  _api: OpenClawPluginApi,
  workspaceDir: string | undefined,
): Promise<{ text?: string }> {
  const personaActive = await getActivePersona(workspaceDir);
  const modeActive = getActiveModeSync(workspaceDir);
  const projectActive = workspaceDir ? getActiveProject(workspaceDir) : null;
  const personaName = personaActive ? personaDisplayName(personaActive) : 'none';
  const modeName = modeActive || 'none';
  const projectName = projectActive ? projectActive.name : 'none';

  return {
    text:
      '# OmOC Status\n\n' +
      `| Feature | Status |\n|---------|--------|\n` +
      `| Persona | **${personaName}** |\n` +
      `| Mode | **${modeName}** |\n` +
      `| Project | **${projectName}** |\n`,
  };
}
