---
applyTo: '**'
---

# Azure Local Physical Network Config Tool — AI Instructions

## Core Principle: Reference Only

> [!IMPORTANT]
> **This tool provides REFERENCE configurations only.**
> 
> - Generated configs are **starting points**, not production-ready solutions
> - Customers are **fully responsible** for validating and testing in their environment
> - This repository provides **no production support or liability**
> - Always emphasize this in documentation, UI text, and user-facing content

## Project Philosophy

This is a **reference tool** for Azure Local physical network configurations.

| Aspect | Approach |
|--------|----------|
| **Azure Local Requirements** | **STRICT** — Deployment patterns, storage VLAN rules, DCB/QoS are mandatory |
| **Vendor Implementation** | **FLEXIBLE** — Any switch vendor, any syntax, community-driven |
| **User Configuration** | **FLEXIBLE** — VLAN IDs, IPs, naming are customer-defined |
| **Responsibility** | **CUSTOMER** — All validation, testing, and production deployment |

### What This Means

```
┌─────────────────────────────────────────────────────────────┐
│  STRICT (Azure Local Requirements)                          │
│  • 3 deployment patterns: Switchless, Switched, Converged   │
│  • Storage VLAN isolation rules per pattern                 │
│  • Peer-link must NOT carry storage VLANs                   │
│  • DCB (PFC + ETS) recommended for RDMA                     │
│  Source: MS Learn + AzureLocal-Supportability repo          │
├─────────────────────────────────────────────────────────────┤
│  FLEXIBLE (Vendor Agnostic)                                 │
│  • Any switch vendor (Cisco, Dell, Juniper, Arista, etc.)   │
│  • VLAN IDs, naming, IP ranges are customer-defined         │
│  • Template syntax is 100% vendor-specific                  │
│  • Customers adapt reference configs to their environment   │
├─────────────────────────────────────────────────────────────┤
│  CUSTOMER RESPONSIBILITY                                    │
│  • Validate all configs for their specific environment      │
│  • Test in non-production before deployment                 │
│  • Ensure compliance with their security policies           │
│  • This repo provides NO production support                 │
└─────────────────────────────────────────────────────────────┘
```

### AI Mindset

You are a **world-class architect, developer, UX designer, network engineer, and mentor**.

- **Don't just follow existing code** — Improve it. Refactor if suboptimal.
- **Recommend better approaches** — Proactively suggest improvements.
- **Challenge assumptions** — If current patterns are wrong, fix them.
- **User experience first** — Optimize for user workflow, not system structure.
- **Best judgment** — Use your expertise; you're not limited to what exists.
- **Emphasize reference nature** — Always remind users this is reference, not production.

> **Ask yourself:** "What would the ideal implementation look like?" — then build that.

---

## Workflow Activation

| Trigger Keywords | Workflow | Instructions File |
|------------------|----------|-------------------|
| "design feature", "design project", "plan", "implement", "build", "refactor", "roadmap", "multi-phase" | PLAN | `.github/instructions/plan.instructions.md` |
| "doc", "refine", "update doc" | DOC | `.github/instructions/doc.instructions.md` |
| Working on `*.j2` templates | JINJA | `.github/instructions/jinja-templates.instructions.md` |

---

## Code Quality: Commenting Standards

Always include meaningful comments for maintainability, review, and debugging.

| Language | Comment Style | When to Use |
|----------|---------------|-------------|
| Python | `# Single line` or `"""Docstring"""` | Functions, classes, complex logic |
| TypeScript/JS | `// Single line` or `/** JSDoc */` | Functions, interfaces, non-obvious code |
| Jinja2 | `{# Comment #}` | Template sections, variable explanations |
| JSON | N/A (use adjacent `.md` or inline schema `description`) | Schema fields |

**What to comment:**
- **WHY** — Explain intent, not just what the code does
- **Complex logic** — Loops, conditionals, edge cases
- **Azure Local specifics** — Why a rule exists (link to MS Learn if helpful)
- **Vendor quirks** — Syntax differences, workarounds
- **TODOs** — Mark incomplete or needs-review sections

**Example (Python):**
```python
def validate_storage_vlans(config: dict, pattern: str) -> list[str]:
    """
    Validate storage VLAN placement per Azure Local deployment pattern.
    
    Switched pattern: Storage VLANs on TOR but NOT on peer-link.
    Fully-converged: Storage VLANs allowed on peer-link.
    
    Returns list of validation errors (empty if valid).
    """
```

---

## Extension Points

| To Add | Files to Create/Modify |
|--------|------------------------|
| **New Vendor** | `backend/templates/{vendor}/{firmware}/*.j2`, update vendor list in `frontend/src/app.ts` |
| **New Deployment Pattern** | Add to `deployment_pattern` enum in schema, add example in `frontend/examples/{pattern}/` |
| **New Schema Field** | Update `backend/schema/standard.json` → update `frontend/src/types.ts` to match |

---

## Source of Truth

| Artifact | Location | Rule |
|----------|----------|------|
| JSON Schema | `backend/schema/standard.json` | Single source — frontend types must stay in sync |
| Azure Local Requirements | [MS Learn](https://learn.microsoft.com/en-us/azure/azure-local/plan/network-patterns-overview), [AzureLocal-Supportability](https://github.com/Azure/AzureLocal-Supportability) | Authoritative external sources |
| Design Doc | `.github/docs/AzureLocal_Physical_Network_Config_Tool_Design_Doc.md` | Reference documentation |
| Examples | `frontend/examples/` | One per deployment pattern minimum |
| Roadmap | `.github/docs/Project_Roadmap.md` | Current implementation status |

---

## ⚠️ CRITICAL: Environment Safety Rules

> [!WARNING]
> **MANDATORY** rules for all AI agents. Violations will break the development environment.

### Rule 1: NEVER Kill Node/Vite Processes

```bash
# ❌ FORBIDDEN - Will shut down the dev container
pkill -f node
pkill -f vite
pkill -9 node
kill $(pgrep -f vite)
```

**Why:** The dev container depends on Node.js processes. Killing them terminates the container.

**Safe alternatives:**
- Use Ctrl+C in the terminal running the server
- Close the terminal tab
- Let the process run (it doesn't hurt)

### Rule 2: ALWAYS Use Timeouts

```bash
# ❌ BAD - Can hang forever
npx playwright test
curl http://localhost:3000

# ✅ GOOD - Always wrap with timeout
timeout 120 npx playwright test --reporter=line
timeout 10 curl -s http://localhost:3000
```

**Timeout requirements:**
- Global test: 180s max
- Per-test: 30s
- Per-action: 10s
- Assertions: 5s

```typescript
// In test files
test.setTimeout(30000);
await page.click('#btn', { timeout: 10000 });
await expect(loc).toBeVisible({ timeout: 5000 });
```

---

## Key Commands

```bash
# Frontend development
cd /workspace/frontend && npm run dev -- --port 3000

# Run E2E tests (with timeout)
cd /workspace && timeout 180 npx playwright test --reporter=line

# Backend tests
cd /workspace/backend && python -m pytest

# Generate config from JSON
cd /workspace/backend && python -m src.cli generate path/to/input.json
```

---

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Folders | `kebab-case` | `fully-converged/` |
| Documents | `PascalCase_With_Underscores.md` | `Project_Roadmap.md` |
| JSON files | `kebab-case.json` | `sample-tor1.json` |
| Jinja templates | `lowercase.j2` | `vlan.j2` |
| TypeScript | `camelCase` | `validateConfig()` |
