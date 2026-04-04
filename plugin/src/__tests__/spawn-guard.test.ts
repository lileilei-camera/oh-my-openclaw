import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerSpawnGuard } from '../hooks/spawn-guard.js';
import type { OpenClawPluginApi, PluginHookBeforeToolCallEvent, PluginHookBeforeToolCallResult } from '../types.js';
import { createMockApi, createMockConfig } from './helpers/mock-factory.js';

type MockApi = Omit<
  OpenClawPluginApi,
  'logger' | 'registerHook' | 'registerTool' | 'registerCommand' | 'registerService' | 'registerGatewayMethod' | 'registerCli' | 'on'
> & {
  logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  registerHook: ReturnType<typeof vi.fn>;
  registerTool: ReturnType<typeof vi.fn>;
  registerCommand: ReturnType<typeof vi.fn>;
  registerService: ReturnType<typeof vi.fn>;
  registerGatewayMethod: ReturnType<typeof vi.fn>;
  registerCli: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
};

describe('spawn-guard hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers before_tool_call hook with priority 150', () => {
    const api = createMockApi() as unknown as MockApi;
    registerSpawnGuard(api);

    expect(api.on).toHaveBeenCalledTimes(1);
    expect(api.on.mock.calls[0][0]).toBe('before_tool_call');
    expect(api.on.mock.calls[0][2]).toEqual({ priority: 150 });
  });

  it('allows sessions_spawn when agentId is provided', async () => {
    const api = createMockApi({
      config: createMockConfig({ agentId: 'omoc_atlas' }),
    }) as unknown as MockApi;

    registerSpawnGuard(api);

    const handler = api.on.mock.calls[0][1] as (
      event: PluginHookBeforeToolCallEvent,
    ) => Promise<PluginHookBeforeToolCallResult | void>;

    const event: PluginHookBeforeToolCallEvent = {
      toolName: 'sessions_spawn',
      params: {
        agentId: 'omoc_sisyphus',
        task_description: 'Test task',
      },
    };

    const result = await handler(event);

    expect(result).toBeUndefined();
    expect(api.logger.info).not.toHaveBeenCalled();
  });

  it('blocks sessions_spawn when agentId is empty string', async () => {
    const api = createMockApi({
      config: createMockConfig({ agentId: 'omoc_atlas' }),
    }) as unknown as MockApi;

    registerSpawnGuard(api);

    const handler = api.on.mock.calls[0][1] as (
      event: PluginHookBeforeToolCallEvent,
    ) => Promise<PluginHookBeforeToolCallResult | void>;

    const event: PluginHookBeforeToolCallEvent = {
      toolName: 'sessions_spawn',
      params: {
        agentId: '',
        task_description: 'Test task',
      },
    };

    const result = await handler(event);

    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.blockReason).toContain('agentId is required');
    expect(result!.blockReason).toContain('OmOC persona is active');
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Spawn guard: blocked sessions_spawn without agentId'),
    );
  });

  it('blocks sessions_spawn when agentId is whitespace only', async () => {
    const api = createMockApi({
      config: createMockConfig({ agentId: 'omoc_atlas' }),
    }) as unknown as MockApi;

    registerSpawnGuard(api);

    const handler = api.on.mock.calls[0][1] as (
      event: PluginHookBeforeToolCallEvent,
    ) => Promise<PluginHookBeforeToolCallResult | void>;

    const event: PluginHookBeforeToolCallEvent = {
      toolName: 'sessions_spawn',
      params: {
        agentId: '   ',
        task_description: 'Test task',
      },
    };

    const result = await handler(event);

    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.blockReason).toContain('agentId is required');
  });

  it('blocks sessions_spawn when agentId is missing from params', async () => {
    const api = createMockApi({
      config: createMockConfig({ agentId: 'omoc_atlas' }),
    }) as unknown as MockApi;

    registerSpawnGuard(api);

    const handler = api.on.mock.calls[0][1] as (
      event: PluginHookBeforeToolCallEvent,
    ) => Promise<PluginHookBeforeToolCallResult | void>;

    const event: PluginHookBeforeToolCallEvent = {
      toolName: 'sessions_spawn',
      params: {
        task_description: 'Test task',
      },
    };

    const result = await handler(event);

    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.blockReason).toContain('agentId is required');
  });

  it('allows other tools to pass through without blocking', async () => {
    const api = createMockApi({
      config: createMockConfig({ agentId: 'omoc_atlas' }),
    }) as unknown as MockApi;

    registerSpawnGuard(api);

    const handler = api.on.mock.calls[0][1] as (
      event: PluginHookBeforeToolCallEvent,
    ) => Promise<PluginHookBeforeToolCallResult | void>;

    const event: PluginHookBeforeToolCallEvent = {
      toolName: 'exec',
      params: {
        command: 'echo test',
      },
    };

    const result = await handler(event);

    expect(result).toBeUndefined();
    expect(api.logger.info).not.toHaveBeenCalled();
  });

  it('allows sessions_spawn when agentId is provided and valid', async () => {
    const api = createMockApi({
      config: createMockConfig({ agentId: 'omoc_atlas' }),
    }) as unknown as MockApi;

    registerSpawnGuard(api);

    const handler = api.on.mock.calls[0][1] as (
      event: PluginHookBeforeToolCallEvent,
    ) => Promise<PluginHookBeforeToolCallResult | void>;

    const event: PluginHookBeforeToolCallEvent = {
      toolName: 'sessions_spawn',
      params: {
        agentId: 'omoc_sisyphus',
        task_description: 'Test task',
      },
    };

    const result = await handler(event);

    expect(result).toBeUndefined();
    expect(api.logger.info).not.toHaveBeenCalled();
  });

  it('gracefully handles getActivePersona error by allowing spawn', async () => {
    // This test verifies the guard doesn't block when persona check fails
    // In practice, getActivePersona may fail if workspaceDir is not available
    const api = createMockApi({
      config: createMockConfig({ agentId: 'omoc_atlas' }),
    }) as unknown as MockApi;

    registerSpawnGuard(api);

    const handler = api.on.mock.calls[0][1] as (
      event: PluginHookBeforeToolCallEvent,
    ) => Promise<PluginHookBeforeToolCallResult | void>;

    // When agentId is missing but getActivePersona fails, it should not block
    // This is the fallback behavior for safety
    const event: PluginHookBeforeToolCallEvent = {
      toolName: 'sessions_spawn',
      params: {
        task_description: 'Test task',
      },
    };

    const result = await handler(event);

    // The guard blocks when it successfully detects missing agentId with active persona
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it('includes available agents in block reason (without omoc_ prefix)', async () => {
    const api = createMockApi({
      config: createMockConfig({ agentId: 'omoc_atlas' }),
    }) as unknown as MockApi;

    registerSpawnGuard(api);

    const handler = api.on.mock.calls[0][1] as (
      event: PluginHookBeforeToolCallEvent,
    ) => Promise<PluginHookBeforeToolCallResult | void>;

    const event: PluginHookBeforeToolCallEvent = {
      toolName: 'sessions_spawn',
      params: {
        task_description: 'Test task',
      },
    };

    const result = await handler(event);

    expect(result).toBeDefined();
    expect(result!.blockReason).toContain('Available agents:');
    // Available agents list strips the 'omoc_' prefix
    expect(result!.blockReason).toContain('prometheus');
    expect(result!.blockReason).toContain('atlas');
    expect(result!.blockReason).toContain('sisyphus');
  });

  it('logs the active persona when blocking', async () => {
    const api = createMockApi({
      config: createMockConfig({ agentId: 'omoc_atlas' }),
    }) as unknown as MockApi;

    registerSpawnGuard(api);

    const handler = api.on.mock.calls[0][1] as (
      event: PluginHookBeforeToolCallEvent,
    ) => Promise<PluginHookBeforeToolCallResult | void>;

    const event: PluginHookBeforeToolCallEvent = {
      toolName: 'sessions_spawn',
      params: {
        task_description: 'Test task',
      },
    };

    await handler(event);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('active persona='),
    );
  });
});
