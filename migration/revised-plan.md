# Oh-My-OpenClaw 插件迁移计划 (修订版)

**目标**: 完全使用新的 OpenClaw 插件 SDK，移除一切老的接口

**执行时间**: 2026-04-02  
**插件版本**: v0.21.3 → v0.22.0

---

## 📊 当前状态分析

### 已兼容部分 ✅

| 组件 | 状态 | 说明 |
|------|------|------|
| Hook 系统 | ✅ 兼容 | `api.on()` 和 `api.registerHook()` 都是标准 API |
| 注册逻辑 | ✅ 兼容 | 直接使用 `api.registerXxx()` 方法 |
| 工具定义 | ✅ 兼容 | `AnyAgentTool` 类型兼容 |

### 需要迁移部分 ⚠️

| 组件 | 当前实现 | 目标实现 | 优先级 |
|------|---------|---------|--------|
| 类型定义 | 本地 `OmocPluginApi` | SDK `OpenClawPluginApi` | 🔴 高 |
| Hook 事件类型 | 本地 `TypedHookContext` | SDK 标准事件类型 | 🔴 高 |
| 配置访问 | `getConfig(api)` | `api.config` + `api.pluginConfig` | 🔴 高 |
| 运行时访问 | `api.runtime.system` | `api.runtime` 标准 API | 🟡 中 |
| 日志记录 | `api.logger` | ✅ 已兼容 | 🟢 低 |

---

## 🎯 Phase 1 (修订): 类型系统迁移

**目标**: 移除本地类型，完全使用 SDK 类型

### 1.1 移除本地类型定义

**文件**: `src/types.ts`

**移除**:
- ❌ `OmocPluginApi` - 使用 `OpenClawPluginApi`
- ❌ `TypedHookContext` - 使用 SDK 事件对象
- ❌ `BeforePromptBuildEvent` - 使用 `PluginHookBeforePromptBuildEvent`
- ❌ `BeforePromptBuildResult` - 使用 `PluginHookBeforePromptBuildResult`
- ❌ `ToolResult` - 使用 SDK 类型

**保留**:
- ✅ 插件专用类型（如 `ContextEntry`, `RalphLoopState` 等）
- ✅ 工具特定类型（如 `Todo`, `CheckpointData` 等）

### 1.2 更新所有 Hook 文件

**文件列表**:
- `src/hooks/*.ts` - 所有 Hook 文件
- `src/tools/*.ts` - 所有工具文件
- `src/commands/*.ts` - 所有命令文件
- `src/services/*.ts` - 所有服务文件

**修改模式**:

**迁移前**:
```typescript
import { OmocPluginApi, TypedHookContext } from '../types.js';

api.on<BeforePromptBuildEvent, BeforePromptBuildResult>(
  'before_prompt_build',
  (_event: BeforePromptBuildEvent, ctx: TypedHookContext): BeforePromptBuildResult | void => {
    const sessionKey = ctx.sessionKey;
    // ...
  }
);
```

**迁移后**:
```typescript
import type { OpenClawPluginApi, PluginHookBeforePromptBuildEvent, PluginHookBeforePromptBuildResult } from 'openclaw/plugin-sdk';

api.on<PluginHookBeforePromptBuildEvent, PluginHookBeforePromptBuildResult>(
  'before_prompt_build',
  (event: PluginHookBeforePromptBuildEvent): PluginHookBeforePromptBuildResult | void => {
    // 从事件对象或 api.config 获取上下文
    // SDK Hook 不再提供 TypedHookContext
  }
);
```

### 1.3 更新 index.ts

**修改**:
- 导入 `OpenClawPluginApi` from `openclaw/plugin-sdk`
- 移除本地 `api.on()` 别名（SDK 已原生支持）
- 更新 `register()` 函数签名

---

## 🎯 Phase 2 (修订): 配置和运行时迁移

**目标**: 使用 SDK 标准配置和运行时 API

### 2.1 配置访问迁移

**文件**: `src/utils/config.ts`

**迁移前**:
```typescript
import { OmocPluginApi } from '../types.js';

export function getConfig(api: OmocPluginApi): PluginConfig {
  const config = api.config as OpenClawConfig & PluginConfig;
  // ...
}
```

**迁移后**:
```typescript
import type { OpenClawPluginApi, OpenClawConfig } from 'openclaw/plugin-sdk';

// 直接使用 api.config 和 api.pluginConfig
// 不再需要 getConfig() 包装函数
```

**所有使用 `getConfig(api)` 的地方**:
- 替换为 `api.config` (OpenClaw 核心配置)
- 替换为 `api.pluginConfig` (插件专属配置)

### 2.2 运行时访问迁移

**文件**: `src/hooks/*.ts`, `src/services/*.ts`

**迁移前**:
```typescript
if (api.runtime.system) {
  api.runtime.system.enqueueSystemEvent(warning, { sessionKey });
}
```

**迁移后**:
```typescript
// 使用 SDK 标准运行时 API
// 具体方法需要查看 PluginRuntime 类型定义
api.runtime.xxx(...)
```

### 2.3 移除配置工具函数

**文件**: `src/utils/config.ts`

**移除**:
- ❌ `getConfig()` - 直接使用 `api.config`
- ❌ `validateConfig()` - SDK 自动验证
- ❌ 配置默认值处理 - 使用 manifest 中的 `configSchema`

---

## 🎯 Phase 3: 清单文件更新

**目标**: 创建符合新 SDK 要求的 `openclaw.plugin.json`

### 3.1 创建 Manifest 文件

**文件**: `plugin/openclaw.plugin.json`

```json
{
  "id": "@lileilei-camera/oh-my-openclaw",
  "name": "Oh My OpenClaw",
  "version": "0.22.0",
  "description": "Agent orchestration framework for OpenClaw",
  "kind": "automation",
  "configSchema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "max_ralph_iterations": {
        "type": "number",
        "default": 10,
        "description": "Maximum iterations for Ralph Loop"
      },
      "todo_enforcer_enabled": {
        "type": "boolean",
        "default": false
      },
      "comment_checker_enabled": {
        "type": "boolean",
        "default": true
      },
      "gateway_url": {
        "type": "string",
        "default": "http://127.0.0.1:18789"
      },
      "hooks_token": {
        "type": "string",
        "default": ""
      }
    }
  },
  "skills": [
    "git-master",
    "frontend-ui-ux",
    "comment-checker",
    "gemini-look-at",
    "web-search"
  ]
}
```

### 3.2 更新 package.json

**修改**:
- 添加 `openclaw.plugin.json` 到 `files` 数组
- 更新 `main` 指向编译后的入口

---

## 📋 执行顺序

1. ✅ **Phase 1.1**: 更新 `src/types.ts` - 移除本地类型
2. ✅ **Phase 1.2**: 更新所有 Hook 文件 - 使用 SDK 类型
3. ✅ **Phase 1.3**: 更新 `src/index.ts` - 使用 SDK API
4. ✅ **Phase 2.1**: 移除 `getConfig()` - 使用 `api.config`
5. ✅ **Phase 2.2**: 更新运行时访问 - 使用 `api.runtime`
6. ✅ **Phase 3.1**: 创建 `openclaw.plugin.json`
7. ✅ **Phase 3.2**: 更新 `package.json`
8. ✅ **验证**: TypeScript 编译 + 所有测试

---

## ⚠️ 风险缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| SDK 类型不兼容 | 编译失败 | 逐步迁移，每步验证编译 |
| Hook 签名变化 | 运行时错误 | 保留测试，确保 366 测试通过 |
| 配置访问变化 | 功能失效 | 保留向后兼容，逐步迁移 |
| 运行时 API 变化 | 功能失效 | 查看 SDK 文档，使用标准 API |

---

## ✅ 验收标准

- [ ] TypeScript 编译通过（无错误）
- [ ] 所有测试通过（366 个）
- [ ] 移除所有本地类型（`OmocPluginApi`, `TypedHookContext` 等）
- [ ] 使用 SDK 标准配置访问（`api.config`, `api.pluginConfig`）
- [ ] 创建有效的 `openclaw.plugin.json`
- [ ] 插件能正常加载和运行

---

*修订版迁移计划 - 完全使用新 SDK*
