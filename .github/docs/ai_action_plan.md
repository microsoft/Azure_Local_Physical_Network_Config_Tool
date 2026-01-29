## Plan: Full Implementation (Phase 2 + 3 + 4)

**TL;DR:** Build the network config tool fresh from Design Doc: (1) Create TypeScript frontend wizard per UI workflows, (2) Build Python backend that consumes frontend's JSON output, (3) Validate end-to-end. **Frontend defines the contract; backend serves frontend.**

---

### Source of Truth

| Document | Location | Purpose |
|----------|----------|---------|
| Design Doc | [AzureLocal_NetworkConfTool_Project_Design_Doc.md](/.github/reviews/AzureLocal_NetworkConfTool_Project_Design_Doc.md) | UI workflows, field specs, validation rules |
| Roadmap | [Project_Roadmap.md](/.github/reviews/Project_Roadmap.md) | Task breakdown, verification commands |
| Test Samples | `_test/rr1-n25-r20-5248hl-23-1a/` | Dell OS10 reference output |
| Test Samples | `_test/s46-r21-93180hl-24-1a.config` | Cisco NXOS reference output |

**Principle:** 
```
Design Doc UI Workflow → Frontend Forms → Standard JSON Contract → Backend Consumes → .cfg Output
```

**References (read-only, do not copy patterns):**
- [archive/v1/](archive/v1/) — old backend, not UI-driven
- [frontend/app.js](frontend/app.js), [frontend/schema.js](frontend/schema.js) — prototype only

---

## Phase 2: Frontend (TypeScript) — Build Fresh

### Acceptance Criteria
- [ ] Wizard loads in browser
- [ ] User can fill all steps (Switch → Network → Routing → Review) per Design Doc §3
- [ ] Export produces valid Standard JSON matching Design Doc §6
- [ ] Imported JSON populates form correctly

### Steps

- [ ] **2.1 Initialize TypeScript project**
  - Create [frontend/package.json](frontend/package.json) with `typescript`, `vite`
  - Create [frontend/tsconfig.json](frontend/tsconfig.json) with strict mode
  - Create [frontend/vite.config.ts](frontend/vite.config.ts) for build config
  - Verify: `cd frontend && npm install && npm run build`

- [ ] **2.2 Create type definitions from Design Doc §6**
  - Create [frontend/src/types.ts](frontend/src/types.ts) with interfaces:
    - `SwitchConfig` (vendor, model, hostname, role, firmware, deployment_pattern)
    - `Vlan` (vlan_id, name, purpose, interface, redundancy)
    - `Interface` (name, type, intf_type, intf, ipv4, tagged_vlans, etc.)
    - `PortChannel` (id, description, type, members, vpc_peer_link)
    - `Mlag` (domain_id, peer_keepalive, delay_restore)
    - `Bgp` (asn, router_id, networks, neighbors)
    - `PrefixList` (seq, action, prefix)
    - `StandardConfig` (root object combining all)
  - Reference: Design Doc §6 field tables
  - Verify: `npm run typecheck`

- [ ] **2.3 Create validation module from Design Doc §7**
  - Create [frontend/src/validator.ts](frontend/src/validator.ts)
  - Implement cross-reference validation (VLANs ↔ interfaces, BGP router_id ↔ loopback)
  - Implement business logic rules (VLAN 1 reserved, Loopback0 required for BGP, etc.)
  - Return typed `ValidationResult` with errors array
  - Reference: Design Doc §7 "Validation Rules"
  - Verify: `npm run typecheck`

- [ ] **2.4 Create state management module**
  - Create [frontend/src/state.ts](frontend/src/state.ts)
  - Typed `WizardState` interface with:
    - `currentStep: 1 | 2 | 3 | 4`
    - `switch: Partial<SwitchConfig>`
    - `vlans: Vlan[]`
    - `interfaces: Interface[]`
    - `portChannels: PortChannel[]`
    - `mlag: Partial<Mlag>`
    - `bgp: Partial<Bgp>`
  - State getter/setter functions
  - Verify: `npm run typecheck`

- [ ] **2.5 Build HTML structure from Design Doc §3**
  - Create/replace [frontend/index.html](frontend/index.html)
  - Wizard steps per Design Doc:
    - Step 1: Switch (vendor, model, role, hostname, pattern) — Design Doc §5.1
    - Step 2: Network (VLANs → Host Ports → Redundancy → Uplinks) — Design Doc §5.2
    - Step 3: Routing (BGP or Static) — Design Doc §5.3
    - Step 4: Review & Export
  - Include breadcrumb navigation, sticky summary sidebar, progress bar
  - Reference: Design Doc §3 "User Workflow Overview" diagrams
  - Verify: HTML loads in browser

- [ ] **2.6 Build CSS styling**
  - Create/replace [frontend/style.css](frontend/style.css)
  - Dark theme with CSS variables
  - Card-based selection UI for vendor/model/role
  - Form styling for VLAN/port/BGP inputs
  - Responsive layout
  - Verify: Styled wizard displays correctly

- [ ] **2.7 Build main application logic**
  - Create [frontend/src/app.ts](frontend/src/app.ts)
  - Implement per Design Doc UI workflows:
    - Step 1: Card selection → auto-fill firmware from vendor+model
    - Step 2.1: VLAN form → build `vlans[]` with HSRP/VRRP auto-config
    - Step 2.2: Host port assignment → build `interfaces[]` trunks
    - Step 2.3: Redundancy → build `port_channels[]` peer-link + `mlag{}`
    - Step 2.4: Uplinks → build L3 `interfaces[]` + loopback
    - Step 3: BGP config → build `prefix_lists{}` + `bgp{}`
    - Step 4: Review → show summary, export JSON
  - Reference: Design Doc §4 "Function Workflow Overview"
  - Verify: `npm run typecheck`

- [ ] **2.8 Create Vite entry point**
  - Create [frontend/src/main.ts](frontend/src/main.ts) as entry point
  - Import and initialize app
  - Verify: `npm run dev` → wizard loads in browser

- [ ] **2.9 Create sanitized example configs**
  - Create [frontend/examples/dell-tor1.json](frontend/examples/dell-tor1.json)
  - Create [frontend/examples/dell-tor2.json](frontend/examples/dell-tor2.json)
  - Create [frontend/examples/dell-bmc.json](frontend/examples/dell-bmc.json)
  - Use dummy data (RFC 5737/5398 ranges)
  - Verify: `grep -r "100\.71\." frontend/examples/` returns nothing

- [ ] **2.10 Build production bundle**
  - Configure Vite output to [frontend/dist/](frontend/dist/)
  - Verify: `npm run build && ls frontend/dist/`

- [ ] **2.11 Playwright frontend tests**
  - Install: `npx playwright install --with-deps chromium`
  - Create [tests/frontend.spec.ts](tests/frontend.spec.ts)
  - Verify: `npx playwright test tests/frontend.spec.ts`

---

**Sanitization Reference:**

| Data Type | Replace With | RFC |
|-----------|--------------|-----|
| Hostnames | `example-tor1`, `example-tor2`, `example-bmc` | — |
| Management IPs | `192.0.2.0/24` | RFC 5737 TEST-NET-1 |
| Uplink IPs | `198.51.100.0/24` | RFC 5737 TEST-NET-2 |
| Loopback IPs | `203.0.113.0/24` | RFC 5737 TEST-NET-3 |
| BGP ASNs | `64500`, `64501` | RFC 5398 documentation |

---

## Phase 3: Backend Pipeline — Build Fresh, Frontend-Driven

### Design Principle

**Frontend-driven architecture:**
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  Standard JSON   │────▶│     Backend     │
│  (user input)   │     │   (contract)     │     │  (consumer)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
   Defines the             Schema lives in          Validates &
   JSON structure         backend/schema/          renders .cfg
```

- **Backend schema** ([backend/schema/standard.json](backend/schema/standard.json)) is derived FROM frontend needs
- Backend validates what frontend produces, not the other way around
- If frontend needs a new field, add to schema first, then backend supports it

### Acceptance Criteria
- [ ] CLI can process JSON exported from frontend
- [ ] Output .cfg files match expected structure in `_test/` samples
- [ ] All backend tests pass
- [ ] Schema reflects frontend's JSON output

### Steps

- [ ] **3.1 Project setup**
  - Create [backend/pyproject.toml](backend/pyproject.toml):
    ```toml
    [project]
    name = "network-config-generator"
    dependencies = ["jinja2", "jsonschema", "click"]
    
    [project.optional-dependencies]
    dev = ["pytest"]
    ```
  - Create [backend/src/__init__.py](backend/src/__init__.py)
  - Verify: `cd backend && pip install -e . && python3 -c "import jinja2; print('OK')"`

- [ ] **3.2 Update schema to match frontend output**
  - Review/update [backend/schema/standard.json](backend/schema/standard.json)
  - Ensure schema matches `frontend/src/types.ts` interfaces exactly
  - Schema is the contract between frontend and backend
  - Verify: Frontend example JSONs validate against schema

- [ ] **3.3 Create validator (consumes frontend JSON)**
  - Create [backend/src/validator.py](backend/src/validator.py) with `StandardValidator` class
  - Validate against schema
  - Check cross-references per Design Doc §7:
    - `interfaces.tagged_vlans` → all VLANs exist in `vlans[]`
    - `port_channels.members` → all ports exist
    - `bgp.router_id` → matches loopback interface IP
  - Return structured validation errors
  - Verify: `python3 -c "from src.validator import StandardValidator; print('OK')"`

- [ ] **3.4 Create transformer (enriches frontend JSON)**
  - Create [backend/src/transformer.py](backend/src/transformer.py) with `Transformer` class
  - Add `_computed` section (values frontend doesn't need to know):
    - Role-based priorities per Design Doc §5.1:
      - TOR1: hsrp_priority=150, mlag_role_priority=1, mst_priority=8192
      - TOR2: hsrp_priority=100, mlag_role_priority=32667, mst_priority=16384
      - BMC: mst_priority=32768
  - Add template helper flags: `has_bgp`, `has_mlag`, `has_qos`, `has_static_routes`
  - Verify: `python3 -c "from src.transformer import Transformer; print('OK')"`

- [ ] **3.5 Create context builder**
  - Create [backend/src/context.py](backend/src/context.py) with `ContextBuilder` class
  - Merge original JSON + `_computed` into template context
  - Flatten nested structures for easier Jinja2 access
  - Verify: `python3 -c "from src.context import ContextBuilder; print('OK')"`

- [ ] **3.6 Create renderer**
  - Create [backend/src/renderer.py](backend/src/renderer.py) with `Renderer` class
  - Load Jinja2 templates from `backend/templates/{vendor}/{firmware}/`
  - Render individual sections or full config
  - Output to files or return strings
  - Verify: `python3 -c "from src.renderer import Renderer; print('OK')"`

- [ ] **3.7 Create CLI**
  - Create [backend/src/cli.py](backend/src/cli.py) with Click:
    ```
    validate <input.json>              # Validate frontend JSON
    transform <input.json>             # Validate + add computed values
    generate <input.json> -o <dir>     # Full pipeline → .cfg files
    ```
  - Verify: `python3 -m src.cli --help`

- [ ] **3.8 Create Dell OS10 templates**
  - Create [backend/templates/dellemc/os10/](backend/templates/dellemc/os10/)
  - Reference output structure: [_test/rr1-n25-r20-5248hl-23-1a/generated_*.cfg](_test/rr1-n25-r20-5248hl-23-1a/)
  - Templates:
    - `system.j2` — hostname, banner
    - `vlan.j2` — VLAN definitions
    - `interface.j2` — port configs (access, trunk, L3)
    - `port_channel.j2` — LAG/MLAG peer-link
    - `bgp.j2` — BGP routing
    - `prefix_list.j2` — route filtering
    - `qos.j2` — QoS policies
    - `login.j2` — authentication
    - `full_config.j2` — includes all above
  - Verify: `ls backend/templates/dellemc/os10/*.j2 | wc -l` ≥ 8

- [ ] **3.9 Create Cisco NXOS templates**
  - Create [backend/templates/cisco/nxos/](backend/templates/cisco/nxos/)
  - Reference output: [_test/s46-r21-93180hl-24-1a.config](_test/s46-r21-93180hl-24-1a.config)
  - Templates (same as Dell plus):
    - `vpc.j2` — VPC/MLAG config
    - `stp.j2` — Spanning tree
  - Verify: `ls backend/templates/cisco/nxos/*.j2 | wc -l` ≥ 10

- [ ] **3.10 Create backend tests**
  - Create [backend/tests/__init__.py](backend/tests/__init__.py)
  - Create [backend/tests/test_validator.py](backend/tests/test_validator.py) — test with frontend examples
  - Create [backend/tests/test_transformer.py](backend/tests/test_transformer.py) — test computed values
  - Create [backend/tests/test_renderer.py](backend/tests/test_renderer.py) — test template rendering
  - Verify: `cd backend && python3 -m pytest tests/ -v`

---

## Phase 4: Integration Testing — Frontend → Backend Flow

### Design Principle

**Test the real flow:**
```
User fills wizard → Export JSON → Backend CLI → .cfg files → Diff against reference
```

Not: Test backend in isolation with hand-crafted JSON.

### Acceptance Criteria
- [ ] JSON exported from frontend validates in backend
- [ ] Generated .cfg files match expected structure
- [ ] Automated tests cover full pipeline
- [ ] CI runs all tests before deploy

### Steps

- [ ] **4.1 Validate frontend examples with backend**
  - Run: `python3 -m src.cli validate frontend/examples/dell-tor1.json`
  - Run: `python3 -m src.cli validate frontend/examples/dell-tor2.json`
  - Run: `python3 -m src.cli validate frontend/examples/dell-bmc.json`
  - Verify: All pass validation

- [ ] **4.2 Dell TOR1 generation test**
  - Input: [frontend/examples/dell-tor1.json](frontend/examples/dell-tor1.json)
  - Run: `python3 -m src.cli generate frontend/examples/dell-tor1.json -o /tmp/dell-tor1/`
  - Compare structure vs [_test/rr1-n25-r20-5248hl-23-1a/](_test/rr1-n25-r20-5248hl-23-1a/)
  - Verify: Same files generated, similar structure (IPs differ due to sanitization)

- [ ] **4.3 Dell TOR2 generation test**
  - Input: [frontend/examples/dell-tor2.json](frontend/examples/dell-tor2.json)
  - Compare structure vs [_test/rr1-n25-r20-5248hl-23-1b/](_test/rr1-n25-r20-5248hl-23-1b/)
  - Verify: Same files, similar structure

- [ ] **4.4 Dell BMC generation test**
  - Input: [frontend/examples/dell-bmc.json](frontend/examples/dell-bmc.json)
  - Compare structure vs [_test/rr1-n25-r20-3248bmc-23-1/](_test/rr1-n25-r20-3248bmc-23-1/)
  - Verify: Same files, simpler config (no MLAG/BGP)

- [ ] **4.5 Cisco TOR generation test**
  - Create [frontend/examples/cisco-tor1.json](frontend/examples/cisco-tor1.json) with sanitized data
  - Compare structure vs [_test/s46-r21-93180hl-24-1a.config](_test/s46-r21-93180hl-24-1a.config)
  - Verify: Similar structure

- [ ] **4.6 Playwright E2E tests**
  - Create [tests/e2e.spec.ts](tests/e2e.spec.ts)
  - Test:
    1. Load wizard
    2. Fill Step 1 (switch config)
    3. Fill Step 2 (network config)
    4. Fill Step 3 (routing config)
    5. Export JSON
    6. Verify JSON structure matches schema
    7. Import JSON back → verify form populated
  - Verify: `npx playwright test tests/e2e.spec.ts`

- [ ] **4.7 Create backend E2E test**
  - Create [backend/tests/test_e2e.py](backend/tests/test_e2e.py)
  - Test: Load each `frontend/examples/*.json` → validate → transform → generate → check output files exist
  - Verify: `python3 -m pytest tests/test_e2e.py -v`

- [ ] **4.8 Create CI workflow**
  - Create/update [.github/workflows/ci.yml](.github/workflows/ci.yml):
    ```yaml
    - Frontend: npm install → npm run build → npm run typecheck
    - Backend: pip install → pytest
    - Playwright: npx playwright install → npx playwright test
    ```
  - Verify: Push triggers workflow, all tests pass

- [ ] **4.9 Update GitHub Pages workflow**
  - Modify [.github/workflows/pages.yml](.github/workflows/pages.yml):
    - Build frontend: `cd frontend && npm install && npm run build`
    - Deploy: `frontend/dist/`
  - Verify: Workflow succeeds, site accessible

- [ ] **4.10 Cleanup old files**
  - Remove prototype files after TypeScript version complete:
    - [frontend/app.js](frontend/app.js)
    - [frontend/schema.js](frontend/schema.js)
  - Keep [archive/v1/](archive/v1/) as historical reference
  - Verify: No broken imports

---

### Final Success Criteria

| Criteria | Verification |
|----------|--------------|
| Frontend builds | `cd frontend && npm run build` exits 0 |
| Frontend loads | Browser shows wizard at localhost |
| TypeScript clean | `npm run typecheck` no errors |
| JSON export valid | `python3 -m src.cli validate <exported.json>` passes |
| JSON import works | Import → all form fields populate |
| Backend tests pass | `python3 -m pytest tests/ -v` all green |
| Dell configs generate | Output files match expected structure |
| Cisco configs generate | Output files match expected structure |
| Playwright tests pass | `npx playwright test` all green |
| CI passes | GitHub Actions workflow succeeds |
| GitHub Pages deploys | Site accessible at published URL |

---

### Commands Reference

```bash
# Frontend (TypeScript)
cd /workspace/frontend && npm install        # Install dependencies
cd /workspace/frontend && npm run dev        # Start dev server with HMR
cd /workspace/frontend && npm run build      # Build for production
cd /workspace/frontend && npm run typecheck  # Check types

# Backend (Python)
cd /workspace/backend && pip install -e ".[dev]"             # Install with dev deps
cd /workspace/backend && python3 -m src.cli validate <file>  # Validate JSON
cd /workspace/backend && python3 -m src.cli generate <file> -o <dir>  # Generate .cfg
cd /workspace/backend && python3 -m pytest tests/ -v         # Run tests

# Playwright
npx playwright install --with-deps chromium  # Install browser
npx playwright test                          # Run all tests
npx playwright test tests/e2e.spec.ts        # Run E2E tests

# Full validation
cd /workspace/frontend && npm run build && \
cd /workspace/backend && python3 -m pytest tests/ -v && \
npx playwright test
```

---

### Further Considerations

1. **Schema evolution:** If frontend needs new fields, update `backend/schema/standard.json` first, then update `frontend/src/types.ts` to match
2. **Template accuracy:** Focus on structural equivalence; minor whitespace/ordering differences acceptable
3. **Error handling:** Frontend should show user-friendly validation errors from backend
4. **Future vendors:** New vendor templates follow same pattern: `backend/templates/{vendor}/{firmware}/*.j2`
