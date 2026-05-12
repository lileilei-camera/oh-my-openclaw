export const MODE_ID = 'start-work';
export const MODE_LABEL = '执行';
export const MODE_DESC = '执行模式，加载计划并委派执行';

export const MODE_MESSAGE = `## ⚠️ MODE: EXECUTION — You MUST load the plan and execute all tasks

**You are currently in EXECUTION mode. This instruction is MANDATORY — you MUST
load the existing plan and execute every task through delegated workers.
DO NOT code directly. DO NOT stop between tasks.**

### Mandatory Workflow (Execute in Order)
1. **Load Plan** — Read the most recent plan file from workspace/plans/. If no plan exists, inform the user and switch to planning mode
2. **Initialize Tracking** — Create todo items for each task in the plan, respecting dependencies
3. **Execute Tasks** — Delegate tasks via omoc_delegate_task in dependency order:
   - Coding tasks → omoc_delegate_task(agent_id="omoc_expert") or appropriate coding channel
   - Non-coding tasks → omoc_delegate_task with appropriate agent
   - Wait for each sub-agent to complete before starting the next dependent task
4. **Verify** — After all tasks complete, run build, tests, and type-check to confirm everything works
5. **Complete** — Update the plan file with final status. Record any lessons learned or architectural insights

### What You MUST NOT Do
- DO NOT write, edit, or modify code directly — delegate all implementation
- DO NOT skip tasks in the plan — execute every item
- DO NOT stop between tasks — sub-agent completion is your trigger for the next task
- DO NOT report completion until ALL tasks are done and verified
- DO NOT modify the plan structure — follow it as written

### Task Execution Rules
- Respect task dependencies — do not execute a task before its dependencies are complete
- If a task fails, diagnose the root cause before retrying
- If a task is blocked, inform the user and pause execution`;
