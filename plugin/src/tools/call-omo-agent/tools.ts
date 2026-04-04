import { Type, Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from '../../types.js';
import { ALLOWED_AGENTS, CALL_OMO_AGENT_DESCRIPTION } from './constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';

const LOG_PREFIX_CALL_OMO = `${LOG_PREFIX}[call-omo-agent]`;

const CallOmoAgentParamsSchema = Type.Object({
  description: Type.String({
    description: 'A short (3-5 words) description of the task',
  }),
  prompt: Type.String({
    description: 'The task for the agent to perform',
  }),
  subagent_type: Type.String({
    description: 'The type of specialized agent to use for this task (explore or librarian only)',
  }),
  run_in_background: Type.Boolean({
    description: 'REQUIRED. true: run asynchronously (use background_output to get results), false: run synchronously and wait for completion',
  }),
  session_id: Type.Optional(Type.String({
    description: 'Existing Task session to continue',
  })),
});

type CallOmoAgentParams = Static<typeof CallOmoAgentParamsSchema>;

export function registerCallOmoAgentTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering call-omo-agent tool`);

  const agentDescriptions = ALLOWED_AGENTS.map(
    (name) => `- ${name}: Specialized agent for ${name} tasks`
  ).join('\n');

  api.registerTool({
    name: `${TOOL_PREFIX}call_omo_agent`,
    description: '⚠️ Returns sessions_spawn instructions - does NOT create session. Caller must execute sessions_spawn with returned parameters. Available: explore, librarian. run_in_background REQUIRED.',
    parameters: CallOmoAgentParamsSchema,
    execute: async (_toolCallId: string, params: CallOmoAgentParams) => {
      api.logger.info(`${LOG_PREFIX_CALL_OMO} Starting with agent: ${params.subagent_type}, background: ${params.run_in_background}`);

      try {
        // Validate agent type
        const normalizedAgent = params.subagent_type.toLowerCase();
        if (!ALLOWED_AGENTS.includes(normalizedAgent as typeof ALLOWED_AGENTS[number])) {
          return toolError(`Invalid agent type "${params.subagent_type}". Only ${ALLOWED_AGENTS.join(', ')} are allowed.`);
        }

        // Build instruction for caller to execute sessions_spawn
        const sessionMode = params.run_in_background ? 'session' : 'run';
        const cleanup = params.run_in_background ? 'keep' : 'delete';

        const instruction = [
          `🔄 Call OmO Agent → "${normalizedAgent}"`,
          '',
          '⚡ CALLER: Execute sessions_spawn with these parameters:',
          '',
          '```typescript',
          'sessions_spawn({',
          `  task: "${params.prompt.replace(/"/g, '\\"')}",`,
          `  runtime: "subagent",`,
          `  agentId: "${normalizedAgent}",`,
          `  mode: "${sessionMode}",`,
          params.description ? `  label: "${params.description}",` : '',
          `  cleanup: "${cleanup}",`,
          params.session_id && !params.run_in_background ? `  resumeSessionId: "${params.session_id}",` : '',
          '})',
          '```',
          '',
          '📋 Parameters:',
          `- Agent: ${normalizedAgent}`,
          `- Task: ${params.description}`,
          `- Background: ${params.run_in_background ? 'Yes (session mode)' : 'No (run mode)'}`,
          '',
          '⚠️ Do NOT just return this metadata. The CALLER must execute sessions_spawn.',
        ].filter(Boolean).join('\n');

        return toolResponse(instruction);
      } catch (e: any) {
        api.logger.error(`${LOG_PREFIX_CALL_OMO} Error:`, e);
        return toolError(e.message || String(e));
      }
    },
    optional: true,
  });

  api.logger.info(`${LOG_PREFIX} Call-omo-agent tool registered successfully`);
}
