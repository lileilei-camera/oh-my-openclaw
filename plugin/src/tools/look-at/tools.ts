import { execFile } from 'node:child_process';
import { Type, Static } from '@sinclair/typebox';
import { existsSync } from 'node:fs';
import type { OpenClawPluginApi } from '../../types.js';
import { LOOK_AT_DESCRIPTION } from './constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';

const LOG_PREFIX_LOOK_AT = `${LOG_PREFIX}[look-at]`;
const OPENCLAW_TIMEOUT_MS = 60_000;

const LookAtParamsSchema = Type.Object({
  file_path: Type.String({
    description: 'Absolute path to the file to analyze',
  }),
  goal: Type.String({
    description: 'What specific information to extract from the file',
  }),
  model: Type.Optional(Type.String({
    description: 'OpenClaw summarize model to use (optional)',
  })),
});

type LookAtParams = Static<typeof LookAtParamsSchema>;

/**
 * Check if OpenClaw summarize CLI is available.
 */
function isOpenClawSummarizeAvailable(): boolean {
  // Check if openclaw CLI exists and summarize plugin is enabled
  return true; // We'll try and handle errors gracefully
}

/**
 * Detect file type by extension to choose appropriate analysis method.
 */
function detectFileType(filePath: string): 'image' | 'pdf' | 'document' | 'unknown' {
  const ext = filePath.toLowerCase().split('.').pop() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
    return 'image';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (['md', 'txt', 'html', 'json', 'xml', 'csv', 'yaml', 'yml', 'ts', 'js', 'py', 'c', 'h', 'cpp', 'java'].includes(ext)) {
    return 'document';
  }
  return 'unknown';
}

export function registerLookAtTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering look-at tool (OpenClaw mode)`);

  api.registerTool({
    name: `${TOOL_PREFIX}look_at`,
    description: LOOK_AT_DESCRIPTION,
    parameters: LookAtParamsSchema,
    execute: async (_toolCallId: string, params: LookAtParams) => {
      api.logger.info(`${LOG_PREFIX_LOOK_AT} Analyzing file: ${params.file_path}, goal: ${params.goal}`);

      const file_path = params.file_path;
      const goal = params.goal;
      const fileType = detectFileType(file_path);

      // Check if file exists
      if (!existsSync(file_path)) {
        return toolError(`File not found: ${file_path}`);
      }

      // Method 1: Try OpenClaw summarize CLI (supports images, PDFs, audio, video)
      try {
        const summarizeResult = await new Promise<ReturnType<typeof toolResponse> | null>((resolve) => {
          execFile(
            'openclaw',
            ['summarize', file_path],
            { timeout: OPENCLAW_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
            (error, stdout, stderr) => {
              if (error) {
                api.logger.warn(`${LOG_PREFIX_LOOK_AT} summarize CLI failed: ${(error as any).message}`);
                resolve(null);
                return;
              }

              const output = stdout?.trim();
              if (output) {
                const response = `📋 OpenClaw Analysis Result (${fileType}):\n\n${output}\n\n---\n🎯 User Goal: ${goal}`;
                resolve(toolResponse(response));
              } else {
                resolve(null);
              }
            },
          );
        });

        if (summarizeResult) {
          return summarizeResult;
        }
      } catch (e) {
        api.logger.warn(`${LOG_PREFIX_LOOK_AT} summarize CLI error: ${(e as Error).message}`);
      }

      // Method 2: Fallback - provide guidance for using OpenClaw built-in tools
      const guidance = getBuiltInToolGuidance(file_path, fileType, goal);
      return toolResponse(guidance);
    },
    optional: true,
  });

  api.logger.info(`${LOG_PREFIX} Look-at tool registered successfully (OpenClaw mode)`);
}

/**
 * Generate guidance for using OpenClaw built-in tools when summarize CLI is not available.
 */
function getBuiltInToolGuidance(filePath: string, fileType: string, goal: string): string {
  const lines: string[] = [
    `📋 File Analysis Request: ${filePath}`,
    `🎯 Goal: ${goal}`,
    `📁 File Type: ${fileType}`,
    '',
    '---',
    '',
    '💡 The Gemini CLI is not available, but you can use OpenClaw\'s built-in tools:',
    '',
  ];

  switch (fileType) {
    case 'image':
      lines.push(
        'For image analysis, OpenClaw has a built-in `image` tool:',
        '',
        '```',
        `image(image: "${filePath}", prompt: "${goal}")`,
        '```',
        '',
        'Supported formats: JPG, PNG, GIF, WebP, BMP, SVG',
      );
      break;

    case 'pdf':
      lines.push(
        'For PDF analysis, OpenClaw has a built-in `pdf` tool:',
        '',
        '```',
        `pdf(pdf: "${filePath}", prompt: "${goal}")`,
        '```',
        '',
        'The PDF tool can extract text, analyze layout, and answer questions about content.',
      );
      break;

    case 'document':
      lines.push(
        'For document analysis, you can use the built-in `read` tool:',
        '',
        '```',
        `read(path: "${filePath}")`,
        '```',
        '',
        'Or for summarization, use the `summarize` tool if available.',
      );
      break;

    default:
      lines.push(
        'Try using the appropriate built-in tool based on file type:',
        '- `image` for images',
        '- `pdf` for PDFs',
        '- `read` for text files',
      );
  }

  lines.push(
    '',
    '---',
    '',
    '📝 Simply ask the AI to analyze the file using the appropriate tool above.',
    'The AI will automatically select the right tool based on the file type.',
  );

  return lines.join('\n');
}
