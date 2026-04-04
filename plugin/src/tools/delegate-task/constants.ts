export const VISUAL_CATEGORY_PROMPT_APPEND = `<Category_Context>
You are working on VISUAL/UI tasks.

Design-first mindset:
- Bold aesthetic choices over safe defaults
- Unexpected layouts, asymmetry, grid-breaking elements
- Distinctive typography (avoid: Arial, Inter, Roboto, Space Grotesk)
- Cohesive color palettes with sharp accents
- High-impact animations with staggered reveals
- Atmosphere: gradient meshes, noise textures, layered transparencies

AVOID: Generic fonts, purple gradients on white, predictable layouts, cookie-cutter patterns.
</Category_Context>`

export const STRATEGIC_CATEGORY_PROMPT_APPEND = `<Category_Context>
You are working on BUSINESS LOGIC / ARCHITECTURE tasks.

Strategic advisor mindset:
- Bias toward simplicity: least complex solution that fulfills requirements
- Leverage existing code/patterns over new components
- Prioritize developer experience and maintainability
- One clear recommendation with effort estimate (Quick/Short/Medium/Large)
- Signal when advanced approach warranted

Response format:
- Bottom line (2-3 sentences)
- Action plan (numbered steps)
- Risks and mitigations (if relevant)
</Category_Context>`

export const ARTISTRY_CATEGORY_PROMPT_APPEND = `<Category_Context>
You are working on HIGHLY CREATIVE / ARTISTIC tasks.

Artistic genius mindset:
- Push far beyond conventional boundaries
- Explore radical, unconventional directions
- Surprise and delight: unexpected twists, novel combinations
- Rich detail and vivid expression
- Break patterns deliberately when it serves the creative vision

Approach:
- Generate diverse, bold options first
- Embrace ambiguity and wild experimentation
- Balance novelty with coherence
- This is for tasks requiring exceptional creativity
</Category_Context>`

export const QUICK_CATEGORY_PROMPT_APPEND = `<Category_Context>
You are working on SMALL / QUICK tasks.

Efficient execution mindset:
- Fast, focused, minimal overhead
- Get to the point immediately
- No over-engineering
- Simple solutions for simple problems

Approach:
- Minimal viable implementation
- Skip unnecessary abstractions
- Direct and concise
</Category_Context>`

export const UNSPECIFIED_LOW_CATEGORY_PROMPT_APPEND = `<Category_Context>
You are working on tasks that don't fit specific categories but require moderate effort.
</Category_Context>`

export const UNSPECIFIED_HIGH_CATEGORY_PROMPT_APPEND = `<Category_Context>
You are working on tasks that don't fit specific categories but require substantial effort.
</Category_Context>`

export const WRITING_CATEGORY_PROMPT_APPEND = `<Category_Context>
You are working on WRITING / PROSE tasks.

Wordsmith mindset:
- Clear, flowing prose
- Appropriate tone and voice
- Engaging and readable
- Proper structure and organization

Approach:
- Understand the audience
- Draft with care
- Polish for clarity and impact
- Documentation, READMEs, articles, technical writing
</Category_Context>`

export const DEFAULT_CATEGORY_AGENTS: Record<string, string> = {
  quick: "omoc_sisyphus",
  deep: "omoc_hephaestus",
  ultrabrain: "omoc_oracle",
  "visual-engineering": "omoc_frontend",
  multimodal: "omoc_looker",
  artistry: "omoc_hephaestus",
  "unspecified-low": "omoc_sisyphus",
  "unspecified-high": "omoc_hephaestus",
  writing: "omoc_sisyphus",
}

export const DEFAULT_CATEGORY_MODELS: Record<string, string> = {
  quick: "bailian/qwen3-coder-plus",
  deep: "bailian/qwen3-coder-plus",
  ultrabrain: "bailian/qwen3-max-2026-01-23",
  "visual-engineering": "bailian/kimi-k2.5",
  multimodal: "bailian/kimi-k2.5",
  artistry: "bailian/qwen3-coder-plus",
  "unspecified-low": "bailian/qwen3-coder-plus",
  "unspecified-high": "bailian/qwen3-coder-plus",
  writing: "bailian/qwen3-coder-plus",
}

export const CATEGORY_PROMPT_APPENDS: Record<string, string> = {
  "visual-engineering": VISUAL_CATEGORY_PROMPT_APPEND,
  ultrabrain: STRATEGIC_CATEGORY_PROMPT_APPEND,
  artistry: ARTISTRY_CATEGORY_PROMPT_APPEND,
  quick: QUICK_CATEGORY_PROMPT_APPEND,
  "unspecified-low": UNSPECIFIED_LOW_CATEGORY_PROMPT_APPEND,
  "unspecified-high": UNSPECIFIED_HIGH_CATEGORY_PROMPT_APPEND,
  writing: WRITING_CATEGORY_PROMPT_APPEND,
}

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  quick: "Trivial tasks - single file changes, typo fixes, simple modifications",
  deep: "Complex implementation tasks requiring substantial effort",
  ultrabrain: "Deep logical reasoning, complex architecture decisions requiring extensive analysis",
  "visual-engineering": "Frontend, UI/UX, design, styling, animation",
  multimodal: "Tasks requiring image/video/audio analysis",
  artistry: "Highly creative/artistic tasks, novel ideas",
  "unspecified-low": "Tasks that don't fit other categories, low effort required",
  "unspecified-high": "Tasks that don't fit other categories, high effort required",
  writing: "Documentation, prose, technical writing",
}
