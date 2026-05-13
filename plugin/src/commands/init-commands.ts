import type { OpenClawPluginApi } from '../types.js';
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
import { existsSync, statSync } from 'fs';
import { resolve, join, isAbsolute } from 'path';
import * as os from 'os';

interface CommandCtx {
  args?: string;
  sessionKey?: string;
  config?: Record<string, unknown>;
}

/**
 * Resolve workspaceDir from command context.
 * Command ctx doesn't have workspaceDir, so we extract agentId from sessionKey
 * and look up the workspace from config.
 */
function resolveWorkspaceDir(ctx: CommandCtx): string | null {
  const config = ctx.config as Record<string, unknown> | undefined;

  // Extract agentId from sessionKey (format: agent:<agentId>:...)
  let agentId: string | undefined;
  if (ctx.sessionKey) {
    const parts = ctx.sessionKey.split(':');
    if (parts.length >= 2 && parts[0] === 'agent') {
      agentId = parts[1];
    }
  }

  if (agentId && config) {
    const agents = config.agents as { list?: Array<Record<string, unknown>> } | undefined;
    if (agents?.list) {
      const agent = agents.list.find((a) => a.id === agentId);
      if (agent?.workspace) {
        return agent.workspace as string;
      }
    }
    // Fallback to default workspace
    const defaultWorkspace = config.workspace as string | undefined;
    if (defaultWorkspace) return defaultWorkspace;
  }

  // Last resort: derive from agentId
  if (agentId) {
    const home = os.homedir();
    if (agentId === 'main') {
      return join(home, '.openclaw', 'workspace');
    }
    return join(home, '.openclaw', `workspace-${agentId}`);
  }

  return null;
}

/**
 * Resolve a path, expanding ~ to home directory.
 * Handles: absolute paths, ~/..., and relative paths.
 */
function expandPath(p: string): string {
  if (p.startsWith('~/')) {
    const home = os.homedir() || process.env.HOME;
    if (!home) throw new Error('Cannot determine home directory');
    return resolve(home, p.slice(2));
  }
  if (p === '~') {
    const home = os.homedir() || process.env.HOME;
    if (!home) throw new Error('Cannot determine home directory');
    return home;
  }
  if (isAbsolute(p)) {
    return resolve(p);
  }
  return resolve(process.cwd(), p);
}

function formatProjectList(workspaceDir: string): string {
  const state = readState(workspaceDir);
  if (!state.projects.length) return 'No projects registered yet.';

  const lines: string[] = ['# Registered Projects', ''];

  // Active project summary at the top
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

  // Sort: active project first, then inactive
  const sorted = [...state.projects].sort((a, b) => {
    if (a.name === state.active && b.name !== state.active) return -1;
    if (a.name !== state.active && b.name === state.active) return 1;
    return 0;
  });

  // Table overview
  lines.push('| # | Name | Path | Active |');
  lines.push('|---|------|------|--------|');
  sorted.forEach((p, i) => {
    const isActive = p.name === state.active ? '✅ **Yes**' : 'No';
    lines.push(`| ${i + 1} | **${p.name}**${p.name === state.active ? ' 🟢' : ''} | \`${p.path}\` | ${isActive} |`);
  });
  lines.push('');

  // Details
  if (state.projects.some((p) => p.agentMds.length > 0)) {
    lines.push('### Details');
    lines.push('');
    for (const p of sorted) {
      const isActive = p.name === state.active ? ' 🟢 **(Active)**' : '';
      lines.push(`**${p.name}**${isActive}`);
      lines.push(`- Path: \`${p.path}\``);
      if (p.agentMds.length) {
        lines.push(`- Description files: ${p.agentMds.map((md) => `\`${md}\``).join(', ')}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function registerInitCommands(api: OpenClawPluginApi) {
  api.registerCommand({
    name: 'omoc_init',
    description: 'Initialize or manage project agent.md files',
    acceptsArgs: true,
    handler: async (ctx: CommandCtx) => {
      const workspaceDir = resolveWorkspaceDir(ctx);
      if (!workspaceDir) {
        api.logger.warn('[omoc:init] Cannot resolve workspaceDir from context');
        return { text: '⚠️ **Error**: Cannot determine workspace directory.' };
      }
      api.logger.info(`[omoc:init] resolved workspaceDir=[${workspaceDir}]`);

      const argsRaw = (ctx.args ?? '').trim();

      if (!argsRaw) {
        return {
          text: '# OmOC Init\n\nUsage:\n- `/omoc_init <dir> <project-name>` — Initialize a new project\n- `/omoc_init add <project-name> <sub-path-agent-md>` — Add extra agent.md\n- `/omoc_init delete <project-name> [agent-md]` — Remove project or agent.md\n- `/omoc_init list` — List all projects\n- `/omoc_init set-active <project-name>` — Activate a project\n- `/omoc_init off` — Deactivate current project',
        };
      }

      const parts = argsRaw.split(/\s+/);
      const firstArg = parts[0];
      const firstArgLower = firstArg.toLowerCase();

      // /omoc_init <dir> <project-name>
      if (firstArgLower !== 'add' && firstArgLower !== 'delete' && firstArgLower !== 'list' && firstArgLower !== 'set-active' && firstArgLower !== 'off') {
        api.logger.info(`[omoc:init] raw firstArg=[${firstArg}] argsRaw=[${argsRaw}]`);
        const home = os.homedir();
        api.logger.info(`[omoc:init] os.homedir()=[${home}] env.HOME=[${process.env.HOME}]`);
        const dir = expandPath(firstArg);
        api.logger.info(`[omoc:init] expanded dir=[${dir}]`);
        const projectName = parts[1]?.trim();

        if (!projectName) {
          return {
            text: '⚠️ **Error**: Project name is required.\n\nUsage: `/omoc_init <dir> <project-name>`',
          };
        }

        if (!existsSync(dir) || !statSync(dir).isDirectory()) {
          return {
            text: `⚠️ **Error**: Directory does not exist or is not a directory: \`${dir}\``,
          };
        }

        // 项目已注册：不报错，继续使用已有项目名称（或用户指定的新名称）
        let effectiveName = projectName;
        const existingByPath = findProjectByPath(workspaceDir, dir);
        if (existingByPath) {
          // 已注册 → 复用已有名称（除非用户指定了不同的有效名称）
          const existingByName = findProjectByName(workspaceDir, projectName);
          if (!existingByName && projectName !== existingByPath.name) {
            // 用户给了新名称且不存在冲突，用新名称
            effectiveName = projectName;
          } else {
            effectiveName = existingByPath.name;
          }
        }

        if (!findProjectByName(workspaceDir, effectiveName)) {
          // 新项目，添加条目
          addProject(workspaceDir, { name: effectiveName, path: dir, agentMds: ['AGENTS.md'] });
        }

        // 默认激活该项目
        setActiveProject(workspaceDir, effectiveName);

        // Set pending init — 即使已注册也继续，让 agent 重新梳理/更新 AGENTS.md
        setPendingInit(workspaceDir, {
          type: 'init',
          projectName: effectiveName,
          projectPath: dir,
          agentMdFile: 'AGENTS.md',
        });

        return {
          continueAgent: true,
        };
      }

      // /omoc_init add <project-name> <sub-path-agent-md>
      if (firstArgLower === 'add') {
        const projectName = parts[1]?.trim();
        const subPathAgentMd = parts.slice(2).join(' ').trim();

        if (!projectName || !subPathAgentMd) {
          return {
            text: '⚠️ **Error**: Both project name and sub-path are required.\n\nUsage: `/omoc_init add <project-name> <sub-path-agent-md>`',
          };
        }

        const project = findProjectByName(workspaceDir, projectName);
        if (!project) {
          return {
            text: `⚠️ **Error**: Project not found: \`${projectName}\`\n\nUse \`/omoc_init list\` to see existing projects.`,
          };
        }

        // Expand ~ and store as absolute path
        let absolutePath = expandPath(subPathAgentMd);

        if (!existsSync(absolutePath)) {
          return {
            text: `⚠️ **Error**: Path does not exist: \`${absolutePath}\``,
          };
        }

        // If path is a directory, auto-append AGENTS.md
        if (statSync(absolutePath).isDirectory()) {
          absolutePath = join(absolutePath, 'AGENTS.md');
        }

        const added = addAgentMdToProject(workspaceDir, projectName, absolutePath);

        setPendingInit(workspaceDir, {
          type: 'add',
          projectName,
          projectPath: project.path,
          agentMdFile: absolutePath,
          subPath: absolutePath,
        });

        return {
          continueAgent: true,
        };
      }

      // /omoc_init delete <project-name> [agent-md]
      if (firstArgLower === 'delete') {
        const projectName = parts[1]?.trim();
        const agentMd = parts.slice(2).join(' ').trim();

        if (!projectName) {
          return {
            text: '⚠️ **Error**: Project name is required.\n\nUsage: `/omoc_init delete <project-name> [agent-md]`',
          };
        }

        const project = findProjectByName(workspaceDir, projectName);
        if (!project) {
          return {
            text: `⚠️ **Error**: Project not found: \`${projectName}\``,
          };
        }

        if (agentMd) {
          const removed = removeAgentMdFromProject(workspaceDir, projectName, agentMd);
          if (!removed) {
            return { text: `⚠️ agent.md not found in project: \`${agentMd}\`` };
          }
          return {
            text: `✅ Removed \`${agentMd}\` from project \`${projectName}\`.`
            + (project.agentMds.length <= 1 ? '\n\n⚠️ This project now has no description files.' : ''),
          };
        } else {
          removeProject(workspaceDir, projectName);
          return {
            text: `✅ Removed project \`${projectName}\`.`,
          };
        }
      }

      // /omoc_init list
      if (firstArgLower === 'list') {
        return { text: formatProjectList(workspaceDir) };
      }

      // /omoc_init set-active <project-name>
      if (firstArgLower === 'set-active') {
        const projectName = parts[1]?.trim();
        if (!projectName) {
          return { text: '⚠️ **Error**: Project name is required.\n\nUsage: `/omoc_init set-active <project-name>`' };
        }

        const project = findProjectByName(workspaceDir, projectName);
        if (!project) {
          return { text: `⚠️ **Error**: Project not found: \`${projectName}\`` };
        }

        setActiveProject(workspaceDir, projectName);
        return {
          text: `✅ Activated project: **${projectName}**\n\nFuture messages will inject this project's agent.md context.`,
        };
      }

      // /omoc_init off
      if (firstArgLower === 'off') {
        setActiveProject(workspaceDir, null);
        return {
          text: `✅ Project context injection deactivated.\n\nFuture messages will not inject any project agent.md.`,
        };
      }

      return {
        text: '⚠️ Unknown subcommand. Use `/omoc_init` for usage.',
      };
    },
  });
}
