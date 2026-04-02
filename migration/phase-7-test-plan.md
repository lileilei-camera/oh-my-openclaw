# Phase 7: 实际加载测试验证计划

**目标**: 将 Oh-My-OpenClaw v0.21.3 插件实际加载到 OpenClaw 环境中，验证所有功能正常工作

**测试环境**:
- OpenClaw 版本：2026.4.1
- 插件版本：@lileilei-camera/oh-my-openclaw@0.21.3
- Node.js: v22.22.1
- 工作空间：`/home/lileilei/.openclaw/workspace/agents/coder/`

---

## 📋 测试验证计划

### 阶段 7A: 插件打包和安装

#### 步骤 1: 构建插件
```bash
cd ~/wind/ai_code/oh-my-openclaw/plugin
npm run build
```

**验证点**:
- ✅ `dist/` 目录生成成功
- ✅ `dist/index.js` 存在且可执行
- ✅ `dist/index.d.ts` 存在
- ✅ `openclaw.plugin.json` 在 `files` 列表中

#### 步骤 2: 安装到 OpenClaw

**方案 A: 本地路径安装（推荐用于开发测试）**

修改 `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/home/lileilei/.openclaw/workspace/lossless-claw-enhanced",
        "/home/lileilei/wind/ai_code/oh-my-openclaw/plugin"  // 新增
      ]
    },
    "entries": {
      "@lileilei-camera/oh-my-openclaw": {  // 新增
        "enabled": true,
        "config": {
          "max_ralph_iterations": 10,
          "todo_enforcer_enabled": false,
          "todo_enforcer_cooldown_ms": 2000,
          "todo_enforcer_max_failures": 5,
          "comment_checker_enabled": true,
          "checkpoint_dir": "./checkpoints",
          "webhook_bridge_enabled": false,
          "gateway_url": "http://127.0.0.1:18789",
          "hooks_token": "",
          "webhook_reminder_interval_ms": 300000,
          "webhook_subagent_stale_threshold_ms": 600000
        }
      }
    }
  }
}
```

**方案 B: npm link（用于测试 npm 包）**

```bash
cd ~/wind/ai_code/oh-my-openclaw/plugin
npm link

# 然后在 OpenClaw 全局安装目录
cd ~/.npm-global/lib/node_modules/openclaw/
npm link @lileilei-camera/oh-my-openclaw
```

#### 步骤 3: 重启 OpenClaw Gateway

```bash
openclaw gateway restart
```

**验证点**:
- ✅ Gateway 重启成功
- ✅ 无启动错误日志
- ✅ 插件成功加载

---

### 阶段 7B: 基础功能测试

#### 测试 1: 插件加载验证

**命令**:
```bash
# 查看 Gateway 日志
tail -f /tmp/openclaw/openclaw-*.log | grep -i "oh-my-openclaw\|@happycastle"
```

**预期日志**:
```
[@lileilei-camera/oh-my-openclaw] Initializing plugin v0.21.3
[@lileilei-camera/oh-my-openclaw] Configuration: max_ralph_iterations=10, todo_enforcer=false
[@lileilei-camera/oh-my-openclaw] Plugin initialized with X tools, Y commands, Z hooks
```

**验证点**:
- ✅ 插件初始化日志出现
- ✅ 版本号正确 (0.21.3)
- ✅ 配置加载正确
- ✅ 注册统计正确（11 hooks, 11 commands, 8+ tools）

#### 测试 2: Commands 测试

**测试命令列表**:

| 命令 | 测试内容 | 预期结果 |
|------|---------|---------|
| `/omoc` | 激活 OmOC 模式 | 成功切换模式，无错误 |
| `/omoc list` | 列出所有 personas | 显示 11 个 agent personas |
| `/omoc_status` | 查看插件状态 | 显示 Ralph Loop、Todo Enforcer、Comment Checker 状态 |
| `/omoc_health` | 查看健康状态 | 显示配置和运行状态 |
| `/omoc_config` | 查看配置 | 显示当前配置值 |
| `/ralph_loop` | 启动 Ralph Loop | 成功启动（或提示需要任务文件） |
| `/ralph_stop` | 停止 Ralph Loop | 成功停止（或提示未运行） |
| `/ultrawork` | 启动完整工作流 | 触发 planning → execution → verification |
| `/plan` | 仅规划 | 触发 planning 阶段 |
| `/start_work` | 执行现有计划 | 执行已有的计划 |
| `/todos` | Todo 管理 | 显示 todo 列表或帮助 |

**执行方式**:
在 Feishu 对话中发送命令，观察响应。

#### 测试 3: Tools 测试

**测试场景**:

1. **委托工具测试**
   ```
   使用 omoc_delegate 工具，委托一个简单任务：
   "写一个 Python 函数，计算斐波那契数列"
   类别：quick
   ```
   
   **验证点**:
   - ✅ 工具成功调用
   - ✅ 子代理成功启动
   - ✅ 任务完成并返回结果

2. **Look-at 工具测试**
   ```
   发送一张图片或 PDF，使用 omoc_look_at 工具分析
   ```
   
   **验证点**:
   - ✅ 工具识别文件
   - ✅ 调用多模态模型分析
   - ✅ 返回分析结果

3. **Checkpoint 工具测试**
   ```
   在长任务中，手动触发 checkpoint 保存
   ```
   
   **验证点**:
   - ✅ Checkpoint 文件创建
   - ✅ 文件包含完整上下文
   - ✅ 可以从 checkpoint 恢复

4. **Todo 工具测试**
   ```
   使用 omoc_todo_create 创建 todo
   使用 omoc_todo_list 查看 todo
   使用 omoc_todo_update 更新 todo
   ```
   
   **验证点**:
   - ✅ Todo 创建成功
   - ✅ Todo 列表显示正确
   - ✅ Todo 更新生效

#### 测试 4: Hooks 测试

**测试场景**:

1. **before_prompt_build Hooks**
   - 发送一个编码任务
   - 检查 prompt 中是否注入了：
     - ✅ Guardrail rules
     - ✅ Keyword detection results
     - ✅ Context injection
     - ✅ Todo enforcer reminders（如果启用）

2. **session_start Hooks**
   - 开始新会话
   - 检查：
     - ✅ Session sync 初始化
     - ✅ Todo reminder 初始化

3. **before_tool_call Hooks**
   - 调用一个工具
   - 检查：
     - ✅ Spawn guard 验证权限
     - ✅ 工具调用被正确拦截和处理

4. **subagent_ended Hooks**
   - 完成一个子代理任务
   - 检查：
     - ✅ Subagent tracker 记录完成
     - ✅ 清理逻辑执行

5. **agent_end Hooks**
   - 完成一个任务
   - 检查：
     - ✅ Todo reminder 检查
     - ✅ Agent end reminder 执行

6. **session_end Hooks**
   - 结束会话
   - 检查：
     - ✅ Session cleanup 执行
     - ✅ Todo reminder 清理

7. **message_received Hooks**
   - 发送消息
   - 检查：
     - ✅ Message monitor 计数增加

---

### 阶段 7C: 集成测试

#### 测试 5: 完整工作流测试

**场景 1: Ultrawork 完整流程**

```
1. 发送：/ultrawork 实现一个简单的待办事项管理 CLI
2. 观察：
   - Prometheus 规划阶段
   - Metis 差距分析
   - Momus 计划审查
   - Atlas 任务分配
   - Sisyphus-Junior 编码执行
   - 测试验证
   - 最终合并
```

**验证点**:
- ✅ 所有 personas 按顺序激活
- ✅ 每个阶段日志清晰
- ✅ 任务最终完成
- ✅ 代码质量符合标准

**场景 2: Ralph Loop 自修正**

```
1. 发送：/ralph_loop 5 task.txt
2. 创建一个包含错误的任务文件
3. 观察 Ralph Loop 如何自修正
```

**验证点**:
- ✅ Ralph Loop 成功启动
- ✅ 迭代执行任务
- ✅ 检测错误并自修正
- ✅ 在最大迭代次数内完成或失败

**场景 3: 多子代理并发**

```
1. 同时委托 3 个不同类别的任务：
   - quick: "写一个 hello world"
   - deep: "实现一个完整的 API 客户端"
   - visual-engineering: "设计一个 UI 组件"
2. 观察并发执行
```

**验证点**:
- ✅ 3 个子代理同时运行
- ✅ 模型路由正确（不同类别使用不同模型）
- ✅ 结果正确返回
- ✅ 无资源竞争或死锁

#### 测试 6: 配置测试

**测试配置项**:

1. **max_ralph_iterations**
   ```json
   {"max_ralph_iterations": 3}
   ```
   - 创建需要多次迭代才能完成的任务
   - 验证在第 3 次迭代后被强制停止

2. **todo_enforcer_enabled**
   ```json
   {"todo_enforcer_enabled": true}
   ```
   - 启用 todo enforcer
   - 发送任务但不创建 todo
   - 验证是否提醒创建 todo

3. **comment_checker_enabled**
   ```json
   {"comment_checker_enabled": true}
   ```
   - 生成包含 AI slop 注释的代码
   - 验证是否提醒清理注释

4. **webhook_bridge_enabled**
   ```json
   {"webhook_bridge_enabled": true, "gateway_url": "http://127.0.0.1:18789"}
   ```
   - 启用 webhook bridge
   - 触发长运行任务
   - 验证是否发送进度通知

---

### 阶段 7D: 压力测试

#### 测试 7: 高负载测试

**场景**:
```
1. 快速连续发送 10 个任务委托请求
2. 同时启动 5 个 Ralph Loop
3. 在短时间内触发 100 次消息
```

**验证点**:
- ✅ 无内存泄漏
- ✅ 无竞态条件
- ✅ 所有请求都被正确处理
- ✅ 系统稳定性保持

#### 测试 8: 长时间运行测试

**场景**:
```
运行 Ralph Loop 持续 1 小时，执行多个迭代
```

**验证点**:
- ✅ 内存使用稳定
- ✅ 日志文件不过度增长
- ✅ 无资源泄漏
- ✅ 性能不随时间下降

---

### 阶段 7E: 错误处理测试

#### 测试 9: 异常情况测试

**测试用例**:

1. **无效配置**
   ```json
   {"max_ralph_iterations": -5}  // 应为 0-100
   ```
   - 验证：配置被 clamped 到有效范围

2. **缺失必需参数**
   ```
   调用 omoc_delegate 但不提供 task_description
   ```
   - 验证：返回清晰的错误信息

3. **网络错误**
   ```
   设置 gateway_url 为无效地址
   ```
   - 验证：优雅降级，不崩溃

4. **文件权限错误**
   ```
   checkpoint_dir 指向无权限的目录
   ```
   - 验证：错误处理，提示用户

5. **模型 API 错误**
   ```
   使用无效的 API key 或模型不可用
   ```
   - 验证：重试机制或回退到备用模型

---

## 📊 测试结果记录模板

### 测试执行记录

| 测试 ID | 测试名称 | 执行时间 | 结果 | 备注 |
|--------|---------|---------|------|------|
| 7A-1 | 插件构建 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7A-2 | 插件安装 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7A-3 | Gateway 重启 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7B-1 | 插件加载验证 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7B-2 | Commands 测试 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7B-3 | Tools 测试 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7B-4 | Hooks 测试 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7C-1 | Ultrawork 流程 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7C-2 | Ralph Loop | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7C-3 | 多子代理并发 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7C-4 | 配置测试 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7D-1 | 高负载测试 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7D-2 | 长时间运行 | YYYY-MM-DD HH:MM | ✅/❌ | |
| 7E-1 | 异常处理 | YYYY-MM-DD HH:MM | ✅/❌ | |

### 问题跟踪

| 问题 ID | 描述 | 严重程度 | 状态 | 解决方案 |
|--------|------|---------|------|---------|
| BUG-001 | | Critical/High/Medium/Low | Open/In Progress/Resolved | |

---

## 🚀 执行步骤

### 第一步：准备测试环境

```bash
# 1. 确保插件构建成功
cd ~/wind/ai_code/oh-my-openclaw/plugin
npm run build

# 2. 备份当前配置
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup

# 3. 修改配置添加插件
# (编辑 ~/.openclaw/openclaw.json，添加插件配置)

# 4. 重启 Gateway
openclaw gateway restart

# 5. 查看日志确认加载
tail -f /tmp/openclaw/openclaw-*.log
```

### 第二步：执行基础测试

按顺序执行阶段 7B 的所有测试，记录结果。

### 第三步：执行集成测试

执行阶段 7C 的完整工作流测试。

### 第四步：执行压力测试（可选）

如果基础测试和集成测试都通过，执行压力测试。

### 第五步：问题修复和回归测试

如果发现问题：
1. 记录问题详情
2. 修复代码
3. 重新构建：`npm run build`
4. 重启 Gateway：`openclaw gateway restart`
5. 回归测试受影响的功能

### 第六步：生成测试报告

总结所有测试结果，确认是否可以发布。

---

## ✅ 成功标准

**Phase 7 通过标准**:

1. ✅ 所有基础测试通过（7B-1 到 7B-4）
2. ✅ 所有集成测试通过（7C-1 到 7C-4）
3. ✅ 无 Critical 或 High 严重程度的 bug
4. ✅ 性能指标在可接受范围内
5. ✅ 日志清晰，无异常错误

**全部通过后**:
- 更新版本号到 0.21.3（正式发布）
- 创建发布说明
- 更新文档
- 考虑发布到 npm

---

## 📝 注意事项

1. **测试环境隔离**: 建议在测试环境中执行，避免影响生产使用
2. **日志备份**: 测试前后备份日志文件
3. **配置回滚**: 准备好配置回滚方案
4. **逐步验证**: 按顺序执行测试，不要跳过步骤
5. **详细记录**: 记录所有测试结果和发现的问题

---

**准备就绪后，执行第一步！** 🚀
