import type { ClaudeCodeMcpServer } from "../claude-code-mcp-loader/types.js"

export type SkillScope = "builtin" | "config" | "user" | "project" | "opencode" | "opencode-project"

export interface SkillMetadata {
  name?: string
  description?: string
  model?: string
  "argument-hint"?: string
  agent?: string
  subtask?: boolean
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  "allowed-tools"?: string
  mcp?: SkillMcpConfig
}

export interface LazyContentLoader {
  loaded: boolean
  content?: string
  load: () => Promise<string>
}

export interface LoadedSkill {
  name: string
  path?: string
  resolvedPath?: string
  definition: CommandDefinition
  scope: SkillScope
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowedTools?: string[]
  mcpConfig?: SkillMcpConfig
  lazyContent?: LazyContentLoader
}

export interface CommandDefinition {
  name: string
  description: string
  template: string
  model?: string
  agent?: string
  subtask?: boolean
  argumentHint?: string
}

export type SkillMcpConfig = Record<string, ClaudeCodeMcpServer>
