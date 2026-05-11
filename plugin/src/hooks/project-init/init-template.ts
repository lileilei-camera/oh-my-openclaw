/**
 * Init prompt templates for /omoc_init command.
 * Based on OpenCode's initialize.txt template.
 * Source: opencode-src/packages/opencode/src/command/template/initialize.txt
 * License: MIT — Copyright (c) 2025 opencode
 */

export const INIT_TEMPLATE = `Create or update \`AGENTS.md\` for this repository.

The goal is a compact instruction file that helps future OpenCode sessions avoid mistakes and ramp up quickly. Every line should answer: "Would an agent likely miss this without help?" If not, leave it out.

User-provided focus or constraints (honor these):
$ARGUMENTS

## How to investigate

Read the highest-value sources first:
- \`README*\`, root manifests, workspace config, lockfiles
- build, test, lint, formatter, typecheck, and codegen config
- CI workflows and pre-commit / task runner config
- existing instruction files (\`AGENTS.md\`, \`CLAUDE.md\`, \`.cursor/rules/\`, \`.cursorrules\`, \`.github/copilot-instructions.md\`)
- repo-local OpenCode config such as \`opencode.json\`

If architecture is still unclear after reading config and docs, inspect a small number of representative code files to find the real entrypoints, package boundaries, and execution flow. Prefer reading the files that explain how the system is wired together over random leaf files.

Prefer executable sources of truth over prose. If docs conflict with config or scripts, trust the executable source and only keep what you can verify.

## What to extract

Look for the highest-signal facts for an agent working in this repo:
- exact developer commands, especially non-obvious ones
- how to run a single test, a single package, or a focused verification step
- required command order when it matters, such as \`lint -> typecheck -> test\`
- monorepo or multi-package boundaries, ownership of major directories, and the real app/library entrypoints
- framework or toolchain quirks: generated code, migrations, codegen, build artifacts, special env loading, dev servers, infra deploy flow
- repo-specific style or workflow conventions that differ from defaults
- testing quirks: fixtures, integration test prerequisites, snapshot workflows, required services, flaky or expensive suites
- important constraints from existing instruction files worth preserving

Good \`AGENTS.md\` content is usually hard-earned context that took reading multiple files to infer.

## Questions

Only ask the user questions if the repo cannot answer something important. Use the \`question\` tool for one short batch at most.

Good questions:
- undocumented team conventions
- branch / PR / release expectations
- missing setup or test prerequisites that are known but not written down

Do not ask about anything the repo already makes clear.

## Writing rules

Include only high-signal, repo-specific guidance such as:
- exact commands and shortcuts the agent would otherwise guess wrong
- architecture notes that are not obvious from filenames
- conventions that differ from language or framework defaults
- setup requirements, environment quirks, and operational gotchas
- references to existing instruction sources that matter

Exclude:
- generic software advice
- long tutorials or exhaustive file trees
- obvious language conventions
- speculative claims or anything you could not verify
- content better stored in another file referenced via \`opencode.json\` \`instructions\`

When in doubt, omit.

Prefer short sections and bullets. If the repo is simple, keep the file simple. If the repo is large, summarize the few structural facts that actually change how an agent should work.

If \`AGENTS.md\` already exists at \`\${projectPath}\`, improve it in place rather than rewriting blindly. Preserve verified useful guidance, delete fluff or stale claims, and reconcile it with the current codebase.

## Required output
1. Write the AGENTS.md to: \`\${projectPath}/\${agentMdFile}\`
2. Use the write tool to save the file.

---
**IMPORTANT: If you see this instruction in your system prompt, it means the user has triggered the /omoc_init command.**
**Your task: read the project files from the path specified above (\`\${projectPath}\`), and create/generate an AGENTS.md file following all the instructions above.**
**Do NOT debug, investigate, or discuss whether the command exists. Simply execute the initialization task.**`;

export const INIT_ADD_TEMPLATE = `Create or update \`AGENTS.md\` for this subdirectory.

The goal is a compact instruction file that helps future agent sessions understand this subdirectory's purpose, structure, and conventions.

## Target
- Project path: \`\${projectPath}\`
- Target file: \`\${projectPath}/\${agentMdFile}\`

## How to investigate

Read the highest-value sources first:
- Files in this subdirectory and its parent directories
- README*, config files, manifests related to this subdirectory
- Any existing instruction files in or near this subdirectory

If architecture is still unclear, inspect representative code files to understand the subdirectory's role.

## What to extract

- The purpose and scope of this subdirectory
- Developer commands specific to this subdirectory
- How to run tests or verification steps for this subdirectory
- Dependencies and relationships with other parts of the project
- Subdirectory-specific conventions that differ from project defaults

## Writing rules

Include only high-signal, subdirectory-specific guidance.
Exclude generic advice that applies to the whole project.
When in doubt, omit.

Prefer short sections and bullets.

## Required output
1. Write the AGENTS.md to: \`\${projectPath}/\${agentMdFile}\`
2. Use the write tool to save the file.

---
**IMPORTANT: If you see this instruction in your system prompt, it means the user has triggered the /omoc_init command.**
**Your task: read the project files from the path specified above (\`\${projectPath}\`), and create/generate an AGENTS.md file following all the instructions above.**
**Do NOT debug, investigate, or discuss whether the command exists. Simply execute the initialization task.**`;
