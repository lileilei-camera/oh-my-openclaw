import { SEARCH_PATTERN, SEARCH_MESSAGE } from './search-mode.js';
import { ANALYZE_PATTERN, ANALYZE_MESSAGE } from './analyze-mode.js';
import { ULTRAWORK_PATTERN, ULTRAWORK_MESSAGE } from './ultrawork-mode.js';
import { CODING_PATTERN, CODING_MESSAGE } from './coding-mode.js';
import { PLAN_PATTERN, PLAN_MESSAGE } from './plan-mode.js';
import { START_WORK_PATTERN, START_WORK_MESSAGE } from './start-work-mode.js';

const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;

export type KeywordType = 'ultrawork' | 'search' | 'analyze' | 'coding' | 'plan' | 'start_work';

export interface DetectedKeyword {
  type: KeywordType;
  message: string;
}

interface KeywordDetector {
  type: KeywordType;
  pattern: RegExp;
  message: string;
}

/** Persona to auto-switch when a workflow keyword is detected */
export const WORKFLOW_PERSONA_MAP: Partial<Record<KeywordType, string>> = {
  ultrawork: 'omoc_delegate',
  plan: 'omoc_planner',
  start_work: 'omoc_delegate',
};

const SLASH_COMMAND_DETECTORS: KeywordDetector[] = [
  { type: 'ultrawork', pattern: ULTRAWORK_PATTERN, message: ULTRAWORK_MESSAGE },
  { type: 'plan', pattern: PLAN_PATTERN, message: PLAN_MESSAGE },
  { type: 'start_work', pattern: START_WORK_PATTERN, message: START_WORK_MESSAGE },
];

const NATURAL_LANG_DETECTORS: KeywordDetector[] = [
  { type: 'search', pattern: SEARCH_PATTERN, message: SEARCH_MESSAGE },
  { type: 'analyze', pattern: ANALYZE_PATTERN, message: ANALYZE_MESSAGE },
  { type: 'coding', pattern: CODING_PATTERN, message: CODING_MESSAGE },
];

function removeCodeBlocks(text: string): string {
  return text.replace(CODE_BLOCK_PATTERN, '').replace(INLINE_CODE_PATTERN, '');
}

export function detectKeywords(text: string, personaId?: string | null): DetectedKeyword[] {
  const cleaned = removeCodeBlocks(text);

  // 1. 优先探测斜杠命令
  const slashResults = SLASH_COMMAND_DETECTORS
    .filter(({ pattern }) => pattern.test(cleaned))
    .map(({ type, message }) => ({ type, message }));

  // 2. 如果命中斜杠命令，立即返回（不再探测自然语言关键词）
  if (slashResults.length > 0) {
    return slashResults;
  }

  // 3. 没有斜杠命令，才探测自然语言关键词
  const results = NATURAL_LANG_DETECTORS
    .filter(({ pattern }) => pattern.test(cleaned))
    .map(({ type, message }) => ({ type, message }));

  // 4. Planner persona 下过滤掉 coding
  if (personaId === 'omoc_planner') {
    return results.filter(r => r.type !== 'coding');
  }

  return results;
}
