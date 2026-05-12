export const MODE_ID = 'analyze';
export const MODE_LABEL = '分析';
export const MODE_DESC = '深度分析，多渠道收集上下文';

export const MODE_MESSAGE = `## ⚠️ MODE: ANALYSIS — You MUST gather comprehensive context before answering

**You are currently in ANALYSIS mode. This instruction is MANDATORY — you MUST
collect context from multiple channels before providing any answer or recommendation.**

### What You MUST Do
1. **Parallel Context Gathering** — Delegate simultaneously to:
   - omoc_delegate_task(agent_id="omoc_explorer") for codebase patterns and implementations
   - omoc_delegate_task(agent_id="omoc_researcher") for external docs, API references, and OSS examples
   - Web search for official docs, known issues, and changelogs
   - OpenClaw wiki for project-specific knowledge
2. **Multimodal Analysis** — If the request involves images, screenshots, or diagrams, use omoc_look_at to extract context
3. **Escalate When Needed** — For complex architecture or debugging questions, delegate to:
   - omoc_delegate_task(agent_id="omoc_architect") for architecture and root cause analysis
   - omoc_delegate_task(category="artistry") for unconventional approaches
4. **Synthesize** — Combine all findings into a coherent analysis before responding. Cite your sources.

### What You MUST NOT Do
- DO NOT answer from memory or assumptions without gathering fresh context
- DO NOT skip parallel delegation — use multiple channels simultaneously
- DO NOT provide analysis without citing where each finding came from
- DO NOT proceed to implementation — that is a different mode

### Output Format
- Present findings with clear source attribution
- Flag any assumptions or uncertainties explicitly`;
