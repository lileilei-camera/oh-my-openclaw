/**
 * Project Guard — 核心函数
 *
 * 安全检查、cd 目标解析、轮次级授权管理。
 */
import { normalize, resolve, sep } from 'path';
import { homedir } from 'os';
import { getActiveProject } from '../project-init/project-state.js';
import type { SafeZone, TurnGrantStore } from './guard-types.js';
import { turnGrantStore } from './guard-types.js';

// ============================================================================
// Active Project
// ============================================================================

/**
 * 获取当前 active 项目的绝对路径。
 * @returns 项目路径，无 active project 时返回 null
 */
export function getActiveProjectPath(workspaceDir: string): string | null {
  const project = getActiveProject(workspaceDir);
  if (!project) return null;
  return normalize(project.path);
}

// ============================================================================
// Safe Zone Check
// ============================================================================

/**
 * 检查绝对路径是否在安全区内。
 *
 * 安全区 = projectPath ∪ workspaceDir ∪ /tmp ∪ turnGrants
 * 子目录前缀匹配：授权 /a/b → /a/b/c 自动放行，反之不行。
 */
/** Strip trailing path separators to avoid double-slash on prefix matching. */
function stripTrailingSep(p: string): string {
  return p.replace(/\/+$/, '') || '/';
}

export function isInSafeZone(
  absolutePath: string,
  { projectPath, workspaceDir, turnGrants }: SafeZone,
): boolean {
  const normalized = normalize(absolutePath);

  const checkPrefixes = [projectPath, workspaceDir, '/tmp', ...turnGrants];

  for (const prefix of checkPrefixes) {
    const normalizedPrefix = stripTrailingSep(normalize(prefix));
    if (normalized === normalizedPrefix) return true;
    if (normalized.startsWith(normalizedPrefix + sep)) return true;
  }

  return false;
}

// ============================================================================
// CD Target Parsing
// ============================================================================

/**
 * 正则：匹配 command 中的所有 cd 目标。
 *
 * 覆盖场景：
 *   cd /abs/path
 *   cd /abs/path && make
 *   cd ~/path
 *   cd relative/path
 *   cd "path with spaces"
 *
 * 匹配逻辑：
 *   \bcd\s+  — 单词边界 + cd + 空白
 *   (~?   — 可选 ~
 *    \/?  — 可选 /
 *    [\w.\-\/ ]+  — 路径字符 + 空格（支持带空格路径）
 *   )
 *   (?=  — 前瞻：后面是
 *     \s*(?:;|\||&{1,2}|\s*$|\s*&&|\s*\|\|)   — 分隔符 或 结束
 *     |  — 或者
 *     "   — 结束引号
 *     |  — 或者
 *     '   — 结束单引号
 *   )
 */
const CD_REGEX = /\bcd\s+["']?([~]?\/?[\w.\-\/ ]+?)["']?(?=\s*(?:;|\||&{1,2}|\s+&&|\s+\|\||\s*$))/gm;

/**
 * 从 command 字符串中提取最后一个 cd 的目标路径，展开 ~ 并处理相对路径。
 *
 * @param command   exec 的 command 参数
 * @param workdir   exec 的 workdir 参数（可选）
 * @param workspaceDir  agent 的工作空间（兜底）
 * @returns 归一化后的绝对路径，无 cd 时返回 null
 */
export function parseCdTarget(
  command: string,
  workdir?: string,
  workspaceDir?: string,
): string | null {
  let lastMatch: string | null = null;

  // 提取所有 cd 目标，只取最后一个
  let match: RegExpExecArray | null;
  CD_REGEX.lastIndex = 0;
  while ((match = CD_REGEX.exec(command)) !== null) {
    lastMatch = match[1];
  }

  if (lastMatch === null) return null;

  let target = lastMatch.trim();

  // ~/path → $HOME/path
  if (target.startsWith('~')) {
    target = joinPath(homedir(), target.slice(1));
    return normalize(target);
  }

  // /absolute → 直接 normalize
  if (target.startsWith('/')) {
    return normalize(target);
  }

  // relative → (workdir || workspaceDir) + '/' + relative
  const base = workdir && workdir.trim() ? workdir : workspaceDir || '/';
  return normalize(joinPath(base, target));
}

// ============================================================================
// Turn-Level Grants
// ============================================================================

/**
 * 将路径加入指定 session 的轮次授权集合。
 * 后续该 session 的越界操作如命中此前缀会自动放行。
 */
export function addTurnGrant(
  store: TurnGrantStore,
  sessionKey: string,
  path: string,
): void {
  let grants = store.get(sessionKey);
  if (!grants) {
    grants = new Set();
    store.set(sessionKey, grants);
  }
  grants.add(normalize(path));
}

/** 清空指定 session 的轮次授权 */
export function clearTurnGrants(sessionKey: string): void {
  turnGrantStore.delete(sessionKey);
}

/** 获取指定 session 的已授权路径集合 */
export function getTurnGrants(sessionKey: string): string[] {
  return [...(turnGrantStore.get(sessionKey) ?? [])];
}

// ============================================================================
// Helpers
// ============================================================================

/** 路径拼接后 normalize */
function joinPath(base: string, ...parts: string[]): string {
  // Remove leading slashes from parts to avoid absolute path override
  const cleanParts = parts.map((p) => p.replace(/^\/+/, ''));
  return resolve(base, ...cleanParts);
}
