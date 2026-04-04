import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let tmuxPath: string | null = null;
let initPromise: Promise<string | null> | null = null;

async function findTmuxPath(): Promise<string | null> {
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'where' : 'which';

  try {
    const { stdout } = await execAsync(`${cmd} tmux`, { timeout: 5000 });
    const path = stdout.trim().split('\n')[0];

    if (!path) {
      return null;
    }

    // Verify tmux works
    try {
      await execAsync(`${path} -V`, { timeout: 5000 });
      return path;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export async function getTmuxPath(): Promise<string | null> {
  if (tmuxPath !== null) {
    return tmuxPath;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const path = await findTmuxPath();
    tmuxPath = path;
    return path;
  })();

  return initPromise;
}

export function getCachedTmuxPath(): string | null {
  return tmuxPath;
}

export function startBackgroundCheck(): void {
  if (!initPromise) {
    initPromise = getTmuxPath();
    initPromise.catch(() => {});
  }
}
