/**
 * Canonical source for all agent IDs and their metadata.
 * Single source of truth for agent identification across the plugin.
 */

/** Orchestrator-tier agents (strategic planning and task distribution) */
export const ORCHESTRATOR_IDS = new Set([
  'omoc_planner',
  'omoc_delegate',
]);

/** Worker-tier agents (implementation and execution) */
export const WORKER_IDS = new Set([
  'omoc_coder',
  'omoc_expert',
  'omoc_frontend',
]);

/** Maps agent ID to markdown persona filename (without extension) */
export const AGENT_MD_MAP: Record<string, string> = {
  omoc_planner: 'planner',
  omoc_delegate: 'delegate',
  omoc_coder: 'coder',
  omoc_expert: 'expert',
  omoc_architect: 'architect',
  omoc_explorer: 'explorer',
  omoc_researcher: 'researcher',
  omoc_advisor: 'advisor',
  omoc_reviewer: 'reviewer',
  omoc_looker: 'multimodal-looker',
  omoc_frontend: 'frontend',
};

/** Maps agent ID to model tier for provider preset selection */
export const AGENT_TIER_MAP: Record<string, 'planner' | 'orchestrator' | 'reasoning' | 'analysis' | 'worker' | 'deep-worker' | 'search' | 'research' | 'visual'> = {
  omoc_planner: 'planner',
  omoc_delegate: 'orchestrator',
  omoc_architect: 'reasoning',
  omoc_advisor: 'analysis',
  omoc_reviewer: 'analysis',
  omoc_coder: 'worker',
  omoc_expert: 'deep-worker',
  omoc_explorer: 'search',
  omoc_researcher: 'research',
  omoc_looker: 'visual',
  omoc_frontend: 'visual',
};

/** All agent IDs (orchestrators + workers + read-only specialists) */
export const ALL_AGENT_IDS = [
  ...ORCHESTRATOR_IDS,
  ...WORKER_IDS,
  'omoc_architect',
  'omoc_explorer',
  'omoc_researcher',
  'omoc_advisor',
  'omoc_reviewer',
  'omoc_looker',
];
