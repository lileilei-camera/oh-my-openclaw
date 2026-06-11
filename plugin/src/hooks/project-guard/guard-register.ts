/**
 * Project Guard — Hook 注册
 *
 * 在 before_tool_call 中拦截 write/edit/exec 越界操作，
 * 通过 requireApproval 弹窗请求用户授权。
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
import { WRITE_TOOLS, EXEC_TOOL, turnGrantStore } from './guard-types.js';
import {
  getActiveProjectPath,
  isInSafeZone,
  parseCdTarget,
  addTurnGrant,
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

        api.logger.warn(
          `${LOG_PREFIX} Project Guard: write/edit out-of-bounds → path="${absolutePath}" ` +
          `agent="${ctx.agentId || 'unknown'}" project="${projectPath}"`,
        );
        return {
          requireApproval: {
            title: '⚠️ 项目边界越界',
            description: [
              `**write/edit** 操作的目标路径不在当前项目范围内。`,
              ``,
              `- **当前项目**：${projectName}`,
              `- **项目路径**：${projectPath}`,
              `- **目标路径**：${absolutePath}`,
              ``,
              `安全区域包括：项目目录、工作空间、/tmp、以及本轮已授权的路径。`,
            ].join('\n'),
            severity: 'warning',
            allowedDecisions: ['allow-once', 'allow-always', 'deny'],
            actions: [
              { kind: 'decision', label: '单次', style: 'primary', decision: 'allow-once', commandTemplate: '单次' },
              { kind: 'decision', label: '本轮', style: 'success', decision: 'allow-always', commandTemplate: '本轮' },
              { kind: 'decision', label: '拒绝', style: 'danger', decision: 'deny', commandTemplate: '拒绝' },
            ],
            onResolution: (decision: string) => {
              if (decision === 'allow-always') {
                api.logger.info(`${LOG_PREFIX} guard: granted turn-wide write access to "${absolutePath}"`);
                addTurnGrant(turnGrantStore, sessionKey, absolutePath);
              }
            },
          },
        };
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

        api.logger.warn(
          `${LOG_PREFIX} Project Guard: exec out-of-bounds → cwd="${finalCwd}" ` +
          `agent="${ctx.agentId || 'unknown'}" project="${projectPath}"`,
        );
        return {
          requireApproval: {
            title: '⚠️ 项目边界越界',
            description: [
              `**exec** 命令的工作目录不在当前项目范围内。`,
              ``,
              `- **当前项目**：${projectName}`,
              `- **项目路径**：${projectPath}`,
              `- **命令 cwd**：${finalCwd}`,
              `- **命令**：\`${command.slice(0, 200)}\``,
              ``,
              `安全区域包括：项目目录、工作空间、/tmp、以及本轮已授权的路径。`,
            ].join('\n'),
            severity: 'warning',
            allowedDecisions: ['allow-once', 'allow-always', 'deny'],
            actions: [
              { kind: 'decision', label: '单次', style: 'primary', decision: 'allow-once', commandTemplate: '单次' },
              { kind: 'decision', label: '本轮', style: 'success', decision: 'allow-always', commandTemplate: '本轮' },
              { kind: 'decision', label: '拒绝', style: 'danger', decision: 'deny', commandTemplate: '拒绝' },
            ],
            onResolution: (decision: string) => {
              if (decision === 'allow-always') {
                api.logger.info(`${LOG_PREFIX} guard: granted turn-wide exec access to "${finalCwd}"`);
                addTurnGrant(turnGrantStore, sessionKey, finalCwd);
              }
            },
          },
        };
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
