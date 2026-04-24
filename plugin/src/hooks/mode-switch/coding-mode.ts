export const MODE_ID = 'coding';
export const MODE_LABEL = '编码';
export const MODE_DESC = '编码任务，委派给 OpenCode';

export const MODE_MESSAGE = `[coding-mode]
CODING TASK DETECTED. Use the right execution channel:

PRIMARY — tmux OpenCode/OmO session (opencode-controller skill):
- Delegate implementation to OpenCode running in tmux for full OmO power
- Use for: heavy coding, multi-file refactors, test writing, build/lint cycles

ALTERNATIVE — omoc_delegate_task for lighter tasks:
- omoc_delegate_task(category="quick", agent_id="omoc_coder") — simple fixes, single-file changes
- omoc_delegate_task(category="deep", agent_id="omoc_expert") — complex refactoring, architecture changes

CONTEXT GATHERING (parallel, before coding):
- omoc_delegate_task(agent_id="omoc_explorer") — understand existing patterns first

VERIFICATION (after coding):
- Run tests, linter, type-check, build via tmux session`;
