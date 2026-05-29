import { execFile } from 'node:child_process';
import { Type, Static } from '@sinclair/typebox';
import { existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import type { OpenClawPluginApi } from '../../types.js';
import { LOOK_AT_DESCRIPTION } from './constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';

const LOG_PREFIX_LOOK_AT = `${LOG_PREFIX}[look-at]`;
const OPENCLAW_TIMEOUT_MS = 120_000;

const LookAtParamsSchema = Type.Object({
  file_path: Type.String({
    description: 'Path to the file to analyze (absolute or relative to workspace)',
  }),
  goal: Type.String({
    description: 'What specific information to extract from the file',
  }),
  model: Type.Optional(Type.String({
    description: 'Model override for the summarization (optional)',
  })),
});

type LookAtParams = Static<typeof LookAtParamsSchema>;

function detectFileType(filePath: string): 'image' | 'pdf' | 'document' | 'office' | 'unknown' {
  const ext = filePath.toLowerCase().split('.').pop() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
    return 'image';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (['docx', 'pptx', 'xlsx', 'doc', 'ppt', 'xls'].includes(ext)) {
    return 'office';
  }
  if (['md', 'txt', 'html', 'json', 'xml', 'csv', 'yaml', 'yml', 'ts', 'js', 'py', 'c', 'h', 'cpp', 'java'].includes(ext)) {
    return 'document';
  }
  return 'unknown';
}

export function registerLookAtTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering look-at tool`);

  api.registerTool({
    name: `${TOOL_PREFIX}look_at`,
    description: LOOK_AT_DESCRIPTION,
    parameters: LookAtParamsSchema,
    execute: async (_toolCallId: string, params: LookAtParams) => {
      api.logger.info(`${LOG_PREFIX_LOOK_AT} Analyzing file: ${params.file_path}`);

      const rawPath = params.file_path;
      const file_path = isAbsolute(rawPath) ? rawPath : resolve(rawPath);

      if (!existsSync(file_path)) {
        return toolError(`File not found: ${file_path}`);
      }

      const fileType = detectFileType(file_path);
      const goal = params.goal;
      const model = params.model;

      try {
        const summarizeResult = await new Promise<{ content: Array<{ type: string; text: string }> } | null>((resolve) => {
          const args = ['summarize', file_path, '--prompt', goal];
          if (model) args.push('--model', model);

          const child = execFile(
            'openclaw',
            args,
            { timeout: OPENCLAW_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
            (error, stdout, stderr) => {
              if (stderr) {
                api.logger.warn(`${LOG_PREFIX_LOOK_AT} summarize stderr: ${stderr.slice(0, 500)}`);
              }

              if (error) {
                api.logger.warn(`${LOG_PREFIX_LOOK_AT} summarize CLI failed: ${(error as any).message}`);
                resolve(null);
                return;
              }

              const output = stdout?.trim();
              if (output) {
                const response = `📋 Analysis of \`${file_path}\` (${fileType})\n\n${output}\n\n---\n🎯 Goal: ${goal}`;
                resolve(toolResponse(response));
              } else {
                api.logger.warn(`${LOG_PREFIX_LOOK_AT} summarize CLI returned empty output`);
                resolve(null);
              }
            },
          );

          child.on('error', (err) => {
            api.logger.warn(`${LOG_PREFIX_LOOK_AT} summarize spawn error: ${err.message}`);
            resolve(null);
          });
        });

        if (summarizeResult) {
          return summarizeResult;
        }
      } catch (e) {
        api.logger.warn(`${LOG_PREFIX_LOOK_AT} summarize error: ${(e as Error).message}`);
      }

      return toolError(
        `Failed to analyze \`${file_path}\` via OpenClaw summarize CLI. ` +
        `Try using the built-in \`image\`, \`pdf\`, or \`read\` tools instead.`
      );
    },
    optional: true,
  });

  api.logger.info(`${LOG_PREFIX} Look-at tool registered successfully`);
}
