/**
 * Session Log Viewer Manager
 *
 * 管理 session-viewer HTTP 服务的生命周期 (start/stop/restart)。
 * 通过 child_process.spawn 启动独立进程，PID 写入文件。
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as os from 'node:os';
import * as net from 'node:net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PID_FILE = resolve(__dirname, '.session-viewer.pid');
const DEFAULT_PORT = 8765;
const DEFAULT_HOST = '127.0.0.1';
const SERVER_SCRIPT = resolve(__dirname, 'server.mjs');
const DEFAULT_LOG_DIR = resolve(os.homedir(), '.openclaw', 'agents');

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export interface ViewerStatus {
  running: boolean;
  pid: number | null;
  port: number | null;
  url: string | null;
}

/** 检查端口是否被占用 */
async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

/** 找到可用端口 */
async function findFreePort(startPort: number): Promise<number> {
  let port = startPort;
  while (!(await isPortFree(port))) {
    port++;
    if (port > startPort + 100) {
      throw new Error(`No free port found in range ${startPort}-${startPort + 100}`);
    }
  }
  return port;
}

/** 读取保存的 PID */
function readPid(): number | null {
  try {
    if (!existsSync(PID_FILE)) return null;
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/** 检查进程是否存活 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0); // 发送信号 0 检查进程是否存在
    return true;
  } catch {
    return false;
  }
}

/** 启动服务 */
export async function startViewer(
  logger: Logger,
  port?: number,
): Promise<ViewerStatus> {
  const existingPid = readPid();
  if (existingPid && isProcessRunning(existingPid)) {
    const actualPort = port ?? DEFAULT_PORT;
    logger.info(`Session viewer is already running (pid=${existingPid})`);
    return {
      running: true,
      pid: existingPid,
      port: actualPort,
      url: `http://127.0.0.1:${actualPort}`,
    };
  }

  // 清理残留 PID 文件
  if (existsSync(PID_FILE)) {
    unlinkSync(PID_FILE);
  }

  const targetPort = await findFreePort(port ?? DEFAULT_PORT);

  if (!existsSync(SERVER_SCRIPT)) {
    throw new Error(`Server script not found: ${SERVER_SCRIPT}`);
  }
  if (!existsSync(DEFAULT_LOG_DIR)) {
    throw new Error(`Log directory not found: ${DEFAULT_LOG_DIR}`);
  }

  const child: ChildProcess = spawn('node', [
    SERVER_SCRIPT,
    '--port', String(targetPort),
    '--host', DEFAULT_HOST,
    '--log-dir', DEFAULT_LOG_DIR,
  ], {
    detached: true,
    stdio: 'ignore',
    cwd: __dirname,
  });

  const pid = child.pid;
  if (!pid) {
    throw new Error('Failed to start session viewer process');
  }

  writeFileSync(PID_FILE, String(pid), 'utf-8');

  // 等待端口就绪
  await new Promise<void>((resolve) => {
    const check = async () => {
      if (!(await isPortFree(targetPort))) {
        resolve();
      } else {
        setTimeout(check, 200);
      }
    };
    setTimeout(check, 500);
  });

  // detach 子进程，让它在后台运行
  child.unref();

  const url = `http://${DEFAULT_HOST}:${targetPort}`;

  logger.info(`Session viewer started`);
  logger.info(`  PID: ${pid}`);
  logger.info(`  URL: ${url}`);
  logger.info(`  Access via: ssh -L ${targetPort}:127.0.0.1:${targetPort} llli@192.168.200.53`);
  logger.info(`  Then open: ${url}`);

  return { running: true, pid, port: targetPort, url };
}

/** 停止服务 */
export function stopViewer(logger: Logger): boolean {
  const pid = readPid();

  if (!pid) {
    logger.warn('Session viewer is not running (no PID file)');
    return false;
  }

  if (!isProcessRunning(pid)) {
    logger.warn(`Session viewer process ${pid} is not running (stale PID file)`);
    unlinkSync(PID_FILE);
    return false;
  }

  try {
    process.kill(pid, 'SIGTERM');
    logger.info(`Session viewer stopped (pid=${pid})`);

    // 等待进程退出
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds
    while (isProcessRunning(pid) && attempts < maxAttempts) {
      attempts++;
    }

    if (isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL');
      logger.info(`Force killed session viewer (pid=${pid})`);
    }
  } catch (err) {
    logger.error(`Failed to stop session viewer: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (existsSync(PID_FILE)) {
    unlinkSync(PID_FILE);
  }

  return true;
}

/** 重启服务 */
export async function restartViewer(
  logger: Logger,
  port?: number,
): Promise<ViewerStatus> {
  logger.info('Restarting session viewer...');
  stopViewer(logger);
  // 等待端口释放
  await new Promise((r) => setTimeout(r, 500));
  return startViewer(logger, port);
}

/** 获取状态 */
export function getViewerStatus(): ViewerStatus {
  const pid = readPid();

  if (!pid || !isProcessRunning(pid)) {
    return { running: false, pid: null, port: null, url: null };
  }

  return {
    running: true,
    pid,
    port: DEFAULT_PORT,
    url: `http://${DEFAULT_HOST}:${DEFAULT_PORT}`,
  };
}
