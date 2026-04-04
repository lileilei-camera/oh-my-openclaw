import type { SkillScope, LoadedSkill } from "../../features/skill-loader/types.js"
import type { SkillMcpManager } from "../../features/skill-mcp-manager/manager.js"

export interface SkillArgs {
  name: string
}

export interface SkillInfo {
  name: string
  description: string
  location?: string
  scope: SkillScope
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowedTools?: string[]
}

export interface SkillLoadOptions {
  /** When true, only load from OpenClaw paths */
  openclawOnly?: boolean
  /** Pre-merged skills to use instead of discovering */
  skills?: LoadedSkill[]
  /** MCP manager for querying skill-embedded MCP servers */
  mcpManager?: SkillMcpManager
  /** Session ID getter for MCP client identification */
  getSessionID?: () => string
}
