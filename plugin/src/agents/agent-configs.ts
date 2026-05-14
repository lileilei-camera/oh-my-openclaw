/**
 * Defines the Oh-My-OpenClaw plugin's local agent configuration contracts
 * and the canonical list of built-in OMOC agent definitions.
 * 
 * Agent models are resolved from openclaw.json agents.list at runtime.
 * Each agent's model field is omitted here — OpenClaw resolves it automatically
 * from agents.list (or agents.defaults.model if not configured).
 */
import { READ_ONLY_DENY } from '../constants.js';
import { readAgentModel } from '../utils/agent-model.js';

export type OmocAgentConfig = {
  id: string;
  name?: string;
  model?: string | { primary: string; fallbacks?: string[] };
  skills?: string[];
  identity?: { name?: string; theme?: string; emoji?: string };
  subagents?: {
    allowAgents?: string[];
    model?: string | { primary: string; fallbacks?: string[] };
  };
  tools?: {
    profile?: 'minimal' | 'coding' | 'messaging' | 'full';
    allow?: string[];
    deny?: string[];
  };
};

export const OMOC_AGENT_CONFIGS: OmocAgentConfig[] = [
  // Strategic planning agent - needs best reasoning for complex planning.
  {
    id: 'omoc_planner',
    name: 'Planner',
    identity: {
      name: 'Planner',
      emoji: '📋',
      theme: 'Strategic Planner',
    },
    tools: { profile: 'full' },
    subagents: { allowAgents: ['*'] },
  },
  // Task orchestration coordinator - balanced speed/quality for coordination.
  {
    id: 'omoc_delegate',
    name: 'Delegate',
    identity: {
      name: 'Delegate',
      emoji: '🗺️',
      theme: 'Task Orchestrator',
    },
    tools: { profile: 'full' },
    subagents: { allowAgents: ['*'] },
  },
  // Primary implementation worker - needs best coding model.
  {
    id: 'omoc_coder',
    name: 'Coder',
    identity: {
      name: 'Coder',
      emoji: '💻',
      theme: 'Implementation Worker',
    },
    tools: { profile: 'full' },
    subagents: {
      allowAgents: ['omoc_explorer', 'omoc_researcher', 'omoc_architect'],
    },
  },
  // Deep implementation specialist - complex coding tasks.
  {
    id: 'omoc_expert',
    name: 'Expert',
    identity: {
      name: 'Expert',
      emoji: '⚙️',
      theme: 'Deep Implementation',
    },
    tools: { profile: 'full' },
    subagents: {
      allowAgents: ['omoc_explorer', 'omoc_researcher', 'omoc_architect'],
    },
  },
  // Read-only architecture consultant - reasoning for architecture decisions.
  {
    id: 'omoc_architect',
    name: 'Architect',
    identity: {
      name: 'Architect',
      emoji: '🏗️',
      theme: 'Architecture Consultant',
    },
    tools: {
      profile: 'coding',
      deny: READ_ONLY_DENY,
    },
  },
  // Read-only codebase search specialist - fast search with good context.
  {
    id: 'omoc_explorer',
    name: 'Explorer',
    identity: {
      name: 'Explorer',
      emoji: '🔎',
      theme: 'Codebase Search',
    },
    tools: {
      profile: 'coding',
      deny: READ_ONLY_DENY,
    },
  },
  // Read-only documentation research specialist - large context for docs.
  {
    id: 'omoc_researcher',
    name: 'Researcher',
    identity: {
      name: 'Researcher',
      emoji: '🔬',
      theme: 'Documentation Research',
    },
    tools: {
      profile: 'coding',
      deny: READ_ONLY_DENY,
    },
  },
  // Read-only pre-planning analyst - analysis before planning.
  {
    id: 'omoc_advisor',
    name: 'Advisor',
    identity: {
      name: 'Advisor',
      emoji: '💡',
      theme: 'Pre-Planning Analyst',
    },
    tools: {
      profile: 'coding',
      deny: READ_ONLY_DENY,
    },
  },
  // Read-only plan review specialist - critical review needs reasoning.
  {
    id: 'omoc_reviewer',
    name: 'Reviewer',
    identity: {
      name: 'Reviewer',
      emoji: '📝',
      theme: 'Plan Reviewer',
    },
    tools: {
      profile: 'coding',
      deny: READ_ONLY_DENY,
    },
  },
  // Multimodal visual analysis specialist - needs image support.
  {
    id: 'omoc_looker',
    name: 'Multimodal Looker',
    identity: {
      name: 'Multimodal Looker',
      emoji: '👁️',
      theme: 'Visual Analysis',
    },
    tools: {
      allow: ['read'],
      deny: READ_ONLY_DENY,
    },
  },
  // Frontend-focused visual engineering specialist - visual + coding.
  {
    id: 'omoc_frontend',
    name: 'Frontend',
    identity: {
      name: 'Frontend',
      emoji: '🎨',
      theme: 'Visual Engineering',
    },
    tools: { profile: 'coding' },
    subagents: { allowAgents: ['omoc_explorer', 'omoc_researcher'] },
  },
];
