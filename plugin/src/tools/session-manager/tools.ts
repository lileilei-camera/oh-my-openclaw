import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { Type, Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from '../../types.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';
import { SESSION_LIST_DESCRIPTION, SESSION_READ_DESCRIPTION } from './constants.js';

const execAsync = promisify(exec);

const SessionListParamsSchema = Type.Object({
  limit: Type.Optional(Type.Number({
    description: 'Maximum number of sessions to return (default: 20)',
    default: 20,
  })),
  activeMinutes: Type.Optional(Type.Number({
    description: 'Filter sessions active within last N minutes',
  })),
  kinds: Type.Optional(Type.Array(Type.String(), {
    description: 'Filter by session kinds (e.g. ["subagent", "acp"])',
  })),
});

type SessionListParams = Static<typeof SessionListParamsSchema>;

const SessionReadParamsSchema = Type.Object({
  sessionKey: Type.String({
    description: 'Session key to read',
  }),
  limit: Type.Optional(Type.Number({
    description: 'Maximum number of messages to return (default: 50)',
    default: 50,
  })),
  includeTools: Type.Optional(Type.Boolean({
    description: 'Include tool call details (default: false)',
    default: false,
  })),
});

type SessionReadParams = Static<typeof SessionReadParamsSchema>;

/**
 * Get OpenClaw agents directory path
 */
function getAgentsDir(): string {
  return join(homedir(), '.openclaw', 'agents');
}

/**
 * Extract sessionId from session key
 * Session key format: agent:<agent-id>:<...>:<sessionId>
 * The sessionId is a UUID (8-4-4-4-12 format)
 */
function extractSessionId(sessionKey: string): string | null {
  // Try to find UUID pattern in the session key
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = sessionKey.match(uuidPattern);
  if (match) {
    return match[0];
  }
  // Fallback: use last part of key
  const parts = sessionKey.split(':');
  if (parts.length > 0) {
    return parts[parts.length - 1];
  }
  return null;
}

/**
 * Parse session key to extract agent id and session id
 */
function parseSessionKey(sessionKey: string): { agentId: string; sessionId: string } | null {
  const parts = sessionKey.split(':');
  if (parts.length < 2 || parts[0] !== 'agent') {
    return null;
  }
  const agentId = parts[1];
  const sessionId = extractSessionId(sessionKey);
  if (!sessionId) {
    return null;
  }
  return { agentId, sessionId };
}

/**
 * Find session file path from session key
 */
async function findSessionFile(sessionKey: string): Promise<string | null> {
  const parsed = parseSessionKey(sessionKey);
  if (!parsed) {
    return null;
  }

  const agentsDir = getAgentsDir();
  const agentDir = join(agentsDir, parsed.agentId, 'sessions');

  try {
    const files = await readdir(agentDir, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.jsonl')) {
        const sessionId = file.name.replace('.jsonl', '');
        if (sessionId === parsed.sessionId || sessionKey.includes(sessionId)) {
          return join(agentDir, file.name);
        }
      }
    }
  } catch (e) {
    // Directory might not exist
  }

  return null;
}

/**
 * Parse JSONL file and extract messages
 */
async function parseSessionFile(filePath: string, limit: number, includeTools: boolean): Promise<any[]> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  
  const messages: any[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const entry = JSON.parse(line);
      
      if (entry.type === 'message') {
        const msg = entry.message;
        if (msg) {
          const formattedMsg: any = {
            role: msg.role,
            content: msg.content,
            timestamp: entry.timestamp,
          };
          
          if (includeTools && msg.toolCalls) {
            formattedMsg.toolCalls = msg.toolCalls;
          }
          
          messages.push(formattedMsg);
        }
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
    
    if (messages.length >= limit) {
      break;
    }
  }
  
  return messages;
}

export function registerSessionListTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering session-list tool`);

  api.registerTool({
    name: `${TOOL_PREFIX}list`,
    description: SESSION_LIST_DESCRIPTION,
    parameters: SessionListParamsSchema,
    execute: async (_toolCallId: string, params: SessionListParams) => {
      api.logger.info(`${LOG_PREFIX} Session list:`, { limit: params.limit, activeMinutes: params.activeMinutes });

      try {
        // Use OpenClaw CLI to list sessions
        let cmd = 'openclaw sessions --json';
        
        if (params.activeMinutes) {
          cmd += ` --active ${params.activeMinutes}`;
        }
        
        const { stdout, stderr } = await execAsync(cmd);
        
        if (stderr && !stdout) {
          return toolError(`Failed to list sessions: ${stderr}`);
        }
        
        const result = JSON.parse(stdout);
        const sessions = result.sessions || [];
        
        if (sessions.length === 0) {
          return toolResponse('No sessions found.');
        }

        // Format as table
        const lines: string[] = [];
        lines.push(`Found ${sessions.length} session(s):\n`);
        
        for (const session of sessions) {
          const key = session.key || 'unknown';
          const model = session.model || 'N/A';
          const updatedAt = session.updatedAt ? new Date(session.updatedAt).toISOString() : 'N/A';
          
          lines.push(`- **${key}**`);
          lines.push(`  Model: ${model}, Updated: ${updatedAt}`);
          if (session.sessionId) {
            lines.push(`  Session ID: ${session.sessionId}`);
          }
          lines.push('');
        }

        return toolResponse(lines.join('\n'));
      } catch (e: any) {
        api.logger.error(`${LOG_PREFIX} Session list error:`, e);
        return toolError(e.message || String(e));
      }
    },
    optional: true,
  });

  api.logger.info(`${LOG_PREFIX} Session-list tool registered successfully`);
}

export function registerSessionReadTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering session-read tool`);

  api.registerTool({
    name: `${TOOL_PREFIX}read`,
    description: SESSION_READ_DESCRIPTION,
    parameters: SessionReadParamsSchema,
    execute: async (_toolCallId: string, params: SessionReadParams) => {
      api.logger.info(`${LOG_PREFIX} Session read:`, { sessionKey: params.sessionKey, limit: params.limit });

      try {
        // Find session file
        const sessionFile = await findSessionFile(params.sessionKey);
        
        if (!sessionFile) {
          return toolError(`Session file not found for key: ${params.sessionKey}`);
        }

        // Parse session file
        const messages = await parseSessionFile(sessionFile, params.limit ?? 50, params.includeTools ?? false);
        
        if (messages.length === 0) {
          return toolResponse(`No messages found in session: ${params.sessionKey}`);
        }

        // Format messages
        const lines: string[] = [];
        lines.push(`Session: ${params.sessionKey}\n`);
        lines.push(`Messages: ${messages.length}\n`);
        lines.push('---\n');
        
        for (const msg of messages) {
          const role = msg.role || 'unknown';
          const timestamp = msg.timestamp ? new Date(msg.timestamp).toISOString() : 'N/A';
          
          lines.push(`[${role}] ${timestamp}`);
          
          if (msg.content) {
            const content = Array.isArray(msg.content) 
              ? msg.content.map((c: any) => c.text || c.content || JSON.stringify(c)).join('\n')
              : (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
            // Truncate long content
            const truncated = content.length > 500 ? content.substring(0, 500) + '...' : content;
            lines.push(truncated);
          }
          
          if (params.includeTools && msg.toolCalls && msg.toolCalls.length > 0) {
            lines.push(`  Tool calls: ${msg.toolCalls.map((t: any) => t.name).join(', ')}`);
          }
          
          lines.push('');
        }

        return toolResponse(lines.join('\n'));
      } catch (e: any) {
        api.logger.error(`${LOG_PREFIX} Session read error:`, e);
        return toolError(e.message || String(e));
      }
    },
    optional: true,
  });

  api.logger.info(`${LOG_PREFIX} Session-read tool registered successfully`);
}
