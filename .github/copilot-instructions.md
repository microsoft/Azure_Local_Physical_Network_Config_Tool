# AI Agent Instructions

## Workflow Activation

| Trigger Keywords | Workflow |
|------------------|----------|
| "plan", "implement", "build", "refactor" | PLAN |
| "roadmap", "multi-phase", "phase 1" | ROADMAP |
| "architect", "design system", "trade-off" | ARCHITECT |
| "design feature", "design project" | DESIGN |
| "doc", "refine", "update doc" | DOC |
| "check to-do", "process drafts" | DRAFT |

---

## DESIGN Workflow

**Trigger:** Feature design, tool building, project structure.

**Principle:** User workflow first → Data structure → Function logic → Implementation

**Required Outputs:**
1. User workflow diagram (what user sees/does)
2. Function workflow diagram (how code processes)
3. Input/Output table (user provides vs auto-generated)
4. Field specification table (required, type, default)

**Rules:**
- Group by user mental model, not system architecture
- 90% use defaults; 10% can override
- If user must understand backend to use UI → redesign

---

## PLAN Workflow

**Trigger:** Implementation planning, step breakdown.

**Output Structure:**
```
# Implementation Plan: [Name]
## Overview (2-3 sentences)
## Requirements (bullets)
## Architecture Changes (file paths + descriptions)
## Implementation Steps
### Phase N: [Name]
- Step, File, Action, Why, Dependencies, Risk
## Testing Strategy
## Risks & Mitigations (table)
## Success Criteria (checklist)
```

**Rules:**
- Use exact file paths
- Extend existing code over rewriting
- Each step independently verifiable
- Flag: functions >50 lines, nesting >4 levels, duplicated code

---

## ROADMAP Workflow

**Trigger:** Multi-phase project execution.

**Principles:**
- UI-First: Build what users see first; backend serves frontend
- Schema as Contract: Define data structure before implementation
- Self-Contained Components: Each component owns src/, tests/, config
- Incremental Delivery: Each phase produces verifiable output

**Execution Order:**
```
PHASE 1: CONTRACT → Define shared schema/interface
PHASE 2: FRONTEND → Build user-facing UI, output contract format
PHASE 3: BACKEND  → Consume frontend output, add features incrementally
PHASE 4: INTEGRATION → E2E testing, verify full flow
```

**Component Structure:**
```
project/
├── component-a/    # Self-contained (src/, tests/, config)
├── component-b/    # Self-contained (src/, tests/, config)
└── shared/         # Contracts only (schema/)
```

**Task Template:**
| Field | Required |
|-------|:--------:|
| File (exact path) | ✓ |
| Action | ✓ |
| Verify (command) | ✓ |
| Done When | ✓ |
| Depends On | |

**Checklist Format:**
```
| Phase | Task | Status |
|-------|------|--------|
| 1 | 1.1 Task | ⏳/✅/❌ |
```

---

## ARCHITECT Workflow

**Trigger:** System design, scalability, trade-offs.

**Required Outputs:**
- Architecture diagram (Mermaid)
- Component responsibilities
- Trade-off table: Aspect | Pros | Cons | Decision

**ADR Template:**
```
# ADR-XXX: [Title]
## Context
## Decision
## Consequences (Positive/Negative)
## Alternatives Considered
## Status: Proposed/Accepted/Deprecated
```

**Anti-Patterns:** Big Ball of Mud, Golden Hammer, Premature Optimization, Tight Coupling, God Object

---

## DOC Workflow

**Trigger:** Documentation refinement.

**Process:**
1. Identify doc type and overlap with existing (>50% = merge)
2. Structure: Summary → Overview → Definitions → Content → Validation
3. Add diagrams before complex explanations
4. Remove redundancy
5. Code blocks must have language tags

**Rules:**
- Edit in place, never create backups/v2
- Merge overlapping content
- Terms defined on first use

---

## DRAFT Workflow

**Trigger:** Process to-do/ intake queue.

**Decision:**
| Condition | Action |
|-----------|--------|
| >50% overlap | Merge into existing |
| Extends existing | Add section |
| New topic | Move to folder |

**Anti-Patterns:**
- Creating new doc when existing covers topic
- Leaving processed files in to-do/
- Creating *_v2.md or *_backup.md

---

## Output Standards

| Rule | Description |
|------|-------------|
| Diagrams first | Mermaid before complex explanations |
| Tables for comparisons | Not prose |
| Concrete examples | Include expected outputs |
| Define terms | On first use |

---

## Naming Conventions

| Element | Convention |
|---------|------------|
| Folders | `kebab-case` |
| Documents | `PascalCase_With_Underscores.md` |
| Scripts | `kebab-case.ext` |

---

## Mermaid Rules

| Use Case | Type |
|----------|------|
| Components | `flowchart TB/LR` |
| Sequences | `sequenceDiagram` |
| Entities | `classDiagram` |
| States | `stateDiagram-v2` |

**Syntax:** Quote labels with punctuation: `A["Label (with parens)"]`

---

## Tag Generation

**Rules:**
1. Extract product/platform (e.g., `#azure-local`)
2. Extract topic (e.g., `#memory-optimization`)
3. Add doc type: `#architecture`, `#guide`, `#config`
4. Use `kebab-case`, ≤20 chars
5. Never tag structure (`#5-phases`, `#action-plan`)

---

## Formatting

- One H1 per file
- Callouts: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`
- Language tags on all code blocks
- `<details>` for optional content
