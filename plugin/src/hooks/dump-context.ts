/**
 * /omoc dump — LLM input context dumper.
 *
 * Hooks into llm_input (the final assembled prompt sent to the LLM provider)
 * and dumps it to a file when a dump flag is present.
 *
 * Trigger: user runs /omoc dump [path]
 *   → command handler writes flag file at <workspace>/.omoc-state/dump_next_turn
 *   → continues agent turn → llm_input hook fires → reads flag → dumps → clears flag
 */

import type { OpenClawPluginApi, PluginHookLlmInputEvent, PluginHookAgentContext } from '../types.js';
import { LOG_PREFIX } from '../constants.js';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';

const SEP = '='.repeat(80);

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function flagFile(workspaceDir: string): string {
  return join(workspaceDir, '.omoc-state', 'dump_next_turn');
}

/**
 * 把 LLM input event 格式化成人类可读的多行文本。
 * 不重新排序，保持原始顺序。
 */
function formatDump(event: PluginHookLlmInputEvent): string {
  const lines: string[] = [];

  // ── Header ──
  lines.push(SEP);
  lines.push('LLM Context Dump');
  lines.push(SEP);
  lines.push(`Timestamp : ${new Date().toISOString()}`);
  lines.push(`Provider  : ${event.provider}`);
  lines.push(`Model     : ${event.model}`);
  lines.push(`Session   : ${event.sessionId}`);
  lines.push(`Run       : ${event.runId}`);
  lines.push(`Tools     : ${event.tools?.length ?? 0}`);
  lines.push(`History   : ${event.historyMessages.length} messages`);
  lines.push(`Images    : ${event.imagesCount}`);
  lines.push('');

  // ── System Prompt ──
  lines.push(SEP);
  lines.push('SYSTEM PROMPT');
  lines.push(SEP);
  lines.push(event.systemPrompt ?? '(none)');
  lines.push('');

  // ── History Messages ──
  lines.push(SEP);
  lines.push(`HISTORY (${event.historyMessages.length} messages)`);
  lines.push(SEP);
  for (let i = 0; i < event.historyMessages.length; i++) {
    const msg = event.historyMessages[i] as Record<string, unknown>;
    const role = String(msg.role ?? '?');
    lines.push('');
    lines.push(`--- [${i + 1}] ${role} ---`);

    const content = msg.content;
    if (typeof content === 'string') {
      lines.push(content);
    } else if (Array.isArray(content)) {
      for (const block of content as Array<Record<string, unknown>>) {
        if (block.type === 'text' && typeof block.text === 'string') {
          lines.push(block.text);
        } else if (block.type === 'toolCall') {
          lines.push(`[${block.name ?? '?'}](${JSON.stringify(block.arguments ?? {})})`);
        } else if (block.type === 'toolResult') {
          const tcId = String(block.toolCallId ?? '?');
          const isErr = block.isError ? ' ERROR' : '';
          lines.push(`// .toolResult ${tcId}${isErr}`);
          const tcContent = (block as Record<string, unknown>).content;
          if (Array.isArray(tcContent)) {
            for (const cb of tcContent as Array<Record<string, unknown>>) {
              if (cb.type === 'text' && typeof cb.text === 'string') {
                lines.push(cb.text);
              }
            }
          } else if (typeof tcContent === 'string') {
            lines.push(tcContent);
          }
        } else if (block.type === 'thinking') {
          lines.push(`# thinking: ${String(block.thinking ?? '').substring(0, 200)}`);
        }
      }
    }
  }

  // ── Current Prompt ──
  lines.push('');
  lines.push(SEP);
  lines.push('CURRENT PROMPT');
  lines.push(SEP);
  lines.push(event.prompt);
  lines.push('');

  return lines.join('\n');
}

export function registerDumpContext(api: OpenClawPluginApi): void {
  api.on('llm_input', (event: PluginHookLlmInputEvent, ctx: PluginHookAgentContext) => {
    const workspaceDir = ctx.workspaceDir;
    if (!workspaceDir) return;

    const flag = flagFile(workspaceDir);
    if (!existsSync(flag)) return;

    // Read output path from flag file
    let outPath: string;
    try {
      outPath = readFileSync(flag, 'utf-8').trim();
      if (!outPath) throw new Error('empty flag');
    } catch {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      outPath = join(workspaceDir, '.omoc-dumps', `llm-input-${ts}.json`);
    }

    // Clear flag FIRST to prevent loops
    try {
      unlinkSync(flag);
    } catch {
      // ignore — might have been cleaned up already
    }

    try {
      ensureDir(dirname(outPath));
      writeFileSync(outPath, formatDump(event), 'utf-8');

      api.logger.info(
        `${LOG_PREFIX} [dump] LLM input dumped → ${outPath} ` +
        `(provider=${event.provider}, model=${event.model}, ` +
        `${event.historyMessages.length} history msgs, ` +
        `${event.imagesCount} images, ` +
        `${event.tools?.length ?? 0} tools)`
      );
    } catch (err) {
      api.logger.error(`${LOG_PREFIX} [dump] Failed to write dump: ${err}`);
    }
  });
}
