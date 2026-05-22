/**
 * Project Guard — 类型定义与常量
 *
 * 防止 agent 在多个项目间串操作。
 * 检查 write/edit/exec 的路径是否在安全区内，越界则弹窗请求授权。
 */

/** 需要拦截的文件写入工具 */
export const WRITE_TOOLS = new Set(['write', 'edit']);

/** 需要拦截的执行工具 */
export const EXEC_TOOL = 'exec';

/**
 * 轮次级授权存储
 * Map<sessionKey, Set<grantedPath>>
 * agent_end 时清空对应 session
 */
export type TurnGrantStore = Map<string, Set<string>>;

/** 模块级单例 */
export const turnGrantStore: TurnGrantStore = new Map();

/** 安全区配置 */
export interface SafeZone {
  projectPath: string;
  workspaceDir: string;
  turnGrants: string[];
}
