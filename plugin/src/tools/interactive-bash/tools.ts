import { exec } from 'child_process';
import { promisify } from 'util';
import { Type, Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from '../../types.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';
import { BLOCKED_TMUX_SUBCOMMANDS, DEFAULT_TIMEOUT_MS, INTERACTIVE_BASH_DESCRIPTION } from './constants.js';
import { getCachedTmuxPath } from './utils.js';

const execAsync = promisify(exec);

/**
 * Quote-aware command tokenizer with escape handling
 * Handles single/double quotes and backslash escapes without external dependencies
 */
export function tokenizeCommand(cmd: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  let escaped = false;

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if ((char === "'" || char === '"') && !inQuote) {
      inQuote = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuote) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}

const InteractiveBashParamsSchema = Type.Object({
  tmux_command: Type.String({
    description: "The tmux command to execute (without 'tmux' prefix). Examples: new-session -d -s omo-dev, send-keys -t omo-dev \"vim\" Enter",
  }),
  timeout: Type.Optional(Type.Number({
    description: 'Timeout in milliseconds (default: 60000)',
    default: 60000,
  })),
});

type InteractiveBashParams = Static<typeof InteractiveBashParamsSchema>;

export function registerInteractiveBashTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering interactive-bash tool`);

  api.registerTool({
    name: `${TOOL_PREFIX}interactive-bash`,
    description: INTERACTIVE_BASH_DESCRIPTION,
    parameters: InteractiveBashParamsSchema,
    execute: async (_toolCallId: string, params: InteractiveBashParams) => {
      api.logger.info(`${LOG_PREFIX} Interactive bash:`, { tmux_command: params.tmux_command });

      try {
        const tmuxPath = getCachedTmuxPath() ?? 'tmux';

        const parts = tokenizeCommand(params.tmux_command);

        if (parts.length === 0) {
          return toolError('Empty tmux command');
        }

        const subcommand = parts[0].toLowerCase();
        if (BLOCKED_TMUX_SUBCOMMANDS.includes(subcommand)) {
          const sessionIdx = parts.findIndex(p => p === '-t' || p.startsWith('-t'));
          let sessionName = 'omo-session';
          if (sessionIdx !== -1) {
            if (parts[sessionIdx] === '-t' && parts[sessionIdx + 1]) {
              sessionName = parts[sessionIdx + 1];
            } else if (parts[sessionIdx].startsWith('-t')) {
              sessionName = parts[sessionIdx].slice(2);
            }
          }

          return toolError(
            `'${parts[0]}' is blocked in interactive-bash. ` +
            `Use Bash tool instead to capture terminal output.`
          );
        }

        const timeout = Math.min(params.timeout ?? DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
        const command = `${tmuxPath} ${parts.join(' ')}`;

        const { stdout, stderr } = await execAsync(command, {
          timeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        });

        if (stderr.trim()) {
          return toolError(stderr.trim());
        }

        return toolResponse(stdout || '(no output)');
      } catch (e: any) {
        if (e.killed) {
          return toolError(`Timeout after ${params.timeout ?? DEFAULT_TIMEOUT_MS}ms`);
        }
        return toolError(e.message || String(e));
      }
    },
    optional: true,
  });

  api.logger.info(`${LOG_PREFIX} Interactive-bash tool registered successfully`);
}
