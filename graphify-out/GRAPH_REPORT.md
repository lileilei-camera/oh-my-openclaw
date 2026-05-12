# Graph Report - oh-my-openclaw  (2026-05-12)

## Corpus Check
- 151 files · ~136,285 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 564 nodes · 1325 edges · 20 communities detected
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `895cc2c2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 20|Community 20]]

## God Nodes (most connected - your core abstractions)
1. `register()` - 44 edges
2. `SkillMcpManager` - 28 edges
3. `toolResponse()` - 23 edges
4. `LSPClient` - 23 edges
5. `toolError()` - 21 edges
6. `getPluginConfig()` - 18 edges
7. `readState()` - 15 edges
8. `ContextCollector` - 15 edges
9. `createMockApi()` - 12 edges
10. `install()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `register()` --calls--> `registerSlashcommandTool()`  [INFERRED]
  plugin/src/index.ts → plugin/src/tools/slashcommand/tools.ts
- `register()` --calls--> `registerLookAtTool()`  [INFERRED]
  plugin/src/index.ts → plugin/src/tools/look-at/tools.ts
- `register()` --calls--> `registerSessionListTool()`  [INFERRED]
  plugin/src/index.ts → plugin/src/tools/session-manager/tools.ts
- `register()` --calls--> `registerSessionReadTool()`  [INFERRED]
  plugin/src/index.ts → plugin/src/tools/session-manager/tools.ts
- `register()` --calls--> `registerLspGotoDefinitionTool()`  [INFERRED]
  plugin/src/index.ts → plugin/src/tools/lsp/tools.ts

## Communities (33 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (26): formatGlobResult(), getCachedTmuxPath(), getTmuxPath(), startBackgroundCheck(), registerLookAtTool(), extractSessionId(), findSessionFile(), getAgentsDir() (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (35): registerBackgroundTaskTool(), registerCallOmoAgentTool(), registerSetupCli(), registerInitCommands(), registerRalphCommands(), registerStatusCommands(), registerTodoCommands(), registerDelegateTaskTool() (+27 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (27): extractSpawnResult(), findTrackedSubagentInContent(), registerSubagentTracker(), clearSession(), registerAgentEndReminder(), registerSessionCleanup(), registerTodoReminder(), resetTodoReminderCounters() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (27): clearPersonaCache(), listPersonas(), readPersonaPrompt(), readPersonaPromptSync(), resolvePersonaId(), extractAgentIdFromSessionKey(), getDisplayName(), registerPersonaCommands() (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (28): mergeMcpServers(), readMcporterConfig(), resolveMcporterConfigPath(), runMcporterSetup(), writeMcporterConfig(), applyProviderPreset(), buildCustomPreset(), getProviderNames() (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (22): ensureCliAvailable(), getAstGrepPath(), isCliAvailable(), runSg(), startBackgroundInit(), checkEnvironment(), findSgCliPathSync(), getPlatformPackageName() (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (5): expandEnvVarsInObject(), expandEnvVarsInString(), createCleanMcpEnvironment(), getConnectionType(), SkillMcpManager

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (7): ContextCollector, registerCommentChecker(), registerContextInjector(), classifyAgentRole(), getEnforcerState(), registerTodoEnforcer(), resetEnforcerState()

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (22): findServerForExtension(), getAllServers(), getConfigPaths(), getLanguageId(), getMergedServers(), getOpenClawConfigDir(), isServerInstalled(), loadAllConfigs() (+14 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (12): extractAgentIdFromSessionKey(), registerModeCommands(), resolveWorkspaceForAgent(), registerModeSwitch(), getModeMessage(), isValidMode(), listModes(), getActiveModeSync() (+4 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (15): discoverBuiltinSkills(), discoverProjectSkills(), discoverUserSkills(), loadMcpJsonFromDir(), loadSkillFromPath(), loadSkillsFromDir(), mergeSkills(), parseAllowedTools() (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (16): addAgentMdToProject(), addProject(), clearPendingInit(), defaultState(), findProjectByName(), findProjectByPath(), getActiveProject(), getPendingInit() (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.19
Nodes (12): buildArgs(), buildGrepArgs(), buildRgArgs(), parseCountOutput(), parseOutput(), runRg(), runRgCount(), findExecutable() (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.38
Nodes (12): commandExists(), dim(), fail(), heading(), info(), initWorkspace(), install(), isSymlink() (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.35
Nodes (8): buildFindArgs(), buildPowerShellCommand(), buildRgArgs(), getFileMtime(), runRgFiles(), findExecutable(), resolveGrepCli(), resolveGrepCliWithAutoInstall()

### Community 16 - "Community 16"
Cohesion: 0.38
Nodes (3): loadHandler(), main(), test()

### Community 17 - "Community 17"
Cohesion: 0.6
Nodes (5): getCliConfigDir(), getOpenCodeConfigDir(), getOpenCodeConfigPaths(), getTauriConfigDir(), isDevBuild()

### Community 18 - "Community 18"
Cohesion: 0.6
Nodes (3): isSymbolicLink(), resolveSymlink(), resolveSymlinkAsync()

### Community 20 - "Community 20"
Cohesion: 0.6
Nodes (3): extractAgentIdFromSessionKey(), personaBootstrapHandler(), readPersonaContent()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SkillMcpManager` connect `Community 7` to `Community 0`, `Community 1`, `Community 11`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `LSPClient` connect `Community 6` to `Community 9`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `register()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 5`, `Community 8`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Are the 43 inferred relationships involving `register()` (e.g. with `getPluginConfig()` and `initPersonaState()`) actually correct?**
  _`register()` has 43 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `toolResponse()` (e.g. with `handleSave()` and `handleLoad()`) actually correct?**
  _`toolResponse()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `toolError()` (e.g. with `handleLoad()` and `handleList()`) actually correct?**
  _`toolError()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._