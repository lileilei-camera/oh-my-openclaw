export const MODE_ID = 'start-work';
export const MODE_LABEL = '执行';
export const MODE_DESC = '执行模式，加载计划并委派执行';

export const MODE_MESSAGE = `[start-work-mode]
EXECUTION MODE ACTIVATED. Load plan and execute via delegation.

MANDATORY WORKFLOW:
1. LOAD PLAN: Read most recent plan from workspace/plans/
2. INIT TRACKING: Create todo items for each task
3. EXECUTE: Delegate tasks via omoc_delegate_task in dependency order
4. VERIFY: Run build/test verification after all tasks complete
5. COMPLETE: Update plan status, record wisdom

HARD BOUNDARY: Implementation through delegated workers only. Do not code directly.
Sub-agent completion notification = action trigger. Never stop between tasks.`;
