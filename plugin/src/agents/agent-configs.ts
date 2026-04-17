/**
 * Defines the Oh-My-OpenClaw plugin's local agent configuration contracts
 * and the canonical list of built-in OMOC agent definitions.
 * 
 * Model configuration is loaded from config/agent-models.json at runtime.
 * Edit that file to change models - no rebuild required!
 */
import { READ_ONLY_DENY } from '../constants.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// __dirname is .../plugin/dist/agents/, so go up twice to reach plugin/
const PLUGIN_ROOT = join(__dirname, '..', '..');

interface AgentModelConfig {
  primary: string;
  fallbacks?: string[];
}

interface AgentModelsFile {
  description: string;
  agents: Record<string, AgentModelConfig>;
}

/**
 * Load agent model configuration from config/agent-models.json
 * Cached at module load time for performance.
 */
function loadAgentModels(): AgentModelsFile {
  try {
    const configPath = join(PLUGIN_ROOT, 'config', 'agent-models.json');
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as AgentModelsFile;
  } catch (error) {
    console.warn('[omoc] Failed to load agent-models.json, using defaults:', error);
    return {
      description: 'Default agent models',
      agents: {},
    };
  }
}

const agentModels = loadAgentModels();

/**
 * Get model configuration for an agent from runtime config.
 * Falls back to bailian/qwen3.5-plus if not configured.
 */
function getModelForAgent(agentId: string): string | { primary: string; fallbacks?: string[] } {
  const config = agentModels.agents[agentId];
  if (!config) {
    return 'bailian/qwen3.5-plus';
  }
  return config.fallbacks ? config : config.primary;
}

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
    model: getModelForAgent('omoc_planner'),
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
    model: getModelForAgent('omoc_delegate'),
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
    model: getModelForAgent('omoc_coder'),
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
    model: getModelForAgent('omoc_expert'),
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
    model: getModelForAgent('omoc_architect'),
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
    model: getModelForAgent('omoc_explorer'),
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
    model: getModelForAgent('omoc_researcher'),
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
    model: getModelForAgent('omoc_advisor'),
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
    model: getModelForAgent('omoc_reviewer'),
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
    model: getModelForAgent('omoc_looker'),
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
    model: getModelForAgent('omoc_frontend'),
    identity: {
      name: 'Frontend',
      emoji: '🎨',
      theme: 'Visual Engineering',
    },
    tools: { profile: 'coding' },
    subagents: { allowAgents: ['omoc_explorer', 'omoc_researcher'] },
  },
];
