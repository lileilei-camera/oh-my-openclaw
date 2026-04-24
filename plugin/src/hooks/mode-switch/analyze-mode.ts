export const MODE_ID = 'analyze';
export const MODE_LABEL = '分析';
export const MODE_DESC = '深度分析，多渠道收集上下文';

export const MODE_MESSAGE = `[analyze-mode]
ANALYSIS MODE. Gather context from ALL channels before diving deep:

CONTEXT GATHERING (parallel):
- omoc_delegate_task(agent_id="omoc_explorer") — codebase patterns, implementations
- omoc_delegate_task(agent_id="omoc_researcher") — external docs, API references
- web-search  official docs, known issues, changelogs
- openclaw wiki

VISUAL/MULTIMODAL ANALYSIS (if needed):
- omoc_look_at — quick multimodal analysis of images/screenshots

IF COMPLEX — delegate to specialists:
- omoc_delegate_task(agent_id="omoc_architect") — architecture, debugging, complex logic
- omoc_delegate_task(category="artistry") — unconventional approaches

SYNTHESIZE findings before proceeding.`;
