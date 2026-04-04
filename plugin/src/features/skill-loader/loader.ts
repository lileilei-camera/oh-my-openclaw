import { promises as fs } from "fs"
import { join, basename } from "path"
import yaml from "js-yaml"
import type { CommandDefinition, SkillScope, SkillMetadata, LoadedSkill, LazyContentLoader, SkillMcpConfig } from "./types.js"
import type { ClaudeCodeMcpServer } from "../claude-code-mcp-loader/types.js"

function parseSkillMcpConfigFromFrontmatter(content: string): SkillMcpConfig | undefined {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!frontmatterMatch) return undefined

  try {
    const parsed = yaml.load(frontmatterMatch[1]) as Record<string, unknown>
    if (parsed && typeof parsed === "object" && "mcp" in parsed && parsed.mcp) {
      return parsed.mcp as SkillMcpConfig
    }
  } catch {
    return undefined
  }
  return undefined
}

async function loadMcpJsonFromDir(skillDir: string): Promise<SkillMcpConfig | undefined> {
  const mcpJsonPath = join(skillDir, "mcp.json")
  
  try {
    const content = await fs.readFile(mcpJsonPath, "utf-8")
    const parsed = JSON.parse(content) as Record<string, unknown>
    
    if (parsed && typeof parsed === "object" && "mcpServers" in parsed && parsed.mcpServers) {
      return parsed.mcpServers as SkillMcpConfig
    }
    
    if (parsed && typeof parsed === "object" && !("mcpServers" in parsed)) {
      const hasCommandField = Object.values(parsed).some(
        (v) => v && typeof v === "object" && "command" in (v as Record<string, unknown>)
      )
      if (hasCommandField) {
        return parsed as SkillMcpConfig
      }
    }
  } catch {
    return undefined
  }
  return undefined
}

function parseAllowedTools(allowedTools: string | undefined): string[] | undefined {
  if (!allowedTools) return undefined
  return allowedTools.split(/\s+/).filter(Boolean)
}

function parseFrontmatter<T extends SkillMetadata>(content: string): { data: T; body: string } {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)/)
  if (!frontmatterMatch) {
    return { data: {} as T, body: content }
  }

  let data: T
  try {
    data = yaml.load(frontmatterMatch[1]) as T
  } catch {
    data = {} as T
  }

  const body = frontmatterMatch[2].trim()
  return { data, body }
}

async function loadSkillFromPath(
  skillPath: string,
  resolvedPath: string,
  defaultName: string,
  scope: SkillScope
): Promise<LoadedSkill | null> {
  try {
    const content = await fs.readFile(skillPath, "utf-8")
    const { data, body } = parseFrontmatter<SkillMetadata>(content)
    const frontmatterMcp = parseSkillMcpConfigFromFrontmatter(content)
    const mcpJsonMcp = await loadMcpJsonFromDir(resolvedPath)
    const mcpConfig = mcpJsonMcp || frontmatterMcp

    const skillName = data.name || defaultName
    const originalDescription = data.description || ""
    const formattedDescription = `(${scope} - Skill) ${originalDescription}`

    const templateContent = `<skill-instruction>
Base directory for this skill: ${resolvedPath}/
File references (@path) in this skill are relative to this directory.

${body.trim()}
</skill-instruction>

<user-request>
$ARGUMENTS
</user-request>`

    const eagerLoader: LazyContentLoader = {
      loaded: true,
      content: templateContent,
      load: async () => templateContent,
    }

    const definition: CommandDefinition = {
      name: skillName,
      description: formattedDescription,
      template: templateContent,
      model: data.model,
      agent: data.agent,
      subtask: data.subtask,
      argumentHint: data["argument-hint"],
    }

    return {
      name: skillName,
      path: skillPath,
      resolvedPath,
      definition,
      scope,
      license: data.license,
      compatibility: data.compatibility,
      metadata: data.metadata,
      allowedTools: parseAllowedTools(data["allowed-tools"]),
      mcpConfig,
      lazyContent: eagerLoader,
    }
  } catch {
    return null
  }
}

async function loadSkillsFromDir(skillsDir: string, scope: SkillScope): Promise<LoadedSkill[]> {
  const entries = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => [])
  const skills: LoadedSkill[] = []

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue

    const entryPath = join(skillsDir, entry.name)

    if (entry.isDirectory() || entry.isSymbolicLink()) {
      const resolvedPath = entry.isSymbolicLink() 
        ? await fs.readlink(entryPath).catch(() => entryPath)
        : entryPath
      const dirName = entry.name

      const skillMdPath = join(resolvedPath, "SKILL.md")
      try {
        await fs.access(skillMdPath)
        const skill = await loadSkillFromPath(skillMdPath, resolvedPath, dirName, scope)
        if (skill) skills.push(skill)
        continue
      } catch {
      }

      const namedSkillMdPath = join(resolvedPath, `${dirName}.md`)
      try {
        await fs.access(namedSkillMdPath)
        const skill = await loadSkillFromPath(namedSkillMdPath, resolvedPath, dirName, scope)
        if (skill) skills.push(skill)
      } catch {
      }
    }
  }

  return skills
}

export async function discoverBuiltinSkills(): Promise<LoadedSkill[]> {
  const builtinSkillsDir = join(process.cwd(), "plugin", "skills")
  return loadSkillsFromDir(builtinSkillsDir, "builtin")
}

export async function discoverUserSkills(): Promise<LoadedSkill[]> {
  const homeDir = process.env["HOME"] ?? process.env["USERPROFILE"] ?? ""
  if (!homeDir) return []
  
  const userSkillsDir = join(homeDir, ".openclaw", "skills")
  return loadSkillsFromDir(userSkillsDir, "user")
}

export async function discoverProjectSkills(projectDir: string): Promise<LoadedSkill[]> {
  const projectSkillsDir = join(projectDir, ".openclaw", "skills")
  return loadSkillsFromDir(projectSkillsDir, "project")
}

export function mergeSkills(...skillArrays: LoadedSkill[][]): LoadedSkill[] {
  const skillMap = new Map<string, LoadedSkill>()
  
  for (const skills of skillArrays) {
    for (const skill of skills) {
      if (!skillMap.has(skill.name)) {
        skillMap.set(skill.name, skill)
      }
    }
  }
  
  return Array.from(skillMap.values())
}

export { parseFrontmatter }
