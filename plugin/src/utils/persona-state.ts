import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { OpenClawPluginApi } from '../types.js';
import { resolveOpenClawWorkspaceDir } from './paths.js';
import { ALL_AGENT_IDS } from '../agents/agent-ids.js';

const KNOWN_AGENT_IDS = new Set(ALL_AGENT_IDS);

let activePersonaId: string | null = null;
let loaded = false;

function resolveStateDir(workspaceDir?: string): string {
  return join(resolveOpenClawWorkspaceDir(workspaceDir), '.omoc-state');
}

function resolveStateFilePath(workspaceDir?: string): string {
  return join(resolveStateDir(workspaceDir), 'active-persona');
}

export async function initPersonaState(_api: OpenClawPluginApi): Promise<void> {
  try {
    await mkdir(resolveStateDir(), { recursive: true });
  } catch (error) {
    console.warn('[omoc] Failed to initialize persona state directory:', error);
  }
  await loadFromDisk();
}

export async function setActivePersonaId(id: string | null, workspaceDir?: string): Promise<void> {
  activePersonaId = id;
  loaded = true;
  await saveToDisk(workspaceDir);
}

export async function setActivePersona(id: string | null, workspaceDir?: string): Promise<void> {
  await setActivePersonaId(id, workspaceDir);
}

/** Synchronous getter for in-memory persona state (returns null if not loaded yet) */
export function getActivePersonaSync(): string | null {
  return activePersonaId;
}

export async function getActivePersona(workspaceDir?: string, agentId?: string): Promise<string | null> {
  if (!loaded) await loadFromDisk(workspaceDir);
  if (activePersonaId) return activePersonaId;
  if (agentId && KNOWN_AGENT_IDS.has(agentId)) {
    await setActivePersonaId(agentId);
    return agentId;
  }
  return null;
}

export async function resetPersonaState(workspaceDir?: string): Promise<void> {
  activePersonaId = null;
  loaded = true;
  await saveOffState(workspaceDir);
}

async function loadFromDisk(workspaceDir?: string): Promise<void> {
  try {
    const content = (await readFile(resolveStateFilePath(workspaceDir), 'utf-8')).trim();
    activePersonaId = (content && content !== OFF_MARKER) ? content : null;
  } catch (error: any) {
    // ENOENT is expected on first boot — no state file yet
    if (error?.code !== 'ENOENT') {
      console.warn('[omoc] Failed to load persona state from disk:', error);
    }
    activePersonaId = null;
  }
  loaded = true;
}

export const OFF_MARKER = '__OFF__';

async function saveToDisk(workspaceDir?: string): Promise<void> {
  try {
    await mkdir(resolveStateDir(workspaceDir), { recursive: true });
    await writeFile(resolveStateFilePath(workspaceDir), activePersonaId ?? '', 'utf-8');
  } catch (error) {
    console.warn('[omoc] Failed to persist persona state to disk:', error);
  }
}

async function saveOffState(workspaceDir?: string): Promise<void> {
  try {
    await mkdir(resolveStateDir(workspaceDir), { recursive: true });
    await writeFile(resolveStateFilePath(workspaceDir), OFF_MARKER, 'utf-8');
  } catch (error) {
    console.warn('[omoc] Failed to persist persona off-state to disk:', error);
  }
}
