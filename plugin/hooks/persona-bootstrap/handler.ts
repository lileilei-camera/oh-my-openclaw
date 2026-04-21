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
  console.log('[persona-bootstrap] ===== HOOK TRIGGERED: agent:bootstrap =====');

  const evt = event as {
    type: string;
    action: string;
    sessionKey?: string;
    context?: {
      workspaceDir: string;
      bootstrapFiles: Array<{
        name: string;
        path: string;
        content: string;
        missing: boolean;
      }>;
      agentId?: string;
      cfg?: { agents?: { list?: Array<{ id: string; workspace?: string }> } };
    };
  };

  const ctx = evt.context;
  if (!ctx) {
    console.log('[persona-bootstrap] ❌ No event.context — skipping');
    return;
  }

  try {
    // Debug: dump event context
    console.log('[persona-bootstrap] event.context.workspaceDir:', ctx.workspaceDir);
    console.log('[persona-bootstrap] event.sessionKey:', evt.sessionKey);
    console.log('[persona-bootstrap] event.context.agentId:', ctx.agentId);
    console.log('[persona-bootstrap] bootstrapFiles count:', ctx.bootstrapFiles?.length ?? 0);
    console.log('[persona-bootstrap] bootstrapFiles names:', ctx.bootstrapFiles?.map(f => f.name).join(', '));

    // Skip persona injection for lightweight subagent runs (e.g., active-memory)
    // These inherit the persona from the main session anyway
    if (!ctx.bootstrapFiles || ctx.bootstrapFiles.length === 0) {
      console.log('[persona-bootstrap] bootstrapFiles is empty — likely a lightweight subagent run (e.g., active-memory), skipping persona injection');
      return;
    }

    // 1. Determine workspace directory
    const agentId = extractAgentIdFromSessionKey(evt.sessionKey) ?? ctx.agentId ?? null;
    const profile = process.env.OPENCLAW_PROFILE;
    let workspaceDir = ctx.workspaceDir;

    console.log('[persona-bootstrap] extracted agentId:', agentId);
    console.log('[persona-bootstrap] OPENCLAW_PROFILE:', profile);

    if (profile) {
      workspaceDir = join(homedir(), '.openclaw', `workspace-${profile}`);
      console.log('[persona-bootstrap] workspaceDir (from profile):', workspaceDir);
    } else if (agentId && agentId !== 'main' && agentId !== 'default') {
      // Check config for custom workspace
      const agentConfig = ctx.cfg?.agents?.list?.find(a => a.id === agentId);
      if (agentConfig?.workspace) {
        workspaceDir = agentConfig.workspace.startsWith('~')
          ? join(homedir(), agentConfig.workspace.slice(1))
          : agentConfig.workspace;
        console.log('[persona-bootstrap] workspaceDir (from agent config):', workspaceDir);
      } else {
        workspaceDir = join(homedir(), '.openclaw', `workspace-${agentId}`);
        console.log('[persona-bootstrap] workspaceDir (default agent):', workspaceDir);
      }
    } else {
      console.log('[persona-bootstrap] workspaceDir (unchanged):', workspaceDir);
    }

    // 2. Read active persona state
    const statePath = join(workspaceDir, '.omoc-state', 'active-persona');
    console.log('[persona-bootstrap] statePath:', statePath);

    let personaId: string | null = null;

    try {
      const content = readFileSync(statePath, 'utf-8').trim();
      personaId = (content && content !== OFF_MARKER) ? content : null;
      console.log('[persona-bootstrap] persona state file content:', content.substring(0, 100));
      console.log('[persona-bootstrap] resolved personaId:', personaId);
    } catch (err) {
      console.log('[persona-bootstrap] No persona state file or cannot read — persona not active. Error:', err instanceof Error ? err.message : String(err));
      return;
    }

    if (!personaId) {
      console.log('[persona-bootstrap] personaId is null/empty/OFF — skipping injection');
      return;
    }

    // 3. Read persona content
    console.log('[persona-bootstrap] Reading persona content for:', personaId);
    const personaContent = readPersonaContent(personaId);
    if (!personaContent) {
      console.log('[persona-bootstrap] Persona content not found for:', personaId);
      return;
    }
    console.log('[persona-bootstrap] Persona content loaded, length:', personaContent.length, 'bytes');

    // 4. Find and replace AGENTS.md in bootstrapFiles
    const agentsFile = ctx.bootstrapFiles.find(f => f.name === 'AGENTS.md');
    if (!agentsFile) {
      console.log('[persona-bootstrap] AGENTS.md not found in bootstrapFiles — skipping');
      return;
    }

    console.log('[persona-bootstrap] Found AGENTS.md in bootstrapFiles, original length:', agentsFile.content.length, 'bytes');

    // Replace AGENTS.md content with persona content
    agentsFile.content = personaContent;
    agentsFile.missing = false;

    // 5. Log success
    console.log(
      `[persona-bootstrap] ✅ Injected persona '${personaId}' into AGENTS.md (workspace: ${workspaceDir}, new length: ${personaContent.length} bytes)`
    );
  } catch (err) {
    console.error('[persona-bootstrap] ❌ Hook error:', err);
  }
}
