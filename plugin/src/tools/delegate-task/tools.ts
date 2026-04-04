import { Type, Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from '../../types.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';
// DELEGATE_TASK_DESCRIPTION not exported, using inline description
import {
  DEFAULT_CATEGORY_AGENTS,
  DEFAULT_CATEGORY_MODELS,
  CATEGORY_PROMPT_APPENDS,
  CATEGORY_DESCRIPTIONS,
} from './constants.js';

const LOG_PREFIX_DELEGATE = `${LOG_PREFIX}[delegate-task]`;

const DelegateTaskParamsSchema = Type.Object({
  description: Type.String({
    description: 'Short task description (3-5 words)',
  }),
  prompt: Type.String({
    description: 'Full detailed prompt for the agent',
  }),
  load_skills: Type.Array(Type.String(), {
    description: 'Skill names to inject. REQUIRED - pass [] if no skills needed',
  }),
  category: Type.Optional(Type.String({
    description: 'Category (e.g., "quick", "deep", "ultrabrain", "visual-engineering", "multimodal", "artistry", "unspecified-low", "unspecified-high", "writing"). Mutually exclusive with subagent_type.',
  })),
  subagent_type: Type.Optional(Type.String({
    description: 'Agent name (e.g., "oracle", "explore", "librarian"). Mutually exclusive with category.',
  })),
  run_in_background: Type.Boolean({
    description: 'true=async (returns task_id), false=sync (waits). Default: false',
    default: false,
  }),
  session_id: Type.Optional(Type.String({
    description: 'Existing Task session to continue',
  })),
  command: Type.Optional(Type.String({
    description: 'The command that triggered this task (optional, for tracking)',
  })),
});

type DelegateTaskParams = Static<typeof DelegateTaskParamsSchema>;

const categoryNames = Object.keys(DEFAULT_CATEGORY_AGENTS);

export function registerDelegateTaskTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering delegate-task tool`);

  // Register both omoc_delegate_task (canonical) and omoc_delegate (alias for backward compatibility)
  const toolNames = [`${TOOL_PREFIX}delegate_task`, `${TOOL_PREFIX}delegate`];
  
  for (const toolName of toolNames) {
    api.logger.info(`${LOG_PREFIX} Registering tool: ${toolName}`);
    
    api.registerTool({
      name: toolName,
      description: toolName === `${TOOL_PREFIX}delegate` 
        ? '⚠️ Returns sessions_spawn instructions - does NOT create session. Caller must execute sessions_spawn with returned parameters. Alias for omoc_delegate_task.' 
        : '⚠️ Returns sessions_spawn instructions - does NOT create session. Caller must execute sessions_spawn with returned parameters. Category-based model routing.',
    parameters: DelegateTaskParamsSchema,
    execute: async (_toolCallId: string, params: DelegateTaskParams) => {
      api.logger.info(`${LOG_PREFIX_DELEGATE} Starting delegation:`, {
        category: params.category,
        subagent_type: params.subagent_type,
        background: params.run_in_background,
      });

      try {
        // Validate required parameters
        if (!params.prompt?.trim()) {
          return toolError('Prompt is required and cannot be empty');
        }

        if (params.prompt.length > 10000) {
          return toolError('Prompt too long (max 10000 chars)');
        }

        // Validate category vs subagent_type
        if (params.category && params.subagent_type) {
          return toolError(
            `Cannot specify both 'category' and 'subagent_type'. Choose one.`
          );
        }

        // Resolve agent and category
        let agentId: string;
        let category: string | undefined;
        let model: string | undefined;
        let categoryPromptAppend: string | undefined;

        if (params.category) {
          const normalizedCategory = params.category.toLowerCase();
          if (!categoryNames.includes(normalizedCategory)) {
            return toolError(
              `Invalid category: ${params.category}. Valid: ${categoryNames.join(', ')}`
            );
          }
          category = normalizedCategory;
          agentId = DEFAULT_CATEGORY_AGENTS[category] || 'omoc_sisyphus';
          model = DEFAULT_CATEGORY_MODELS[category];
          categoryPromptAppend = CATEGORY_PROMPT_APPENDS[category];
        } else if (params.subagent_type) {
          agentId = params.subagent_type.startsWith('omoc_')
            ? params.subagent_type
            : `omoc_${params.subagent_type.toLowerCase()}`;
          category = undefined;
        } else {
          // Default to quick category
          category = 'quick';
          agentId = DEFAULT_CATEGORY_AGENTS[category];
          model = DEFAULT_CATEGORY_MODELS[category];
        }

        // Build final prompt with category-specific guidance
        let finalPrompt = params.prompt;
        if (categoryPromptAppend) {
          finalPrompt = `${params.prompt}\n\n${categoryPromptAppend}`;
        }

        api.logger.info(`${LOG_PREFIX_DELEGATE} Agent: ${agentId}, category: ${category}, model: ${model}`);

        // Build instruction for caller to execute sessions_spawn
        const sessionMode = params.run_in_background ? 'session' : 'run';
        const cleanup = params.run_in_background ? 'keep' : 'delete';

        const instruction = [
          `🔄 Delegate Task → Category "${category || 'quick'}" → Agent "${agentId}"`,
          '',
          '⚡ CALLER: Execute sessions_spawn with these parameters:',
          '',
          '```typescript',
          'sessions_spawn({',
          `  task: "${finalPrompt.replace(/"/g, '\\"')}",`,
          `  runtime: "subagent",`,
          `  agentId: "${agentId.replace('omoc_', '')}",`,
          `  mode: "${sessionMode}",`,
          model ? `  model: "${model}",  // Recommended model for this category` : '',
          params.description ? `  label: "${params.description}",` : '',
          `  cleanup: "${cleanup}",`,
          params.session_id ? `  resumeSessionId: "${params.session_id}",` : '',
          '})',
          '```',
          '',
          '📋 Parameters:',
          `- Task: ${params.description}`,
          `- Category: ${category || 'quick'}`,
          `- Agent: ${agentId}`,
          model ? `- Model: ${model} (recommended)` : '',
          `- Background: ${params.run_in_background ? 'Yes (session mode)' : 'No (run mode)'}`,
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
  }

  api.logger.info(`${LOG_PREFIX} Delegate-task tool registered successfully (both omoc_delegate_task and omoc_delegate)`);
}
