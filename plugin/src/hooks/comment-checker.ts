import type {
  OpenClawPluginApi,
  PluginHookToolResultPersistEvent,
  PluginHookToolResultPersistContext,
  PluginHookToolResultPersistResult,
} from '../types.js';
import { CommentViolation } from '../types.js';
import { getPluginConfig } from '../types.js';

const NON_CODE_EXTENSIONS = ['.md', '.json', '.yaml', '.yml', '.txt'];

const AI_SLOP_PATTERNS: RegExp[] = [
  /^\s*\/\/\s*Import\s/i,
  /^\s*\/\/\s*Define\s/i,
  /^\s*\/\/\s*Return\s/i,
  /^\s*\/\/\s*Export\s/i,
  /^\s*\/\/\s*Set\s.*\sto\s/i,
  /^\s*\/\/\s*Loop\s/i,
  /^\s*\/\/\s*Initialize\s/i,
  /^\s*\/\/\s*Create\s(a|an|the|new)\s/i,
  /^\s*\/\/\s*This\s(function|method|class|module|component)\s/i,
  /^\s*\/\/\s*Handle\s(the|an?)?\s?(error|exception|response|request|event)/i,
  /^\s*\/\/\s*Check\s(if|whether)\s/i,
];

function hasNonCodeExtension(value: string): boolean {
  const lowered = value.toLowerCase();
  return NON_CODE_EXTENSIONS.some((ext) => lowered.endsWith(ext));
}

/**
 * Extract text content from a content block array or string.
 * Returns null if content is empty or not processable.
 */
function getTextContent(event: PluginHookToolResultPersistEvent): string | null {
  const content = (event.message as Record<string, unknown>).content;

  // Legacy: plain string content
  if (typeof content === 'string') {
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  // Modern: content block array
  if (Array.isArray(content)) {
    const text = content
      .filter(
        (c): c is { type: 'text'; text: string } =>
          typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text' && typeof (c as Record<string, unknown>).text === 'string',
      )
      .map((c) => c.text)
      .join('');
    return text.trim().length > 0 ? text : null;
  }

  return null;
}

/**
 * Get a file hint from various possible fields on the event or context.
 */
function extractFileHint(event: PluginHookToolResultPersistEvent, _ctx: PluginHookToolResultPersistContext): string {
  const msg = event.message as Record<string, unknown>;
  if (typeof msg.file === 'string') return msg.file;
  if (typeof msg.filename === 'string') return msg.filename;
  if (typeof msg.path === 'string') return msg.path;
  return 'unknown';
}

function contentLooksNonCode(content: string): boolean {
  const extensionMatch = content.match(/\b[^\s"']+\.(md|json|ya?ml|txt)\b/i);
  return extensionMatch !== null;
}

function findViolations(content: string, file: string): CommentViolation[] {
  const violations: CommentViolation[] = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineText = lines[index];
    const isViolation = AI_SLOP_PATTERNS.some((pattern) => pattern.test(lineText));

    if (isViolation) {
      violations.push({
        file,
        line: index + 1,
        content: lineText.trim(),
        reason: 'AI slop: obvious/narrating comment',
      });
    }
  }

  return violations;
}

function appendViolationSummary(content: string, violations: CommentViolation[]): string {
  const details = violations
    .map((violation) => `  - Line ${violation.line}: "${violation.content}" → ${violation.reason}`)
    .join('\n');

  return `${content}\n\n---\n⚠️ [OMOC Comment Checker] Found ${violations.length} AI slop comment(s):\n${details}\n\nConsider removing these obvious/narrating comments to keep code clean.`;
}

export function registerCommentChecker(api: OpenClawPluginApi): void {
  api.on<PluginHookToolResultPersistEvent, PluginHookToolResultPersistResult | void>(
    'tool_result_persist',
    (event: PluginHookToolResultPersistEvent, ctx: PluginHookToolResultPersistContext): PluginHookToolResultPersistResult | void => {
      const config = getPluginConfig(api);
      if (!config.comment_checker_enabled) {
        return;
      }

      const content = getTextContent(event);
      if (!content) return;

      const fileHint = extractFileHint(event, ctx);
      if (hasNonCodeExtension(fileHint) || contentLooksNonCode(content)) {
        return;
      }

      const violations = findViolations(content, fileHint);
      if (violations.length === 0) {
        return;
      }

      const updatedContent = appendViolationSummary(content, violations);

      // Modify message content to append the violation summary
      const rawContent = (event.message as Record<string, unknown>).content;

      if (typeof rawContent === 'string') {
        return {
          message: {
            ...event.message,
            content: updatedContent,
          } as typeof event.message,
        };
      }

      // Content block array: append to last text block
      if (Array.isArray(rawContent)) {
        const blocks = rawContent.map((block, i) => {
          if (i === rawContent.length - 1 && typeof block === 'object' && block !== null && (block as Record<string, unknown>).type === 'text' && typeof (block as Record<string, unknown>).text === 'string') {
            return { ...block, text: (block as { text: string }).text + '\n\n---\n' + updatedContent.split('\n').slice(2).join('\n') };
          }
          return block;
        });

        return {
          message: {
            ...event.message,
            content: blocks,
          } as typeof event.message,
        };
      }

      return;
    },
    { priority: 90 },
  );
}
