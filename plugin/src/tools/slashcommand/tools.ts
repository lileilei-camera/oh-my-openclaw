import { Type } from "@sinclair/typebox"
import { readFileSync, existsSync, readdirSync } from "fs"
import { join, basename } from "path"
import { homedir } from "os"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { SlashcommandArgs, CommandInfo } from "./types.js"
import { SLASHCOMMAND_DESCRIPTION } from "./constants.js"
import { toolResponse, toolError } from "../../utils/helpers.js"
import { TOOL_PREFIX, LOG_PREFIX } from "../../constants.js"
import { parseFrontmatter } from "../../shared/frontmatter.js"

const LOG_PREFIX_CMD = `${LOG_PREFIX}[slashcommand]`

function discoverCommandsFromDir(commandsDir: string, scope: "user" | "project" | "builtin"): CommandInfo[] {
  if (!existsSync(commandsDir)) {
    return []
  }

  const commands: CommandInfo[] = []

  try {
    const entries = readdirSync(commandsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name.startsWith(".")) {
        continue
      }

      const commandPath = join(commandsDir, entry.name)
      const commandName = basename(entry.name, ".md")

      try {
        const content = readFileSync(commandPath, "utf-8")
        const { data, body } = parseFrontmatter(content)

        commands.push({
          name: commandName,
          description: (data as any).description || "",
          template: body,
          agent: (data as any).agent,
          model: (data as any).model,
          subtask: (data as any).subtask,
          scope,
        })
      } catch {
        continue
      }
    }
  } catch {
    return []
  }

  return commands
}

function discoverAllCommands(api: OpenClawPluginApi): CommandInfo[] {
  const commands: CommandInfo[] = []

  // User commands: ~/.claude/commands/
  const userCommandsDir = join(homedir(), ".claude", "commands")
  commands.push(...discoverCommandsFromDir(userCommandsDir, "user"))

  // Project commands: ./.claude/commands/
  const projectCommandsDir = join(process.cwd(), ".claude", "commands")
  commands.push(...discoverCommandsFromDir(projectCommandsDir, "project"))

  // Skills as commands: ~/.openclaw/skills/
  const skillsDir = join(homedir(), ".openclaw", "skills")
  if (existsSync(skillsDir)) {
    try {
      const skillEntries = readdirSync(skillsDir, { withFileTypes: true })
      for (const entry of skillEntries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) {
          continue
        }

        const skillPath = join(skillsDir, entry.name, "SKILL.md")
        if (existsSync(skillPath)) {
          try {
            const content = readFileSync(skillPath, "utf-8")
            const { data, body } = parseFrontmatter(content)

            commands.push({
              name: entry.name,
              description: (data as any).description || "",
              template: body,
              agent: (data as any).agent,
              model: (data as any).model,
              subtask: (data as any).subtask,
              scope: "user",
            })
          } catch {
            continue
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return commands
}

export function registerSlashcommandTool(api: OpenClawPluginApi) {
  api.registerTool({
    name: `${TOOL_PREFIX}slashcommand`,
    description: SLASHCOMMAND_DESCRIPTION,
    parameters: Type.Object({
      name: Type.String({
        description: "Command name to execute (without / prefix)",
      }),
      arguments: Type.Optional(
        Type.String({
          description: "Arguments to pass to the command",
        })
      ),
    }),
    async execute(_toolCallId: string, args: SlashcommandArgs) {
      try {
        api.logger.info(`${LOG_PREFIX_CMD} Executing command: ${args.name}`)

        if (!args.name?.trim()) {
          return toolError("Command name is required")
        }

        // Discover all available commands
        const allCommands = discoverAllCommands(api)
        const command = allCommands.find((cmd) => cmd.name.toLowerCase() === args.name.toLowerCase())

        if (!command) {
          const availableCommands = allCommands.map((c) => c.name).join(", ")
          return toolError(
            `Command not found: ${args.name}. Available: ${availableCommands || "none"}`
          )
        }

        // Build final prompt with arguments
        let finalPrompt = command.template
        if (args.arguments) {
          finalPrompt = `${command.template}\n\nArguments: ${args.arguments}`
        }

        api.logger.info(`${LOG_PREFIX_CMD} Command found: ${command.name} (${command.scope})`)

        // If command has agent, delegate to it
        if (command.agent && command.subtask) {
          const agentId = command.agent.startsWith("omoc_")
            ? command.agent
            : `omoc_${command.agent.toLowerCase()}`

          const result = await api.spawnSubagent({
            task: finalPrompt,
            agentId: agentId,
            mode: "run",
            thread: false,
            label: `Command: ${command.name}`,
            cleanup: "delete",
            model: command.model,
          })

          if (!result.success) {
            return toolError(`Failed to execute command: ${result.error}`)
          }

          return toolResponse(`Command executed successfully.

**Command**: ${command.name}
**Agent**: ${agentId}
**Scope**: ${command.scope}

**Output**:
${result.output || "Completed with no output"}`)
        }

        // Otherwise, return the template for execution
        return toolResponse(`Command template ready.

**Command**: ${command.name}
**Description**: ${command.description}
**Scope**: ${command.scope}
${command.agent ? `**Agent**: ${command.agent}` : ""}
${command.model ? `**Model**: ${command.model}` : ""}

**Template**:
${finalPrompt}

Execute this template or delegate to an agent.`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        api.logger.error(`${LOG_PREFIX_CMD} Error: ${errorMessage}`)
        return toolError(`Failed to execute command: ${errorMessage}`)
      }
    },
  })

  api.logger.info(`${LOG_PREFIX_CMD} slashcommand tool registered successfully`)
}
