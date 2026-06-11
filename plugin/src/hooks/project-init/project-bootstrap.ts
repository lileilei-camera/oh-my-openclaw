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
          ? `我已经在上方给你发送了 ${templateName} 模板的完整指令。请严格按照模板中的步骤，为子模块 **${pending.projectName}** 创建或更新 AGENTS.md。\n\n⚠️ 如果你在上方找不到 project-add 模板内容，请立即停下来告诉我，不要自行猜测或执行。`
          : `我已经在上方给你发送了 ${templateName} 模板的完整指令。请严格按照模板中的步骤，为项目 **${pending.projectName}** 创建或更新 AGENTS.md。\n\n⚠️ 如果你在上方找不到 project-init 模板内容，请立即停下来告诉我，不要自行猜测或执行。`;

        api.logger.info(`[omoc:project-init] Injected ${pending.type} template for project: ${pending.projectName}`);
        return { prependContext: template, appendContext: appendMsg };
      }

      // 2. No pending — check active project
      const project = getActiveProject(workspaceDir);
      if (!project) return;

      // Resolve all agent.md full paths first
      const resolvedPaths: { relPath: string; fullPath: string }[] = [];
      for (const agentMd of project.agentMds) {
        const fullPath = resolve(project.path, agentMd);
        resolvedPaths.push({ relPath: agentMd, fullPath });
      }

      // Read each agent.md and collect content
      const fileContents: { fullPath: string; content: string; frontmatter?: { name: string; description: string } }[] = [];
      for (const { fullPath } of resolvedPaths) {
        if (!existsSync(fullPath)) {
          api.logger.warn(`[omoc:project-init] agent.md not found: ${fullPath}`);
          continue;
        }

        try {
          const content = readFileSync(fullPath, 'utf-8');

          // Try to extract YAML frontmatter for metadata display
          let frontmatter: { name: string; description: string } | undefined;
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
          if (fmMatch) {
            const fmLines = fmMatch[1].split('\n');
            const meta: Record<string, string> = {};
            for (const line of fmLines) {
              const kv = line.match(/^(\w+):\s*(.+)$/);
              if (kv) meta[kv[1].trim()] = kv[2].trim();
            }
            if (meta.name || meta.description) {
              frontmatter = { name: meta.name || '', description: meta.description || '' };
              api.logger.info(`[omoc:project-init] Parsed frontmatter: name="${frontmatter.name}", desc="${frontmatter.description}"`);
            }
          }

          fileContents.push({ fullPath, content, frontmatter });
          api.logger.info(`[omoc:project-init] Read agent.md: ${fullPath}`);
        } catch (err) {
          api.logger.error(`[omoc:project-init] Failed to read ${fullPath}:`, err);
        }
      }

      if (fileContents.length === 0) return;

      const parts: string[] = [];

      // --- Project info header block (compact overview) ---
      const projectInfo = [
        `## Active Project: ${project.name}`,
        `路径: ${project.path}`,
      ].join('\n');

      const guardPrompt = [
        ``,
        `### 🔒 项目路径保护`,
        `  - 始终以 **${project.path}** 为当前工作目录`,
        `  - 偶尔需切到项目外查信息（如 cd /other && ls），完成后**立刻切回项目路径**`,
        `  - write/edit/exec 越界会弹窗请求授权`,
      ].join('\n');

      parts.push(projectInfo + '\n' + guardPrompt);

      // Inject each agent.md with full path header
      for (const { fullPath, content, frontmatter } of fileContents) {
        let header: string;
        if (frontmatter && frontmatter.name) {
          const desc = frontmatter.description || '';
          header = `--- Skill: ${frontmatter.name} | ${desc} | File: ${fullPath} ---`;
        } else {
          header = `--- Project: ${project.name} | File: ${fullPath} ---`;
        }
        parts.push(`\n${header}\n${content}`);
      }

      api.logger.info(
        `[omoc:project-init] Injected ${fileContents.length} agent.md file(s) + project header for project: ${project.name}`
      );

      // appendContext: conversational guidance — prependContext already has the full knowledge
      const appendContext = [
        `━━━ 🔔 当前项目：${project.name} ━━━`,
        `你现在工作在 **${project.name}** 项目，项目知识在 ## Active Project 下，工作路径是 ${project.path}。`,
        `按照项目中的要求来工作，这里就是你的主战场。`,
        `如果临时需要切换到项目外查看信息，查看后请立刻切回项目目录。`,
        `时刻牢记：你当前正在为这个项目工作。`,
      ].join('\n');

      return { prependContext: parts.join('\n'), appendContext };
    },
    { priority: 74 },  // Just below mode-switch (75) to avoid prependContext conflict
  );
}
