import { Type, Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from '../../types.js';
import { TOOL_PREFIX, LOG_PREFIX, CATEGORIES } from '../../constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';

const LOG_PREFIX_DELEGATE = `${LOG_PREFIX}[delegate]`;

const DelegateTaskParamsSchema = Type.Object({
  task_description: Type.String({
    description: 'Task description for the agent',
  }),
  category: Type.String({
    description: 'Category for model routing (e.g., "quick", "deep", "ultrabrain")',
  }),
});

type DelegateTaskParams = Static<typeof DelegateTaskParamsSchema>;

const categoryNames = [...CATEGORIES];

const DEFAULT_MODEL = 'claude-sonnet-4-6';

export function registerDelegateTaskTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering delegate-task tool`);

  api.registerTool({
    name: `${TOOL_PREFIX}delegate`,
    description:
      '⚠️ Returns sessions_spawn instructions - does NOT create session. Caller must execute sessions_spawn with returned parameters. Category-based model routing.',
    parameters: DelegateTaskParamsSchema,
    execute: async (_toolCallId: string, params: DelegateTaskParams) => {
      api.logger.info(`${LOG_PREFIX_DELEGATE} Starting delegation:`, {
        category: params.category,
      });

      try {
        // Validate required parameters
        if (!params.task_description?.trim()) {
          return toolError('Task description is required and cannot be empty');
        }

        if (params.task_description.length > 10000) {
          return toolError('Task description too long (max 10000 chars)');
        }

        // Validate category
        const normalizedCategory = params.category.toLowerCase();
        if (!categoryNames.includes(normalizedCategory)) {
          return toolError(
            `Invalid category: ${params.category}. Valid: ${categoryNames.join(', ')}`
          );
        }

        // Resolve model from config.model_routing or use default
        const routingConfig = (api.config as any).model_routing;
        let model = DEFAULT_MODEL;
        let alternatives: string[] | undefined;

        if (routingConfig && routingConfig[normalizedCategory]) {
          model = routingConfig[normalizedCategory].model ?? DEFAULT_MODEL;
          alternatives = routingConfig[normalizedCategory].alternatives;
        }

        const agentId = normalizedCategory;

        api.logger.info(`${LOG_PREFIX_DELEGATE} Category: ${normalizedCategory}, model: ${model}`);

        // Build instruction for caller to execute sessions_spawn
        const instruction = [
          `🔄 Delegate Task → Category "${normalizedCategory}" → Agent "${agentId}"`,
          '',
          '⚡ CALLER: Execute sessions_spawn with these parameters:',
          '',
          '```typescript',
          'sessions_spawn({',
          `  task: "${params.task_description.replace(/"/g, '\\"')}",`,
          `  runtime: "subagent",`,
          `  agentId: "${agentId}",`,
          `  mode: "run",`,
          `  model: "${model}",`,
          '  cleanup: "delete",',
          '})',
          '```',
          '',
          '📋 Parameters:',
          `- Category: ${normalizedCategory}`,
          `- Agent: ${agentId}`,
          `- Model: ${model} (recommended)`,
          ...(alternatives && alternatives.length > 0
            ? [`- Recommended fallback models (informational only): ${alternatives.join(', ')}`]
            : []),
          '',
          '⚠️ Do NOT just return this metadata. The CALLER must execute sessions_spawn.',
        ].filter(Boolean).join('\n');

        return toolResponse(instruction);
      } catch (e: any) {
        api.logger.error(`${LOG_PREFIX_DELEGATE} Error:`, e);
        return toolError(e.message || String(e));
      }
    },
    optional: true,
  });

  api.logger.info(`${LOG_PREFIX} Delegate-task tool registered successfully`);
}
