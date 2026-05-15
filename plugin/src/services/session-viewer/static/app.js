/**
 * Session Log Viewer — 前端逻辑
 *
 * 职责：
 * - 加载 Agent 列表 + 会话列表（左侧栏）
 * - 加载并渲染会话消息（chat bubble 风格）
 * - 类型过滤（thinking / text / toolCall）
 * - Short 模式切换
 */

// ── 全局状态 ──────────────────────────────────────────────
const state = {
  agents: [],
  sessions: [],
  messages: [],
  activeAgent: null,
  activeSession: null,
  filters: { text: true, thinking: true, toolCall: true },
  shortMode: false,
  eventSource: null,  // SSE 连接
  liveMode: true,     // 默认开启 Live 模式
};

// ── DOM 引用 ──────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  agentList: $('#agentList'),
  sessionList: $('#sessionList'),
  emptyState: $('#emptyState'),
  chatHeader: $('#chatHeader'),
  filterBar: $('#filterBar'),
  messageList: $('#messageList'),
  headerAgent: $('#headerAgent'),
  headerChannel: $('#headerChannel'),
  headerSessionId: $('#headerSessionId'),
  headerMsgCount: $('#headerMsgCount'),
  headerTimeRange: $('#headerTimeRange'),
  shortMode: $('#shortMode'),
  liveMode: $('#liveMode'),
  liveIndicator: $('#liveIndicator'),
};

// ── API 调用 ───────────────────────────────────────────────

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── 初始化 ────────────────────────────────────────────────

async function init() {
  // 设置滚动追踪
  setupScrollTracking();

  try {
    state.agents = await api('/api/agents');
    renderAgentList();
  } catch (err) {
    dom.agentList.innerHTML = `<div class="empty-text">加载失败: ${err.message}</div>`;
  }

  // 过滤 toggle 事件
  $$('.filter-toggle').forEach((el) => {
    el.addEventListener('click', () => {
      const type = el.dataset.type;
      state.filters[type] = !state.filters[type];
      el.classList.toggle('active', state.filters[type]);
      renderMessages();
    });
  });

  // Short 模式 toggle
  dom.shortMode.addEventListener('change', () => {
    state.shortMode = dom.shortMode.checked;
    if (state.activeSession && state.activeAgent) {
      loadSession(state.activeAgent, state.activeSession, true);
    }
  });

  // Live 模式 toggle
  dom.liveMode.addEventListener('change', () => {
    state.liveMode = dom.liveMode.checked;
    if (state.liveMode && state.activeSession && state.activeAgent) {
      startLiveMode();
    } else {
      stopLiveMode();
    }
  });
}

// ── 左侧栏：Agent 列表 ─────────────────────────────────────

function renderAgentList() {
  if (!state.agents.length) {
    dom.agentList.innerHTML = '<div class="empty-text">无 Agent</div>';
    return;
  }

  const hasSessions = state.agents.filter((a) => a.session_count > 0);

  dom.agentList.innerHTML = hasSessions
    .map(
      (a) => `
    <div class="agent-item ${a.id === state.activeAgent ? 'selected' : ''}"
         data-agent="${a.id}">
      <span class="agent-name">${a.id}</span>
      <span class="agent-count">${a.session_count}</span>
    </div>`
    )
    .join('');

  // 绑定事件
  dom.agentList.querySelectorAll('.agent-item').forEach((el) => {
    el.addEventListener('click', () => {
      const agentId = el.dataset.agent;
      selectAgent(agentId);
    });
  });

  // 默认选中第一个有会话的 agent
  if (!state.activeAgent && hasSessions.length) {
    selectAgent(hasSessions[0].id);
  }
}

// ── 左侧栏：Agent 选中 ────────────────────────────────────

async function selectAgent(agentId) {
  stopLiveMode();  // 停止旧 live
  state.activeAgent = agentId;
  state.activeSession = null;
  state.messages = [];

  // 更新 UI
  dom.agentList.querySelectorAll('.agent-item').forEach((el) => {
    el.classList.toggle('selected', el.dataset.agent === agentId);
  });

  // 加载会话列表
  dom.sessionList.innerHTML = '<div class="loading-text">加载中...</div>';
  try {
    state.sessions = await api(`/api/agents/${agentId}/sessions`);
    renderSessionList();
  } catch (err) {
    dom.sessionList.innerHTML = `<div class="empty-text">加载失败: ${err.message}</div>`;
  }

  // 自动选中第一个会话
  if (state.sessions.length > 0) {
    selectSession(state.sessions[0].sessionId);
  } else {
    showEmptyState();
  }
}

// ── 左侧栏：会话列表 ───────────────────────────────────────

function renderSessionList() {
  if (!state.sessions.length) {
    dom.sessionList.innerHTML = '<div class="empty-text">无会话</div>';
    return;
  }

  // 默认只显示最近 7 天的会话
  const now = Date.now();
  const weekMs = 7 * 24 * 3600 * 1000;
  const recent = state.sessions.filter((s) => (now - (s.updatedAt || s.startedAt)) < weekMs);
  const older = state.sessions.filter((s) => (now - (s.updatedAt || s.startedAt)) >= weekMs);
  const showOlder = state._showAllSessions || false;
  const display = showOlder ? state.sessions : recent;

  let html = '';
  if (!showOlder && older.length > 0) {
    html += `<div class="section-hint">最近 7 天 · ${recent.length} 个会话</div>`;
  }

  html += display
    .map((s) => {
      const when = formatUnixMs(s.updatedAt || s.startedAt);
      return `
    <div class="session-item ${s.sessionId === state.activeSession ? 'selected' : ''}"
         data-sid="${s.sessionId}">
      <div class="session-item-top">
        <span class="session-item-time">${when}</span>
        <span class="session-status ${s.status || 'unknown'}">${s.status || '?'}</span>
      </div>
      <div class="session-item-channel">${s.channel || 'unknown'}</div>
    </div>`;
    })
    .join('');

  // 显示全部 / 收起按钮
  if (older.length > 0) {
    html += `
    <div class="show-more-item" id="showMoreSessions">
      ${showOlder
        ? `收起旧会话 · ${older.length} 个`
        : `显示全部 · 还有 ${older.length} 个旧会话`}
    </div>`;
  }

  dom.sessionList.innerHTML = html;

  // 显示全部按钮
  const showMore = dom.sessionList.querySelector('#showMoreSessions');
  if (showMore) {
    showMore.addEventListener('click', () => {
      state._showAllSessions = !state._showAllSessions;
      renderSessionList();
    });
  }

  // 绑定事件
  dom.sessionList.querySelectorAll('.session-item').forEach((el) => {
    el.addEventListener('click', () => {
      const sid = el.dataset.sid;
      selectSession(sid);
    });
  });
}

// ── 会话选中 & 加载消息 ────────────────────────────────────

async function selectSession(sessionId) {
  state.activeSession = sessionId;
  dom.sessionList.querySelectorAll('.session-item').forEach((el) => {
    el.classList.toggle('selected', el.dataset.sid === sessionId);
  });

  // 先停止旧 Live 连接
  stopLiveMode();
  await loadSession(state.activeAgent, sessionId);

  // 如果 Live 开关开着，重新连接
  if (state.liveMode) {
    startLiveMode();
  }
}

async function loadSession(agentId, sessionId, forceReload = false) {
  if (!agentId || !sessionId) return;

  const shortParam = state.shortMode ? '?short=true' : '';
  const url = `/api/agents/${agentId}/sessions/${sessionId}${shortParam}`;

  try {
    const data = await api(url);
    state.messages = data.messages || [];

    // 更新头部
    showChatView();
    const session = state.sessions.find((s) => s.sessionId === sessionId);
    dom.headerAgent.textContent = agentId;
    dom.headerChannel.textContent = session?.channel || '?';
    dom.headerSessionId.textContent = sessionId.substring(0, 16) + '...';
    dom.headerMsgCount.textContent = `${state.messages.length} 条消息`;

    if (state.messages.length > 1) {
      const first = state.messages[0]?.timestamp;
      const last = state.messages[state.messages.length - 1]?.timestamp;
      dom.headerTimeRange.textContent = `${first} — ${last}`;
    } else {
      dom.headerTimeRange.textContent = '';
    }

    renderMessages();
  } catch (err) {
    state.messages = [];
    dom.messageList.innerHTML = `<div class="empty-text">加载失败: ${err.message}</div>`;
  }
}

// ── UI 状态切换 ────────────────────────────────────────────

function showEmptyState() {
  dom.emptyState.classList.remove('hidden');
  dom.chatHeader.classList.add('hidden');
  dom.filterBar.classList.add('hidden');
  dom.messageList.innerHTML = '';
}

function showChatView() {
  dom.emptyState.classList.add('hidden');
  dom.chatHeader.classList.remove('hidden');
  dom.filterBar.classList.remove('hidden');
}

// ── 滚动管理 ──────────────────────────────────────────────

// 用户是否手动滚离底部
let _userScrolledUp = false;

function setupScrollTracking() {
  const ml = dom.messageList;
  ml.addEventListener('scroll', () => {
    const distFromBottom = ml.scrollHeight - ml.scrollTop - ml.clientHeight;
    if (distFromBottom > 60) {
      _userScrolledUp = true;
    } else {
      _userScrolledUp = false;
    }
  }, { passive: true });
}

function autoScrollToBottom() {
  // 用户主动上滚时不自动滚
  if (_userScrolledUp) return;
  requestAnimationFrame(() => {
    if (!_userScrolledUp) {
      dom.messageList.scrollTop = dom.messageList.scrollHeight;
    }
  });
}

// ── SSE Live 模式 ──────────────────────────────────────────

function startLiveMode() {
  stopLiveMode();  // 断开旧连接

  const url = `/api/agents/${state.activeAgent}/sessions/${state.activeSession}/stream`;
  const es = new EventSource(url);
  state.eventSource = es;

  es.addEventListener('connected', () => {
    dom.liveIndicator.classList.remove('hidden');
  });

  es.addEventListener('init', (e) => {
    try {
      const data = JSON.parse(e.data);
      console.log(`Live 模式：当前已有 ${data.from_index} 条消息，等待新消息...`);
    } catch (_) {}
  });

  es.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data);

      // 检查消息是否过滤
      const hasMatchingContent = msg.content.some((c) => state.filters[c.type]);
      if (!hasMatchingContent) return;

      state.messages.push(msg);
      appendMessage(msg);
      updateHeaderCount();
    } catch (_) {}
  });

  es.addEventListener('truncated', () => {
    console.log('文件被截断，重新加载...');
    state.messages = [];
    if (state.activeSession) {
      loadSession(state.activeAgent, state.activeSession, true);
    }
  });

  es.onerror = () => {
    // SSE 断连，自动重连
    dom.liveIndicator.classList.add('hidden');
    if (state.liveMode) {
      console.log('Live 断连，3 秒后重试...');
      setTimeout(() => {
        if (state.liveMode && state.activeSession) {
          startLiveMode();
        }
      }, 3000);
    }
  };

  dom.liveIndicator.classList.remove('hidden');
}

function stopLiveMode() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  dom.liveIndicator.classList.add('hidden');
}

function appendMessage(msg) {
  let html = '';

  // 插入系统分割线（如果 stopReason 变了）
  const prev = state.messages[state.messages.length - 2];
  if (!prev || msg.stopReason !== prev.stopReason) {
    if (msg.stopReason) {
      html += renderSystemMessage(msg);
    }
  }

  for (const item of msg.content) {
    if (!state.filters[item.type]) continue;
    switch (item.type) {
      case 'text': html += renderTextBubble(msg, item); break;
      case 'thinking': html += renderThinkingBubble(msg, item); break;
      case 'toolCall': html += renderToolCallBubble(msg, item); break;
    }
  }

  if (html) {
    dom.messageList.insertAdjacentHTML('beforeend', html);
    bindToggleEventsIn(dom.messageList.lastElementChild?.parentElement);
    autoScrollToBottom();
  }
}

function bindToggleEventsIn(parent) {
  if (!parent) return;
  parent.querySelectorAll('[data-action="expand-thinking"]').forEach((el) => {
    el.addEventListener('click', function () {
      const bubble = this.closest('.bubble-thinking');
      const preview = bubble.querySelector('.thinking-preview');
      const full = bubble.querySelector('.thinking-full');
      if (full.classList.contains('hidden')) {
        full.classList.remove('hidden');
        preview.classList.add('hidden');
        this.textContent = '收起';
      } else {
        full.classList.add('hidden');
        preview.classList.remove('hidden');
        const text = full.textContent;
        this.textContent = `展开全部 (${text.length} 字)`;
      }
    });
  });

  parent.querySelectorAll('[data-action="expand-text"]').forEach((el) => {
    el.addEventListener('click', function () {
      const content = this.previousElementSibling;
      const full = content.dataset.full;
      content.textContent = full;
      this.remove();
    });
  });

  parent.querySelectorAll('[data-action="expand-result"]').forEach((el) => {
    el.addEventListener('click', function () {
      const resultEl = this.previousElementSibling;
      const full = resultEl.dataset.full;
      resultEl.textContent = full;
      this.remove();
    });
  });
}

function updateHeaderCount() {
  dom.headerMsgCount.textContent = `${state.messages.length} 条消息`;
  if (state.messages.length > 1) {
    const first = state.messages[0]?.timestamp;
    const last = state.messages[state.messages.length - 1]?.timestamp;
    dom.headerTimeRange.textContent = `${first} — ${last}`;
  }
}

// ── 消息渲染 ───────────────────────────────────────────────

function renderMessages() {
  if (!state.messages.length) {
    dom.messageList.innerHTML = '<div class="empty-text">无消息</div>';
    return;
  }

  // 先渲染系统消息 + 分组
  let html = '';
  for (let i = 0; i < state.messages.length; i++) {
    const msg = state.messages[i];

    // 系统行：如果 stopReason 变化或跨轮，插入分割
    if (i === 0 || msg.stopReason !== state.messages[i - 1]?.stopReason) {
      if (msg.stopReason) {
        html += renderSystemMessage(msg);
      }
    }

    // 渲染 content
    for (const item of msg.content) {
      if (!state.filters[item.type]) continue;

      switch (item.type) {
        case 'text':
          html += renderTextBubble(msg, item);
          break;
        case 'thinking':
          html += renderThinkingBubble(msg, item);
          break;
        case 'toolCall':
          html += renderToolCallBubble(msg, item);
          break;
      }
    }
  }

  dom.messageList.innerHTML = html;

  // 绑定折叠/展开事件
  bindToggleEvents();

  // 自动滚动到底部（用 rAF 等 DOM 布局完成）
  _userScrolledUp = false;  // 新会话重置
  requestAnimationFrame(() => {
    dom.messageList.scrollTop = dom.messageList.scrollHeight;
  });
}

function renderSystemMessage(msg) {
  const label = {
    stop: '完成',
    toolUse: '工具调用',
    length: '超长截断',
    aborted: '中止',
    error: '错误',
  };
  return `
    <div class="system-message">
      <span>#${msg.index} · ${msg.timestamp} · ${msg.model || ''}</span>
      <span class="stop-badge ${msg.stopReason || ''}">${label[msg.stopReason] || msg.stopReason}</span>
    </div>`;
}

function renderTextBubble(msg, item) {
  const text = escapeHtml(item.text);
  const isLong = item.is_long || item.text.length > 500;
  const displayText = state.shortMode ? escapeHtml(item.truncated_preview || item.text) : text;

  return `
    <div class="bubble bubble-text">
      <div class="bubble-header">
        <span class="bubble-type-label">💬 回复</span>
        <span class="bubble-meta">#${msg.index} · ${msg.timestamp}</span>
      </div>
      <div class="bubble-text-content" data-full="${isLong ? text : ''}">${displayText}</div>
      ${isLong && state.shortMode ? '<span class="thinking-toggle" data-action="expand-text">展开全文</span>' : ''}
    </div>`;
}

function renderThinkingBubble(msg, item) {
  const text = item.text || '';
  const lines = text.split('\n');
  const preview = lines.slice(0, 3).join('\n');
  const isCollapsible = lines.length > 3 || text.length > 200;

  return `
    <div class="bubble bubble-thinking">
      <div class="bubble-header">
        <span class="bubble-type-label">🤔 思考</span>
        <span class="bubble-meta">#${msg.index} · ${msg.timestamp}</span>
      </div>
      <div class="thinking-content">
        <span class="thinking-preview">${escapeHtml(preview)}</span>
        ${isCollapsible ? `<span class="thinking-full hidden">${escapeHtml(text)}</span>` : ''}
      </div>
      ${isCollapsible ? '<span class="thinking-toggle" data-action="expand-thinking">展开全部 (' + text.length + ' 字)</span>' : ''}
    </div>`;
}

function renderToolCallBubble(msg, item) {
  const args = item.args || [];
  const hasResult = item.result && item.result.length > 0;

  // 参数行
  const argsHtml = args
    .map(
      (a) => `
    <div class="tool-arg">
      <span class="tool-arg-key">${escapeHtml(a.key)}:</span>
      <span class="tool-arg-value">
        ${state.shortMode && a.is_long
          ? escapeHtml(a.value.substring(0, 200)) + '...'
          : escapeHtml(a.value)}
      </span>
    </div>`
    )
    .join('');

  // 结果
  let resultHtml = '';
  if (hasResult) {
    const isLong = item.result_is_long || item.result.length > 500;
    const displayResult = state.shortMode && isLong
      ? escapeHtml((item.result_truncated || item.result).substring(0, 500))
      : escapeHtml(item.result);
    resultHtml = `
    <div class="bubble bubble-toolResult">
      <div class="bubble-header">
        <span class="bubble-type-label">✅ 结果</span>
        <span class="bubble-meta">${item.result.length} 字节</span>
      </div>
      <div class="tool-result" data-full="${isLong && state.shortMode ? escapeHtml(item.result) : ''}">${displayResult}</div>
      ${isLong && state.shortMode ? '<span class="result-more" data-action="expand-result">展开全部</span>' : ''}
    </div>`;
  }

  return `
    <div class="bubble bubble-toolCall">
      <div class="bubble-header">
        <span class="bubble-type-label">🛠️ 工具调用</span>
        <span class="bubble-meta">#${msg.index} · ${msg.timestamp}</span>
      </div>
      <div class="tool-name">${escapeHtml(item.name)}</div>
      <div class="tool-args">${argsHtml}</div>
      ${resultHtml}
    </div>`;
}

// ── 折叠/展开事件 ─────────────────────────────────────────

function bindToggleEvents() {
  dom.messageList.querySelectorAll('[data-action="expand-thinking"]').forEach((el) => {
    el.addEventListener('click', function () {
      const bubble = this.closest('.bubble-thinking');
      const preview = bubble.querySelector('.thinking-preview');
      const full = bubble.querySelector('.thinking-full');
      if (full.classList.contains('hidden')) {
        full.classList.remove('hidden');
        preview.classList.add('hidden');
        this.textContent = '收起';
      } else {
        full.classList.add('hidden');
        preview.classList.remove('hidden');
        const text = full.textContent;
        this.textContent = `展开全部 (${text.length} 字)`;
      }
    });
  });

  dom.messageList.querySelectorAll('[data-action="expand-text"]').forEach((el) => {
    el.addEventListener('click', function () {
      const content = this.previousElementSibling;
      const full = content.dataset.full;
      content.textContent = full;
      this.remove();
    });
  });

  dom.messageList.querySelectorAll('[data-action="expand-result"]').forEach((el) => {
    el.addEventListener('click', function () {
      const resultEl = this.previousElementSibling;
      const full = resultEl.dataset.full;
      resultEl.textContent = full;
      this.remove();
    });
  });
}

// ── 辅助 ───────────────────────────────────────────────────

function formatUnixMs(ms) {
  if (!ms) return '--';
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── 入口 ───────────────────────────────────────────────────
init();
