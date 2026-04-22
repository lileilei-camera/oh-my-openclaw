import { describe, expect, it, vi, beforeEach } from 'vitest';
import { detectKeywords, WORKFLOW_PERSONA_MAP } from '../hooks/keyword-detector/detector.js';
import { registerKeywordDetector } from '../hooks/keyword-detector/hook.js';
import { createMockApi } from './helpers/mock-factory.js';

describe('keyword-detector', () => {
  describe('detectKeywords', () => {
    it('detects /ultrawork command', () => {
      const result = detectKeywords('/ultrawork this feature');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ultrawork');
    });

    it('detects /ulw shorthand command', () => {
      const result = detectKeywords('/ulw implement auth');
      expect(result.some((k) => k.type === 'ultrawork')).toBe(true);
    });

    it('detects search keywords in English', () => {
      const result = detectKeywords('search for auth patterns');
      expect(result.some((k) => k.type === 'search')).toBe(true);
    });

    it('detects search keywords in Korean', () => {
      const result = detectKeywords('인증 패턴 찾아줘');
      expect(result.some((k) => k.type === 'search')).toBe(true);
    });

    it('detects analyze keywords in English', () => {
      const result = detectKeywords('analyze the performance bottleneck');
      expect(result.some((k) => k.type === 'analyze')).toBe(true);
    });

    it('detects analyze keywords in Korean', () => {
      const result = detectKeywords('이 코드 분석해줘');
      expect(result.some((k) => k.type === 'analyze')).toBe(true);
    });

    it('detects coding keywords in English', () => {
      const result = detectKeywords('implement a new auth system');
      expect(result.some((k) => k.type === 'coding')).toBe(true);
    });

    it('detects coding keywords in Korean', () => {
      const result = detectKeywords('인증 시스템 구현해줘');
      expect(result.some((k) => k.type === 'coding')).toBe(true);
    });

    it('detects multiple keyword types simultaneously', () => {
      const result = detectKeywords('search and analyze the auth module then implement a fix');
      const types = result.map((k) => k.type);
      expect(types).toContain('search');
      expect(types).toContain('analyze');
      expect(types).toContain('coding');
    });

    it('returns empty for no keywords', () => {
      const result = detectKeywords('hello world');
      expect(result).toHaveLength(0);
    });

    it('ignores keywords inside code blocks', () => {
      const result = detectKeywords('here is code:\n```\nfunction search() {}\n```\nnothing else');
      expect(result.some((k) => k.type === 'search')).toBe(false);
    });

    it('ignores keywords inside inline code', () => {
      const result = detectKeywords('the `search` function is here');
      expect(result.some((k) => k.type === 'search')).toBe(false);
    });

    it('detects Japanese keywords', () => {
      const result = detectKeywords('このコードを分析してください');
      expect(result.some((k) => k.type === 'analyze')).toBe(true);
    });

    it('detects Chinese keywords', () => {
      const result = detectKeywords('搜索认证模式');
      expect(result.some((k) => k.type === 'search')).toBe(true);
    });

    it('detects Vietnamese keywords', () => {
      const result = detectKeywords('tìm kiếm mẫu xác thực');
      expect(result.some((k) => k.type === 'search')).toBe(true);
    });

    it('detects /plan command', () => {
      const result = detectKeywords('/plan create a migration strategy');
      expect(result.some((k) => k.type === 'plan')).toBe(true);
    });

    it('detects /start_work command', () => {
      const result = detectKeywords('/start_work plan-v2.md');
      expect(result.some((k) => k.type === 'start_work')).toBe(true);
    });

    it('/plan does NOT match in middle of message', () => {
      const result = detectKeywords('hello /plan create a plan');
      expect(result.some((k) => k.type === 'plan')).toBe(false);
    });

    it('/ultrawork does NOT match in middle of message', () => {
      const result = detectKeywords('let me /ultrawork on this');
      expect(result.some((k) => k.type === 'ultrawork')).toBe(false);
    });

    it('slash command blocks natural language coding detection', () => {
      const result = detectKeywords('/plan implement this feature');
      expect(result.some((k) => k.type === 'plan')).toBe(true);
      expect(result.some((k) => k.type === 'coding')).toBe(false);
    });

    it('/PLAN (uppercase) is detected (case-insensitive)', () => {
      const result = detectKeywords('/PLAN design the system');
      expect(result.some((k) => k.type === 'plan')).toBe(true);
    });

    it('/Plan (mixed case) is detected (case-insensitive)', () => {
      const result = detectKeywords('/Plan this feature');
      expect(result.some((k) => k.type === 'plan')).toBe(true);
    });

    it('omoc_planner persona filters out coding keywords', () => {
      const result = detectKeywords('search and implement a fix', 'omoc_planner');
      expect(result.some((k) => k.type === 'coding')).toBe(false);
      expect(result.some((k) => k.type === 'search')).toBe(true);
    });

    it('omoc_planner persona does NOT filter non-coding keywords', () => {
      const result = detectKeywords('search and analyze this', 'omoc_planner');
      expect(result).toHaveLength(2);
      expect(result.some((k) => k.type === 'search')).toBe(true);
      expect(result.some((k) => k.type === 'analyze')).toBe(true);
    });

    it('does NOT detect start_work without slash (requires / prefix)', () => {
      const result = detectKeywords('start_work on the approved plan');
      expect(result.some((k) => k.type === 'start_work')).toBe(false);
    });
  });

  describe('WORKFLOW_PERSONA_MAP', () => {
    it('maps ultrawork to omoc_delegate', () => {
      expect(WORKFLOW_PERSONA_MAP.ultrawork).toBe('omoc_delegate');
    });

    it('maps plan to omoc_planner', () => {
      expect(WORKFLOW_PERSONA_MAP.plan).toBe('omoc_planner');
    });

    it('maps start_work to omoc_delegate', () => {
      expect(WORKFLOW_PERSONA_MAP.start_work).toBe('omoc_delegate');
    });
  });

  describe('registerKeywordDetector hook', () => {
    let mockApi: ReturnType<typeof createMockApi>;
    let hookHandler: (event: { messages?: unknown[] }, ctx: Record<string, unknown>) => unknown;

    /** Helper to build event with a user message */
    const userMsg = (text: string) => ({ messages: [{ role: 'user', content: text }] });

    beforeEach(() => {
      mockApi = createMockApi();
      registerKeywordDetector(mockApi as any);

      // given - hook registered on before_prompt_build
      const onCall = mockApi.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'before_prompt_build',
      );
      expect(onCall).toBeDefined();
      hookHandler = onCall![1] as typeof hookHandler;
    });

    it('returns prependContext when keywords detected', () => {
      const result = hookHandler(userMsg('search for auth patterns'), {});
      expect(result).toBeDefined();
      expect((result as any).prependContext).toContain('[search-mode]');
    });

    it('returns void when no keywords detected', () => {
      const result = hookHandler(userMsg('hello world'), {});
      expect(result).toBeUndefined();
    });

    it('returns void when messages is empty', () => {
      const result = hookHandler({ messages: [] }, {});
      expect(result).toBeUndefined();
    });

    it('returns void when messages is missing', () => {
      const result = hookHandler({}, {});
      expect(result).toBeUndefined();
    });

    it('merges multiple detected keyword messages', () => {
      const result = hookHandler(userMsg('search and analyze this module'), {});
      const context = (result as any).prependContext;
      expect(context).toContain('[search-mode]');
      expect(context).toContain('[analyze-mode]');
    });

    it('includes coding-mode when coding keywords present', () => {
      const result = hookHandler(userMsg('이 기능 구현해줘'), {});
      expect((result as any).prependContext).toContain('[coding-mode]');
    });

    it('returns plan-mode context when /plan detected', () => {
      const result = hookHandler(userMsg('/plan design the auth system'), {});
      expect((result as any).prependContext).toContain('[plan-mode]');
    });

    it('returns start-work-mode context when /start_work detected', () => {
      const result = hookHandler(userMsg('/start_work plan-v2.md'), {});
      expect((result as any).prependContext).toContain('[start-work-mode]');
    });

    it('registers with priority 75', () => {
      const onCall = mockApi.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'before_prompt_build',
      );
      expect(onCall![2]).toEqual({ priority: 75 });
    });
  });
});
