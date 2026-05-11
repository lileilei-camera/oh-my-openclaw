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

        // 关键问题：agent 看到用户消息里的 /omoc_init 会本能地去 debug 它。
        // appendContext 在系统提示词之后、对话历史之前出现。
        // 必须用非常明确的指令阻止 agent 去 debug 命令。
        const userRequest = `\n\n## YOUR TASK: Project Initialization\n\nThe user has requested project initialization for the project described above.\n\n**STOP. Do NOT try to run, execute, or debug the /omoc_init command you see in the user's message.**\n**The command has already been processed. Your job is to DO THE WORK described below.**\n\nPlease read the project files and create an AGENTS.md following the instructions above.`;

        api.logger.info(`[omoc:project-init] Injected ${pending.type} template for project: ${pending.projectName}`);
        return { prependContext: template, appendContext: userRequest };
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
