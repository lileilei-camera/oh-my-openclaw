/**
 * MCP server configuration compatible with Claude Code format.
 * Supports both stdio (local process) and HTTP (remote server) connections.
 */
export interface ClaudeCodeMcpServer {
  /** Connection type: "stdio" for local process, "http"/"sse" for remote server */
  type?: "stdio" | "http" | "sse"
  
  /** For HTTP connections: server URL */
  url?: string
  
  /** For stdio connections: command to execute */
  command?: string
  
  /** For stdio connections: command arguments */
  args?: string[]
  
  /** Environment variables for stdio process */
  env?: Record<string, string>
  
  /** HTTP headers for authentication (HTTP connections) */
  headers?: Record<string, string>
  
  /** Additional configuration options */
  [key: string]: unknown
}
