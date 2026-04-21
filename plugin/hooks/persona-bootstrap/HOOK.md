---
name: persona-bootstrap
description: Inject persona content into AGENTS.md via agent:bootstrap internal hook
events:
  - agent:bootstrap
---

# Persona Bootstrap Hook

Injects active persona content into the AGENTS.md bootstrap file at runtime.

Reads `.omoc-state/active-persona` to determine which persona is active,
then replaces the AGENTS.md content with the corresponding persona prompt.
