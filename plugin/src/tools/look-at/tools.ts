import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { extname, basename } from 'node:path';
import { Type, Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from '../../types.js';
import { LOOK_AT_DESCRIPTION } from './constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';

const execAsync = promisify(exec);
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

function inferMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.mp4': 'video/mp4',
    '.mpeg': 'video/mpeg',
    '.mpg': 'video/mpeg',
    '.mov': 'video/mov',
    '.avi': 'video/avi',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.wmv': 'video/wmv',
    '.3gpp': 'video/3gpp',
    '.3gp': 'video/3gpp',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mp3',
    '.aiff': 'audio/aiff',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.md': 'text/md',
    '.html': 'text/html',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.js': 'text/javascript',
    '.py': 'text/x-python',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export function registerLookAtTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering look-at tool`);

  api.registerTool({
    name: `${TOOL_PREFIX}look_at`,
    description: LOOK_AT_DESCRIPTION,
    parameters: LookAtParamsSchema,
    execute: async (_toolCallId: string, params: LookAtParams) => {
      api.logger.info(`${LOG_PREFIX_LOOK_AT} Analyzing file: ${params.file_path}, goal: ${params.goal}`);

      try {
        // Validate parameters
        if (!params.file_path) {
          return toolError("Missing required parameter 'file_path'");
        }
        if (!params.goal) {
          return toolError("Missing required parameter 'goal'");
        }

        const model = params.model ?? 'gemini-3-flash-preview';
        const filename = basename(params.file_path);
        const mimeType = inferMimeType(params.file_path);

        api.logger.info(`${LOG_PREFIX_LOOK_AT} Using model: ${model}, file: ${filename}, type: ${mimeType}`);

        // Execute gemini CLI
        const cmd = `gemini -m "${model}" --prompt "${params.goal.replace(/"/g, '\\"')}" -f "${params.file_path}" -o text`;
        
        const { stdout, stderr } = await execAsync(cmd, {
          timeout: GEMINI_TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
        });

        if (stderr && !stdout) {
          return toolError(`Gemini CLI error: ${stderr}`);
        }

        const output = stdout.trim() || '(empty response from Gemini CLI)';
        api.logger.info(`${LOG_PREFIX_LOOK_AT} Analysis complete`);
        
        return toolResponse(output);
      } catch (e: any) {
        api.logger.error(`${LOG_PREFIX_LOOK_AT} Error:`, e);
        
        // Handle timeout
        if (e.killed || e.code === 'ETIMEDOUT') {
          return toolError(`Gemini CLI timed out after ${GEMINI_TIMEOUT_MS / 1000} seconds`);
        }
        
        // Handle gemini CLI errors
        const detail = e.stderr?.trim() || e.message;
        return toolError(`Gemini CLI failed: ${detail}`);
      }
    },
    optional: true,
  });

  api.logger.info(`${LOG_PREFIX} Look-at tool registered successfully`);
}
