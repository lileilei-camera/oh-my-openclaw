# Oh-My-OpenClaw Plugin 测试计划

**版本**: 0.21.3  
**日期**: 2026-04-03  
**状态**: 待执行

---

## 📋 测试目标

验证 OMO 插件的核心功能是否正常工作，包括：
1. omoc_delegate 工具调用
2. sessions_spawn 子代理创建
3. persona 状态管理
4. workspace 隔离
5. spawn guard 保护机制

---

## 🔧 前置条件

### 环境检查
```bash
# 1. 确认 OpenClaw 版本
openclaw --version  # 应输出：OpenClaw 2026.4.2 (d74a122)

# 2. 确认 Gateway 运行中
openclaw gateway status

# 3. 确认 OMO 插件已加载
grep "oh-my-openclaw" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep "loaded"

# 4. 确认插件版本
cat ~/.openclaw/workspace/oh-my-openclaw/plugin/package.json | grep version
```

### Persona 状态检查
```bash
# 检查当前激活的 persona
cat ~/.openclaw/workspace/.omoc-state/active-persona

# 如果 persona 已激活，先关闭以避免干扰测试
# 在 Main Agent 中发送：/omoc off
```

---

## 📝 测试用例

### 测试 1: omoc_delegate 工具调用 (基础功能)

**目标**: 验证 omoc_delegate 工具能正确返回指令

**步骤**:
1. 在 Main Agent 中调用 omoc_delegate
2. 检查返回的指令格式
3. 验证是否包含所有必需参数

**测试指令**:
```
使用 omoc_delegate 委托一个简单任务给 Sisyphus：
"请报告你的工作空间路径"
```

**预期结果**:
- ✅ omoc_delegate 工具被调用
- ✅ 返回指令包含：category, agentId, model, task
- ✅ 指令格式清晰，包含 `agentId: "omoc_sisyphus"`
- ✅ 指令明确说明需要调用 sessions_spawn

**验证命令**:
```bash
# 查看 Main Agent transcript
tail -100 ~/.openclaw/agents/main/sessions/*.jsonl | grep -A 20 "omoc_delegate"
```

---

### 测试 2: sessions_spawn 子代理创建

**目标**: 验证 LLM 能正确调用 sessions_spawn 并创建子代理

**步骤**:
1. 在 Main Agent 中调用 omoc_delegate
2. 观察 LLM 是否调用 sessions_spawn
3. 检查 sessions_spawn 参数是否完整

**测试指令**:
```
使用 omoc_delegate 委托一个简单任务给 Sisyphus：
"请报告你的工作空间路径"
```

**预期结果**:
- ✅ LLM 调用 sessions_spawn
- ✅ sessions_spawn 参数包含：task, mode, runtime, **agentId**
- ✅ 子代理成功创建并执行任务
- ✅ 子代理返回结果

**验证命令**:
```bash
# 检查子代理是否创建
openclaw sessions list --active

# 查看 Gateway 日志
grep "sessions_spawn" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | tail -5

# 检查是否有 spawn guard 拒绝记录
grep "Spawn guard" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | tail -5
```

---

### 测试 3: Spawn Guard 保护机制

**目标**: 验证 spawn guard 在 OmOC persona 激活时正确检查 agentId

**步骤**:
1. 激活 OmOC persona (`/omoc atlas`)
2. 尝试调用 sessions_spawn 但不提供 agentId
3. 验证 spawn guard 是否拒绝

**测试指令**:
```
/omoc atlas
```

然后手动调用 sessions_spawn（不带 agentId）：
```
调用 sessions_spawn 执行任务："测试"，mode="run"，runtime="subagent"
```

**预期结果**:
- ✅ spawn guard 拒绝 sessions_spawn 调用
- ✅ 错误消息明确指出需要 agentId
- ✅ 错误消息列出可用的 agent 列表

**验证命令**:
```bash
# 查看 spawn guard 日志
grep "Spawn guard" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | tail -10
```

---

### 测试 4: Persona 切换功能

**目标**: 验证 /omoc 命令能正确切换 persona

**步骤**:
1. 列出所有可用 persona
2. 切换到不同 persona
3. 验证 AGENTS.md 内容是否更新

**测试指令**:
```
/omoc list
/omoc prometheus
/omoc off
```

**预期结果**:
- ✅ /omoc list 显示所有 11 个 persona
- ✅ /omoc prometheus 切换成功，AGENTS.md 更新为 Prometheus 内容
- ✅ /omoc off 恢复默认 AGENTS.md

**验证命令**:
```bash
# 检查 persona 状态
cat ~/.openclaw/workspace/.omoc-state/active-persona

# 检查 AGENTS.md 内容
head -20 ~/.openclaw/workspace/AGENTS.md
```

---

### 测试 5: Workspace 隔离 (如果启用)

**目标**: 验证子代理 workspace 是否正确创建

**步骤**:
1. 调用 omoc_delegate 创建子代理
2. 检查子代理 workspace 是否创建
3. 验证 AGENTS.md 内容

**测试指令**:
```
使用 omoc_delegate 委托一个简单任务给 Sisyphus：
"请报告你的工作空间路径和 AGENTS.md 前 10 行"
```

**预期结果**:
- ✅ 子代理 workspace 创建在 `~/.openclaw/workspace/omoc-sisyphus/`
- ✅ AGENTS.md 包含默认内容 + Sisyphus persona
- ✅ 子代理能正确访问自己的 workspace

**验证命令**:
```bash
# 检查 workspace 目录
ls -la ~/.openclaw/workspace/omoc-*/

# 检查 AGENTS.md 内容
head -50 ~/.openclaw/workspace/omoc-sisyphus/AGENTS.md
```

---

### 测试 6: Category → Agent → Model 映射

**目标**: 验证不同 category 正确映射到对应的 agent 和 model

**步骤**:
1. 使用不同 category 调用 omoc_delegate
2. 验证返回的 agent 和 model 是否正确

**测试指令**:
```
# quick category
使用 omoc_delegate (category="quick") 委托任务："测试"

# deep category
使用 omoc_delegate (category="deep") 委托任务："测试"

# ultrabrain category
使用 omoc_delegate (category="ultrabrain") 委托任务："测试"
```

**预期结果**:
| Category | Expected Agent | Expected Model |
|----------|---------------|----------------|
| quick | omoc_sisyphus | claude-sonnet-4-6 |
| deep | omoc_hephaestus | claude-opus-4-6-thinking |
| ultrabrain | omoc_oracle | gpt-5.3-codex |
| visual-engineering | omoc_frontend | gemini-3.1-pro |
| multimodal | omoc_looker | gemini-3-flash |

**验证命令**:
```bash
# 查看 Gateway 日志中的映射记录
grep "Delegating task" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | tail -10
```

---

### 测试 7: Todo 命令集成

**目标**: 验证 todo 命令是否正常工作

**步骤**:
1. 创建 todo
2. 列出 todo
3. 更新 todo 状态

**测试指令**:
```
/omoc todo create "测试任务 1"
/omoc todo list
/omoc todo update 1 --status completed
```

**预期结果**:
- ✅ todo 创建成功
- ✅ todo 列表显示正确
- ✅ todo 状态更新成功

**验证命令**:
```bash
# 检查 todo 状态文件
cat ~/.openclaw/workspace/.omoc-state/todos.jsonl 2>/dev/null || echo "No todos file"
```

---

### 测试 8: Ralph 命令集成

**目标**: 验证 ralph 命令是否正常工作

**测试指令**:
```
/omoc ralph status
/omoc ralph iterations 5
```

**预期结果**:
- ✅ ralph status 显示当前状态
- ✅ ralph iterations 设置成功

---

## 📊 测试结果记录

### 执行记录

| 测试用例 | 日期 | 执行者 | 结果 | 备注 |
|---------|------|--------|------|------|
| 测试 1: omoc_delegate 基础 | | | ⬜ 待执行 | |
| 测试 2: sessions_spawn | | | ⬜ 待执行 | |
| 测试 3: Spawn Guard | | | ⬜ 待执行 | |
| 测试 4: Persona 切换 | | | ⬜ 待执行 | |
| 测试 5: Workspace 隔离 | | | ⬜ 待执行 | |
| 测试 6: Category 映射 | | | ⬜ 待执行 | |
| 测试 7: Todo 命令 | | | ⬜ 待执行 | |
| 测试 8: Ralph 命令 | | | ⬜ 待执行 | |

### 问题记录

| 问题 ID | 测试用例 | 描述 | 严重程度 | 状态 |
|--------|---------|------|---------|------|
| | | | 🔴 高 / 🟡 中 / 🟢 低 | ⬜ 待解决 |

---

## 🔍 调试工具

### 日志查看
```bash
# 实时查看 Gateway 日志
tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep -E "omoc|persona|spawn"

# 查看 OMO 插件日志
grep "oh-my-openclaw" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | tail -50
```

### 会话检查
```bash
# 列出所有活动会话
openclaw sessions list --active

# 查看 Main Agent 会话状态
openclaw sessions status agent:main:feishu:direct:ou_8e408d15a585f2a33abcee02f911fdf5
```

### 插件状态
```bash
# 查看插件加载状态
openclaw doctor | grep -A 5 "plugins"
```

---

## ✅ 测试完成标准

所有测试用例通过，且：
- [ ] omoc_delegate 工具正常工作
- [ ] sessions_spawn 能正确创建子代理
- [ ] spawn guard 保护机制正常
- [ ] persona 切换功能正常
- [ ] workspace 隔离正常（如果启用）
- [ ] category 映射正确
- [ ] todo/ralph 命令正常

---

## 📝 备注

1. **测试顺序**: 建议按顺序执行测试用例，因为后续测试可能依赖前置测试的状态
2. **状态清理**: 每个测试用例执行后，建议清理状态（如关闭 persona、删除测试 workspace）
3. **日志保留**: 测试过程中保留所有日志，便于问题排查
4. **Gateway 重启**: 如果修改了插件代码，需要重启 Gateway 才能生效

```bash
# 重启 Gateway
openclaw gateway restart

# 等待 Gateway 启动
sleep 5
openclaw gateway status
```
