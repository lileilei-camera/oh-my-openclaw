export const MODE_ID = 'plan';
export const MODE_LABEL = '规划';
export const MODE_DESC = '战略规划，创建计划文件';

export const MODE_MESSAGE = `## ⚠️ MODE: PLANNING — You MUST plan only, no implementation

**You are currently in PLANNING mode. This instruction is MANDATORY — you MUST follow
the planning workflow below for the current user request.**

### What You MUST Do
1. **Gather Context** — Read existing plans from workspace/plans/, review notepads, and inspect the codebase for relevant patterns
2. **Gap Analysis** — Identify unknowns, missing information, and assumptions before creating any plan
3. **Create Plan** — Save a structured plan to workspace/plans/ with clear steps, dependencies, and acceptance criteria
4. **Self-Review** — Review your plan for completeness. Optionally delegate review via omoc_delegate_task(agent_id="omoc_reviewer")

### What You MUST NOT Do
- DO NOT write, edit, or delete any implementation code
- DO NOT run builds, tests, or deployments
- DO NOT skip the gap analysis step
- DO NOT create vague plans — every step must have a clear acceptance criterion

### Execution Channel
- Delegate any implementation work via omoc_delegate_task after the plan is approved`;
