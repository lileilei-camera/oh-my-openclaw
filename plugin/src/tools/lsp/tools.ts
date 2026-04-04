import { Type, Static } from '@sinclair/typebox'
import type { OpenClawPluginApi } from '../../types.js'
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js'
import { toolResponse, toolError } from '../../utils/helpers.js'
import {
  DEFAULT_MAX_REFERENCES,
  DEFAULT_MAX_SYMBOLS,
  DEFAULT_MAX_DIAGNOSTICS,
} from './constants.js'
import {
  formatLocation,
  formatDocumentSymbol,
  formatSymbolInfo,
  formatDiagnostic,
  filterDiagnosticsBySeverity,
  formatPrepareRenameResult,
  applyWorkspaceEdit,
  formatApplyResult,
} from './utils.js'
import { lspManager } from './client.js'
import { findServerForExtension } from './config.js'
import type { Location, LocationLink, DocumentSymbol, SymbolInfo, Diagnostic, PrepareRenameResult, PrepareRenameDefaultBehavior, WorkspaceEdit } from './types.js'

const GotoDefinitionParamsSchema = Type.Object({
  filePath: Type.String({ description: 'File path' }),
  line: Type.Number({ description: 'Line number (1-based)', minimum: 1 }),
  character: Type.Number({ description: 'Character position (0-based)', minimum: 0 }),
})

type GotoDefinitionParams = Static<typeof GotoDefinitionParamsSchema>

const FindReferencesParamsSchema = Type.Object({
  filePath: Type.String({ description: 'File path' }),
  line: Type.Number({ description: 'Line number (1-based)', minimum: 1 }),
  character: Type.Number({ description: 'Character position (0-based)', minimum: 0 }),
  includeDeclaration: Type.Optional(Type.Boolean({ description: 'Include declaration', default: true })),
})

type FindReferencesParams = Static<typeof FindReferencesParamsSchema>

const SymbolsParamsSchema = Type.Object({
  filePath: Type.String({ description: 'File path for LSP context' }),
  scope: Type.Optional(Type.Union([Type.Literal('document'), Type.Literal('workspace')], { description: "'document' for file symbols, 'workspace' for project-wide search", default: 'document' })),
  query: Type.Optional(Type.String({ description: 'Symbol name to search (required for workspace scope)' })),
  limit: Type.Optional(Type.Number({ description: 'Max results (default 50)' })),
})

type SymbolsParams = Static<typeof SymbolsParamsSchema>

const DiagnosticsParamsSchema = Type.Object({
  filePath: Type.String({ description: 'File path' }),
  severity: Type.Optional(Type.Union([
    Type.Literal('error'),
    Type.Literal('warning'),
    Type.Literal('information'),
    Type.Literal('hint'),
    Type.Literal('all'),
  ], { description: 'Filter by severity level', default: 'all' })),
})

type DiagnosticsParams = Static<typeof DiagnosticsParamsSchema>

const PrepareRenameParamsSchema = Type.Object({
  filePath: Type.String({ description: 'File path' }),
  line: Type.Number({ description: 'Line number (1-based)', minimum: 1 }),
  character: Type.Number({ description: 'Character position (0-based)', minimum: 0 }),
})

type PrepareRenameParams = Static<typeof PrepareRenameParamsSchema>

const RenameParamsSchema = Type.Object({
  filePath: Type.String({ description: 'File path' }),
  line: Type.Number({ description: 'Line number (1-based)', minimum: 1 }),
  character: Type.Number({ description: 'Character position (0-based)', minimum: 0 }),
  newName: Type.String({ description: 'New symbol name' }),
})

type RenameParams = Static<typeof RenameParamsSchema>

export function registerLspGotoDefinitionTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering lsp-goto-definition tool`)

  api.registerTool({
    name: `${TOOL_PREFIX}goto_definition`,
    description: 'Jump to symbol definition. Find WHERE something is defined.',
    parameters: GotoDefinitionParamsSchema,
    execute: async (_toolCallId: string, params: GotoDefinitionParams) => {
      api.logger.info(`${LOG_PREFIX} Goto definition:`, { filePath: params.filePath, line: params.line })

      try {
        const ext = '.' + params.filePath.split('.').pop()?.toLowerCase()
        const lookup = findServerForExtension(ext)

        if (lookup.status === 'not_installed') {
          return toolError(`LSP server '${lookup.server.id}' not installed. ${lookup.installHint}`)
        }

        if (lookup.status === 'not_configured') {
          return toolError(`No LSP server configured for ${ext}. Available: ${lookup.availableServers.join(', ')}`)
        }

        const client = await lspManager.getClient(process.cwd(), lookup.server)
        const result = await client.definition(params.filePath, params.line, params.character) as Location | Location[] | LocationLink[] | null

        if (!result) {
          return toolResponse('No definition found')
        }

        const locations = Array.isArray(result) ? result : [result]
        if (locations.length === 0) {
          return toolResponse('No definition found')
        }

        const output = locations.map(formatLocation).join('\n')
        lspManager.releaseClient(process.cwd(), lookup.server.id)
        return toolResponse(output)
      } catch (e: any) {
        return toolError(`Error: ${e.message || String(e)}`)
      }
    },
    optional: true,
  })

  api.logger.info(`${LOG_PREFIX} LSP goto-definition tool registered`)
}

export function registerLspFindReferencesTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering lsp-find-references tool`)

  api.registerTool({
    name: `${TOOL_PREFIX}find_references`,
    description: 'Find ALL usages/references of a symbol across the entire workspace.',
    parameters: FindReferencesParamsSchema,
    execute: async (_toolCallId: string, params: FindReferencesParams) => {
      api.logger.info(`${LOG_PREFIX} Find references:`, { filePath: params.filePath, line: params.line })

      try {
        const ext = '.' + params.filePath.split('.').pop()?.toLowerCase()
        const lookup = findServerForExtension(ext)

        if (lookup.status === 'not_installed') {
          return toolError(`LSP server '${lookup.server.id}' not installed. ${lookup.installHint}`)
        }

        if (lookup.status === 'not_configured') {
          return toolError(`No LSP server configured for ${ext}. Available: ${lookup.availableServers.join(', ')}`)
        }

        const client = await lspManager.getClient(process.cwd(), lookup.server)
        const result = await client.references(params.filePath, params.line, params.character, params.includeDeclaration ?? true) as Location[] | null

        if (!result || result.length === 0) {
          lspManager.releaseClient(process.cwd(), lookup.server.id)
          return toolResponse('No references found')
        }

        const total = result.length
        const truncated = total > DEFAULT_MAX_REFERENCES
        const limited = truncated ? result.slice(0, DEFAULT_MAX_REFERENCES) : result
        const lines = limited.map(formatLocation)
        if (truncated) {
          lines.unshift(`Found ${total} references (showing first ${DEFAULT_MAX_REFERENCES}):`)
        }
        
        lspManager.releaseClient(process.cwd(), lookup.server.id)
        return toolResponse(lines.join('\n'))
      } catch (e: any) {
        return toolError(`Error: ${e.message || String(e)}`)
      }
    },
    optional: true,
  })

  api.logger.info(`${LOG_PREFIX} LSP find-references tool registered`)
}

export function registerLspSymbolsTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering lsp-symbols tool`)

  api.registerTool({
    name: `${TOOL_PREFIX}symbols`,
    description: "Get symbols from file (document) or search across workspace. Use scope='document' for file outline, scope='workspace' for project-wide symbol search.",
    parameters: SymbolsParamsSchema,
    execute: async (_toolCallId: string, params: SymbolsParams) => {
      api.logger.info(`${LOG_PREFIX} LSP symbols:`, { filePath: params.filePath, scope: params.scope })

      try {
        const scope = params.scope ?? 'document'
        const ext = '.' + params.filePath.split('.').pop()?.toLowerCase()
        const lookup = findServerForExtension(ext)

        if (lookup.status === 'not_installed') {
          return toolError(`LSP server '${lookup.server.id}' not installed. ${lookup.installHint}`)
        }

        if (lookup.status === 'not_configured') {
          return toolError(`No LSP server configured for ${ext}. Available: ${lookup.availableServers.join(', ')}`)
        }

        const client = await lspManager.getClient(process.cwd(), lookup.server)

        if (scope === 'workspace') {
          if (!params.query) {
            lspManager.releaseClient(process.cwd(), lookup.server.id)
            return toolError("'query' is required for workspace scope")
          }

          const result = await client.workspaceSymbols(params.query) as SymbolInfo[] | null

          if (!result || result.length === 0) {
            lspManager.releaseClient(process.cwd(), lookup.server.id)
            return toolResponse('No symbols found')
          }

          const total = result.length
          const limit = Math.min(params.limit ?? DEFAULT_MAX_SYMBOLS, DEFAULT_MAX_SYMBOLS)
          const truncated = total > limit
          const limited = result.slice(0, limit)
          const lines = limited.map(formatSymbolInfo)
          if (truncated) {
            lines.unshift(`Found ${total} symbols (showing first ${limit}):`)
          }

          lspManager.releaseClient(process.cwd(), lookup.server.id)
          return toolResponse(lines.join('\n'))
        } else {
          const result = await client.documentSymbols(params.filePath) as DocumentSymbol[] | SymbolInfo[] | null

          if (!result || result.length === 0) {
            lspManager.releaseClient(process.cwd(), lookup.server.id)
            return toolResponse('No symbols found')
          }

          const total = result.length
          const limit = Math.min(params.limit ?? DEFAULT_MAX_SYMBOLS, DEFAULT_MAX_SYMBOLS)
          const truncated = total > limit
          const limited = truncated ? result.slice(0, limit) : result

          const lines: string[] = []
          if (truncated) {
            lines.push(`Found ${total} symbols (showing first ${limit}):`)
          }

          if ('range' in limited[0]) {
            lines.push(...(limited as DocumentSymbol[]).map((s) => formatDocumentSymbol(s)))
          } else {
            lines.push(...(limited as SymbolInfo[]).map(formatSymbolInfo))
          }

          lspManager.releaseClient(process.cwd(), lookup.server.id)
          return toolResponse(lines.join('\n'))
        }
      } catch (e: any) {
        return toolError(`Error: ${e.message || String(e)}`)
      }
    },
    optional: true,
  })

  api.logger.info(`${LOG_PREFIX} LSP symbols tool registered`)
}

export function registerLspDiagnosticsTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering lsp-diagnostics tool`)

  api.registerTool({
    name: `${TOOL_PREFIX}diagnostics`,
    description: 'Get errors, warnings, hints from language server BEFORE running build.',
    parameters: DiagnosticsParamsSchema,
    execute: async (_toolCallId: string, params: DiagnosticsParams) => {
      api.logger.info(`${LOG_PREFIX} LSP diagnostics:`, { filePath: params.filePath, severity: params.severity })

      try {
        const ext = '.' + params.filePath.split('.').pop()?.toLowerCase()
        const lookup = findServerForExtension(ext)

        if (lookup.status === 'not_installed') {
          return toolError(`LSP server '${lookup.server.id}' not installed. ${lookup.installHint}`)
        }

        if (lookup.status === 'not_configured') {
          return toolError(`No LSP server configured for ${ext}. Available: ${lookup.availableServers.join(', ')}`)
        }

        const client = await lspManager.getClient(process.cwd(), lookup.server)
        const result = await client.diagnostics(params.filePath)

        let diagnostics: Diagnostic[] = []
        if (result) {
          if (Array.isArray(result)) {
            diagnostics = result
          } else if (result.items) {
            diagnostics = result.items
          }
        }

        diagnostics = filterDiagnosticsBySeverity(diagnostics, params.severity)

        if (diagnostics.length === 0) {
          lspManager.releaseClient(process.cwd(), lookup.server.id)
          return toolResponse('No diagnostics found')
        }

        const total = diagnostics.length
        const truncated = total > DEFAULT_MAX_DIAGNOSTICS
        const limited = truncated ? diagnostics.slice(0, DEFAULT_MAX_DIAGNOSTICS) : diagnostics
        const lines = limited.map(formatDiagnostic)
        if (truncated) {
          lines.unshift(`Found ${total} diagnostics (showing first ${DEFAULT_MAX_DIAGNOSTICS}):`)
        }

        lspManager.releaseClient(process.cwd(), lookup.server.id)
        return toolResponse(lines.join('\n'))
      } catch (e: any) {
        return toolError(`Error: ${e.message || String(e)}`)
      }
    },
    optional: true,
  })

  api.logger.info(`${LOG_PREFIX} LSP diagnostics tool registered`)
}

export function registerLspPrepareRenameTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering lsp-prepare-rename tool`)

  api.registerTool({
    name: `${TOOL_PREFIX}prepare_rename`,
    description: 'Check if rename is valid. Use BEFORE lsp_rename.',
    parameters: PrepareRenameParamsSchema,
    execute: async (_toolCallId: string, params: PrepareRenameParams) => {
      api.logger.info(`${LOG_PREFIX} Prepare rename:`, { filePath: params.filePath, line: params.line })

      try {
        const ext = '.' + params.filePath.split('.').pop()?.toLowerCase()
        const lookup = findServerForExtension(ext)

        if (lookup.status === 'not_installed') {
          return toolError(`LSP server '${lookup.server.id}' not installed. ${lookup.installHint}`)
        }

        if (lookup.status === 'not_configured') {
          return toolError(`No LSP server configured for ${ext}. Available: ${lookup.availableServers.join(', ')}`)
        }

        const client = await lspManager.getClient(process.cwd(), lookup.server)
        const result = await client.prepareRename(params.filePath, params.line, params.character) as PrepareRenameResult | PrepareRenameDefaultBehavior | null
        const output = formatPrepareRenameResult(result)

        lspManager.releaseClient(process.cwd(), lookup.server.id)
        return toolResponse(output)
      } catch (e: any) {
        return toolError(`Error: ${e.message || String(e)}`)
      }
    },
    optional: true,
  })

  api.logger.info(`${LOG_PREFIX} LSP prepare-rename tool registered`)
}

export function registerLspRenameTool(api: OpenClawPluginApi) {
  api.logger.info(`${LOG_PREFIX} Registering lsp-rename tool`)

  api.registerTool({
    name: `${TOOL_PREFIX}rename`,
    description: 'Rename symbol across entire workspace. APPLIES changes to all files.',
    parameters: RenameParamsSchema,
    execute: async (_toolCallId: string, params: RenameParams) => {
      api.logger.info(`${LOG_PREFIX} LSP rename:`, { filePath: params.filePath, line: params.line, newName: params.newName })

      try {
        const ext = '.' + params.filePath.split('.').pop()?.toLowerCase()
        const lookup = findServerForExtension(ext)

        if (lookup.status === 'not_installed') {
          return toolError(`LSP server '${lookup.server.id}' not installed. ${lookup.installHint}`)
        }

        if (lookup.status === 'not_configured') {
          return toolError(`No LSP server configured for ${ext}. Available: ${lookup.availableServers.join(', ')}`)
        }

        const client = await lspManager.getClient(process.cwd(), lookup.server)
        const edit = await client.rename(params.filePath, params.line, params.character, params.newName) as WorkspaceEdit | null
        const result = applyWorkspaceEdit(edit)
        const output = formatApplyResult(result)

        lspManager.releaseClient(process.cwd(), lookup.server.id)
        return toolResponse(output)
      } catch (e: any) {
        return toolError(`Error: ${e.message || String(e)}`)
      }
    },
    optional: true,
  })

  api.logger.info(`${LOG_PREFIX} LSP rename tool registered`)
}
