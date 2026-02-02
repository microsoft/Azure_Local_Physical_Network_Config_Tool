---
applyTo: '**/docs/*.md,**/Project_Roadmap.md'
---

# ROADMAP Workflow

**Trigger:** "roadmap", "multi-phase", "phase 1", multi-phase project execution.

**Scope:** Multi-phase project tracking and execution. For single-feature decision-making (which approach?), see PLAN workflow.

> [!IMPORTANT]
> **Reference Only:** This tool provides reference configurations only. Always emphasize customer responsibility for validation and testing in all documentation.

## Principles

- **Reference First:** All configs are starting points, not production-ready
- **UI-First:** Build what users see first; backend serves frontend
- **Schema as Contract:** Define data structure before implementation
- **Self-Contained Components:** Each component owns src/, tests/, config
- **Incremental Delivery:** Each phase produces verifiable output

## Execution Order

```
PHASE 1: CONTRACT    → Define shared schema/interface
PHASE 2: FRONTEND    → Build user-facing UI, output contract format
PHASE 3: BACKEND     → Consume frontend output, add features incrementally
PHASE 4: INTEGRATION → E2E testing, verify full flow
```

## Component Structure

```
project/
├── component-a/    # Self-contained (src/, tests/, config)
├── component-b/    # Self-contained (src/, tests/, config)
└── shared/         # Contracts only (schema/)
```

## Task Template

| Field | Required | Description |
|-------|:--------:|-------------|
| File (exact path) | ✓ | Which file to modify |
| Action | ✓ | What to do |
| Verify (command) | ✓ | How to verify completion |
| Done When | ✓ | Success criteria |
| Depends On | | Prerequisites |

## Checklist Format

```markdown
| Phase | Task | Status |
|-------|------|--------|
| 1 | 1.1 Define schema | ⏳ |
| 1 | 1.2 Validate schema | ✅ |
| 2 | 2.1 Build UI | ❌ |
```

Status: ⏳ In Progress | ✅ Complete | ❌ Blocked
