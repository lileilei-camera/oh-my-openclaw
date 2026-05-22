/**
 * Project Guard — Hook 注册
 *
 * 所有判断逻辑完整保留，但当前模式为「仅日志不拦截」：
 * - 安全区内的操作：静默放行
 * - 越界操作：打印 warn 日志后放行
 *
 * 工作空间解析：
 * - 优先从 api.config.agents.list[] 中按 ctx.agentId 匹配 agent.workspace
 * - fallback resolveOpenClawWorkspaceDir()
 */
import { resolve, join } from 'path';
import { homedir } from 'os';
import type {
  OpenClawPluginApi,
  PluginHookBeforeToolCallEvent,
  PluginHookBeforeToolCallResult,
  PluginHookAgentEndEvent,
} from '../../types.js';
import { LOG_PREFIX } from '../../constants.js';
import { WRITE_TOOLS, EXEC_TOOL } from './guard-types.js';
import {
  getActiveProjectPath,
  isInSafeZone,
  parseCdTarget,
  clearTurnGrants,
  getTurnGrants,
} from './guard-core.js';
import { resolveOpenClawWorkspaceDir } from '../../utils/paths.js';

// ============================================================================
// Helpers
// ============================================================================

/** 展开路径中的 ~ 为 $HOME */
function expandTilde(path: string): string {
  if (path.startsWith('~')) {
    return join(process.env.HOME ?? homedir(), path.slice(1));
  }
  return path;
}

/**
 * 获取 workspace 目录。
 * 优先级：
 *   1. api.config.agents.list[] 中匹配 ctx.agentId → 取 agent.workspace
 *   2. resolveOpenClawWorkspaceDir()
 */
function getWorkspaceDir(api: OpenClawPluginApi, agentId?: string): string | undefined {
  if (agentId) {
    const agents = (api.config as Record<string, unknown>).agents as
      | { list?: Array<{ id: string; workspace?: string }> }
      | undefined;
    const agent = agents?.list?.find(a => a.id === agentId);
    if (agent?.workspace) {
      return expandTilde(agent.workspace);
    }
  }
  return resolveOpenClawWorkspaceDir();
}

// ============================================================================
// Register
// ============================================================================

export function registerProjectGuard(api: OpenClawPluginApi): void {
  // ── before_tool_call ────────────────────────────────────────────────

  api.on<PluginHookBeforeToolCallEvent, PluginHookBeforeToolCallResult | void>(
    'before_tool_call',
    (event: PluginHookBeforeToolCallEvent, ctx: { agentId?: string; sessionKey?: string }): PluginHookBeforeToolCallResult | void => {
      api.logger.info(
        `${LOG_PREFIX} before_tool_call → tool="${event.toolName}" agent="${ctx.agentId || '(unknown)'}" session="${ctx.sessionKey || '(unknown)'}"`,
      );

      const workspaceDir = getWorkspaceDir(api, ctx.agentId);
      if (!workspaceDir) {
        api.logger.info(`${LOG_PREFIX} guard skip: no workspaceDir (agentId="${ctx.agentId || '(unknown)'}")`);
        return;
      }

      const projectPath = getActiveProjectPath(workspaceDir);
      if (!projectPath) {
        api.logger.info(`${LOG_PREFIX} guard skip: no active project in workspace="${workspaceDir}"`);
        return;
      }

      const projectName = projectPath.split('/').pop() || projectPath;
      const sessionKey = ctx.sessionKey || 'default';

      // ── write / edit ──
      if (WRITE_TOOLS.has(event.toolName)) {
        const rawPath = event.params.path as string | undefined;
        if (!rawPath) {
          api.logger.info(`${LOG_PREFIX} guard skip: write tool "${event.toolName}" has no path param`);
          return;
        }

        const absolutePath = resolve(workspaceDir, rawPath);
        const turnGrants = getTurnGrants(sessionKey);

        if (isInSafeZone(absolutePath, { projectPath, workspaceDir, turnGrants })) {
          api.logger.info(`${LOG_PREFIX} guard pass (safe zone): write "${absolutePath}"`);
          return;
        }

        // 仅日志，不拦截
        api.logger.warn(
          `${LOG_PREFIX} Project Guard: write/edit WOULD BLOCK (passing) → path="${absolutePath}" ` +
          `agent="${ctx.agentId || 'unknown'}" workspace="${workspaceDir}" ` +
          `project="${projectPath}"`,
        );
        return;
      }

      // ── exec ──
      if (event.toolName === EXEC_TOOL) {
        const command = event.params.command as string | undefined;
        if (!command) {
          api.logger.info(`${LOG_PREFIX} guard skip: exec tool has no command param`);
          return;
        }

        const workdir = event.params.workdir as string | undefined;
        const finalCwd = parseCdTarget(command, workdir, workspaceDir);

        if (finalCwd === null) {
          api.logger.info(`${LOG_PREFIX} guard skip: cannot determine cwd for exec, passthrough`);
          return;
        }

        const turnGrants = getTurnGrants(sessionKey);

        if (isInSafeZone(finalCwd, { projectPath, workspaceDir, turnGrants })) {
          api.logger.info(`${LOG_PREFIX} guard pass (safe zone): exec cwd="${finalCwd}"`);
          return;
        }

        // 仅日志，不拦截
        api.logger.warn(
          `${LOG_PREFIX} Project Guard: exec WOULD BLOCK (passing) → cwd="${finalCwd}" ` +
          `agent="${ctx.agentId || 'unknown'}" workspace="${workspaceDir}" ` +
          `project="${projectPath}"`,
        );
        return;
      }

      // ── other tools (read, grep, glob, etc.) ──
      api.logger.info(`${LOG_PREFIX} guard skip: tool "${event.toolName}" not in write/exec scope, passthrough`);
    },
    { priority: 140 },
  );

  // ── agent_end ─────────────────────────────────────────────────────

  api.on<PluginHookAgentEndEvent>(
    'agent_end',
    (_event: PluginHookAgentEndEvent, ctx: { sessionKey?: string }) => {
      const sessionKey = ctx.sessionKey || 'default';
      api.logger.info(`${LOG_PREFIX} guard: agent_end → clearing turn grants for session="${sessionKey}"`);
      clearTurnGrants(sessionKey);
    },
    { priority: 0 },
  );
}
