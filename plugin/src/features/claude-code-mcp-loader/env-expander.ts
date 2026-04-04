/**
 * Expands environment variables in configuration objects.
 * Replaces ${VAR} and $VAR patterns with actual environment values.
 */
export function expandEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === "string") {
    return expandEnvVarsInString(obj as string) as T
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item) => expandEnvVarsInObject(item)) as T
  }
  
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvVarsInObject(value)
    }
    return result as T
  }
  
  return obj
}

function expandEnvVarsInString(str: string): string {
  return str.replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, braceVar, plainVar) => {
    const varName = braceVar || plainVar
    const value = process.env[varName]
    return value !== undefined ? value : match
  })
}
