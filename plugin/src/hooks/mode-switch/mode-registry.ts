import { MODE_ID as SEARCH_ID, MODE_LABEL as SEARCH_LABEL, MODE_DESC as SEARCH_DESC, MODE_MESSAGE as SEARCH_MSG } from './search-mode.js';
import { MODE_ID as ANALYZE_ID, MODE_LABEL as ANALYZE_LABEL, MODE_DESC as ANALYZE_DESC, MODE_MESSAGE as ANALYZE_MSG } from './analyze-mode.js';
import { MODE_ID as CODING_ID, MODE_LABEL as CODING_LABEL, MODE_DESC as CODING_DESC, MODE_MESSAGE as CODING_MSG } from './coding-mode.js';
import { MODE_ID as PLAN_ID, MODE_LABEL as PLAN_LABEL, MODE_DESC as PLAN_DESC, MODE_MESSAGE as PLAN_MSG } from './plan-mode.js';
import { MODE_ID as ULTRAWORK_ID, MODE_LABEL as ULTRAWORK_LABEL, MODE_DESC as ULTRAWORK_DESC, MODE_MESSAGE as ULTRAWORK_MSG } from './ultrawork-mode.js';
import { MODE_ID as START_WORK_ID, MODE_LABEL as START_WORK_LABEL, MODE_DESC as START_WORK_DESC, MODE_MESSAGE as START_WORK_MSG } from './start-work-mode.js';

export type ModeId = 'search' | 'analyze' | 'coding' | 'plan' | 'ultrawork' | 'start-work';

interface ModeMeta {
  id: ModeId;
  label: string;
  description: string;
  message: string;
}

const MODES: ModeMeta[] = [
  { id: SEARCH_ID, label: SEARCH_LABEL, description: SEARCH_DESC, message: SEARCH_MSG },
  { id: ANALYZE_ID, label: ANALYZE_LABEL, description: ANALYZE_DESC, message: ANALYZE_MSG },
  { id: CODING_ID, label: CODING_LABEL, description: CODING_DESC, message: CODING_MSG },
  { id: PLAN_ID, label: PLAN_LABEL, description: PLAN_DESC, message: PLAN_MSG },
  { id: ULTRAWORK_ID, label: ULTRAWORK_LABEL, description: ULTRAWORK_DESC, message: ULTRAWORK_MSG },
  { id: START_WORK_ID, label: START_WORK_LABEL, description: START_WORK_DESC, message: START_WORK_MSG },
];

const MODE_MAP = new Map<ModeId, ModeMeta>(MODES.map((m) => [m.id, m]));

export function getModeMessage(mode: ModeId): string {
  return MODE_MAP.get(mode)?.message ?? '';
}

export function getModeLabel(mode: ModeId): string {
  return MODE_MAP.get(mode)?.label ?? mode;
}

export function listModes(): Array<{ id: ModeId; label: string; description: string }> {
  return MODES.map(({ id, label, description }) => ({ id, label, description }));
}

export function isValidMode(mode: string): mode is ModeId {
  return MODE_MAP.has(mode as ModeId);
}
