// SDK 类型声明 - 帮助 TypeScript 解析 openclaw/plugin-sdk 模块
// 这个文件是必需的，因为 SDK 的类型导出路径比较复杂
//
// ⚠️ 只补了 api.on<>() 的现代类型。旧 api.registerHook() 的事件 shape 不同，
// 那些文件里的本地 interface 是 registerHook 遗留 API 的文档，不能直接换成这里的类型。

declare module 'openclaw/plugin-sdk' {
  // 核心 API 类型
  export type { OpenClawPluginApi } from './src/plugins/types.js';
  export type { OpenClawConfig } from './src/config/config.js';
  export type { PluginLogger } from './src/plugins/types.js';
  export type { PluginRuntime } from './src/plugins/runtime/types.js';
  
  // Hook 相关类型
  export type { InternalHookHandler } from './src/hooks/types.js';
  export type { OpenClawPluginHookOptions } from './src/plugins/types.js';
  export type { OpenClawPluginToolOptions } from './src/plugins/types.js';
  export type { AnyAgentTool } from './src/plugins/types.js';
  
  // Hook 事件和结果类型（与 SDK 真实类型一一对应）
  export type { PluginHookName, PluginHookHandlerMap, PluginHookAgentContext } from './src/hooks/types.js';
  export type { PluginHookBeforePromptBuildEvent, PluginHookBeforePromptBuildResult } from './src/hooks/types.js';
  export type { PluginHookLlmInputEvent } from './src/hooks/types.js';
  export type { PluginHookAgentEndEvent } from './src/hooks/types.js';
  export type { PluginHookSessionStartEvent, PluginHookSessionEndEvent } from './src/hooks/types.js';
  export type { PluginHookBeforeToolCallEvent, PluginHookBeforeToolCallResult } from './src/hooks/types.js';
  export type { PluginHookToolResultPersistEvent, PluginHookToolResultPersistContext, PluginHookToolResultPersistResult } from './src/hooks/types.js';
  export type { PluginHookMessageContext, PluginHookMessageReceivedEvent, PluginHookMessageSentEvent } from './src/hooks/types.js';
  export type { PluginHookSubagentEndedEvent } from './src/hooks/types.js';
  export type { PluginHookGatewayStartEvent, PluginHookGatewayContext } from './src/hooks/types.js';
}
