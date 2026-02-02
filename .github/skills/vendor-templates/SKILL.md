---
name: vendor-templates
description: 'Reference for switch template structure. Used by template-generator agent to create new vendor templates.'
---

# Vendor Templates

This skill provides the **reference structure** for switch configuration templates. It's primarily used by the `template-generator` agent to create new vendor templates automatically.

## Your Role as Architect

The template structure is **a starting point, not a fixed requirement**:
- **Evaluate and improve** — If the current structure is suboptimal, redesign it
- **Optimize for the flow** — Templates should map cleanly from frontend JSON to backend generation
- **Challenge existing patterns** — Don't assume current templates are ideal; improve them
- **Refactor freely** — You're empowered to restructure for better maintainability

> **Mindset:** You are the architect. The current implementation is a reference, not a constraint.

## How to Add a New Vendor

**Use the automated workflow** — same process for developers and community:

1. **Submit a golden config** via GitHub Issue (use the "Golden Config Submission" template)
2. **Or invoke the agent directly:** `@template-generator` in Copilot Chat with your config

The agent will:
- Normalize vendor/model names
- Sanitize sensitive data
- Generate Jinja2 templates following this structure
- Create PR-ready files

## Reference Templates (for AI Context)

Learn from the **actual working implementations**, not artificial skeletons:

| Vendor | Firmware | Path | Notes |
|--------|----------|------|-------|
| Dell EMC | OS10 | `backend/templates/dellemc/os10/` | Full implementation |
| Cisco | NXOS | `backend/templates/cisco/nxos/` | In progress |

> **Why real templates?** They're maintained, tested, and represent actual best practices. Skeletons can drift.

## References

- [Template Structure](references/template-structure.md) — Directory layout, naming, design principles

## When to Use This Skill Directly

Only for understanding the template structure or debugging. For actually adding vendors, use the workflow.
