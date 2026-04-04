export const ALLOWED_AGENTS = ["explore", "librarian"] as const

export const CALL_OMO_AGENT_DESCRIPTION = `⚠️ Returns sessions_spawn instructions - does NOT create session. Caller must execute sessions_spawn with returned parameters.

Available: explore, librarian

run_in_background REQUIRED (true=async with task_id, false=sync). Pass \`session_id=<id>\` to continue previous agent with full context. Prompts MUST be in English. Use \`background_output\` for async results.`
