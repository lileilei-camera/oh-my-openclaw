import { exec } from 'child_process';
import { promisify } from 'util';
import {
  resolveGrepCli,
  type GrepBackend,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_LIMIT,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_OUTPUT_BYTES,
  RG_FILES_FLAGS,
} from './constants.js';
import type { GlobOptions, GlobResult, FileMatch } from './types.js';
import { stat } from 'node:fs/promises';

const execAsync = promisify(exec);

export interface ResolvedCli {
  path: string;
  backend: GrepBackend;
}

function buildRgArgs(options: GlobOptions): string[] {
  const args: string[] = [
    ...RG_FILES_FLAGS,
    `--max-depth=${Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, DEFAULT_MAX_DEPTH)}`,
  ];

  if (options.hidden !== false) args.push('--hidden');
  if (options.follow !== false) args.push('--follow');
  if (options.noIgnore) args.push('--no-ignore');

  args.push(`--glob=${options.pattern}`);

  return args;
}

function buildFindArgs(options: GlobOptions): string[] {
  const args: string[] = [];

  if (options.follow !== false) {
    args.push('-L');
  }

  args.push('.');

  const maxDepth = Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, DEFAULT_MAX_DEPTH);
  args.push('-maxdepth', String(maxDepth));

  args.push('-type', 'f');
  args.push('-name', options.pattern);

  if (options.hidden === false) {
    args.push('-not', '-path', '*/.*');
  }

  return args;
}

function buildPowerShellCommand(options: GlobOptions): string[] {
  const maxDepth = Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, DEFAULT_MAX_DEPTH);
  const paths = options.paths?.length ? options.paths : ['.'];
  const searchPath = paths[0] || '.';

  const escapedPath = searchPath.replace(/'/g, "''");
  const escapedPattern = options.pattern.replace(/'/g, "''");

  let psCommand = `Get-ChildItem -Path '${escapedPath}' -File -Recurse -Depth ${maxDepth - 1} -Filter '${escapedPattern}'`;

  if (options.hidden !== false) {
    psCommand += ' -Force';
  }

  psCommand += ' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName';

  return ['powershell', '-NoProfile', '-Command', psCommand];
}

async function getFileMtime(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath);
    return stats.mtimeMs;
  } catch {
    return 0;
  }
}

export { buildRgArgs, buildFindArgs, buildPowerShellCommand };

export async function runRgFiles(
  options: GlobOptions,
  resolvedCli?: ResolvedCli
): Promise<GlobResult> {
  const cli = resolvedCli ?? resolveGrepCli();
  const timeout = Math.min(options.timeout ?? DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT);

  const isRg = cli.backend === 'rg';
  const isWindows = process.platform === 'win32';

  let command: string;
  let cwd: string | undefined;

  if (isRg) {
    const args = buildRgArgs(options);
    const paths = options.paths?.length ? options.paths : ['.'];
    args.push(...paths);
    command = `${cli.path} ${args.join(' ')}`;
    cwd = undefined;
  } else if (isWindows) {
    const psArgs = buildPowerShellCommand(options);
    command = `${psArgs[0]} ${psArgs.slice(2).join(' ')}`;
    cwd = undefined;
  } else {
    const args = buildFindArgs(options);
    const paths = options.paths?.length ? options.paths : ['.'];
    cwd = paths[0] || '.';
    command = `${cli.path} ${args.join(' ')}`;
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer: DEFAULT_MAX_OUTPUT_BYTES,
      cwd,
    });

    const truncatedOutput = stdout.length >= DEFAULT_MAX_OUTPUT_BYTES;
    const outputToProcess = truncatedOutput ? stdout.substring(0, DEFAULT_MAX_OUTPUT_BYTES) : stdout;

    const lines = outputToProcess.trim().split('\n').filter(Boolean);

    const files: FileMatch[] = [];
    let truncated = false;

    for (const line of lines) {
      if (files.length >= limit) {
        truncated = true;
        break;
      }

      let filePath: string;
      if (isRg) {
        filePath = line;
      } else if (isWindows) {
        filePath = line.trim();
      } else {
        filePath = `${cwd}/${line}`;
      }

      const mtime = await getFileMtime(filePath);
      files.push({ path: filePath, mtime });
    }

    files.sort((a, b) => b.mtime - a.mtime);

    return {
      files,
      totalFiles: files.length,
      truncated: truncated || truncatedOutput,
    };
  } catch (e: any) {
    if (e.killed) {
      return {
        files: [],
        totalFiles: 0,
        truncated: false,
        error: `Glob search timeout after ${timeout}ms`,
      };
    }
    return {
      files: [],
      totalFiles: 0,
      truncated: false,
      error: e.message || String(e),
    };
  }
}
