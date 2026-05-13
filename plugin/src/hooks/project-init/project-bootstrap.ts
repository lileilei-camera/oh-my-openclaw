/**
 * Project-init bootstrap hook.
 * Injects init templates or active project agent.md into system prompt.
 * Runs on before_prompt_build.
 */
import type { OpenClawPluginApi, PluginHookBeforePromptBuildEvent, PluginHookBeforePromptBuildResult } from '../../types.js';
import { getPendingInit, clearPendingInit, getActiveProject, getStateDir } from './project-state.js';
import { INIT_TEMPLATE, INIT_ADD_TEMPLATE } from './init-template.js';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

interface HookCtx {
  sessionKey?: string;
  workspaceDir?: string;
  agentId?: string;
}

export function registerProjectBootstrap(api: OpenClawPluginApi) {
  api.on(
    'before_prompt_build',
    (event: PluginHookBeforePromptBuildEvent, ctx: HookCtx): PluginHookBeforePromptBuildResult | void => {
      const workspaceDir = ctx.workspaceDir;
      if (!workspaceDir) {
        api.logger.warn('[omoc:project-init] No workspaceDir in ctx, skipping');
        return;
      }

      // 1. Check for pending init
      const pending = getPendingInit(workspaceDir);
      if (pending) {
        clearPendingInit(workspaceDir);

        // Sanitize values to prevent template injection ($, `, \)
        function safeReplace(template: string, key: string, value: string): string {
          const escaped = value.replace(/[$`\\]/g, '\\$&');
          return template.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), escaped);
        }

        let template: string;
        if (pending.type === 'add') {
          template = safeReplace(INIT_ADD_TEMPLATE, 'projectName', pending.projectName);
          template = safeReplace(template, 'agentMdFile', pending.agentMdFile);
        } else {
          template = safeReplace(INIT_TEMPLATE, 'projectPath', pending.projectPath);
          template = safeReplace(template, 'agentMdFile', pending.agentMdFile);
        }

        // 通过 prependContext 注入模板，appendContext 引导 LLM 执行
        const templateName = pending.type === 'add' ? 'project-add' : 'project-init';
        const appendMsg = pending.type === 'add'
          ? `请使用上面的 ${templateName} 模板，为子模块 **${pending.projectName}** 完成 AGENTS.md 的建立。模板已注入到上方，按模板中的指令逐步执行。`
          : `请使用上面的 ${templateName} 模板，为项目 **${pending.projectName}** 完成 AGENTS.md 的建立。模板已注入到上方，按模板中的指令逐步执行。`;

        api.logger.info(`[omoc:project-init] Injected ${pending.type} template for project: ${pending.projectName}`);
        return { prependContext: template, appendContext: appendMsg };
      }

      // 2. No pending — check active project
      const project = getActiveProject(workspaceDir);
      if (!project) return;

      const parts: string[] = [];

      // Read each agent.md in order
      const injectedPaths: string[] = [];
      for (const agentMd of project.agentMds) {
        const fullPath = resolve(project.path, agentMd);
        if (!existsSync(fullPath)) {
          api.logger.warn(`[omoc:project-init] agent.md not found: ${fullPath}`);
          continue;
        }

        try {
          const content = readFileSync(fullPath, 'utf-8');

          // Try to extract YAML frontmatter for metadata display
          let header = `--- Project: ${project.name} | File: ${agentMd} ---`;
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
          if (fmMatch) {
            const fmLines = fmMatch[1].split('\n');
            const meta: Record<string, string> = {};
            for (const line of fmLines) {
              const kv = line.match(/^(\w+):\s*(.+)$/);
              if (kv) meta[kv[1].trim()] = kv[2].trim();
            }
            const name = meta.name || agentMd;
            const desc = meta.description || '';
            header = `--- Skill: ${name} | ${desc} | File: ${agentMd} ---`;
            api.logger.info(`[omoc:project-init] Parsed frontmatter: name="${name}", desc="${desc}"`);
          }

          parts.push(`\n${header}\n${content}`);
          injectedPaths.push(fullPath);
        } catch (err) {
          api.logger.error(`[omoc:project-init] Failed to read ${fullPath}:`, err);
        }
      }

      if (parts.length > 0) {
        api.logger.info(
          `[omoc:project-init] Injected ${parts.length} agent.md file(s) for project: ${project.name}: ${injectedPaths.join(', ')}`
        );
        return { prependContext: parts.join('\n') };
      }
    },
    { priority: 75 },
  );
}
