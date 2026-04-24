export const MODE_ID = 'plan';
export const MODE_LABEL = '规划';
export const MODE_DESC = '战略规划，创建计划文件';

export const MODE_MESSAGE = `[plan-mode]
PLANNING MODE ACTIVATED. Strategic analysis and structured plan creation.

MANDATORY WORKFLOW:
1. CONTEXT: Gather existing plans, notepads, and codebase context
2. GAP ANALYSIS: Identify unknowns, missing info, assumptions
3. PLAN CREATION: Save structured plan to workspace/plans/
4. REVIEW: Self-review + optional review via omoc_delegate_task(agent_id="omoc_reviewer")

HARD BOUNDARY: Planning only. No implementation. Delegate execution via omoc_delegate_task.`;
