import { Type, Static } from '@sinclair/typebox';
import { runRgFiles } from './cli.js';
import { resolveGrepCliWithAutoInstall } from './constants.js';
import { formatGlobResult } from './utils.js';
import type { OpenClawPluginApi } from '../../types.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';

const GlobParamsSchema = Type.Object({
  pattern: Type.String({ 
    description: 'The glob pattern to match files against (e.g., "**/*.js", "src/**/*.ts")' 
  }),
  path: Type.Optional(Type.String({ 
    description: 'The directory to search in. If not specified, uses current working directory.' 
  })),
  maxDepth: Type.Optional(Type.Number({ 
    description: 'Maximum directory depth to search (default: 20)', 
    default: 20 
  })),
  limit: Type.Optional(Type.Number({ 
    description: 'Maximum number of results to return (default: 100)', 
    default: 100 
  })),
  hidden: Type.Optional(Type.Boolean({ 
    description: 'Include hidden files (default: false)', 
    default: false 
  })),
  follow: Type.Optional(Type.Boolean({ 
    description: 'Follow symbolic links (default: true)', 
    default: true 
  })),
  noIgnore: Type.Optional(Type.Boolean({ 
    description: 'Ignore .gitignore and other ignore files (default: false)', 
    default: false 
  })),
  timeout: Type.Optional(Type.Number({ 
    description: 'Timeout in milliseconds (default: 60000)', 
    default: 60000 
  })),
});

type GlobParams = Static<typeof GlobParamsSchema>;

export function registerGlobTool(api: OpenClawPluginApi) {
  api.registerTool({
    name: `${TOOL_PREFIX}glob`,
    description: 
      'Fast file pattern matching tool with safety limits (60s timeout, 100 file limit). ' +
      'Supports glob patterns like "**/*.js" or "src/**/*.ts". ' +
      'Returns matching file paths sorted by modification time. ' +
      'Use this tool when you need to find files by name patterns.',
    parameters: GlobParamsSchema,
    execute: async (_toolCallId: string, params: GlobParams) => {
      api.logger.info(`${LOG_PREFIX} Glob search:`, { 
        pattern: params.pattern, 
        path: params.path 
      });

      if (!params.pattern?.trim()) {
        return toolError('Pattern is required and cannot be empty');
      }

      try {
        const cli = await resolveGrepCliWithAutoInstall();
        const paths = params.path ? [params.path] : undefined;

        const result = await runRgFiles(
          {
            pattern: params.pattern,
            paths,
            maxDepth: params.maxDepth,
            limit: params.limit,
            hidden: params.hidden,
            follow: params.follow,
            noIgnore: params.noIgnore,
            timeout: params.timeout,
          },
          cli
        );

        return toolResponse(formatGlobResult(result));
      } catch (e) {
        return toolError(e instanceof Error ? e.message : String(e));
      }
    },
    optional: true,
  });
}
