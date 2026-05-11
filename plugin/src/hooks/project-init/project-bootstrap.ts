/**
 * Project-init bootstrap hook.
 * Injects init templates or active project agent.md into system prompt.
 * Runs on before_prompt_build.
 */
import type { OpenClawPluginApi, PluginHookBeforePromptBuildEvent, PluginHookBeforePromptBuildResult } from '../../types.js';
import { getPendingInit, clearPendingInit, getActiveProject } from './project-state.js';
import { INIT_TEMPLATE, INIT_ADD_TEMPLATE } from './init-template.js';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export function registerProjectBootstrap(api: OpenClawPluginApi) {
  api.on(
    'before_prompt_build',
    (event: PluginHookBeforePromptBuildEvent, ctx: { sessionKey?: string }): PluginHookBeforePromptBuildResult | void => {
      // 1. Check for pending init
      const pending = getPendingInit();
      if (pending) {
        clearPendingInit();

        let template: string;
        if (pending.type === 'add') {
          template = INIT_ADD_TEMPLATE
            .replace(/\$\{projectPath\}/g, pending.projectPath)
            .replace(/\$\{agentMdFile\}/g, pending.agentMdFile);
        } else {
          template = INIT_TEMPLATE
            .replace(/\$\{projectPath\}/g, pending.projectPath)
            .replace(/\$\{agentMdFile\}/g, pending.agentMdFile);
        }

        // 只通过 prependContext 注入模板（指令已在模板末尾）
        api.logger.info(`[omoc:project-init] Injected ${pending.type} template for project: ${pending.projectName}`);
        return { prependContext: template };
      }

      // 2. No pending — check active project
      const project = getActiveProject();
      if (!project) return;

      const parts: string[] = [];

      // Read each agent.md in order
      for (const agentMd of project.agentMds) {
        const fullPath = resolve(project.path, agentMd);
        if (!existsSync(fullPath)) {
          api.logger.warn(`[omoc:project-init] agent.md not found: ${fullPath}`);
          continue;
        }

        try {
          const content = readFileSync(fullPath, 'utf-8');
          parts.push(`\n--- Project: ${project.name} | File: ${agentMd} ---\n${content}`);
        } catch (err) {
          api.logger.error(`[omoc:project-init] Failed to read ${fullPath}:`, err);
        }
      }

      if (parts.length > 0) {
        api.logger.info(`[omoc:project-init] Injected ${parts.length} agent.md file(s) for project: ${project.name}`);
        return { prependContext: parts.join('\n') };
      }
    },
    { priority: 75 },
  );
}
