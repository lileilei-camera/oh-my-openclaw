// ast-grep tools - adapted for OpenClaw Plugin SDK
import { Type, Static } from '@sinclair/typebox';
import { runSg } from './cli.js';
import { formatSearchResult, formatReplaceResult } from './utils.js';
import { CLI_LANGUAGES } from './constants.js';
import type { OpenClawPluginApi } from '../../types.js';
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js';
import { toolResponse, toolError } from '../../utils/helpers.js';

const AstGrepSearchParamsSchema = Type.Object({
  pattern: Type.String({
    description: 'AST pattern with meta-variables ($VAR, $$$). Must be complete AST node.',
  }),
  lang: Type.String({
    description: 'Target language',
    enum: CLI_LANGUAGES,
  }),
  paths: Type.Optional(Type.Array(Type.String(), {
    description: "Paths to search (default: ['.'])",
  })),
  globs: Type.Optional(Type.Array(Type.String(), {
    description: 'Include/exclude globs (prefix ! to exclude)',
  })),
  context: Type.Optional(Type.Number({
    description: 'Context lines around match',
  })),
});

type AstGrepSearchParams = Static<typeof AstGrepSearchParamsSchema>;

const AstGrepReplaceParamsSchema = Type.Object({
  pattern: Type.String({
    description: 'AST pattern to match',
  }),
  rewrite: Type.String({
    description: 'Replacement pattern (can use $VAR from pattern)',
  }),
  lang: Type.String({
    description: 'Target language',
    enum: CLI_LANGUAGES,
  }),
  paths: Type.Optional(Type.Array(Type.String(), {
    description: 'Paths to search',
  })),
  globs: Type.Optional(Type.Array(Type.String(), {
    description: 'Include/exclude globs',
  })),
  dryRun: Type.Optional(Type.Boolean({
    description: 'Preview changes without applying (default: true)',
    default: true,
  })),
});

type AstGrepReplaceParams = Static<typeof AstGrepReplaceParamsSchema>;

function getEmptyResultHint(pattern: string, lang: string): string | null {
  const src = pattern.trim();

  if (lang === 'python') {
    if (src.startsWith('class ') && src.endsWith(':')) {
      const withoutColon = src.slice(0, -1);
      return `Hint: Remove trailing colon. Try: "${withoutColon}"`;
    }
    if ((src.startsWith('def ') || src.startsWith('async def ')) && src.endsWith(':')) {
      const withoutColon = src.slice(0, -1);
      return `Hint: Remove trailing colon. Try: "${withoutColon}"`;
    }
  }

  if (['javascript', 'typescript', 'tsx'].includes(lang)) {
    if (/^(export\s+)?(async\s+)?function\s+\$[A-Z_]+\s*$/i.test(src)) {
      return `Hint: Function patterns need params and body. Try "function $NAME($$$) { $$$ }"`;
    }
  }

  return null;
}

export function registerAstGrepSearchTool(api: OpenClawPluginApi): void {
  api.logger.info(`${LOG_PREFIX} Registering ast_grep_search tool`);

  api.registerTool({
    name: `${TOOL_PREFIX}ast_grep_search`,
    description:
      'Search code patterns across filesystem using AST-aware matching. Supports 25 languages. ' +
      'Use meta-variables: $VAR (single node), $$$ (multiple nodes). ' +
      'IMPORTANT: Patterns must be complete AST nodes (valid code). ' +
      "For functions, include params and body: 'export async function $NAME($$$) { $$$ }' not 'export async function $NAME'. " +
      "Examples: 'console.log($MSG)', 'def $FUNC($$$):', 'async function $NAME($$$)'",
    parameters: AstGrepSearchParamsSchema,
    execute: async (_toolCallId: string, params: AstGrepSearchParams) => {
      api.logger.info(`${LOG_PREFIX} ast-grep search:`, {
        pattern: params.pattern,
        lang: params.lang,
        paths: params.paths,
      });

      if (!params.pattern?.trim()) {
        return toolError('Pattern cannot be empty');
      }

      try {
        const result = await runSg({
          pattern: params.pattern,
          lang: params.lang as typeof CLI_LANGUAGES[number],
          paths: params.paths,
          globs: params.globs,
          context: params.context,
        });

        let output = formatSearchResult(result);

        if (result.matches.length === 0 && !result.error) {
          const hint = getEmptyResultHint(params.pattern, params.lang);
          if (hint) {
            output += `\n\n${hint}`;
          }
        }

        return toolResponse(output);
      } catch (e) {
        return toolError(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  });
}

export function registerAstGrepReplaceTool(api: OpenClawPluginApi): void {
  api.logger.info(`${LOG_PREFIX} Registering ast_grep_replace tool`);

  api.registerTool({
    name: `${TOOL_PREFIX}ast_grep_replace`,
    description:
      'Replace code patterns across filesystem with AST-aware rewriting. ' +
      'Dry-run by default. Use meta-variables in rewrite to preserve matched content. ' +
      "Example: pattern='console.log($MSG)' rewrite='logger.info($MSG)'",
    parameters: AstGrepReplaceParamsSchema,
    execute: async (_toolCallId: string, params: AstGrepReplaceParams) => {
      api.logger.info(`${LOG_PREFIX} ast-grep replace:`, {
        pattern: params.pattern,
        rewrite: params.rewrite,
        lang: params.lang,
        dryRun: params.dryRun,
      });

      if (!params.pattern?.trim()) {
        return toolError('Pattern cannot be empty');
      }
      if (!params.rewrite?.trim()) {
        return toolError('Rewrite cannot be empty');
      }

      try {
        const result = await runSg({
          pattern: params.pattern,
          rewrite: params.rewrite,
          lang: params.lang as typeof CLI_LANGUAGES[number],
          paths: params.paths,
          globs: params.globs,
          updateAll: params.dryRun === false,
        });
        const output = formatReplaceResult(result, params.dryRun !== false);
        return toolResponse(output);
      } catch (e) {
        return toolError(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  });
}
