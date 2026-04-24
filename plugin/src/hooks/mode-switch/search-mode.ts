export const MODE_ID = 'search';
export const MODE_LABEL = '搜索';
export const MODE_DESC = '最大化多渠道搜索';

export const MODE_MESSAGE = `[search-mode]
MAXIMIZE SEARCH EFFORT. Use ALL available channels IN PARALLEL:

AGENT DELEGATION (omoc_delegate_task):
- agent_id="omoc_explorer" — codebase patterns, file structures, cross-module references
- agent_id="omoc_researcher" — external docs, OSS examples, API references

WEB SEARCH (mcporter MCP + OpenClaw native):
- web-search-prime.webSearchPrime — keyword web search (news, blogs, latest info)
- semantic web search (better for question-format queries)
- open-source code pattern search on GitHub
- zread — direct GitHub repo file exploration
- web_fetch — direct URL reading


Launch multiple delegates + web searches simultaneously.
NEVER stop at first result — be exhaustive.`;
