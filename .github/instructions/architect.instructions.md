---
applyTo: '**'
---

# ARCHITECT Workflow

**Trigger:** "architect", "design system", "trade-off", system design, scalability decisions.

## Required Outputs

1. **Architecture diagram** — Mermaid flowchart or component diagram
2. **Component responsibilities** — What each component owns
3. **Trade-off table** — Aspect | Pros | Cons | Decision

## ADR Template (Architecture Decision Record)

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
