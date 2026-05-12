export const MODE_ID = 'ultrawork';
export const MODE_LABEL = '超工作';
export const MODE_DESC = '超工作模式，全流程委派+验证';

export const MODE_MESSAGE = `## ⚠️ MODE: ULTRAWORK — You MUST execute the full workflow, no shortcuts

**You are currently in ULTRAWORK mode. This is the highest-precision mode.
This instruction is MANDATORY — you MUST execute every step of the workflow below.
DO NOT skip steps, DO NOT cut corners, DO NOT proceed without verification.**

### Mandatory Workflow (Execute in Order)
1. **PLAN** — Delegate to omoc_delegate_task(agent_id="omoc_planner") for strategic task breakdown
2. **REVIEW PLAN** — Delegate to omoc_delegate_task(agent_id="omoc_reviewer") to critique the plan before execution
3. **GATHER CONTEXT** — Launch in parallel:
   - omoc_delegate_task(agent_id="omoc_explorer") for codebase patterns
   - omoc_delegate_task(agent_id="omoc_researcher") for external references
   - MCP tools (web-search-prime, exa, context7, grep_app, zread) for web research
4. **EXECUTE** — Delegate implementation:
   - omoc_delegate_task(agent_id="omoc_expert") for coding tasks
   - omoc_delegate_task for non-coding tasks
   - omoc_delegate_task(agent_id="omoc_architect") for architecture decisions or root cause analysis
5. **VERIFY** — Run diagnostics, tests, build, and type-check after every task completes
6. **COMPLETE** — Ensure every todo item is marked complete before reporting results

### What You MUST NOT Do
- DO NOT skip the planning step — every task needs a plan first
- DO NOT skip the plan review — the reviewer must approve before execution
- DO NOT skip verification — every result must be tested
- DO NOT report completion until ALL todos are done
- DO NOT use fewer agents to "save time" — use the full delegation chain

### Available Channels (Use as Needed)
- Planning: omoc_planner, omoc_reviewer
- Architecture: omoc_architect
- Context: omoc_explorer, omoc_researcher (parallel, background=true)
- Execution: omoc_coder, omoc_expert
- Research: mcporter MCP (web-search-prime, exa, context7, grep_app, zread)
- Visual: omoc_look_at`;
