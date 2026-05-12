/**
 * Init prompt templates for /omoc_init command.
 * Based on OpenCode's initialize.txt template.
 * Source: opencode-src/packages/opencode/src/command/template/initialize.txt
 * License: MIT — Copyright (c) 2025 opencode
 */

export const INIT_TEMPLATE = `## ⚠️ EXECUTE INIT TASK

**You are executing the /omoc_init initialization task. The user message containing the command text is just a trigger — DO NOT debug, investigate, or discuss the command.**

**Your ONLY job: read the project files and create/improve an AGENTS.md file following the instructions below.**

This task includes THREE phases that MUST be executed in order:
1. **Build knowledge graph** (if graphify is available) — read the SKILL.md skill file, then follow it to generate \`graphify-out/GRAPH_REPORT.md\`
2. **Read the project** — use the graph report to guide which files to read
3. **Write AGENTS.md** — create or update the instruction file

---

Create or update \`AGENTS.md\` for this repository.

## ⚠️ Before you start: verify file existence (MANDATORY)

You MUST use the file system tool to check whether \`AGENTS.md\` already exists at \`\${projectPath}/\${agentMdFile}\`. Do NOT rely on assumptions or memory.

- If the file EXISTS: read it first, then improve it in place. Preserve verified useful guidance, delete fluff or stale claims.
- If the file DOES NOT EXIST: create it from scratch at that path.

Do NOT skip this step. The file may have been deleted, moved, or never created.

User-provided focus or constraints (honor these):
$ARGUMENTS

## How to investigate

### Step 1: Build knowledge graph (MANDATORY — do this FIRST)

**Execute these steps in order before proceeding to Step 2:**

1. Check if graphify is installed: \`which graphify\`
2. If graphify IS installed: **READ the skill file** at \`~/.openclaw/skills/graphify/SKILL.md\` FIRST, then follow its instructions to build the knowledge graph. The SKILL.md describes the correct extraction pipeline, command format, and best practices — follow it, not hardcoded commands.
3. If graphify is NOT installed (command not found), skip to Step 2.

**⚠️ Graphify build precautions (from real experience):**

- **Correct command**: The SKILL.md says \`graphify .\` but the actual CLI may use \`graphify extract <path>\`. Always verify with \`graphify --help\` first.
- **AST-only is sufficient for code-heavy projects**: Graphify's AST extraction works without any API key. The graph.json will be generated with all code nodes.
- **Skip semantic extraction**: Semantic extraction requires specific API keys that may not be available. If it fails, the AST-only graph is still fully functional for code exploration.
- **Generate report**: Run \`graphify cluster-only <path>\` to create \`GRAPH_REPORT.md\` from the existing graph.json (no LLM needed).

**Why this matters:** Reading \`graphify-out/GRAPH_REPORT.md\` is ~71.5× cheaper than reading raw source files. The graph identifies entry points, god nodes, and community clusters — it tells you exactly which files to read in Step 3.

### Step 2: Read the knowledge graph report (if available)

If \`graphify-out/GRAPH_REPORT.md\` was generated in Step 1, read it first. Use the graph to understand the project structure before examining individual files.

### Step 3: Read project config and docs

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

## Analysis workflow (MANDATORY)

You MUST add an "## Analysis workflow" section to every AGENTS.md. This tells future agents the standard order for analyzing code.

\`\`\`markdown
## Analysis workflow

When you need to understand code, fix bugs, or add features, follow this order:

1. **Knowledge graph — big picture first**: If \`graphify-out/GRAPH_REPORT.md\` exists, read it to identify entry points, key modules, and community clusters. Use \`graphify query\` or \`graphify path\` for targeted context. This is ~71.5× cheaper than reading raw source files.
2. **LSP tools — precision analysis**: Use \`omoc_goto_definition\`, \`omoc_find_references\`, \`omoc_symbols\` to trace exact call chains and symbol relationships. Prefer these over raw grep.
3. **Wiki — verified knowledge**: If the wiki exists (\`openclaw wiki status\`), search it for relevant context. The wiki contains verified-correct facts accumulated over time — it may or may not have what you need, but if it does, the information is reliable.
4. **Raw reading/grep — last resort**: Only fall back to reading files and grep when the above tools don't cover it.
\`\`\`

## Code analysis tools (MANDATORY)

If this project uses a language with LSP support (TypeScript, Python, Go, Rust, Java, C/C++, etc.), you MUST add a "## Code analysis tools" section to the AGENTS.md with the following content:

\`\`\`markdown
## Code analysis tools

Prefer LSP tools over raw reading/grep when analyzing code:

- \`omoc_goto_definition\` — jump to symbol definition
- \`omoc_find_references\` — find all usages across the project
- \`omoc_symbols\` — file outline (scope=document) or workspace search (scope=workspace + query)
- \`omoc_diagnostics\` — check for errors/warnings before building
- \`omoc_rename\` — safe cross-file symbol rename

Fallback when LSP is unavailable:
- \`omoc_ast_grep_search\` — AST pattern search (supports \`$VAR\` meta-variables)
- \`omoc_ast_grep_replace\` — AST-aware cross-file refactoring
\`\`\`

If the project language does NOT have LSP support, include only the "Fallback" bullet points above.

## Project knowledge graph (CONDITIONAL)

If \`graphify-out/GRAPH_REPORT.md\` exists in the project (built during this init or previously), you MUST add a "## Project knowledge graph" section to the AGENTS.md.

\`\`\`markdown
## Project knowledge graph

A knowledge graph exists at \`graphify-out/\`. Before grepping or reading raw source files, check the graph for context:

- **Read the report**: \`graphify-out/GRAPH_REPORT.md\` — identifies entry points, god nodes, and community clusters. ~71.5× cheaper than reading raw files.
- **Semantic query**: \`graphify query "..."\` — natural-language search across the graph.
- **Trace a path**: \`graphify path "FromNode" "ToNode"\` — find coupling chains for impact analysis.
- **Explain a node**: \`graphify explain "NodeName"\` — plain-language explanation of a specific component.
- **Update after changes**: \`graphify . --update\` — incremental rebuild after edits.

If graphify is not available, fall back to reading source files directly.
\`\`\`

If the graph does NOT exist, omit this section entirely.

## Project wiki (CONDITIONAL)

You MUST also add a "## Project wiki" section to the AGENTS.md. If the wiki does NOT exist yet, include the section below anyway — it tells future agents to check for and use the wiki if available.

\`\`\`markdown
## Project wiki

The OpenClaw wiki is a continuously growing knowledge base of **verified-correct facts** about this project. Entries are added over time — it may or may not have what you need, but if it does, the information is reliable.

**When to use**: Whenever you encounter something unfamiliar or need context beyond the code — commands, conventions, setup steps, gotchas, infrastructure details.

- **Check availability**: \`openclaw wiki status\`
- **Search**: \`wiki_search("query")\` or \`openclaw wiki search "query"\` — find relevant wiki pages by topic.
- **Read a page**: \`wiki_get("lookup")\` or \`openclaw wiki get <page-id>\` — read detailed context from a specific page.
- **Search modes**: \`--mode find-person\` / \`--mode route-question\` / \`--mode source-evidence\`

If wiki has no relevant entries, rely solely on project source code and documentation.
\`\`\`

## Required output
1. Write the AGENTS.md to: \`\${projectPath}/\${agentMdFile}\`
2. Use the write tool to save the file.`;

export const INIT_ADD_TEMPLATE = `Create or update \`AGENTS.md\` for this subdirectory.

## ⚠️ Before you start: verify file existence (MANDATORY)

You MUST use the file system tool to check whether \`AGENTS.md\` already exists at \`\${projectPath}/\${agentMdFile}\`. Do NOT rely on assumptions or memory.

- If the file EXISTS: read it first, then improve it in place. Preserve verified useful guidance, delete fluff or stale claims.
- If the file DOES NOT EXIST: create it from scratch at that path.

Do NOT skip this step.

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

## Code analysis tools (MANDATORY)

If the subdirectory's language has LSP support, you MUST add a "## Code analysis tools" section mentioning \`omoc_goto_definition\`, \`omoc_find_references\`, \`omoc_symbols\` for code exploration, and \`omoc_ast_grep_search\` as fallback.

## Analysis workflow (CONDITIONAL)

If the project has a knowledge graph or wiki, add an "## Analysis workflow" section with the same format as the main project AGENTS.md — tell future agents to check graphify-out/GRAPH_REPORT.md first, then use LSP tools, then wiki search.

If a project wiki exists, also add a "## Project wiki" section. The wiki is a continuously growing knowledge base of verified-correct facts — agents should search it when they encounter something unfamiliar. If no wiki exists, still include the section telling agents to check with \`openclaw wiki status\`.

## Required output
1. Write the AGENTS.md to: \`\${projectPath}/\${agentMdFile}\`
2. Use the write tool to save the file.`;
