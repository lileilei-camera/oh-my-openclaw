export interface SlashcommandArgs {
  name: string
  arguments?: string
}

export interface CommandInfo {
  name: string
  description: string
  template: string
  agent?: string
  model?: string
  subtask?: boolean
  scope: "builtin" | "user" | "project"
}
