import { readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

/**
 * Persona Bootstrap Internal Hook
 *
 * Uses the agent:bootstrap internal hook to replace AGENTS.md content
 * with the active persona's prompt at runtime.
 *
 * This is the correct approach — no disk modification, clean runtime injection.
 */

const OFF_MARKER = '__OFF__';

// Persona ID → filename mapping
const AGENT_MD_MAP: Record<string, string> = {
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

// Resolve plugin root from this file's location:
// plugin/hooks/persona-bootstrap/handler.ts → plugin/
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..', '..');

// mtime-based cache for persona files
const personaCache = new Map<string, { content: string; mtimeMs: number }>();

/**
 * Read persona content from plugin/agents/<name>.md
 */
function readPersonaContent(personaId: string): string | null {
  const mdName = AGENT_MD_MAP[personaId];
  if (!mdName) return null;

  const filePath = join(PLUGIN_ROOT, 'agents', `${mdName}.md`);
  try {
    const stat = statSync(filePath);
    const cached = personaCache.get(filePath);

    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.content;
    }

    const content = readFileSync(filePath, 'utf-8');
    personaCache.set(filePath, { content, mtimeMs: stat.mtimeMs });
    return content;
  } catch {
    personaCache.delete(filePath);
    return null;
  }
}

/**
 * Extract agentId from sessionKey (e.g., "agent:coder:feishu:direct:..." → "coder")
 */
function extractAgentIdFromSessionKey(sessionKey?: string): string | null {
  if (!sessionKey) return null;
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match ? match[1] : null;
}

/**
 * Resolve workspace directory for an agent
 */
function resolveWorkspaceDir(agentId: string | null, profile: string | undefined): string {
  // Profile override
  if (profile) {
    return join(homedir(), '.openclaw', `workspace-${profile}`);
  }
  // Agent-specific workspace
  if (agentId && agentId !== 'main' && agentId !== 'default') {
    return join(homedir(), '.openclaw', `workspace-${agentId}`);
  }
  // Default workspace
  return join(homedir(), '.openclaw', 'workspace');
}

/**
 * agent:bootstrap internal hook handler
 *
 * Modifies context.bootstrapFiles to replace AGENTS.md content
 * with the active persona's prompt.
 */
export default function personaBootstrapHandler(event: unknown): void {
  const context = event as {
    workspaceDir: string;
    bootstrapFiles: Array<{
      name: string;
      path: string;
      content: string;
      missing: boolean;
    }>;
    sessionKey?: string;
    agentId?: string;
    cfg?: { agents?: { list?: Array<{ id: string; workspace?: string }> } };
  };

  try {
    // 1. Determine workspace directory
    const agentId = extractAgentIdFromSessionKey(context.sessionKey) ?? context.agentId ?? null;
    const profile = process.env.OPENCLAW_PROFILE;
    let workspaceDir = context.workspaceDir;

    if (profile) {
      workspaceDir = join(homedir(), '.openclaw', `workspace-${profile}`);
    } else if (agentId && agentId !== 'main' && agentId !== 'default') {
      // Check config for custom workspace
      const agentConfig = context.cfg?.agents?.list?.find(a => a.id === agentId);
      if (agentConfig?.workspace) {
        workspaceDir = agentConfig.workspace.startsWith('~')
          ? join(homedir(), agentConfig.workspace.slice(1))
          : agentConfig.workspace;
      } else {
        workspaceDir = join(homedir(), '.openclaw', `workspace-${agentId}`);
      }
    }

    // 2. Read active persona state
    const statePath = join(workspaceDir, '.omoc-state', 'active-persona');
    let personaId: string | null = null;

    try {
      const content = readFileSync(statePath, 'utf-8').trim();
      personaId = (content && content !== OFF_MARKER) ? content : null;
    } catch {
      // No state file or can't read — persona not active
      return;
    }

    if (!personaId) return;

    // 3. Read persona content
    const personaContent = readPersonaContent(personaId);
    if (!personaContent) return;

    // 4. Find and replace AGENTS.md in bootstrapFiles
    const agentsFile = context.bootstrapFiles.find(f => f.name === 'AGENTS.md');
    if (!agentsFile) return;

    // Replace AGENTS.md content with persona content
    agentsFile.content = personaContent;
    agentsFile.missing = false;

    // 5. Log for debugging (use console.log since we don't have a logger in internal hooks)
    console.log(
      `[persona-bootstrap] Injected persona '${personaId}' into AGENTS.md (workspace: ${workspaceDir})`
    );
  } catch (err) {
    console.error('[persona-bootstrap] Hook error:', err);
  }
}
