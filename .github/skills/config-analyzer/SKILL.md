---
name: config-analyzer
description: 'Parse and normalize golden config submissions. Used by template-generator agent to process raw configs into templates.'
---

# Config Analyzer

This skill is used by the `template-generator` agent to process raw switch configurations and prepare them for template generation.

## Your Role as Architect

You are **empowered to improve** the parsing and normalization logic:
- **Evaluate current patterns** — Refine if they miss edge cases or are overly complex
- **Add new patterns** — Vendors have quirks; expand detection rules as needed
- **Challenge assumptions** — Don't assume current regex/patterns are complete
- **Optimize sanitization** — Ensure thorough but not over-aggressive redaction

> **Mindset:** These rules are a starting point. Improve them based on real-world configs you encounter.

## Processing Pipeline

```
Raw Config Input
       ↓
1. Normalize vendor/model/firmware names
       ↓
2. Detect config sections (VLAN, interface, BGP, etc.)
       ↓
3. Sanitize sensitive data → Jinja2 variables
       ↓
4. Extract patterns → Template structure
       ↓
Clean Template Output
```

## References

| Reference | Purpose |
|-----------|---------|
| [Vendor Normalization](references/vendor-normalization.md) | Map user input to folder names |
| [Model Normalization](references/model-normalization.md) | Standardize model naming |
| [Sensitive Data Patterns](references/sensitive-data-patterns.md) | What to redact and how |
| [Syntax Patterns](references/syntax-patterns.md) | Vendor-specific config block detection |
| [Template Extraction Rules](references/template-extraction-rules.md) | Identify variables vs static |

## Principles

- **Be generous with user input** — Accept variations, normalize internally
- **Sanitize thoroughly** — Never leak real IPs, passwords, or hostnames
- **Preserve structure** — Keep vendor-specific formatting
- **Comment uncertainties** — Mark sections that need manual review
