/**
 * Session Viewer — Node.js TypeScript 后端
 *
 * 1:1 复刻 server.py + session_parser.py 的全部功能。
 * 零外部依赖，仅 Node.js 内置模块。
 *
 * 用法：
 *   npx tsx server.ts [--port 8765] [--host 127.0.0.1] [--log-dir ~/.openclaw/agents]
 * 或编译后：
 *   node server.mjs [--port 8765] ...
 */
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import * as os from 'node:os';
// ── 常量 ────────────────────────────────────────────────────
const INTERESTING_TYPES = new Set(['thinking', 'text', 'toolCall']);
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};
// ── 全局配置 ────────────────────────────────────────────────
const DEFAULT_LOG_DIR = path.join(os.homedir(), '.openclaw', 'agents');
let LOG_DIR = DEFAULT_LOG_DIR;
// ── 工具函数 ────────────────────────────────────────────────
function formatTimestamp(ts) {
    if (!ts)
        return '??:??:??';
    try {
        const d = new Date(ts.replace('Z', '+00:00'));
        return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    catch {
        return ts.length >= 19 ? ts.slice(0, 19) : ts;
    }
}
function parseJsonlLine(line) {
    try {
        return JSON.parse(line.trim());
    }
    catch {
        return null;
    }
}
function shouldDisplay(entry) {
    if (entry.type !== 'message')
        return false;
    const message = entry.message || entry;
    const contentList = message.content || [];
    if (contentList.length === 0)
        return false;
    return contentList.some((c) => INTERESTING_TYPES.has(c.type));
}
function isToolResult(entry) {
    if (entry.type !== 'message')
        return false;
    return (entry.message || entry).role === 'toolResult';
}
function extractToolResultText(entry) {
    const contentList = (entry.message || entry).content || [];
    for (const c of contentList) {
        if (c.text)
            return c.text;
    }
    return '';
}
function truncate(text, maxLen) {
    if (text.length <= maxLen)
        return text;
    return text.slice(0, maxLen) + '...';
}
function parseContentItem(item, short) {
    const ctype = item.type || '';
    if (ctype === 'thinking') {
        const text = item.thinking || '';
        return {
            type: 'thinking',
            text,
            is_long: text.length > 300,
            truncated_preview: short ? truncate(text, 300) : text,
        };
    }
    if (ctype === 'text') {
        const text = item.text || '';
        return {
            type: 'text',
            text,
            is_long: text.length > 500,
            truncated_preview: short ? truncate(text, 500) : text,
        };
    }
    if (ctype === 'toolCall') {
        const toolName = item.name || 'unknown';
        const rawArgs = item.arguments || {};
        const argsList = [];
        for (const [k, v] of Object.entries(rawArgs)) {
            const strV = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
            argsList.push({ key: k, value: strV, is_long: strV.length > 200 });
        }
        return {
            type: 'toolCall',
            name: toolName,
            args: argsList,
            raw_args: rawArgs,
            id: item.id || '',
            result: null,
        };
    }
    return { type: ctype };
}
// ── parse_session_messages（1:1 复刻 Python 版）────────────
function parseSessionMessages(filepath, short = false) {
    if (!fs.existsSync(filepath))
        return { sessionInfo: {}, messages: [] };
    const messages = [];
    const sessionInfo = {};
    let msgIndex = 0;
    let pendingToolResult = null;
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim());
    for (const line of lines) {
        const entry = parseJsonlLine(line);
        if (!entry)
            continue;
        // 首个 session 条目记录元信息
        if (entry.type === 'session' && Object.keys(sessionInfo).length === 0) {
            sessionInfo.sessionId = entry.id || '';
            sessionInfo.timestamp = entry.timestamp || '';
            sessionInfo.cwd = entry.cwd || '';
        }
        // 缓存 toolResult
        if (isToolResult(entry)) {
            pendingToolResult = extractToolResultText(entry);
            continue;
        }
        // 跳过不可显示的消息
        if (!shouldDisplay(entry)) {
            pendingToolResult = null;
            continue;
        }
        msgIndex++;
        const message = entry.message || entry;
        const role = message.role || 'unknown';
        let model = (message.model || entry.model) || 'openclaw';
        if (model === 'unknown')
            model = 'openclaw';
        const stopReason = message.stopReason || '';
        const contentList = [];
        const rawContent = message.content || [];
        for (const item of rawContent) {
            const parsed = parseContentItem(item, short);
            // toolCall + pending result
            if (parsed.type === 'toolCall' && pendingToolResult) {
                parsed.result = pendingToolResult;
                parsed.result_is_long = pendingToolResult.length > 500;
                parsed.result_truncated = short ? truncate(pendingToolResult, 500) : pendingToolResult;
                pendingToolResult = null;
            }
            if (INTERESTING_TYPES.has(parsed.type)) {
                contentList.push(parsed);
            }
        }
        pendingToolResult = null;
        if (contentList.length > 0) {
            messages.push({
                index: msgIndex,
                timestamp: formatTimestamp(entry.timestamp),
                role,
                model,
                stopReason,
                content: contentList,
            });
        }
    }
    return { sessionInfo, messages };
}
// ── get_agents（1:1 复刻 Python 版）────────────────────────
function getAgents() {
    const agents = [];
    if (!fs.existsSync(LOG_DIR) || !fs.statSync(LOG_DIR).isDirectory())
        return agents;
    for (const agentId of fs.readdirSync(LOG_DIR).sort()) {
        const agentDir = path.join(LOG_DIR, agentId);
        const sessionsJson = path.join(agentDir, 'sessions', 'sessions.json');
        if (!fs.statSync(agentDir).isDirectory() || !fs.existsSync(sessionsJson)) {
            agents.push({ id: agentId, session_count: 0, last_active: 0, last_active_iso: null });
            continue;
        }
        try {
            const raw = JSON.parse(fs.readFileSync(sessionsJson, 'utf-8'));
            const sessions = Object.values(raw);
            let lastActive = 0;
            for (const s of sessions) {
                if (s.updatedAt && s.updatedAt > lastActive)
                    lastActive = s.updatedAt;
            }
            agents.push({
                id: agentId,
                session_count: sessions.length,
                last_active: lastActive,
                last_active_iso: lastActive ? new Date(lastActive).toISOString() : null,
            });
        }
        catch {
            agents.push({ id: agentId, session_count: 0, last_active: 0, last_active_iso: null });
        }
    }
    agents.sort((a, b) => b.last_active - a.last_active);
    return agents;
}
// ── get_sessions（1:1 复刻 Python 版）───────────────────────
function getSessions(agentId) {
    const sessionsPath = path.join(LOG_DIR, agentId, 'sessions', 'sessions.json');
    if (!fs.existsSync(sessionsPath))
        return [];
    try {
        const raw = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
        const sessions = Object.values(raw);
        const result = [];
        for (const s of sessions) {
            const sessionId = s.sessionId || '';
            result.push({
                sessionId,
                sessionKey: s.sessionId || '',
                updatedAt: s.updatedAt || 0,
                startedAt: s.startedAt || 0,
                status: s.status || 'unknown',
                chatType: s.chatType || s.origin?.chatType || 'unknown',
                channel: s.lastChannel || s.origin?.provider || 'unknown',
                model: s.systemPromptReport?.model || 'unknown',
                compactionCount: s.compactionCount || 0,
            });
        }
        result.sort((a, b) => b.updatedAt - a.updatedAt);
        return result;
    }
    catch {
        return [];
    }
}
// ── SSE stream 端点（1:1 复刻 Python 版）───────────────────
function handleStream(req, res, filepath, short) {
    // 安全校验
    if (!fs.existsSync(filepath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'session file not found' }));
        return;
    }
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.write('event: connected\ndata: {}\n\n');
    // 统计已有消息数
    let msgIndex = 0;
    try {
        const content = fs.readFileSync(filepath, 'utf-8');
        for (const line of content.split('\n')) {
            const entry = parseJsonlLine(line.trim());
            if (entry && shouldDisplay(entry))
                msgIndex++;
        }
    }
    catch {
        // ignore
    }
    res.write(`event: init\ndata: ${JSON.stringify({ from_index: msgIndex })}\n\n`);
    // tail -f 模式
    let pendingToolResult = null;
    let fileSize = fs.statSync(filepath).size;
    let stopped = false;
    const poll = () => {
        if (stopped)
            return;
        try {
            const stats = fs.existsSync(filepath) ? fs.statSync(filepath) : null;
            if (!stats) {
                setTimeout(poll, 1000);
                return;
            }
            if (stats.size > fileSize) {
                // 有新增内容
                const buf = Buffer.alloc(stats.size - fileSize);
                const fd = fs.openSync(filepath, 'r');
                fs.readSync(fd, buf, 0, buf.length, fileSize);
                fs.closeSync(fd);
                const lines = buf.toString('utf-8').split('\n').filter((l) => l.trim());
                for (const line of lines) {
                    const entry = parseJsonlLine(line);
                    if (!entry)
                        continue;
                    // 缓存 toolResult
                    if (isToolResult(entry)) {
                        pendingToolResult = extractToolResultText(entry);
                        continue;
                    }
                    if (!shouldDisplay(entry)) {
                        pendingToolResult = null;
                        continue;
                    }
                    const message = entry.message || entry;
                    const role = message.role || 'unknown';
                    let model = (message.model || entry.model) || 'openclaw';
                    if (model === 'unknown')
                        model = 'openclaw';
                    const stopReason = message.stopReason || '';
                    const contentList = [];
                    const rawContent = message.content || [];
                    for (const item of rawContent) {
                        const parsed = parseContentItem(item, short);
                        if (parsed.type === 'toolCall' && pendingToolResult) {
                            parsed.result = pendingToolResult;
                            parsed.result_is_long = pendingToolResult.length > 500;
                            parsed.result_truncated = short ? truncate(pendingToolResult, 500) : pendingToolResult;
                            pendingToolResult = null;
                        }
                        if (INTERESTING_TYPES.has(parsed.type)) {
                            contentList.push(parsed);
                        }
                    }
                    pendingToolResult = null;
                    if (contentList.length > 0) {
                        msgIndex++;
                        const msg = {
                            index: msgIndex,
                            timestamp: formatTimestamp(entry.timestamp),
                            role,
                            model,
                            stopReason,
                            content: contentList,
                        };
                        res.write(`event: message\ndata: ${JSON.stringify(msg)}\n\n`);
                    }
                }
                fileSize = stats.size;
            }
            else if (stats.size < fileSize) {
                // 文件被截断
                res.write('event: truncated\ndata: {}\n\n');
                fileSize = 0;
                msgIndex = 0;
                pendingToolResult = null;
            }
            setTimeout(poll, 1000);
        }
        catch {
            setTimeout(poll, 1000);
        }
    };
    req.on('close', () => {
        stopped = true;
    });
    poll();
}
// ── 静态文件 ────────────────────────────────────────────────
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_DIR = path.join(__dirname, 'static');
function serveStatic(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const fullPath = path.join(STATIC_DIR, filePath);
    if (!fs.existsSync(fullPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }
    const content = fs.readFileSync(fullPath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
}
// ── 路由 ────────────────────────────────────────────────────
function parseUrl(req) {
    const rawUrl = req.url || '/';
    // 构造完整 URL 用于解析
    try {
        const u = new URL(rawUrl, 'http://localhost');
        return { pathname: u.pathname, searchParams: u.searchParams };
    }
    catch {
        return { pathname: rawUrl.split('?')[0], searchParams: new URLSearchParams(rawUrl.split('?')[1] || '') };
    }
}
function handleRequest(req, res) {
    // CORS + frame 头：允许跨域访问和 iframe 嵌入
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    const { pathname, searchParams } = parseUrl(req);
    // API: /api/agents
    if (pathname === '/api/agents' && req.method === 'GET') {
        const agents = getAgents();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(agents));
        return;
    }
    // API: /api/agents/<agent>/sessions
    const sessionsMatch = pathname.match(/^\/api\/agents\/([^/]+)\/sessions$/);
    if (sessionsMatch && req.method === 'GET') {
        const agentId = decodeURIComponent(sessionsMatch[1]);
        if (agentId.includes('..')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid agent_id' }));
            return;
        }
        const sessions = getSessions(agentId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(sessions));
        return;
    }
    // API: /api/agents/<agent>/sessions/<id>/stream
    const streamMatch = pathname.match(/^\/api\/agents\/([^/]+)\/sessions\/([^/]+)\/stream$/);
    if (streamMatch && req.method === 'GET') {
        const agentId = decodeURIComponent(streamMatch[1]);
        const sessionId = decodeURIComponent(streamMatch[2]);
        if (agentId.includes('..')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid agent_id' }));
            return;
        }
        if (sessionId.includes('..')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid session_id' }));
            return;
        }
        const short = searchParams.get('short') === 'true';
        const filepath = path.join(LOG_DIR, agentId, 'sessions', `${sessionId}.jsonl`);
        handleStream(req, res, filepath, short);
        return;
    }
    // API: /api/agents/<agent>/sessions/<id>
    const detailMatch = pathname.match(/^\/api\/agents\/([^/]+)\/sessions\/([^/]+)$/);
    if (detailMatch && req.method === 'GET') {
        const agentId = decodeURIComponent(detailMatch[1]);
        const sessionId = decodeURIComponent(detailMatch[2]);
        if (agentId.includes('..')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid agent_id' }));
            return;
        }
        if (sessionId.includes('..')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid session_id' }));
            return;
        }
        const short = searchParams.get('short') === 'true';
        const filepath = path.join(LOG_DIR, agentId, 'sessions', `${sessionId}.jsonl`);
        if (!fs.existsSync(filepath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'session file not found' }));
            return;
        }
        const result = parseSessionMessages(filepath, short);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
        return;
    }
    // 静态文件
    if (pathname === '/') {
        serveStatic(res, 'index.html');
        return;
    }
    if (pathname === '/style.css' || pathname === '/app.js') {
        serveStatic(res, pathname.slice(1));
        return;
    }
    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
}
// ── 入口 ────────────────────────────────────────────────────
function parseArgs() {
    const args = process.argv.slice(2);
    let port = 8765;
    let host = '127.0.0.1';
    for (let i = 0; i < args.length; i++) {
        if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
            port = parseInt(args[i + 1], 10);
            i++;
        }
        else if ((args[i] === '--host' || args[i] === '-h') && args[i + 1]) {
            host = args[i + 1];
            i++;
        }
        else if (args[i] === '--log-dir' && args[i + 1]) {
            LOG_DIR = args[i + 1].replace(/^~/, os.homedir());
            i++;
        }
    }
    return { port, host };
}
const { port, host } = parseArgs();
if (!fs.existsSync(LOG_DIR) || !fs.statSync(LOG_DIR).isDirectory()) {
    console.error(`⚠️  日志目录不存在: ${LOG_DIR}`);
    console.error('   请用 --log-dir 指定正确的路径');
    process.exit(1);
}
const server = http.createServer(handleRequest);
server.listen(port, host, () => {
    console.log('🚀 Session Viewer 启动');
    console.log(`   地址: http://${host}:${port}`);
    console.log(`   日志: ${LOG_DIR}`);
    console.log('   按 Ctrl+C 退出');
});
