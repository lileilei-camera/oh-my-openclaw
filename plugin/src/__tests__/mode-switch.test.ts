import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getModeMessage, listModes, isValidMode, ModeId } from '../hooks/mode-switch/mode-registry.js';
import { registerModeSwitch } from '../hooks/mode-switch/hook.js';
import { createMockApi } from './helpers/mock-factory.js';

describe('mode-switch', () => {
  describe('mode-registry', () => {
    it('lists all modes', () => {
      const modes = listModes();
      expect(modes).toHaveLength(6);
      const ids = modes.map((m) => m.id);
      expect(ids).toContain('search');
      expect(ids).toContain('analyze');
      expect(ids).toContain('coding');
      expect(ids).toContain('plan');
      expect(ids).toContain('ultrawork');
      expect(ids).toContain('start-work');
    });

    it('returns message for valid mode', () => {
      const msg = getModeMessage('search');
      expect(msg).toContain('[search-mode]');
    });

    it('returns empty string for invalid mode', () => {
      // @ts-expect-error testing invalid mode
      const msg = getModeMessage('invalid');
      expect(msg).toBe('');
    });

    it('validates mode names correctly', () => {
      expect(isValidMode('search')).toBe(true);
      expect(isValidMode('coding')).toBe(true);
      expect(isValidMode('ultrawork')).toBe(true);
      expect(isValidMode('invalid')).toBe(false);
      expect(isValidMode('')).toBe(false);
    });

    it('each mode has label and description', () => {
      const modes = listModes();
      for (const m of modes) {
        expect(m.label).toBeTruthy();
        expect(m.description).toBeTruthy();
      }
    });
  });

  describe('registerModeSwitch hook', () => {
    let mockApi: ReturnType<typeof createMockApi>;
    let hookHandler: (event: { prompt?: string }, ctx: Record<string, unknown>) => unknown;

    beforeEach(() => {
      mockApi = createMockApi();
      registerModeSwitch(mockApi as any);

      const onCall = mockApi.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'before_prompt_build',
      );
      expect(onCall).toBeDefined();
      hookHandler = onCall![1] as typeof hookHandler;
    });

    it('returns void when no sessionKey', () => {
      const result = hookHandler({ prompt: 'search for auth' }, {});
      expect(result).toBeUndefined();
    });

    it('returns void when prompt is empty', () => {
      const result = hookHandler({ prompt: '' }, { sessionKey: 'agent:main:test' });
      expect(result).toBeUndefined();
    });

    it('returns void when mode file does not exist (no active mode)', () => {
      // getActiveModeSync returns null when file doesn't exist
      const result = hookHandler({ prompt: 'hello' }, { sessionKey: 'agent:main:test' });
      expect(result).toBeUndefined();
    });

    it('registers with priority 75', () => {
      const onCall = mockApi.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'before_prompt_build',
      );
      expect(onCall![2]).toEqual({ priority: 75 });
    });
  });
});
