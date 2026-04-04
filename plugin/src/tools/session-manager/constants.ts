export const SESSION_LIST_DESCRIPTION =
  `List all OpenClaw sessions with optional filtering. ` +
  `Returns a list of available sessions with metadata including session key, model, and message count. ` +
  `Arguments: ` +
  `- limit (optional): Maximum number of sessions to return (default: 20) ` +
  `- activeMinutes (optional): Filter sessions active within last N minutes ` +
  `- kinds (optional): Filter by session kinds (e.g. ["subagent", "acp"])`;

export const SESSION_READ_DESCRIPTION =
  `Read message history from an OpenClaw session. ` +
  `Returns a formatted view of session messages with role and content. ` +
  `Arguments: ` +
  `- sessionKey (required): Session key to read ` +
  `- limit (optional): Maximum number of messages to return (default: 50) ` +
  `- includeTools (optional): Include tool call details (default: false)`;

export const TOOL_NAME_PREFIX = 'session_';
