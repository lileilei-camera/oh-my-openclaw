import { readFileSync } from "node:fs"
import type { LoadedSkill } from "./types.js"
import { parseFrontmatter } from "./loader.js"

const cachedSkills: LoadedSkill[] | null = null

function clearSkillCache(): void {
  // No-op for now
}

export async function getAllSkills(): Promise<LoadedSkill[]> {
  // For now, return empty array - skills will be loaded by the plugin
  // This is a placeholder - actual implementation depends on plugin architecture
  return []
}

export async function extractSkillTemplate(skill: LoadedSkill): Promise<string> {
  if (skill.path) {
    const content = readFileSync(skill.path, "utf-8")
    const { body } = parseFrontmatter(content)
    return body.trim()
  }
  return skill.definition.template || ""
}

export { clearSkillCache }

export function injectGitMasterConfig(template: string, config?: any): string {
  // Placeholder - implement if needed
  return template
}
