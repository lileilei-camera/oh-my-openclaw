// Oh-My-OpenClaw Plugin - Entry Point
// 完全使用 OpenClaw Plugin SDK

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { VERSION } from './version.js';
import { PLUGIN_ID } from './types.js';
import { getPluginConfig } from './types.js';
import { registerTodoEnforcer } from './hooks/todo-enforcer.js';
import { registerCommentChecker } from './hooks/comment-checker.js';
import { registerMessageMonitor } from './hooks/message-monitor.js';
import { registerStartupHook } from './hooks/startup.js';
import { registerRalphLoop } from './services/ralph-loop.js';
import { registerWebhookBridge } from './services/webhook-bridge.js';
import { registerSubagentTracker } from './hooks/subagent-tracker.js';
import { registerDelegateTaskTool } from './tools/delegate-task/index.js';
import { registerSlashcommandTool } from './tools/slashcommand/index.js';
import { registerOmoDelegateTool } from './tools/omo-delegation.js';
import { registerLookAtTool } from './tools/look-at/index.js';
import { registerCheckpointTool } from './tools/checkpoint.js';
import { registerWebSearchTool } from './tools/web-search.js';
import { registerRalphCommands } from './commands/ralph-commands.js';
import { registerStatusCommands } from './commands/status-commands.js';
import { registerOmocCommands } from './commands/omoc-commands.js';
import { registerTodoCommands } from './commands/todo-commands.js';
import { registerContextInjector } from './hooks/context-injector.js';
import { registerGuardrailInjector } from './hooks/guardrail-injector.js';
import { registerSpawnGuard } from './hooks/spawn-guard.js';
import { registerModeSwitch } from './hooks/mode-switch/hook.js';
import { registerProjectBootstrap } from './hooks/project-init/project-bootstrap.js';
import { registerProjectGuard } from './hooks/project-guard/guard-register.js';
import { registerDumpContext } from './hooks/dump-context.js';
import { registerTodoReminder, registerAgentEndReminder, registerSessionCleanup } from './hooks/todo-reminder.js';
import { registerTodoTools } from './tools/todo/index.js';
import { registerGrepTool } from './tools/grep/index.js';
import { registerGlobTool } from './tools/glob/index.js';
import {
  registerLspGotoDefinitionTool,
  registerLspFindReferencesTool,
  registerLspSymbolsTool,
  registerLspDiagnosticsTool,
  registerLspPrepareRenameTool,
  registerLspRenameTool,
} from './tools/lsp/index.js';
import { registerAstGrepTools } from './tools/ast-grep/index.js';
import { registerSetupCli } from './cli/setup.js';
import { initPersonaState } from './utils/persona-state.js';

/**
 * Plugin registry counters
 */
let hookCount = 0;
let toolCount = 0;
let commandCount = 0;
let serviceCount = 0;

/**
 * Oh-My-OpenClaw Plugin Registration
 */
export default function register(api: OpenClawPluginApi) {
  hookCount = 0;
  toolCount = 0;
  commandCount = 0;
  serviceCount = 0;

  const config = getPluginConfig(api);

  api.logger.info(`[${PLUGIN_ID}] Initializing plugin v${VERSION}`);
  api.logger.info(`[${PLUGIN_ID}] Configuration: max_ralph_iterations=${config.max_ralph_iterations}, todo_enforcer=${config.todo_enforcer_enabled}`);

  // Initialize persona state
  initPersonaState(api);

  // Register hooks (synchronous — no skill discovery dependency)
  registerStartupHook(api); hookCount++;
  registerTodoEnforcer(api); hookCount++;
  registerCommentChecker(api); hookCount++;
  registerMessageMonitor(api); hookCount++;
  registerSubagentTracker(api); hookCount++;
  registerContextInjector(api); hookCount++;
  registerGuardrailInjector(api); hookCount++;
  registerSpawnGuard(api); hookCount++;
  registerModeSwitch(api); hookCount++;
  registerProjectBootstrap(api); hookCount++;
  registerProjectGuard(api); hookCount += 2; // before_tool_call + agent_end
  registerDumpContext(api); hookCount++; // llm_input
  registerTodoReminder(api); hookCount += 3; // 3 hooks
  registerAgentEndReminder(api); hookCount++;

  // Register tools
  registerDelegateTaskTool(api); toolCount++; // delegate_task tool
  registerSlashcommandTool(api); toolCount++; // slashcommand
  registerOmoDelegateTool(api); toolCount++;
  registerLookAtTool(api); toolCount++;
  registerCheckpointTool(api); toolCount++;
  registerWebSearchTool(api); toolCount++;
  registerTodoTools(api); toolCount += 4; // 4 todo tools
  registerGrepTool(api); toolCount++; // grep tool
  registerGlobTool(api); toolCount++; // glob tool
  registerLspGotoDefinitionTool(api); toolCount++; // lsp-goto-definition tool
  registerLspFindReferencesTool(api); toolCount++; // lsp-find-references tool
  registerLspSymbolsTool(api); toolCount++; // lsp-symbols tool
  registerLspDiagnosticsTool(api); toolCount++; // lsp-diagnostics tool
  registerLspPrepareRenameTool(api); toolCount++; // lsp-prepare-rename tool
  registerLspRenameTool(api); toolCount++; // lsp-rename tool
  registerAstGrepTools(api); toolCount += 2; // ast-grep-search, ast-grep-replace tools

  // Register commands
  registerRalphCommands(api); commandCount += 2; // /omoc_ralph_loop, /omoc_ralph_stop
  registerStatusCommands(api); commandCount += 2; // /omoc_health, /omoc_config
  registerOmocCommands(api); commandCount += 5; // /omoc (unified), /omoc_mode (alias), /omoc_init (alias), /start-work (alias), /plan (alias)
  registerTodoCommands(api); commandCount += 1; // /omoc_todos

  // Register services
  registerRalphLoop(api); serviceCount++;
  registerWebhookBridge(api); serviceCount++;

  // Register CLI
  api.registerCli((ctx: { program: any; workspaceDir?: string; logger: any }) => {
    registerSetupCli({ program: ctx.program, workspaceDir: ctx.workspaceDir, logger: ctx.logger });
  }, { commands: ['omoc-setup'] });

  api.logger.info(`[${PLUGIN_ID}] Plugin initialized with ${toolCount} tools, ${commandCount} commands, ${hookCount} hooks, ${serviceCount} services`);
}

export { register };
export { hookCount, toolCount, commandCount, serviceCount };
