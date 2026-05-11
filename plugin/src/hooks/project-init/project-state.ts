/**
 * Project state management for omoc_init.
 * Reads/writes <workspace>/.omoc-state/active-project (per-agent workspace).
 */
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

export interface ProjectEntry {
  name: string;
  path: string;
  agentMds: string[];
}

export interface PendingInit {
  type: 'init' | 'add';
  projectName: string;
  projectPath: string;
  agentMdFile: string;
  subPath?: string;
}

export interface ActiveProjectState {
  projects: ProjectEntry[];
  active: string | null;
  pendingInit: PendingInit | null;
}

export function getStateDir(workspaceDir: string): string {
  return join(workspaceDir, '.omoc-state');
}

export function getStateFile(workspaceDir: string): string {
  return join(getStateDir(workspaceDir), 'active-project');
}

function defaultState(): ActiveProjectState {
  return { projects: [], active: null, pendingInit: null };
}

export function readState(workspaceDir: string): ActiveProjectState {
  const stateFile = getStateFile(workspaceDir);
  if (!existsSync(stateFile)) {
    return defaultState();
  }
  try {
    const raw = readFileSync(stateFile, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ActiveProjectState>;
    return {
      projects: parsed.projects ?? [],
      active: parsed.active ?? null,
      pendingInit: parsed.pendingInit ?? null,
    };
  } catch {
    return defaultState();
  }
}

export function writeState(workspaceDir: string, state: ActiveProjectState): void {
  const stateDir = getStateDir(workspaceDir);
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  writeFileSync(getStateFile(workspaceDir), JSON.stringify(state, null, 2), 'utf-8');
}

export function findProjectByName(workspaceDir: string, name: string): ProjectEntry | undefined {
  return readState(workspaceDir).projects.find((p) => p.name === name);
}

export function findProjectByPath(workspaceDir: string, path: string): ProjectEntry | undefined {
  return readState(workspaceDir).projects.find((p) => p.path === path);
}

export function setActiveProject(workspaceDir: string, name: string | null): void {
  const state = readState(workspaceDir);
  state.active = name;
  writeState(workspaceDir, state);
}

export function addProject(workspaceDir: string, entry: ProjectEntry): void {
  const state = readState(workspaceDir);
  // Avoid duplicate by name
  const existing = state.projects.findIndex((p) => p.name === entry.name);
  if (existing >= 0) {
    state.projects[existing] = entry;
  } else {
    state.projects.push(entry);
  }
  writeState(workspaceDir, state);
}

export function removeProject(workspaceDir: string, name: string): void {
  const state = readState(workspaceDir);
  state.projects = state.projects.filter((p) => p.name !== name);
  if (state.active === name) {
    state.active = null;
  }
  writeState(workspaceDir, state);
}

export function addAgentMdToProject(workspaceDir: string, projectName: string, agentMd: string): boolean {
  const state = readState(workspaceDir);
  const project = state.projects.find((p) => p.name === projectName);
  if (!project) return false;
  if (project.agentMds.includes(agentMd)) return false;
  project.agentMds.push(agentMd);
  writeState(workspaceDir, state);
  return true;
}

export function removeAgentMdFromProject(workspaceDir: string, projectName: string, agentMd: string): boolean {
  const state = readState(workspaceDir);
  const project = state.projects.find((p) => p.name === projectName);
  if (!project) return false;
  project.agentMds = project.agentMds.filter((a) => a !== agentMd);
  writeState(workspaceDir, state);
  return true;
}

export function setPendingInit(workspaceDir: string, pending: PendingInit | null): void {
  const state = readState(workspaceDir);
  state.pendingInit = pending;
  writeState(workspaceDir, state);
}

export function clearPendingInit(workspaceDir: string): void {
  const state = readState(workspaceDir);
  state.pendingInit = null;
  writeState(workspaceDir, state);
}

export function getPendingInit(workspaceDir: string): PendingInit | null {
  return readState(workspaceDir).pendingInit;
}

export function getActiveProject(workspaceDir: string): ProjectEntry | undefined {
  const state = readState(workspaceDir);
  if (!state.active) return undefined;
  return state.projects.find((p) => p.name === state.active);
}
