import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface AgentModelConfig {
  primary: string;
  fallbacks?: string[];
}

interface AgentEntry {
  id: string;
  model?: AgentModelConfig;
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      model?: AgentModelConfig;
    };
    list?: AgentEntry[];
  };
}

let cachedConfig: OpenClawConfig | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

function readOpenClawConfig(): OpenClawConfig {
  const now = Date.now();
  if (cachedConfig && (now - cacheTime) < CACHE_TTL_MS) {
    return cachedConfig;
  }
  try {
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    const raw = readFileSync(configPath, 'utf-8');
    cachedConfig = JSON.parse(raw) as OpenClawConfig;
    cacheTime = now;
    return cachedConfig;
  } catch {
    return cachedConfig || {};
  }
}

/**
 * Read agent model from openclaw.json agents.list.
 * Falls back to agents.defaults.model.primary if not configured.
 */
export function readAgentModel(agentId: string): AgentModelConfig {
  const config = readOpenClawConfig();
  const list = config.agents?.list || [];
  const agent = list.find((a) => a.id === agentId);

  if (agent?.model) {
    return agent.model;
  }

  const defaultModel = config.agents?.defaults?.model;
  if (defaultModel) {
    return defaultModel;
  }

  return { primary: 'bailian/qwen3.5-plus' };
}
