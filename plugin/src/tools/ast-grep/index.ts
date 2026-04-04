// ast-grep index - copied from oh-my-opencode verbatim, adapted for OpenClaw
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import { registerAstGrepSearchTool } from "./tools.js"
import { registerAstGrepReplaceTool } from "./tools.js"

export function registerAstGrepTools(api: OpenClawPluginApi): void {
  registerAstGrepSearchTool(api)
  registerAstGrepReplaceTool(api)
}

export { registerAstGrepSearchTool, registerAstGrepReplaceTool }
export { ensureAstGrepBinary, getCachedBinaryPath, getCacheDir } from "./downloader.js"
export { getAstGrepPath, isCliAvailable, ensureCliAvailable, startBackgroundInit } from "./cli.js"
export { checkEnvironment, formatEnvironmentCheck } from "./constants.js"
export type { EnvironmentCheckResult } from "./constants.js"
