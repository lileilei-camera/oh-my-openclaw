import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import type { Location, LocationLink, DocumentSymbol, SymbolInfo, Diagnostic, PrepareRenameResult, PrepareRenameDefaultBehavior, WorkspaceEdit, Range } from './types.js'
import { SYMBOL_KIND_MAP, SEVERITY_MAP } from './constants.js'

export function formatLocation(location: Location | LocationLink): string {
  if ('targetUri' in location) {
    const link = location as LocationLink
    const uri = link.targetUri
    const line = link.targetSelectionRange.start.line + 1
    const character = link.targetSelectionRange.start.character + 1
    return `${uri}:${line}:${character}`
  }
  
  const loc = location as Location
  const uri = loc.uri
  const line = loc.range.start.line + 1
  const character = loc.range.start.character + 1
  return `${uri}:${line}:${character}`
}

export function formatDocumentSymbol(symbol: DocumentSymbol, indent = 0): string {
  const prefix = '  '.repeat(indent)
  const kind = SYMBOL_KIND_MAP[symbol.kind] || 'Unknown'
  const range = symbol.range
  const line = range.start.line + 1
  return `${prefix}${symbol.name} (${kind}) - line ${line}`
}

export function formatSymbolInfo(symbol: SymbolInfo): string {
  const kind = SYMBOL_KIND_MAP[symbol.kind] || 'Unknown'
  const location = formatLocation(symbol.location)
  const container = symbol.containerName ? ` in ${symbol.containerName}` : ''
  return `${symbol.name} (${kind})${container} - ${location}`
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const severity = SEVERITY_MAP[diagnostic.severity || 3] || 'info'
  const line = diagnostic.range.start.line + 1
  const character = diagnostic.range.start.character + 1
  const source = diagnostic.source ? ` [${diagnostic.source}]` : ''
  const code = diagnostic.code ? ` (${diagnostic.code})` : ''
  return `${line}:${character} ${severity}${source}${code}: ${diagnostic.message}`
}

export function filterDiagnosticsBySeverity(
  diagnostics: Diagnostic[],
  severity?: 'error' | 'warning' | 'information' | 'hint' | 'all'
): Diagnostic[] {
  if (!severity || severity === 'all') return diagnostics
  
  const severityNum: Record<string, number> = {
    error: 1,
    warning: 2,
    information: 3,
    hint: 4,
  }
  
  const targetSeverity = severityNum[severity]
  return diagnostics.filter(d => d.severity === targetSeverity)
}

export function formatPrepareRenameResult(result: PrepareRenameResult | PrepareRenameDefaultBehavior | null): string {
  if (!result) {
    return 'Cannot be renamed at this position'
  }
  
  // Case 1: { defaultBehavior: boolean }
  if ('defaultBehavior' in result) {
    return result.defaultBehavior ? 'Rename supported (using default behavior)' : 'Cannot rename at this position'
  }
  
  // Case 2: { range: Range, placeholder?: string }
  if ('range' in result && result.range) {
    const startLine = result.range.start.line + 1
    const startChar = result.range.start.character
    const endLine = result.range.end.line + 1
    const endChar = result.range.end.character
    const placeholder = result.placeholder ? ` (current: "${result.placeholder}")` : ''
    return `Rename available at ${startLine}:${startChar}-${endLine}:${endChar}${placeholder}`
  }
  
  // Case 3: Range directly (has start/end but no range property)
  if ('start' in result && 'end' in result) {
    const rangeResult = result as any
    const startLine = rangeResult.start.line + 1
    const startChar = rangeResult.start.character
    const endLine = rangeResult.end.line + 1
    const endChar = rangeResult.end.character
    return `Rename available at ${startLine}:${startChar}-${endLine}:${endChar}`
  }
  
  return 'Cannot rename at this position'
}

function uriToPath(uri: string): string {
  return fileURLToPath(uri)
}

function applyTextEditsToFile(filePath: string, edits: any[]): { success: boolean; editCount: number; error?: string } {
  try {
    let content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    const sortedEdits = [...edits].sort((a, b) => {
      if (b.range.start.line !== a.range.start.line) {
        return b.range.start.line - a.range.start.line
      }
      return b.range.start.character - a.range.start.character
    })

    for (const edit of sortedEdits) {
      const startLine = edit.range.start.line
      const startChar = edit.range.start.character
      const endLine = edit.range.end.line
      const endChar = edit.range.end.character

      if (startLine === endLine) {
        const line = lines[startLine] || ''
        lines[startLine] = line.substring(0, startChar) + edit.newText + line.substring(endChar)
      } else {
        const firstLine = lines[startLine] || ''
        const lastLine = lines[endLine] || ''
        const newContent = firstLine.substring(0, startChar) + edit.newText + lastLine.substring(endChar)
        lines.splice(startLine, endLine - startLine + 1, ...newContent.split('\n'))
      }
    }

    writeFileSync(filePath, lines.join('\n'), 'utf-8')
    return { success: true, editCount: edits.length }
  } catch (err: any) {
    return { success: false, editCount: 0, error: err.message || String(err) }
  }
}

export function applyWorkspaceEdit(edit: WorkspaceEdit | null): { success: boolean; filesChanged: number; error?: string; filesModified?: string[] } {
  if (!edit) {
    return { success: false, filesChanged: 0, error: 'No edit to apply' }
  }

  const filesModified: string[] = []
  let totalEdits = 0

  if (edit.changes) {
    for (const [uri, edits] of Object.entries(edit.changes)) {
      const filePath = uriToPath(uri)
      const result = applyTextEditsToFile(filePath, edits)
      if (result.success) {
        filesModified.push(filePath)
        totalEdits += result.editCount
      } else {
        return { success: false, filesChanged: 0, error: `${filePath}: ${result.error}` }
      }
    }
  }

  if (edit.documentChanges) {
    for (const change of edit.documentChanges) {
      if ('kind' in change) {
        if (change.kind === 'create') {
          try {
            const filePath = uriToPath(change.uri)
            writeFileSync(filePath, '', 'utf-8')
            filesModified.push(filePath)
          } catch (err: any) {
            return { success: false, filesChanged: 0, error: `Create ${change.uri}: ${err.message}` }
          }
        } else if (change.kind === 'rename') {
          try {
            const oldPath = uriToPath(change.oldUri)
            const newPath = uriToPath(change.newUri)
            const content = readFileSync(oldPath, 'utf-8')
            writeFileSync(newPath, content, 'utf-8')
            unlinkSync(oldPath)
            filesModified.push(newPath)
          } catch (err: any) {
            return { success: false, filesChanged: 0, error: `Rename ${change.oldUri}: ${err.message}` }
          }
        } else if (change.kind === 'delete') {
          try {
            const filePath = uriToPath(change.uri)
            unlinkSync(filePath)
            filesModified.push(filePath)
          } catch (err: any) {
            return { success: false, filesChanged: 0, error: `Delete ${change.uri}: ${err.message}` }
          }
        }
      } else {
        const filePath = uriToPath(change.textDocument.uri)
        const result = applyTextEditsToFile(filePath, change.edits)
        if (result.success) {
          filesModified.push(filePath)
          totalEdits += result.editCount
        } else {
          return { success: false, filesChanged: 0, error: `${filePath}: ${result.error}` }
        }
      }
    }
  }

  return { success: true, filesChanged: filesModified.length, filesModified }
}

export function formatApplyResult(result: { success: boolean; filesChanged: number; error?: string; filesModified?: string[] }): string {
  if (!result.success) {
    return `Failed to apply: ${result.error || 'Unknown error'}`
  }
  const lines = [`Applied ${result.filesChanged} edit(s) to ${result.filesChanged} file(s):`]
  if (result.filesModified) {
    for (const file of result.filesModified) {
      lines.push(`  - ${file}`)
    }
  }
  return lines.join('\n')
}
