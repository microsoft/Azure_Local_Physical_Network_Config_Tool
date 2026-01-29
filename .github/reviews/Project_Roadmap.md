# Azure Local Network Config Tool - AI Agent Execution Roadmap

**Version:** 5.0  
**Date:** January 28, 2026  
**Status:** Ready for Phase 1  
**Design Doc:** [AzureLocal_NetworkConfTool_Project_Design_Doc.md](AzureLocal_NetworkConfTool_Project_Design_Doc.md)

---

## File Structure

```
/workspace/
├── backend/                              # Python CLI (self-contained)
│   ├── src/
│   │   ├── __init__.py
│   │   ├── cli.py                        # Entry point
│   │   ├── validator.py                  # Schema validation
│   │   ├── transformer.py                # Data enrichment
│   │   ├── context.py                    # Template context
│   │   └── renderer.py                   # Jinja2 rendering
│   ├── schema/
│   │   └── standard.json                 # JSON Schema (SOURCE OF TRUTH)
│   ├── templates/
│   │   ├── cisco/nxos/*.j2
│   │   └── dellemc/os10/*.j2
│   ├── tests/
│   │   └── *.py
│   └── pyproject.toml
│
├── frontend/                             # TypeScript wizard (self-contained)
│   ├── index.html
│   ├── style.css
│   ├── src/
│   │   ├── main.ts                       # Entry point
│   │   ├── app.ts                        # Wizard logic
│   │   ├── types.ts                      # Schema interfaces
│   │   ├── validator.ts                  # Client-side validation
│   │   └── utils.ts                      # Helpers
│   ├── dist/                             # Built output (gitignored)
│   ├── tsconfig.json
│   ├── package.json
│   ├── examples/*.json
│   └── tests/
│
├── _test/                                # Sample data (READ-ONLY)
└── archive/                              # Old code reference
```

---

## Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  PHASE 1: SCHEMA                                                        │
│  ════════════════                                                       │
│  Create JSON Schema - the contract between frontend and backend         │
│  File: backend/schema/standard.json                                     │
│                                                                         │
│                              ▼                                          │
│                                                                         │
│  PHASE 2: FRONTEND UI                                                   │
│  ════════════════════                                                   │
│  Build wizard that users interact with                                  │
│  User can SEE what they're configuring                                  │
│  Outputs: Standard JSON file                                            │
│                                                                         │
│                              ▼                                          │
│                                                                         │
│  PHASE 3: BACKEND (driven by Frontend)                                  │
│  ═════════════════════════════════════                                  │
│  Frontend JSON → Backend consumes it → .cfg files                       │
│  Add templates incrementally:                                           │
│    • Dell TOR first (most sample data)                                  │
│    • Then Cisco                                                         │
│    • Then additional scenarios                                          │
│                                                                         │
│                              ▼                                          │
│                                                                         │
│  PHASE 4: INTEGRATION TESTING                                           │
│  ════════════════════════════                                           │
│  Once _test/ scenarios work end-to-end:                                 │
│    • Wizard → JSON → Backend → .cfg                                     │
│    • Compare output with expected files                                 │
│    • Build automated E2E test suite                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Principle:** Frontend defines WHAT users want → Backend delivers HOW to produce it

---

## Phase 1: Schema

**Goal:** Define the data contract that both frontend and backend use.

### Task 1.1: Create JSON Schema

**File:** `backend/schema/standard.json`

**Source:** Design Doc Section 6

**Action:**
1. Read Design Doc Section 6 "Schema Specification"
2. Create JSON Schema Draft-07 format
3. Validate against sample files in `_test/`

**Schema Sections:**

| Section | Required | Description |
|---------|----------|-------------|
| `switch` | Yes | vendor, hostname, role, model, firmware |
| `vlans[]` | No | VLAN definitions |
| `interfaces[]` | No | Port configurations |
| `port_channels[]` | No | LAG definitions |
| `mlag{}` | No | MLAG/VPC config |
| `bgp{}` | No | BGP routing |
| `prefix_lists{}` | No | Route filtering |
| `qos` | No | QoS enabled flag |

**Verify:**
```bash
python3 -c "import json; json.load(open('backend/schema/standard.json')); print('Valid JSON')"
```

**Done When:** Schema validates sample JSON from `_test/rr1-n25-r20-5248hl-23-1a/std_*.json`

---

## Phase 2: Frontend Wizard

**Goal:** Build TypeScript-based UI wizard that users interact with. Outputs Standard JSON.

**Technology:** TypeScript with Vite build tooling (compile-time type safety for complex schema)

**Reference:** https://neilbird.github.io/Odin-for-AzureLocal/

### Task 2.0: TypeScript Project Setup

**Files:** `frontend/package.json`, `frontend/tsconfig.json`

**Action:** Initialize TypeScript project with Vite:
1. Create `package.json` with dependencies: `typescript`, `vite`
2. Create `tsconfig.json` with strict mode enabled
3. Create `src/types.ts` with schema interfaces

**Why TypeScript:**
- Complex nested schema (`vlans[]`, `interfaces[]`, `bgp.neighbors[]`) — types catch shape errors at compile time
- Cross-reference validation benefits from typed lookups
- Multi-step wizard state management needs type safety
- Interfaces serve as living documentation matching schema spec

**Verify:** `cd frontend && npm install && npm run build`

---

### Task 2.1: HTML Structure

**File:** `frontend/index.html`

**Action:** Create single-page wizard with:
- Header with title
- Breadcrumb navigation
- Steps column (01-04)
- Sticky summary sidebar
- Progress bar

**Wizard Steps:**

| Step | Title | User Configures |
|------|-------|-----------------|
| 01 | Switch | Vendor, model, role, hostname |
| 02 | Network | VLANs, ports, MLAG |
| 03 | Routing | BGP settings |
| 04 | Review | Summary, export |

**Verify:** `grep -q "step-01" frontend/index.html`

---

### Task 2.2: CSS Styling

**File:** `frontend/style.css`

**Action:** Create Odin-inspired dark theme with:
- CSS variables for colors
- Option card styles
- Sticky sidebar
- Progress bar
- Responsive layout

**Verify:** `grep -q "accent-blue" frontend/style.css`

---

### Task 2.3: TypeScript Logic

**Files:** `frontend/src/app.ts`, `frontend/src/types.ts`

**Action:** Implement with full type safety:
- Typed wizard state management
- Form data collection with interface validation
- Summary updates with computed types
- JSON export/import with schema types
- Progress tracking

**Key Types to Define:**
```typescript
interface SwitchConfig { vendor: Vendor; model: string; role: Role; ... }
interface VLAN { vlan_id: number; name: string; purpose?: VLANPurpose; ... }
interface Interface { name: string; type: InterfaceType; ... }
interface StandardConfig { switch: SwitchConfig; vlans: VLAN[]; ... }
```

**Verify:** `cd frontend && npm run typecheck && grep -q "exportJSON" src/app.ts`

---

### Task 2.4: Schema Types & Validation

**Files:** `frontend/src/types.ts`, `frontend/src/validator.ts`

**Action:** 
1. Generate TypeScript interfaces from `backend/schema/standard.json`
2. Export typed schema definitions
3. Implement `validateConfig(): ValidationResult` with typed errors

**Type Generation:**
- Use JSON Schema → TypeScript conversion
- Add union types for enums: `type Role = 'TOR1' | 'TOR2' | 'BMC'`
- Add branded types for IDs: `type VlanId = number & { readonly brand: unique symbol }`

**Verify:** `grep -q "validateConfig" frontend/src/validator.ts && npm run typecheck`

---

### Task 2.5: Example Configs

**Location:** `frontend/examples/`

**Action:** Create example JSON files from `_test/` samples

**Files:**
- `dell-tor1.json` - Dell TOR1 example
- `dell-tor2.json` - Dell TOR2 example  
- `cisco-tor1.json` - Cisco example

**Verify:** `ls frontend/examples/*.json | wc -l` returns 3+

---

### Task 2.6: GitHub Pages Workflow

**File:** `.github/workflows/pages.yml`

**Action:** Create workflow to:
1. Install Node.js dependencies
2. Run TypeScript build (`npm run build`)
3. Deploy `frontend/dist/` folder to GitHub Pages

**Verify:** File exists and contains `npm run build` and `path: frontend/dist`

---

**Phase 2 Complete When:** 
- Wizard loads in browser
- User can fill all steps
- Export produces valid Standard JSON
- Imported JSON populates form correctly

---

## Phase 3: Backend Pipeline

**Goal:** Process Standard JSON from frontend, produce .cfg files.

### Task 3.1: Project Setup

**File:** `backend/pyproject.toml`

**Action:** Create with dependencies: jinja2, jsonschema, pytest

**Verify:** `cd backend && uv sync`

---

### Task 3.2: Validator

**File:** `backend/src/validator.py`

**Action:** Create `StandardValidator` class that:
- Validates against schema
- Checks cross-references (VLANs exist, port-channel members exist)

**Verify:** `cd backend && python3 -c "from src.validator import StandardValidator; print('OK')"`

---

### Task 3.3: Transformer

**File:** `backend/src/transformer.py`

**Action:** Create `Transformer` class that:
- Adds `_computed` section based on role
- Normalizes legacy fields (make→vendor, os→firmware)

**Computed Values:**

| Role | hsrp_priority | mlag_role_priority | mst_priority |
|------|---------------|--------------------|--------------| 
| TOR1 | 150 | 1 | 8192 |
| TOR2 | 100 | 32667 | 16384 |
| BMC | null | null | 32768 |

**Verify:** `cd backend && python3 -c "from src.transformer import Transformer; print('OK')"`

---

### Task 3.4: Context Builder

**File:** `backend/src/context.py`

**Action:** Create `ContextBuilder` class that:
- Combines original data with `_computed`
- Adds helper flags: `has_bgp`, `has_mlag`, `has_qos`

**Verify:** `cd backend && python3 -c "from src.context import ContextBuilder; print('OK')"`

---

### Task 3.5: Renderer

**File:** `backend/src/renderer.py`

**Action:** Create `Renderer` class that:
- Loads Jinja2 templates
- Renders to strings or files

**Verify:** `cd backend && python3 -c "from src.renderer import Renderer; print('OK')"`

---

### Task 3.6: CLI

**File:** `backend/src/cli.py`

**Action:** Create CLI with subcommands:
- `validate <input.json>` - Validate only
- `transform <input.json>` - Validate + enrich
- `generate <input.json> -o <dir>` - Full pipeline

**Verify:** `cd backend && python3 -m src.cli --help`

---

### Task 3.7: Templates (Incremental)

**Location:** `backend/templates/`

**Action:** Create templates by referencing `_test/` samples

**Order:**
1. Dell OS10 first (8 templates) - reference: `_test/rr1-n25-r20-5248hl-23-1a/generated_*.cfg`
2. Cisco NXOS second (10 templates) - reference: `_test/s46-r21-93180hl-24-1a.config`

**Template Files:**
- system.j2, vlan.j2, interface.j2, port_channel.j2
- bgp.j2, prefix_list.j2, qos.j2, full_config.j2
- (Cisco only: vpc.j2, stp.j2)

**Verify:** 
```bash
ls backend/templates/dellemc/os10/*.j2 | wc -l  # 8
ls backend/templates/cisco/nxos/*.j2 | wc -l   # 10
```

---

### Task 3.8: Backend Tests

**Location:** `backend/tests/`

**Action:** Create pytest tests:
- test_validator.py
- test_transformer.py
- test_renderer.py
- test_e2e.py

**Verify:** `cd backend && python3 -m pytest tests/ -v`

---

**Phase 3 Complete When:**
- CLI can process JSON from `frontend/examples/`
- Output matches format in `_test/` samples
- All backend tests pass

---

## Phase 4: Integration Testing

**Goal:** Verify full flow works end-to-end.

### Task 4.1: E2E Validation

**Action:**
1. Use frontend to create/export JSON
2. Run through backend CLI
3. Compare output with `_test/` expected files
4. Document any differences

**Test Matrix:**

| Scenario | Frontend Example | Backend Output | Compare With |
|----------|------------------|----------------|--------------|
| Dell TOR1 | dell-tor1.json | /tmp/dell-tor1/ | _test/rr1-n25-r20-5248hl-23-1a/ |
| Dell TOR2 | dell-tor2.json | /tmp/dell-tor2/ | _test/rr1-n25-r20-5248hl-23-1b/ |
| Cisco TOR1 | cisco-tor1.json | /tmp/cisco-tor1/ | _test/s46-r21-93180hl-24-1a.config |

---

**Phase 4 Complete When:**
- All scenarios in test matrix pass
- Automated E2E tests written
- Documentation updated

---

## Checklist

| Phase | Task | Status |
|-------|------|--------|
| **1** | **Schema** | |
| | 1.1 Create JSON Schema | ✅ |
| **2** | **Frontend (TypeScript)** | |
| | 2.0 TypeScript Project Setup | ⏳ |
| | 2.1 HTML Structure | ⏳ |
| | 2.2 CSS Styling | ⏳ |
| | 2.3 TypeScript Logic | ⏳ |
| | 2.4 Schema Types & Validation | ⏳ |
| | 2.5 Example Configs | ⏳ |
| | 2.6 GitHub Pages Workflow | ⏳ |
| **3** | **Backend** | |
| | 3.1 Project Setup | ⏳ |
| | 3.2 Validator | ⏳ |
| | 3.3 Transformer | ⏳ |
| | 3.4 Context Builder | ⏳ |
| | 3.5 Renderer | ⏳ |
| | 3.6 CLI | ⏳ |
| | 3.7 Templates (Dell) | ⏳ |
| | 3.7 Templates (Cisco) | ⏳ |
| | 3.8 Backend Tests | ⏳ |
| **4** | **Integration** | |
| | 4.1 E2E Validation | ⏳ |

---

## Commands Reference

```bash
# Frontend (TypeScript)
cd /workspace/frontend && npm install      # Install dependencies
cd /workspace/frontend && npm run dev      # Start dev server with HMR
cd /workspace/frontend && npm run build    # Build for production
cd /workspace/frontend && npm run typecheck # Check types without emitting

# Backend
cd /workspace/backend && python3 -m src.cli validate <input.json>
cd /workspace/backend && python3 -m src.cli generate <input.json> -o <output_dir>
cd /workspace/backend && python3 -m pytest tests/ -v
```

---

## Reference Files

| Purpose | Location |
|---------|----------|
| Design Doc | `.github/reviews/AzureLocal_NetworkConfTool_Project_Design_Doc.md` |
| Dell Standard JSON | `_test/rr1-n25-r20-5248hl-23-1a/std_*.json` |
| Dell Output Samples | `_test/rr1-n25-r20-5248hl-23-1a/generated_*.cfg` |
| Cisco Output Sample | `_test/s46-r21-93180hl-24-1a.config` |
| Wizard MVP | `_test/wizard-mvp/` |
| Old Code | `archive/v1/` |

---

**Ready to Execute.** Awaiting confirmation to start Phase 1.
