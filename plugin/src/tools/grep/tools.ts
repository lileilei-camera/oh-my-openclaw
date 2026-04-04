import { Type, Static } from '@sinclair/typebox';
import { runRg } from './cli.js';
import { formatGrepResult } from './utils.js';
import type { OpenClawPluginApi } from '../../types.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';

const GrepParamsSchema = Type.Object({
  pattern: Type.String({ 
    description: 'The regex pattern to search for in file contents' 
  }),
  include: Type.Optional(Type.String({ 
    description: 'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")' 
  })),
  path: Type.Optional(Type.String({ 
    description: 'The directory to search in. Defaults to the current working directory.' 
  })),
  maxDepth: Type.Optional(Type.Number({ 
    description: 'Maximum directory depth to search (default: 20)', 
    default: 20 
  })),
  maxFilesize: Type.Optional(Type.String({ 
    description: 'Maximum file size to search (e.g. "1M", "10M") (default: "10M")', 
    default: '10M' 
  })),
  maxCount: Type.Optional(Type.Number({ 
    description: 'Maximum number of matches to return (default: 500)', 
    default: 500 
  })),
  maxColumns: Type.Optional(Type.Number({ 
    description: 'Maximum column width for output (default: 1000)', 
    default: 1000 
  })),
  context: Type.Optional(Type.Number({ 
    description: 'Number of context lines to include (default: 0)', 
    default: 0 
  })),
  caseSensitive: Type.Optional(Type.Boolean({ 
    description: 'Case-sensitive search (default: false)', 
    default: false 
  })),
  wholeWord: Type.Optional(Type.Boolean({ 
    description: 'Match whole words only (default: false)', 
    default: false 
  })),
  fixedStrings: Type.Optional(Type.Boolean({ 
    description: 'Match literal strings instead of regex (default: false)', 
    default: false 
  })),
  multiline: Type.Optional(Type.Boolean({ 
    description: 'Enable multiline matching (default: false)', 
    default: false 
  })),
  hidden: Type.Optional(Type.Boolean({ 
    description: 'Include hidden files (default: false)', 
    default: false 
  })),
  noIgnore: Type.Optional(Type.Boolean({ 
    description: 'Ignore .gitignore and other ignore files (default: false)', 
    default: false 
  })),
  fileType: Type.Optional(Type.Array(Type.String(), {
    description: 'File types to search (e.g. ["js", "ts"])' 
  })),
  timeout: Type.Optional(Type.Number({ 
    description: 'Timeout in milliseconds (default: 60000)', 
    default: 60000 
  })),
});

type GrepParams = Static<typeof GrepParamsSchema>;

export function registerGrepTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering grep tool`);

  api.registerTool({
    name: `${TOOL_PREFIX}grep`,
    description: 
      'Fast content search tool with safety limits (60s timeout, 10MB output). ' +
      'Searches file contents using regular expressions. ' +
      'Supports full regex syntax (e.g. "log.*Error", "function\\s+\\w+", etc.). ' +
      'Filter files by pattern with the include parameter (e.g. "*.js", "*.{ts,tsx}"). ' +
      'Returns file paths with matches sorted by modification time.',
    parameters: GrepParamsSchema,
    execute: async (_toolCallId: string, params: GrepParams) => {
      api.logger.info(`${LOG_PREFIX} Grep search:`, { 
        pattern: params.pattern, 
        include: params.include,
        path: params.path 
      });

      if (!params.pattern?.trim()) {
        return toolError('Pattern cannot be empty');
      }

      try {
        const globs = params.include ? [params.include] : undefined;
        const paths = params.path ? [params.path] : undefined;

        const result = await runRg({
          pattern: params.pattern,
          paths,
          globs,
          maxDepth: params.maxDepth,
          maxFilesize: params.maxFilesize,
          maxCount: params.maxCount,
          maxColumns: params.maxColumns,
          context: params.context,
          caseSensitive: params.caseSensitive,
          wholeWord: params.wholeWord,
          fixedStrings: params.fixedStrings,
          multiline: params.multiline,
          hidden: params.hidden,
          noIgnore: params.noIgnore,
          fileType: params.fileType,
          timeout: params.timeout,
        });

        return toolResponse(formatGrepResult(result));
      } catch (e) {
        return toolError(e instanceof Error ? e.message : String(e));
      }
    },
    optional: true,
  });

  api.logger.info(`${LOG_PREFIX} Grep tool registered successfully`);
}
