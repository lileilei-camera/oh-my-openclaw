/**
 * Project state management for omoc_init.
 * Reads/writes ~/.openclaw/workspace/.omoc-state/active-project
 */
import { homedir } from 'os';
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

const STATE_DIR = join(homedir(), '.openclaw', 'workspace', '.omoc-state');
const STATE_FILE = join(STATE_DIR, 'active-project');

function defaultState(): ActiveProjectState {
  return { projects: [], active: null, pendingInit: null };
}

export function readState(): ActiveProjectState {
  if (!existsSync(STATE_FILE)) {
    return defaultState();
  }
  try {
    const raw = readFileSync(STATE_FILE, 'utf-8');
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

export function writeState(state: ActiveProjectState): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export function findProjectByName(name: string): ProjectEntry | undefined {
  return readState().projects.find((p) => p.name === name);
}

export function findProjectByPath(path: string): ProjectEntry | undefined {
  return readState().projects.find((p) => p.path === path);
}

export function setActiveProject(name: string | null): void {
  const state = readState();
  state.active = name;
  writeState(state);
}

export function addProject(entry: ProjectEntry): void {
  const state = readState();
  // Avoid duplicate by name
  const existing = state.projects.findIndex((p) => p.name === entry.name);
  if (existing >= 0) {
    state.projects[existing] = entry;
  } else {
    state.projects.push(entry);
  }
  writeState(state);
}

export function removeProject(name: string): void {
  const state = readState();
  state.projects = state.projects.filter((p) => p.name !== name);
  if (state.active === name) {
    state.active = null;
  }
  writeState(state);
}

export function addAgentMdToProject(projectName: string, agentMd: string): boolean {
  const state = readState();
  const project = state.projects.find((p) => p.name === projectName);
  if (!project) return false;
  if (project.agentMds.includes(agentMd)) return false;
  project.agentMds.push(agentMd);
  writeState(state);
  return true;
}

export function removeAgentMdFromProject(projectName: string, agentMd: string): boolean {
  const state = readState();
  const project = state.projects.find((p) => p.name === projectName);
  if (!project) return false;
  project.agentMds = project.agentMds.filter((a) => a !== agentMd);
  writeState(state);
  return true;
}

export function setPendingInit(pending: PendingInit | null): void {
  const state = readState();
  state.pendingInit = pending;
  writeState(state);
}

export function clearPendingInit(): void {
  const state = readState();
  state.pendingInit = null;
  writeState(state);
}

export function getPendingInit(): PendingInit | null {
  return readState().pendingInit;
}

export function getActiveProject(): ProjectEntry | undefined {
  const state = readState();
  if (!state.active) return undefined;
  return state.projects.find((p) => p.name === state.active);
}
