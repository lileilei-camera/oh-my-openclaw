import { execFile } from 'node:child_process';
import { Type, Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from '../../types.js';
import { LOOK_AT_DESCRIPTION } from './constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';

const LOG_PREFIX_LOOK_AT = `${LOG_PREFIX}[look-at]`;
const GEMINI_TIMEOUT_MS = 60_000;

const LookAtParamsSchema = Type.Object({
  file_path: Type.String({
    description: 'Absolute path to the file to analyze',
  }),
  goal: Type.String({
    description: 'What specific information to extract from the file',
  }),
  model: Type.Optional(Type.String({
    description: 'Gemini model to use',
    default: 'gemini-3-flash-preview',
  })),
});

type LookAtParams = Static<typeof LookAtParamsSchema>;

export function registerLookAtTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering look-at tool`);

  api.registerTool({
    name: `${TOOL_PREFIX}look_at`,
    description: LOOK_AT_DESCRIPTION,
    parameters: LookAtParamsSchema,
    execute: async (_toolCallId: string, params: LookAtParams) => {
      api.logger.info(`${LOG_PREFIX_LOOK_AT} Analyzing file: ${params.file_path}, goal: ${params.goal}`);

      const model = params.model ?? 'gemini-3-flash-preview';
      const goal = params.goal;
      const file_path = params.file_path;

      return new Promise((resolve) => {
        execFile(
          'gemini',
          ['-m', model, '--prompt', goal, '-f', file_path, '-o', 'text'],
          { timeout: GEMINI_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error) {
              if ((error as any).killed === true) {
                resolve(toolError(`Gemini CLI timed out after ${GEMINI_TIMEOUT_MS / 1000} seconds`));
                return;
              }
              const code = (error as any).code;
              const stderrDetail = stderr?.trim() || error.message;
              resolve(toolError(`Gemini CLI failed (exit ${code}): ${stderrDetail}`));
              return;
            }

            const output = stdout?.trim();
            if (!output) {
              resolve(toolResponse('(empty response from Gemini CLI)'));
              return;
            }

            resolve(toolResponse(output));
          },
        );
      });
    },
    optional: true,
  });

  api.logger.info(`${LOG_PREFIX} Look-at tool registered successfully`);
}
