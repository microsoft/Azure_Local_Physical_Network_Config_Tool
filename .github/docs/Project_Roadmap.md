# Azure Local Physical Network Config Tool — Project Roadmap

**Version:** 24.0  
**Date:** February 3, 2026  
**Status:** Phase 10 Complete — Copilot-Assisted Submission Workflow  
**Reference:** [Design Doc](AzureLocal_Physical_Network_Config_Tool_Design_Doc.md)

---

## Core Principle: Reference Only

> [!IMPORTANT]
> **This tool provides REFERENCE configurations only.**
> 
> | Aspect | This Repo's Responsibility | Customer's Responsibility |
> |--------|---------------------------|--------------------------|
> | **Purpose** | Help understand Azure Local network patterns | Validate for your specific environment |
> | **Configs** | Provide reference templates & examples | Test and modify for production use |
> | **Support** | Community-driven, best-effort | Your IT/Network team |
> | **Liability** | None — use at your own risk | Full responsibility for deployment |
> 
> **Generated configurations are starting points, not production-ready solutions.**

---

## Current Focus

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ✅ COMPLETE (Phases 1-10)                                                      │
│     • Frontend wizard: 51 E2E tests, client-side config generation              │
│     • Backend CLI: 162 unit tests, full schema validation                       │
│     • Templates: Dell OS10 (10/10), Cisco NX-OS (10/10)                         │
│     • Submission workflow: Issue template + Copilot-assisted processing         │
│     • Test reorganization: E2E in frontend/tests, fixtures in backend/tests     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  🎉 MVP COMPLETE — Ready for community contributions!                           │
│     • Users submit configs via GitHub Issues                                    │
│     • Maintainers process with Copilot "Code with agent mode"                   │
│     • No custom GitHub Actions needed (simpler, safer)                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Progress Tracker

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1-6 | E2E MVP Implementation | ✅ **Complete** | See [Archive](#completed-phases-archive) |
| 7 | Client-Side Config Generation | ✅ **Complete** | Nunjucks, no server needed |
| 8 | Lab Workflow Testing | ✅ **Complete** | Vendor detection, sectioning |
| 8.5 | Submission Validation Layer | ✅ **Complete** | Auto-fix typos, welcome new vendors |
| 9 | Script Migration + Unit Tests | ✅ **Complete** | 162 backend tests, 95 new tests |
| 10 | Copilot Submission Workflow | ✅ **Complete** | Issue template + Copilot processing |

---

## Phase 9: Script Migration + Unit Tests ✅ COMPLETE

**Goal:** Move lab scripts to `backend/src/` (permanent location) with full unit test coverage. Ensures scripts are reusable for both CLI and GitHub Actions.

### Why Move to Backend?

| Location | Pros | Cons |
|----------|------|------|
| **`backend/src/`** ✅ | Existing Python home, pytest infrastructure, CLI integration | — |
| `lab/scripts/` | Quick iteration during development | Temporary, no tests, will be archived |
| `.github/scripts/` | Close to Actions | Isolated, no pytest |

### Final Folder Structure

```
backend/
├── src/
│   ├── __init__.py
│   ├── cli.py                      # Existing: Config generation CLI
│   ├── context.py                  # Existing: Template context builder
│   ├── renderer.py                 # Existing: Jinja2 renderer
│   ├── transformer.py              # Existing: Data enrichment
│   ├── validator.py                # Existing: JSON schema validation
│   ├── metadata_validator.py       # ✅ Submission metadata validation
│   ├── vendor_detector.py          # ✅ Auto-detect vendor from config
│   ├── config_sectioner.py         # ✅ Split config into sections
│   └── submission_processor.py     # ✅ Orchestrate submission processing
├── tests/
│   ├── test_cli.py                 # Existing (9 tests)
│   ├── test_transformer.py         # Existing (9 tests)
│   ├── test_validator.py           # Existing (10 tests)
│   ├── test_renderer.py            # Existing (30 tests)
│   ├── test_metadata_validator.py  # ✅ NEW (26 tests)
│   ├── test_vendor_detector.py     # ✅ NEW (21 tests)
│   ├── test_config_sectioner.py    # ✅ NEW (26 tests)
│   └── test_submission_processor.py # ✅ NEW (22 tests)
├── templates/                      # Jinja2 templates (unchanged)
└── schema/                         # JSON schema (unchanged)

lab/
├── README.md                       # Lab usage guide (stays)
├── submissions/                    # Test submissions (playground)
├── output/                         # Generated output (gitignored)
└── scripts/
    └── process.py                  # ✅ Thin wrapper → imports from backend/src/
```

### Test Coverage Summary

| Test File | Test Count | Coverage |
|-----------|------------|----------|
| `test_metadata_validator.py` | 26 tests | Auto-fix, new vendor, validation |
| `test_vendor_detector.py` | 21 tests | Dell/Cisco detection, patterns |
| `test_config_sectioner.py` | 26 tests | Section splitting, analysis |
| `test_submission_processor.py` | 22 tests | Orchestration, error handling |
| **New Tests Total** | **95 tests** | — |
| **Backend Total** | **162 tests** | — |
| **E2E Total** | **51 tests** | — |

### Success Criteria ✅

- [x] All 4 scripts in `backend/src/`
- [x] 4 new test files with 95 tests
- [x] Total backend tests: 162 (target was 80+)
- [x] Lab wrapper still works (`python lab/scripts/process.py`)
- [x] All E2E tests pass (51/51)
├── submissions/                    # Test submissions (stays as playground)
│   ├── example-dell-tor1/
│   ├── example-cisco-tor1/
│   ├── test-typos-dell/
│   ├── test-typos-cisco/
│   ├── test-new-vendor/
│   └── test-invalid-role/
├── output/                         # Generated output (gitignored)
└── scripts/
    └── process.py                  # Thin wrapper → imports from backend/src/
```

---

## Phase 10: Copilot-Assisted Submission Workflow ✅ COMPLETE

**Goal:** Enable community contributions via GitHub Issues with Copilot-assisted processing.

### Why Copilot Instead of Custom GitHub Actions?

| Approach | Pros | Cons |
|----------|------|------|
| **Custom GitHub Actions** | Fully automated | Complex, security risks (spam/bots), maintenance burden |
| **Copilot Agent Mode** ✅ | Human-in-loop, no custom code, leverages existing scripts | Requires maintainer action |

**Decision:** Use Copilot "Code with agent mode" for safety and simplicity.

### Submission Workflow

```mermaid
flowchart LR
    subgraph "Submit"
        A[User opens Issue] --> B[Fills template form]
    end
    
    subgraph "Review & Process"
        B --> C[Maintainer reviews issue]
        C --> D[Clicks 'Code with agent mode']
        D --> E[Copilot validates metadata]
        E --> F[Copilot analyzes config]
        F --> G[Copilot creates PR]
    end
    
    subgraph "Merge"
        G --> H[Maintainer reviews PR]
        H --> I[Merge to main]
    end
```

### Components Created

| Component | Location | Status |
|-----------|----------|--------|
| Issue Template | `.github/ISSUE_TEMPLATE/config-submission.yml` | ✅ Created |
| Copilot Instructions | `.github/instructions/process-submission.instructions.md` | ✅ Created |
| Contributing Guide | `CONTRIBUTING.md` | ✅ Created |
| Validation Scripts | `backend/src/metadata_validator.py` | ✅ Created (Phase 9) |
| Vendor Detection | `backend/src/vendor_detector.py` | ✅ Created (Phase 9) |
| Config Sectioner | `backend/src/config_sectioner.py` | ✅ Created (Phase 9) |

### Issue Template Features

| Feature | Description |
|---------|-------------|
| **Reference disclaimer** | Prominent notice that configs are reference-only |
| **Paste OR attach** | Users can paste config or attach file |
| **Auto-fix friendly** | Free-text vendor/firmware fields allow typos (auto-fixed) |
| **BMC optional** | Clearly marked as optional role |
| **Pattern link** | Links to Azure Local Supportability for pattern help |
| **Required checkboxes** | Sanitization + responsibility acknowledgment |

### Security & Safety

| Protection | Implementation |
|------------|----------------|
| **No auto-processing** | Workflow requires maintainer to click "Code with agent mode" |
| **Human review** | Maintainer sees issue before any processing |
| **No bot triggers** | No `issues: [opened]` workflow that bots can abuse |
| **Copilot guardrails** | Copilot follows `.github/instructions/` guidelines |

### How to Process a Submission

1. **User submits issue** via template form
2. **Maintainer receives notification** 
3. **Maintainer reviews issue** (sanity check: not spam, no credentials)
4. **Maintainer clicks "Code with agent mode"** on the issue
5. **Copilot follows instructions** in `.github/instructions/process-submission.instructions.md`:
   - Validates metadata (auto-fixes typos)
   - Detects vendor from config
   - Sections the config
   - Creates submission folder
   - Opens PR with summary
6. **Maintainer reviews PR** and merges

### Success Criteria ✅

- [x] Issue template renders correctly with all fields
- [x] Copilot instructions file created
- [x] CONTRIBUTING.md guides users through submission
- [x] Validation scripts available in `backend/src/`
- [x] No custom GitHub Actions workflow needed (simpler)
- [x] Human-in-loop for all processing (safer)

---

## Architecture Overview

### Template Flow (Single Source of Truth)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  SOURCE OF TRUTH: backend/templates/*.j2                                        │
│  ├── dellemc/os10/*.j2  (10 templates)                                          │
│  └── cisco/nxos/*.j2    (10 templates)                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │ BUILD TIME                    │ RUNTIME
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  frontend/src/          │     │  backend/src/           │
│  templates.ts           │     │  renderer.py            │
│  (auto-generated)       │     │                         │
│                         │     │                         │
│  Engine: Nunjucks (JS)  │     │  Engine: Jinja2 (Py)    │
│  Use: Browser wizard    │     │  Use: CLI, automation   │
└─────────────────────────┘     └─────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `frontend/` | Web wizard UI, client-side validation, Nunjucks rendering |
| `backend/src/cli.py` | CLI entry point for config generation |
| `backend/src/validator.py` | JSON Schema validation |
| `backend/src/context.py` | Build template context with helpers |
| `backend/src/renderer.py` | Jinja2 template rendering |
| `backend/src/metadata_validator.py` | Submission metadata auto-fix |
| `backend/src/vendor_detector.py` | Detect vendor from config syntax |
| `backend/src/config_sectioner.py` | Split config into logical sections |

---

## Validation Layer

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| **No blockers** | Validation guides, never blocks processing |
| **Auto-fix obvious mistakes** | Case, whitespace, common typos |
| **New vendors welcome** | Unknown vendor = contribution opportunity |
| **Self-service debugging** | Clear logs for user self-fix |

### Auto-Fix Rules

| Input | Auto-Fix To |
|-------|-------------|
| `Dell EMC`, `dell-emc`, `DELLEMC` | `dellemc` |
| `CISCO`, `Cisco Systems` | `cisco` |
| `NX-OS`, `nx-os`, `Nexus` | `nxos` |
| `OS-10`, `os 10` | `os10` |
| `tor1`, `Tor1` | `TOR1` |
| `fully-converged` | `fully_converged` |

### New Vendor Welcome Flow

```
┌─────────────────────────────────────────────────────────────┐
│  🎉 NEW VENDOR DETECTED: juniper                            │
├─────────────────────────────────────────────────────────────┤
│  This vendor isn't in our templates yet — that's OK!        │
│  Your submission helps us add support for new vendors.      │
│                                                             │
│  What happens next:                                         │
│  1. We'll analyze your config to understand the syntax      │
│  2. A maintainer will create templates for this vendor      │
│  3. Your config becomes a test case for the new templates   │
└─────────────────────────────────────────────────────────────┘
```

---

## Test Summary

| Category | Count | Status |
|----------|-------|--------|
| E2E Tests (Playwright) | 51 | ✅ Passing |
| Backend Tests (pytest) | 67 | ✅ Passing |
| **Total** | **118** | ✅ |

After Phase 9:
| Category | Expected |
|----------|----------|
| Backend Tests | 80+ |

---

## ⚠️ Critical Development Rules

> [!WARNING]
> Mandatory for all developers and AI agents.

### 1. NEVER Kill Node/Vite Processes

```bash
# ❌ FORBIDDEN - Will shut down dev container
pkill -f node
pkill -f vite

# ✅ SAFE - Use Ctrl+C or close terminal
```

### 2. ALWAYS Use Timeouts

```bash
# ❌ BAD
npx playwright test

# ✅ GOOD
timeout 180 npx playwright test --reporter=line
```

| Scope | Timeout |
|-------|---------|
| Global | 180s |
| Per-test | 30s |
| Action | 10s |
| Expect | 5s |

---

## Commands Reference

```bash
# Frontend development
cd /workspace/frontend && npm run dev -- --port 3000

# E2E tests
cd /workspace && timeout 180 npx playwright test --reporter=line

# Backend tests
cd /workspace/backend && python -m pytest

# Generate config via CLI
cd /workspace/backend && python -m src.cli generate path/to/input.json

# Lab workflow test
cd /workspace/lab && python scripts/process.py submissions/example-dell-tor1 -v
```

---

## Architectural Decisions

### ADR-001: Template Include Path Convention

Use vendor-prefixed paths: `{% include "dellemc/os10/vlan.j2" %}`

### ADR-002: Interface-Level QoS

QoS configured per-interface with `qos: true`. Context helper: `has_qos_interfaces`.

### ADR-003: Login/Credential Handling

Hardcoded in `full_config.j2` with `$CREDENTIAL_PLACEHOLDER$` markers.

### ADR-004: Client-Side Config Generation

Render configs client-side using Nunjucks. Backend API removed.

### ADR-005: Submission Processing Location

Scripts in `backend/src/` (not lab or .github). Reusable for CLI, lab testing, and GitHub Actions.

---

## Completed Phases Archive

<details>
<summary><strong>Phases 1-8.5 (Click to expand)</strong></summary>

### Phase 1-6: E2E MVP ✅

- Frontend wizard with schema-aligned types
- Backend CLI with Jinja2 rendering
- Dell OS10 templates (10/10)
- Cisco NX-OS templates (10/10)
- 118 total tests passing

### Phase 7: Client-Side Generation ✅

- Nunjucks template engine (Jinja2-compatible)
- Templates bundled at build time via `bundle-templates.cjs`
- Backend API removed (unnecessary)
- Works offline, no server needed

### Phase 8: Lab Workflow ✅

- `lab/scripts/vendor_detector.py` — Auto-detect vendor from config
- `lab/scripts/config_sectioner.py` — Split config into sections
- `lab/scripts/process.py` — Main processor

### Phase 8.5: Validation Layer ✅

- `lab/scripts/metadata_validator.py` — Auto-fix typos, welcome new vendors
- 90% coverage of common input errors
- Detailed timestamped logging for self-service debugging
- Test submissions: typos-dell, typos-cisco, new-vendor, invalid-role

</details>

---

## Reference Links

| Resource | Path/URL |
|----------|----------|
| Design Document | [AzureLocal_Physical_Network_Config_Tool_Design_Doc.md](AzureLocal_Physical_Network_Config_Tool_Design_Doc.md) |
| JSON Schema | `backend/schema/standard.json` |
| Azure Patterns | [AzureLocal-Supportability](https://github.com/Azure/AzureLocal-Supportability) |
| MS Learn | [Azure Local Network Patterns](https://learn.microsoft.com/en-us/azure/azure-local/plan/network-patterns-overview) |
