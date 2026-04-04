import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

export type GrepBackend = 'rg' | 'grep';

interface ResolvedCli {
  path: string;
  backend: GrepBackend;
}

let cachedCli: ResolvedCli | null = null;
let autoInstallAttempted = false;

function findExecutable(name: string): string | null {
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'where' : 'which';

  try {
    const result = spawnSync(cmd, [name], { encoding: 'utf-8', timeout: 5000 });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim().split('\n')[0];
    }
  } catch {
    // Command execution failed
  }
  return null;
}

export function resolveGrepCli(): ResolvedCli {
  if (cachedCli) return cachedCli;

  const systemRg = findExecutable('rg');
  if (systemRg) {
    cachedCli = { path: systemRg, backend: 'rg' };
    return cachedCli;
  }

  const grep = findExecutable('grep');
  if (grep) {
    cachedCli = { path: grep, backend: 'grep' };
    return cachedCli;
  }

  cachedCli = { path: 'rg', backend: 'rg' };
  return cachedCli;
}

export async function resolveGrepCliWithAutoInstall(): Promise<ResolvedCli> {
  const current = resolveGrepCli();

  if (current.backend === 'rg') {
    return current;
  }

  if (autoInstallAttempted) {
    return current;
  }

  autoInstallAttempted = true;

  // For now, just return current (auto-install not implemented in OpenClaw)
  return current;
}

export const DEFAULT_MAX_DEPTH = 20;
export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_LIMIT = 100;
export const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

export const RG_FILES_FLAGS = [
  '--files',
  '--color=never',
  '--no-heading',
  '--line-number',
  '--glob=!.git/*',
] as const;
