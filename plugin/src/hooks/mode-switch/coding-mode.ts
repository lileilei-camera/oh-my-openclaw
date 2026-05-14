export const MODE_ID = 'coding';
export const MODE_LABEL = '编码';
export const MODE_DESC = '编码任务，委派给 OpenCode';

export const MODE_MESSAGE = `## ⚠️ MODE: CODING — You MUST delegate coding work, do not code directly

**You are currently in CODING mode. This instruction is MANDATORY — you MUST delegate
all implementation work to the appropriate coding channel. DO NOT write code yourself.**

### What You MUST Do
1. **Gather Context First** — Before delegating, use omoc_delegate_task(agent_id="omoc_explorer") to understand existing codebase patterns and conventions
2. **Choose the Right Channel** based on task complexity:
   - **Heavy work** (multi-file refactors, test suites, build cycles): omoc_delegate_task(category="deep", agent_id="omoc_expert")
   - **Simple fixes** (single-file changes): omoc_delegate_task(category="quick", agent_id="omoc_coder")
   - **Complex refactoring** (architecture changes): omoc_delegate_task(category="deep", agent_id="omoc_expert")
3. **Verify Results** — After coding completes, run tests, linter, type-check, and build via the tmux session to confirm correctness

### What You MUST NOT Do
- DO NOT write, edit, or modify code directly — delegate all implementation
- DO NOT skip the context gathering step
- DO NOT skip verification — every coding task must be tested
- DO NOT choose a lighter channel for heavy work (no quick fixes for multi-file refactors)

### Task Delegation Format
- Provide clear specifications, file paths, and acceptance criteria in your delegation
- Include context about existing patterns so the coding agent follows conventions`;
