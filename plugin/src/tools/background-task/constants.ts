export const BACKGROUND_TASK_DESCRIPTION = `⚠️ Returns sessions_spawn instructions - does NOT create session. Caller must execute sessions_spawn with returned parameters.

Use \`background_output\` to get results after session is created. Prompts MUST be in English.`

export const BACKGROUND_OUTPUT_DESCRIPTION = `Get output from background task. System notifies on completion, so block=true rarely needed.`

export const BACKGROUND_CANCEL_DESCRIPTION = `Cancel running background task(s). Use all=true to cancel ALL before final answer.`
