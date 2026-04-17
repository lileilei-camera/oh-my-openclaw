---
name: openclaw-look-at
description: OpenClaw native multimodal analysis skill. Analyzes PDFs, images, screenshots, and diagrams using built-in `image`/`pdf`/`read` tools. No external API key required.
---

# OpenClaw Look-At — Native Multimodal Analysis

Replaces Gemini CLI dependency with OpenClaw's built-in tools.
**No API key needed** — uses the model's native multimodal capabilities directly.

## When to Use

- **PDF Analysis** — Evaluate layout, design, content quality
- **Image/Screenshot Analysis** — UI review, bug verification, design feedback
- **Diagram Interpretation** — Analyze architecture, flowcharts, ER diagrams
- **Multi-file Comparison** — Compare two PDFs/images simultaneously
- **OCR + Interpretation** — Extract text from screenshots + semantic analysis

## Available Tools by File Type

| File Type | Tool | Usage |
|-----------|------|-------|
| Images (JPG/PNG/GIF/WebP) | `image` | `image(image: "path/to/file.png", prompt: "analyze this")` |
| PDF documents | `pdf` | `pdf(pdf: "path/to/file.pdf", prompt: "analyze this")` |
| Text/Code files | `read` | `read(path: "path/to/file.ts")` |
| URLs (web pages) | `web_fetch` | `web_fetch(url: "https://example.com")` |

## Execution Methods

### Method 1: Image Analysis

```
# Ask the AI to analyze an image
image(image: "/path/to/screenshot.png", prompt: "Analyze this UI screenshot. Check layout, spacing, and design quality.")
```

Supported formats: JPG, JPEG, PNG, GIF, WebP, BMP, SVG
The image is sent as an attachment to the vision model for analysis.

### Method 2: PDF Analysis

```
# Ask the AI to analyze a PDF
pdf(pdf: "/path/to/document.pdf", prompt: "Evaluate the layout, font size, line spacing, and page breaks.")
```

The PDF tool can:
- Extract and analyze text content
- Understand document structure
- Answer questions about specific sections

### Method 3: Multiple File Comparison

For comparing two images, ask the AI to analyze both:

```
Compare these two screenshots and list the differences:
- Image 1: /path/to/before.png
- Image 2: /path/to/after.png
```

The AI will use the `image` tool for each file and provide a comparison.

### Method 4: Look-At Plugin Tool

The plugin registers `omoc_look_at` which wraps OpenClaw tools:

```
omoc_look_at(
  file_path: "/path/to/file.pdf",
  goal: "Analyze layout and design quality"
)
```

This tool:
1. Detects file type automatically
2. Calls the appropriate OpenClaw tool
3. Returns analysis results

## Analysis Prompts by Pattern

### PDF Layout/Design Review

```
Evaluate this PDF's layout, line breaks, and design.
Check: margins, font size, line spacing, page breaks, table/image placement.
```

### Screenshot UI Review

```
Analyze this web UI screenshot.
1. Layout alignment and spacing consistency
2. Typography hierarchy
3. Color contrast and accessibility
4. Visibility of interactive elements
5. Overall design quality (1-10 score)
Provide specific improvement suggestions.
```

### Architecture Diagram Interpretation

```
Analyze this architecture diagram.
- Identify the role of each component
- Explain data flow direction
- Identify potential bottlenecks or single points of failure
- Suggest improvements
```

### Before/After Comparison

```
Compare these two images.
- List specific changes
- Distinguish improvements from regressions
- Suggest additional improvements
```

### Error Screenshot Debugging

```
Analyze this error screenshot.
- Read the error message accurately
- Estimate possible causes
- Suggest solutions
```

## Model Selection Guide

| Use Case | Recommended Model Category | Reason |
|----------|---------------------------|--------|
| Quick check | quick (claude-sonnet-4-6) | Fast, good multimodal capability |
| Detailed analysis | deep (claude-opus-4-6-thinking) | Deeper analysis, longer content |
| Visual engineering | visual-engineering (claude-opus-4-6-thinking) | Best for UI/design work |

## OpenClaw Native vs Gemini CLI

| Feature | OpenClaw Built-in | Gemini CLI |
|---------|-------------------|------------|
| Images (PNG/JPG) | ✅ Native vision model | ✅ Native analysis |
| PDF | ✅ Text extraction + analysis | ✅ Layout-inclusive analysis |
| Video | ❌ (not yet) | ✅ Frame analysis |
| Multiple files | ✅ Ask AI to analyze multiple | ✅ Multiple `-f` flags |
| Authentication | Not required | Required |
| API Key | Not required | Required |

## Workflow: OpenClaw + Native Multimodal

When visual verification is needed during coding work:

```
1. Write/modify code in OpenClaw
2. Generate build/render results (PDF, screenshots, etc.)
3. Verify visual quality with image/pdf tools
4. On issues found → return to code to fix
5. Repeat (until satisfied with results)
```

## Cautions

- Use absolute paths for files
- Response wait time: 5-30 seconds depending on file size
- For very large PDFs, specify page ranges to reduce processing time
- The `image` tool supports most common image formats
- The `pdf` tool extracts text content; for visual layout analysis, describe what you're looking for in the prompt
