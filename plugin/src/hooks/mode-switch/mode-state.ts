import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { resolveOpenClawWorkspaceDir } from '../../utils/paths.js';

const STATE_SUBDIR = '.omoc-state';
const STATE_FILE = 'active_mode';

function getStateFilePath(workspaceDir?: string): string {
  const ws = resolveOpenClawWorkspaceDir(workspaceDir);
  return join(ws, STATE_SUBDIR, STATE_FILE);
}

export function getActiveModeSync(workspaceDir?: string): string | null {
  const filePath = getStateFilePath(workspaceDir);
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, 'utf-8').trim();
    return raw || null;
  } catch {
    return null;
  }
}

export async function setActiveMode(mode: string, workspaceDir?: string): Promise<void> {
  const filePath = getStateFilePath(workspaceDir);
  const stateDir = join(filePath, '..');
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  writeFileSync(filePath, mode.trim(), 'utf-8');
}

export function resetModeSync(workspaceDir?: string): void {
  const filePath = getStateFilePath(workspaceDir);
  const stateDir = join(filePath, '..');
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  writeFileSync(filePath, 'off', 'utf-8');
}

export async function resetMode(workspaceDir?: string): Promise<void> {
  resetModeSync(workspaceDir);
}
