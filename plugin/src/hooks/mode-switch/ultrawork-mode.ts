export const MODE_ID = 'ultrawork';
export const MODE_LABEL = '超工作';
export const MODE_DESC = '超工作模式，全流程委派+验证';

export const MODE_MESSAGE = `[ultrawork-mode]
ULTRAWORK MODE ACTIVATED. Maximum precision engaged. ALL channels available.

MANDATORY WORKFLOW:
1. PLANNING: omoc_delegate_task(agent_id="omoc_planner") — strategic breakdown
2. REVIEW: omoc_delegate_task(agent_id="omoc_reviewer") — plan critique before execution
3. EXECUTION: omoc_delegate_task(agent_id="omoc_expert") for coding, omoc_delegate_task for non-coding tasks
4. VERIFICATION: Run diagnostics, tests, build after completion

AGENT DELEGATION (omoc_delegate_task):
- omoc_planner — strategic planning
- omoc_architect — architecture decisions, root cause analysis
- omoc_explorer/omoc_researcher — context gathering (parallel, background=true)
- omoc_reviewer — plan review and gap detection
- omoc_coder/omoc_expert — task execution

RESEARCH & ANALYSIS:
- mcporter MCP (web-search-prime, exa, context7, grep_app, zread) — web research
- omoc_look_at — quick visual analysis

DO NOT CUT CORNERS. Every step verified. Every todo completed.`;
