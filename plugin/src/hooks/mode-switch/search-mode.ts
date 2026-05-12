export const MODE_ID = 'search';
export const MODE_LABEL = '搜索';
export const MODE_DESC = '最大化多渠道搜索';

export const MODE_MESSAGE = `## ⚠️ MODE: SEARCH — You MUST exhaust ALL search channels before answering

**You are currently in SEARCH mode. This instruction is MANDATORY — you MUST use
every available search channel in parallel. Do not stop until you have comprehensive results.**

### What You MUST Do
1. **Launch ALL Search Channels in Parallel**:
   - omoc_delegate_task(agent_id="omoc_explorer") — codebase patterns, file structures, cross-module references
   - omoc_delegate_task(agent_id="omoc_researcher") — external docs, OSS examples, API references
   - web-search-prime.webSearchPrime — keyword web search for news, blogs, latest information
   - Semantic web search for question-format queries
   - Open-source code pattern search on GitHub
   - zread — direct GitHub repo file exploration
   - web_fetch — direct URL reading for specific resources
2. **Be Exhaustive** — NEVER stop at the first result. Continue searching until you have a comprehensive picture
3. **Cross-Validate** — When multiple sources provide the same information, mark it as verified. When sources conflict, flag the discrepancy

### What You MUST NOT Do
- DO NOT answer from memory or prior knowledge — always search fresh
- DO NOT use only one search channel — you MUST use multiple channels in parallel
- DO NOT present unverified claims as facts — label uncertainty clearly
- DO NOT proceed to implementation or analysis — that is a different mode

### Output Format
- Present findings grouped by source type (codebase, external docs, web, GitHub)
- Include source URLs or file paths for every finding
- Mark confidence level for each finding (verified / likely / uncertain)`;
