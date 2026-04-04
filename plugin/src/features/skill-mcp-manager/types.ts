import type { ClaudeCodeMcpServer } from "../claude-code-mcp-loader/types.js"

export type SkillMcpConfig = Record<string, ClaudeCodeMcpServer>

export interface SkillMcpClientInfo {
  serverName: string
  skillName: string
  sessionID: string
}

export interface SkillMcpServerContext {
  config: ClaudeCodeMcpServer
  skillName: string
}

export interface SkillMcpArgs {
  mcp_name: string
  tool_name?: string
  resource_name?: string
  prompt_name?: string
  arguments?: string | Record<string, unknown>
  grep?: string
}
