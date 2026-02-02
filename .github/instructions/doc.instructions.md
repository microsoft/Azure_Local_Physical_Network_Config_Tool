---
applyTo: '**/*.md'
---

# DOC Workflow

**Trigger:** "doc", "refine", "update doc", documentation refinement.

## Process

1. **Identify doc type** and overlap with existing (>50% = merge)
2. **Structure:** Summary → Overview → Definitions → Content → Validation
3. **Add diagrams** before complex explanations
4. **Remove redundancy**
5. **Code blocks** must have language tags

## Rules

- Edit in place, never create backups/v2
- Merge overlapping content into single source
- Terms defined on first use
- One H1 per file

## Formatting Standards

### Callouts

```markdown
> [!NOTE]
> Informational note

> [!TIP]
> Helpful suggestion

> [!WARNING]
> Critical warning
```

### Code Blocks

Always include language tag:
```markdown
```json
{ "key": "value" }
```
```

### Collapsible Content

```markdown
<details>
<summary>Click to expand</summary>

Hidden content here

</details>
```

## Document Structure

```markdown
# Title (one H1 only)

Brief summary (2-3 sentences)

## Overview
Context and purpose

## Key Concepts
Define terms on first use

## Main Content
[Diagrams before complex explanations]

## Examples
Concrete examples with expected outputs

## References
Links to related docs
```
