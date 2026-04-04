import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Type, Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from '../../types.js';
import {
  BACKGROUND_TASK_DESCRIPTION,
  BACKGROUND_OUTPUT_DESCRIPTION,
  BACKGROUND_CANCEL_DESCRIPTION,
} from './constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';

const execAsync = promisify(exec);
const LOG_PREFIX_BG = `${LOG_PREFIX}[background-task]`;

interface BackgroundTask {
  sessionKey: string;
  description: string;
  agent: string;
  startTime: number;
  status: 'running' | 'completed' | 'cancelled' | 'failed';
  output?: string;
}

// In-memory task store
const taskStore = new Map<string, BackgroundTask>();

const BackgroundTaskParamsSchema = Type.Object({
  description: Type.String({
    description: 'Short task description (shown in status)',
  }),
  prompt: Type.String({
    description: 'Full detailed prompt for the agent',
  }),
  agent: Type.Optional(Type.String({
    description: 'Agent ID to use (e.g., omoc_explore, omoc_librarian). Default: omoc_sisyphus',
  })),
});

type BackgroundTaskParams = Static<typeof BackgroundTaskParamsSchema>;

const BackgroundOutputParamsSchema = Type.Object({
  task_id: Type.String({
    description: 'Background task ID to get output from',
  }),
  block: Type.Optional(Type.Boolean({
    description: 'Wait for completion if still running (default: false)',
  })),
});

type BackgroundOutputParams = Static<typeof BackgroundOutputParamsSchema>;

const BackgroundCancelParamsSchema = Type.Object({
  task_id: Type.Optional(Type.String({
    description: 'Specific task ID to cancel',
  })),
  all: Type.Optional(Type.Boolean({
    description: 'Cancel ALL running background tasks',
  })),
});

type BackgroundCancelParams = Static<typeof BackgroundCancelParamsSchema>;

export function registerBackgroundTaskTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering background-task tools`);

  // Background task launcher
  api.registerTool({
    name: `${TOOL_PREFIX}background_task`,
    description: '⚠️ Returns sessions_spawn instructions - does NOT create session. Caller must execute sessions_spawn with returned parameters. Use background_output to get results after session is created.',
    parameters: BackgroundTaskParamsSchema,
    execute: async (_toolCallId: string, params: BackgroundTaskParams) => {
      api.logger.info(`${LOG_PREFIX_BG} Launching background task: ${params.description}`);

      try {
        if (!params.prompt?.trim()) {
          return toolError('Prompt is required');
        }

        const agentId = params.agent?.startsWith('omoc_') ? params.agent : `omoc_${params.agent || 'sisyphus'}`;
        const agentName = agentId.replace('omoc_', '');

        // Build instruction for caller to execute sessions_spawn
        const instruction = [
          `🔄 Background Task → Agent "${agentId}"`,
          '',
          '⚡ CALLER: Execute sessions_spawn with these parameters:',
          '',
          '```typescript',
          'sessions_spawn({',
          `  task: "${params.prompt.replace(/"/g, '\\"')}",`,
          `  runtime: "subagent",`,
          `  agentId: "${agentName}",`,
          `  mode: "session",`,
          `  label: "${params.description}",`,
          `  cleanup: "keep",`,
          '})',
          '```',
          '',
          '📋 Parameters:',
          `- Agent: ${agentId}`,
          `- Task: ${params.description}`,
          `- Mode: Session (background)`,
          '',
          '⚠️ Do NOT just return this metadata. The CALLER must execute sessions_spawn.',
          '',
          '💡 After sessions_spawn returns, store the sessionKey and use background_output to check status.',
        ].filter(Boolean).join('\n');

        return toolResponse(instruction);
      } catch (e: any) {
        api.logger.error(`${LOG_PREFIX_BG} Error:`, e);
        return toolError(e.message || String(e));
      }
    },
  });

  // Background output retriever
  api.registerTool({
    name: `${TOOL_PREFIX}background_output`,
    description: BACKGROUND_OUTPUT_DESCRIPTION,
    parameters: BackgroundOutputParamsSchema,
    execute: async (_toolCallId: string, params: BackgroundOutputParams) => {
      api.logger.info(`${LOG_PREFIX_BG} Getting output for task: ${params.task_id}`);

      try {
        const task = taskStore.get(params.task_id);
        if (!task) {
          return toolError(`Task not found: ${params.task_id}. Please provide the sessionKey directly.`);
        }

        // Read session file directly
        const sessionFile = `/home/lileilei/.openclaw/agents/${task.agent.replace('omoc_', '')}/sessions/${task.sessionKey.split(':').pop()}.jsonl`;
        
        try {
          const { stdout } = await execAsync(`tail -100 "${sessionFile}"`);
          const lines = stdout.trim().split('\n');
          const messages: any[] = [];
          
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const entry = JSON.parse(line);
              if (entry.type === 'message' && entry.message) {
                messages.push(entry.message);
              }
            } catch {
              // Skip invalid JSON
            }
          }
          
          if (messages.length === 0) {
            return toolResponse(`Task is still running. No output available yet.

**Task**: ${task.description}
**Status**: Running since ${new Date(task.startTime).toLocaleTimeString()}

Wait for completion notification or check again later.`);
          }
          
          // Extract final output
          const lastMessage = messages[messages.length - 1];
          const output = Array.isArray(lastMessage.content) 
            ? lastMessage.content.map((c: any) => c.text || c.content || JSON.stringify(c)).join('\n')
            : (typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content));
          
          // Update task status
          task.status = 'completed';
          task.output = output;
          taskStore.set(params.task_id, task);
          
          const duration = Math.floor((Date.now() - task.startTime) / 1000);
          
          return toolResponse(`Background task completed.

**Task**: ${task.description}
**Agent**: ${task.agent}
**Duration**: ${duration}s

**Output**:
${output}`);
        } catch (e: any) {
          // Session file not found or not readable
          return toolResponse(`Task is still running. No output available yet.

**Task**: ${task.description}
**Status**: Running since ${new Date(task.startTime).toLocaleTimeString()}

Wait for completion notification or check again later.`);
        }
      } catch (e: any) {
        api.logger.error(`${LOG_PREFIX_BG} Error:`, e);
        return toolError(e.message || String(e));
      }
    },
  });

  // Background task canceller
  api.registerTool({
    name: `${TOOL_PREFIX}background_cancel`,
    description: BACKGROUND_CANCEL_DESCRIPTION,
    parameters: BackgroundCancelParamsSchema,
    execute: async (_toolCallId: string, params: BackgroundCancelParams) => {
      api.logger.info(`${LOG_PREFIX_BG} Cancel request:`, params);

      try {
        const toCancel: string[] = [];

        if (params.all) {
          // Cancel all running tasks
          for (const [taskId, task] of taskStore.entries()) {
            if (task.status === 'running') {
              toCancel.push(taskId);
            }
          }
        } else if (params.task_id) {
          // Cancel specific task
          const task = taskStore.get(params.task_id);
          if (!task) {
            return toolError(`Task not found: ${params.task_id}`);
          }
          if (task.status !== 'running') {
            return toolResponse(`Task ${params.task_id} is already ${task.status}. Nothing to cancel.`);
          }
          toCancel.push(params.task_id);
        } else {
          return toolError('Specify either task_id or all=true');
        }

        // Cancel tasks (mark as cancelled - actual session termination requires manual intervention)
        const cancelled: string[] = [];
        for (const taskId of toCancel) {
          const task = taskStore.get(taskId);
          if (task) {
            api.logger.info(`${LOG_PREFIX_BG} Session ${task.sessionKey} marked as cancelled`);
            task.status = 'cancelled';
            taskStore.set(taskId, task);
            cancelled.push(taskId);
          }
        }

        return toolResponse(`Cancelled ${cancelled.length} background task(s): ${cancelled.join(', ') || 'none'}.

Note: Session termination requires manual intervention. Use OpenClaw UI to kill sessions if needed.`);
      } catch (e: any) {
        api.logger.error(`${LOG_PREFIX_BG} Error:`, e);
        return toolError(e.message || String(e));
      }
    },
  });

  api.logger.info(`${LOG_PREFIX} Background-task tools registered successfully (3 tools)`);
}
