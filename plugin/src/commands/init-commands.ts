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

/**
 * Resolve a path, expanding ~ to home directory.
 * Handles: absolute paths, ~/..., and relative paths.
 */
function expandPath(p: string): string {
  if (p.startsWith('~/')) {
    // ~/xxx → home + xxx (需要切掉 ~/ 两个字符)
    const home = os.homedir() || process.env.HOME || '/home/lileilei';
    return resolve(home, p.slice(2));
  }
  if (p === '~') {
    return os.homedir() || process.env.HOME || '/home/lileilei';
  }
  if (isAbsolute(p)) {
    return resolve(p);
  }
  // Relative path: resolve against current working directory
  return resolve(process.cwd(), p);
}

function isSubPath(parent: string, child: string): boolean {
  const rel = resolve(child);
  const absParent = resolve(parent);
  return rel.startsWith(absParent + '/') || rel === absParent;
}

function formatProjectList(): string {
  const state = readState();
  if (!state.projects.length) return 'No projects registered yet.';

  const lines = ['# Registered Projects', ''];
  for (const p of state.projects) {
    const isActive = p.name === state.active ? ' ← **active**' : '';
    lines.push(`### \`${p.name}\`${isActive}`);
    lines.push(`- Path: \`${p.path}\``);
    lines.push('- Description files:');
    for (const md of p.agentMds) {
      lines.push(`  - \`${md}\``);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function registerInitCommands(api: OpenClawPluginApi) {
  api.registerCommand({
    name: 'omoc_init',
    description: 'Initialize or manage project agent.md files',
    acceptsArgs: true,
    handler: async (ctx: { args?: string }) => {
      const argsRaw = (ctx.args ?? '').trim();

      if (!argsRaw) {
        return {
          text: '# OmOC Init\n\nUsage:\n- `/omoc_init <dir> <project-name>` — Initialize a new project\n- `/omoc_init add <project-name> <sub-path-agent-md>` — Add extra agent.md\n- `/omoc_init delete <project-name> [agent-md]` — Remove project or agent.md\n- `/omoc_init list` — List all projects\n- `/omoc_init set-active <project-name>` — Activate a project\n- `/omoc_init off` — Deactivate current project',
        };
      }

      const parts = argsRaw.split(/\s+/);
      const subCommand = parts[0].toLowerCase();

      // /omoc_init <dir> <project-name>
      if (subCommand !== 'add' && subCommand !== 'delete' && subCommand !== 'list' && subCommand !== 'set-active' && subCommand !== 'off') {
        api.logger.info(`[omoc:init] raw subCommand=[${subCommand}] argsRaw=[${argsRaw}]`);
        const home = os.homedir();
        api.logger.info(`[omoc:init] os.homedir()=[${home}] env.HOME=[${process.env.HOME}]`);
        const dir = expandPath(subCommand);
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
        const existingByPath = findProjectByPath(dir);
        if (existingByPath) {
          // 已注册 → 复用已有名称（除非用户指定了不同的有效名称）
          const existingByName = findProjectByName(projectName);
          if (!existingByName && projectName !== existingByPath.name) {
            // 用户给了新名称且不存在冲突，用新名称
            effectiveName = projectName;
          } else {
            effectiveName = existingByPath.name;
          }
        }

        if (!findProjectByName(effectiveName)) {
          // 新项目，添加条目
          addProject({ name: effectiveName, path: dir, agentMds: ['AGENTS.md'] });
        }

        // Set pending init — 即使已注册也继续，让 agent 重新梳理/更新 AGENTS.md
        setPendingInit({
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
      if (subCommand === 'add') {
        const projectName = parts[1]?.trim();
        const subPathAgentMd = parts.slice(2).join(' ').trim();

        if (!projectName || !subPathAgentMd) {
          return {
            text: '⚠️ **Error**: Both project name and sub-path are required.\n\nUsage: `/omoc_init add <project-name> <sub-path-agent-md>`',
          };
        }

        const project = findProjectByName(projectName);
        if (!project) {
          return {
            text: `⚠️ **Error**: Project not found: \`${projectName}\`\n\nUse \`/omoc_init list\` to see existing projects.`,
          };
        }

        const fullPath = resolve(project.path, subPathAgentMd);
        if (!isSubPath(project.path, fullPath)) {
          return {
            text: `⚠️ **Error**: Target path must be within the project directory.\n\nProject: \`${project.path}\`\nTarget: \`${fullPath}\``,
          };
        }

        const added = addAgentMdToProject(projectName, subPathAgentMd);
        if (!added) {
          return {
            text: `⚠️ **Error**: This agent.md is already registered for project \`${projectName}\`.`,
          };
        }

        setPendingInit({
          type: 'add',
          projectName,
          projectPath: project.path,
          agentMdFile: subPathAgentMd,
          subPath: subPathAgentMd,
        });

        return {
          continueAgent: true,
        };
      }

      // /omoc_init delete <project-name> [agent-md]
      if (subCommand === 'delete') {
        const projectName = parts[1]?.trim();
        const agentMd = parts.slice(2).join(' ').trim();

        if (!projectName) {
          return {
            text: '⚠️ **Error**: Project name is required.\n\nUsage: `/omoc_init delete <project-name> [agent-md]`',
          };
        }

        const project = findProjectByName(projectName);
        if (!project) {
          return {
            text: `⚠️ **Error**: Project not found: \`${projectName}\``,
          };
        }

        if (agentMd) {
          const removed = removeAgentMdFromProject(projectName, agentMd);
          if (!removed) {
            return { text: `⚠️ agent.md not found in project: \`${agentMd}\`` };
          }
          return {
            text: `✅ Removed \`${agentMd}\` from project \`${projectName}\`.`
            + (project.agentMds.length <= 1 ? '\n\n⚠️ This project now has no description files.' : ''),
          };
        } else {
          removeProject(projectName);
          return {
            text: `✅ Removed project \`${projectName}\`.`,
          };
        }
      }

      // /omoc_init list
      if (subCommand === 'list') {
        return { text: formatProjectList() };
      }

      // /omoc_init set-active <project-name>
      if (subCommand === 'set-active') {
        const projectName = parts[1]?.trim();
        if (!projectName) {
          return { text: '⚠️ **Error**: Project name is required.\n\nUsage: `/omoc_init set-active <project-name>`' };
        }

        const project = findProjectByName(projectName);
        if (!project) {
          return { text: `⚠️ **Error**: Project not found: \`${projectName}\`` };
        }

        setActiveProject(projectName);
        return {
          text: `✅ Activated project: **${projectName}**\n\nFuture messages will inject this project's agent.md context.`,
        };
      }

      // /omoc_init off
      if (subCommand === 'off') {
        setActiveProject(null);
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
