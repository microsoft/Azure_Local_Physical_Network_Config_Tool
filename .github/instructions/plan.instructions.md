---
applyTo: '**'
---

# PLAN Workflow

**Trigger:** "design feature", "design project", "plan", "implement", "build", "refactor", "roadmap", "multi-phase", "architect", "design system", "trade-off", system design, scalability decisions.

> [!IMPORTANT]
> **Reference Only:** All generated configurations are starting points, not production-ready. Always include customer responsibility in user-facing features.

## Principle

User workflow first → Data structure → Function logic → Implementation

## Required Outputs

| # | Section | Purpose | Format |
|---|---------|---------|--------|
| 1 | User Workflow | What user sees/does | Mermaid flowchart |
| 2 | Data Flow | How code processes | Mermaid sequence diagram |
| 3 | Input/Output Specification | User provides vs auto-generated | Table |
| 4 | Field Definitions | Required, type, default values | Table |
| 5 | Example | Concrete input → expected output | Code block |
| 6 | Plan Comparison | Multiple approaches with trade-offs | Comparison table |
| 7 | Recommended Plan | AI-selected best approach with rationale | Highlighted section |
| 8 | Architecture Changes | Files to create/modify | Table |
| 9 | Implementation Steps | Phased step-by-step actions | Nested tables |
| 10 | Testing Strategy | How to validate | Bullet list |
| 11 | Risks & Mitigations | What could go wrong | Table |

> [!NOTE]
> Sections 1-5 are for user-facing features. Skip them for pure backend/refactoring work.

## Output Template

```markdown
# Feature Design: [Name]

## 1. User Workflow

'''mermaid
flowchart TD
    A[User Action] --> B[System Response]
    B --> C{Decision?}
    C -->|Yes| D[Result A]
    C -->|No| E[Result B]
'''

## 2. Data Flow

'''mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    U->>F: Input data
    F->>B: Process request
    B-->>F: Return result
    F-->>U: Display output
'''

## 3. Input/Output Specification

| Field | User Provides | Auto-Generated | Required |
|-------|---------------|----------------|----------|
| field_a | ✅ | | Yes |
| field_b | | ✅ | No |
| field_c | ✅ (optional) | ✅ (default) | No |

## 4. Field Definitions

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| field_a | string | — | required | Primary identifier |
| field_b | number | 0 | >= 0 | Count value |
| field_c | boolean | true | — | Enable feature |

## 5. Example

**Input:**
'''json
{
  "field_a": "example",
  "field_c": false
}
'''

**Output:**
'''
Expected result here
'''

---

## 6. Plan Comparison

| Aspect | Plan A: [Name] | Plan B: [Name] | Plan C: [Name] |
|--------|----------------|----------------|----------------|
| **Approach** | Description | Description | Description |
| **Pros** | • Fast to implement | • More flexible | • Best performance |
| **Cons** | • Limited flexibility | • More complex | • Higher effort |
| **Effort** | Low (1-2 days) | Medium (3-5 days) | High (1+ week) |
| **Risk** | Low | Medium | Low |
| **Maintainability** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## 7. 🤖 AI Recommended Plan

**Selected: Plan [X] — [Name]**

**Rationale:**
- [Why this plan is best for the current context]
- [Key advantages over alternatives]
- [Trade-offs accepted and why]

> **Confidence:** High/Medium/Low
> **Alternatives to consider if:** [conditions that would change recommendation]

---

## 8. Architecture Changes

| File | Change | Plan |
|------|--------|------|
| `path/to/file` | Description of change | A/B/C |

## 9. Implementation Steps

### Phase 1: [Name]

| Step | File | Action | Why | Dependencies | Risk |
|------|------|--------|-----|--------------|------|
| 1.1 | `path` | What to do | Reason | None | Low |
| 1.2 | `path` | What to do | Reason | 1.1 | Low |

### Phase 2: [Name]

| Step | File | Action | Why | Dependencies | Risk |
|------|------|--------|-----|--------------|------|
| 2.1 | `path` | What to do | Reason | Phase 1 | Medium |

## 10. Testing Strategy
- **Unit tests:** [What to test, which files]
- **Integration tests:** [Component interactions]
- **E2E tests:** [User workflows to validate]

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| [Risk description] | High/Med/Low | High/Med/Low | [How to prevent or handle] |

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

## ADR Template (Architecture Decision Record)

For significant architectural decisions, document using this format:

```markdown
# ADR-XXX: [Title]

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-YYY

## Context
[What is the issue that we're seeing that is motivating this decision?]

## Decision
[What is the change that we're proposing and/or doing?]

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Drawback 1]
- [Drawback 2]

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| ... | ... | ... | ... |
```

## Anti-Patterns to Avoid

| Anti-Pattern | Description | Solution |
|--------------|-------------|----------|
| Big Ball of Mud | No clear structure | Define component boundaries |
| Golden Hammer | Using same solution for everything | Choose right tool for job |
| Premature Optimization | Optimizing before measuring | Profile first, optimize second |
| Tight Coupling | Components depend on internals | Use interfaces/contracts |
| God Object | One class does everything | Single responsibility |

## Mermaid Diagram Types

| Use Case | Type |
|----------|------|
| Components & flow | `flowchart TB/LR` |
| Interactions | `sequenceDiagram` |
| Data models | `classDiagram` |
| State machines | `stateDiagram-v2` |

## Plan Generation Rules

1. **Always generate 2-3 plans** before recommending
2. **Vary approaches by:**
   - Effort level (quick fix vs proper solution)
   - Architecture style (extend existing vs new abstraction)
   - Risk tolerance (safe incremental vs bold refactor)
3. **Compare on consistent dimensions** (effort, risk, maintainability, flexibility)
4. **Recommend based on context** — consider project phase, time constraints, team size

## Implementation Rules

- Use exact file paths (absolute or workspace-relative)
- Extend existing code over rewriting
- Each step independently verifiable
- Flag: functions >50 lines, nesting >4 levels, duplicated code
- Include rollback strategy for high-risk steps