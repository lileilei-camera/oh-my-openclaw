import { Type, Static } from '@sinclair/typebox'
import type { OpenClawPluginApi } from '../../types.js'
import { TOOL_PREFIX, LOG_PREFIX } from '../../constants.js'
import { toolResponse, toolError } from '../../utils/helpers.js'
import type { SkillMcpManager } from '../../features/skill-mcp-manager/manager.js'
import type { SkillMcpClientInfo, SkillMcpServerContext } from '../../features/skill-mcp-manager/types.js'
import type { LoadedSkill } from '../../features/skill-loader/types.js'

const SkillMcpParamsSchema = Type.Object({
  mcp_name: Type.String({
    description: 'Name of the MCP server from skill config',
  }),
  tool_name: Type.Optional(Type.String({
    description: 'MCP tool to call',
  })),
  resource_name: Type.Optional(Type.String({
    description: 'MCP resource URI to read',
  })),
  prompt_name: Type.Optional(Type.String({
    description: 'MCP prompt to get',
  })),
  arguments: Type.Optional(Type.Union([
    Type.String(),
    Type.Record(Type.String(), Type.Unknown()),
  ], {
    description: 'JSON string or object of arguments',
  })),
  grep: Type.Optional(Type.String({
    description: 'Regex pattern to filter output lines (only matching lines returned)',
  })),
})

type SkillMcpParams = Static<typeof SkillMcpParamsSchema>

type OperationType = { type: 'tool' | 'resource' | 'prompt'; name: string }

function validateOperationParams(args: SkillMcpParams): OperationType {
  const operations: OperationType[] = []
  if (args.tool_name) operations.push({ type: 'tool', name: args.tool_name })
  if (args.resource_name) operations.push({ type: 'resource', name: args.resource_name })
  if (args.prompt_name) operations.push({ type: 'prompt', name: args.prompt_name })

  if (operations.length === 0) {
    throw new Error(
      `Missing operation. Exactly one of tool_name, resource_name, or prompt_name must be specified.\n\n` +
        `Examples:\n` +
        `  skill_mcp(mcp_name="sqlite", tool_name="query", arguments='{"sql": "SELECT * FROM users"}')\n` +
        `  skill_mcp(mcp_name="memory", resource_name="memory://notes")\n` +
        `  skill_mcp(mcp_name="helper", prompt_name="summarize", arguments='{"text": "..."}')`,
    )
  }

  if (operations.length > 1) {
    const provided = [
      args.tool_name && `tool_name="${args.tool_name}"`,
      args.resource_name && `resource_name="${args.resource_name}"`,
      args.prompt_name && `prompt_name="${args.prompt_name}"`,
    ]
      .filter(Boolean)
      .join(', ')

    throw new Error(
      `Multiple operations specified. Exactly one of tool_name, resource_name, or prompt_name must be provided.\n\n` +
        `Received: ${provided}\n\n` +
        `Use separate calls for each operation.`,
    )
  }

  return operations[0]
}

function findMcpServer(
  mcpName: string,
  skills: LoadedSkill[],
): { skill: LoadedSkill; config: NonNullable<LoadedSkill["mcpConfig"]>[string] } | null {
  for (const skill of skills) {
    if (skill.mcpConfig && mcpName in skill.mcpConfig) {
      return { skill, config: skill.mcpConfig[mcpName] }
    }
  }
  return null
}

function formatAvailableMcps(skills: LoadedSkill[]): string {
  const mcps: string[] = []
  for (const skill of skills) {
    if (skill.mcpConfig) {
      for (const serverName of Object.keys(skill.mcpConfig)) {
        mcps.push(`  - "${serverName}" from skill "${skill.name}"`)
      }
    }
  }
  return mcps.length > 0 ? mcps.join('\n') : '  (none found)'
}

function parseArguments(argsJson: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!argsJson) return {}
  if (typeof argsJson === 'object' && argsJson !== null) {
    return argsJson
  }
  try {
    // Strip outer single quotes if present (common in LLM output)
    const jsonStr = typeof argsJson === 'string' && argsJson.startsWith("'") && argsJson.endsWith("'") ? argsJson.slice(1, -1) : argsJson

    const parsed = JSON.parse(jsonStr as string)
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Arguments must be a JSON object')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Invalid arguments JSON: ${errorMessage}\n\n` +
        `Expected a valid JSON object, e.g.: '{"key": "value"}'\n` +
        `Received: ${argsJson}`,
    )
  }
}

function applyGrepFilter(output: string, pattern: string | undefined): string {
  if (!pattern) return output
  try {
    const regex = new RegExp(pattern, 'i')
    const lines = output.split('\n')
    const filtered = lines.filter((line) => regex.test(line))
    return filtered.length > 0 ? filtered.join('\n') : `[grep] No lines matched pattern: ${pattern}`
  } catch {
    return output
  }
}

interface SkillMcpToolOptions {
  manager: SkillMcpManager
  getLoadedSkills: () => LoadedSkill[]
  getSessionID: () => string
}

export function registerSkillMcpTool(api: OpenClawPluginApi, options: SkillMcpToolOptions): void {
  api.logger.info(`${LOG_PREFIX} Registering skill_mcp tool`)

  const { manager, getLoadedSkills, getSessionID } = options

  api.registerTool<SkillMcpParams>({
    name: `${TOOL_PREFIX}skill_mcp`,
    description: 'Invoke MCP server operations from skill-embedded MCPs. Requires mcp_name plus exactly one of: tool_name, resource_name, or prompt_name.',
    parameters: SkillMcpParamsSchema,
    execute: async (_toolCallId: string, args: SkillMcpParams) => {
      try {
        const operation = validateOperationParams(args)
        const skills = getLoadedSkills()
        const found = findMcpServer(args.mcp_name, skills)

        if (!found) {
          return toolError(
            `MCP server "${args.mcp_name}" not found.\n\n` +
              `Available MCP servers in loaded skills:\n` +
              formatAvailableMcps(skills) +
              `\n\n` +
              `Hint: Load the skill first using the 'skill' tool, then call skill_mcp.`,
          )
        }

        const info: SkillMcpClientInfo = {
          serverName: args.mcp_name,
          skillName: found.skill.name,
          sessionID: getSessionID(),
        }

        const context: SkillMcpServerContext = {
          config: found.config,
          skillName: found.skill.name,
        }

        const parsedArgs = parseArguments(args.arguments)

        let output: string
        switch (operation.type) {
          case 'tool': {
            const result = await manager.callTool(info, context, operation.name, parsedArgs)
            output = JSON.stringify(result, null, 2)
            break
          }
          case 'resource': {
            const result = await manager.readResource(info, context, operation.name)
            output = JSON.stringify(result, null, 2)
            break
          }
          case 'prompt': {
            const stringArgs: Record<string, string> = {}
            for (const [key, value] of Object.entries(parsedArgs)) {
              stringArgs[key] = String(value)
            }
            const result = await manager.getPrompt(info, context, operation.name, stringArgs)
            output = JSON.stringify(result, null, 2)
            break
          }
        }
        return toolResponse(applyGrepFilter(output, args.grep))
      } catch (e) {
        return toolError(e instanceof Error ? e.message : String(e))
      }
    },
  })

  api.logger.info(`${LOG_PREFIX} skill_mcp tool registered successfully`)
}
