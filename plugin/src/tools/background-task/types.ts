export interface BackgroundTaskArgs {
  description: string
  prompt: string
  agent?: string
}

export interface BackgroundOutputArgs {
  task_id: string
  block?: boolean
}

export interface BackgroundCancelArgs {
  task_id?: string
  all?: boolean
}
