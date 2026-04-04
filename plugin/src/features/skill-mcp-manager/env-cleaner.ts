/**
 * Creates a clean environment for MCP processes.
 * Merges provided env with process.env, filtering out problematic variables.
 */
export function createCleanMcpEnvironment(providedEnv?: Record<string, string>): Record<string, string> {
  const cleanEnv: Record<string, string> = { ...process.env as Record<string, string> }
  
  // Remove problematic variables that may interfere with MCP processes
  delete cleanEnv.LC_ALL
  delete cleanEnv.LANG
  delete cleanEnv.NODE_OPTIONS
  
  // Merge provided env (takes priority)
  if (providedEnv) {
    Object.assign(cleanEnv, providedEnv)
  }
  
  return cleanEnv
}
