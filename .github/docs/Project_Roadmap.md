# Azure Local Network Config Tool — Project Roadmap

**Version:** 7.0  
**Date:** January 29, 2026  
**Status:** Frontend Refresh (Pattern-First UI Redesign)  
**Design Doc:** [AzureLocal_NetworkConfTool_Project_Design_Doc.md](AzureLocal_NetworkConfTool_Project_Design_Doc.md)

---

## Overview

Rebuild frontend to match Design Doc's 3-phase structure. Use current 7-step implementation as reference for working code patterns (validation, state management, export logic). Pattern-first visual selection drives entire UX.

### Architecture Comparison

| Aspect | Current (Reference) | Target (Design Doc) |
|--------|---------------------|---------------------|
| Navigation | 7 flat steps | 3 phases with sub-steps |
| Flow | Vendor → Model → Role → Pattern | **Pattern → Vendor → Model → Role** |
| Templates | By role (`dell-tor1`) | By pattern (`fully-converged/sample-tor1`) |
| Pattern UI | Small card at bottom | Visual card with topology image + persistent sidebar |
| Phase 2 | Steps 2-5 separate | 4 sub-steps (2.1-2.4) grouped |

---

## Target Phase Structure

```
Phase 1: Pattern & Switch
├── 1.1 Select Pattern (visual cards with topology images)
├── 1.2 Select Hardware (Vendor → Model dropdowns)
├── 1.3 Select Role (TOR1 / TOR2)
└── 1.4 Hostname (auto-filled, editable)

Phase 2: Network
├── 2.1 VLANs (pattern-driven defaults)
├── 2.2 Host Ports (port range + VLAN assignment)
├── 2.3 Redundancy (vPC/MLAG peer-link, keepalive)
└── 2.4 Uplinks (L3 interfaces, Loopback)

Phase 3: Routing
├── 3.1 BGP (ASN, neighbors) OR
└── 3.2 Static Routes (destination, next-hop)

→ Review & Export
```

---

## Execution Order

```
1. SCHEMA ────────────────────── ✅ Done (backend/schema/standard.json)
   │
2. FRONTEND REFRESH ◄─────────── 🔴 CURRENT FOCUS
   │
   ├─ (1) Prep / Assets
   ├─ (2) HTML Restructure
   ├─ (3) TypeScript Rewrite
   ├─ (4) CSS Updates
   ├─ (5) Example JSON Files
   ├─ (6) Tests
   │
3. BACKEND ───────────────────── After frontend validates
   │
   ├─ Cisco NX-OS templates (stubs)
   ├─ Integration test with frontend output
   │
4. E2E TESTING ───────────────── After both work
```

---

## Implementation Checklist

### (1) Prep / Assets

- [ ] **Download pattern topology images** to `frontend/media/`:
  ```bash
  mkdir -p frontend/media
  curl -o frontend/media/pattern-switchless.png "https://raw.githubusercontent.com/Azure/AzureLocal-Supportability/main/TSG/Networking/Top-Of-Rack-Switch/images/AzureLocalPhysicalNetworkDiagram_Switchless.png"
  curl -o frontend/media/pattern-switched.png "https://raw.githubusercontent.com/Azure/AzureLocal-Supportability/main/TSG/Networking/Top-Of-Rack-Switch/images/AzureLocalPhysicalNetworkDiagram_Switched.png"
  curl -o frontend/media/pattern-fully-converged.png "https://raw.githubusercontent.com/Azure/AzureLocal-Supportability/main/TSG/Networking/Top-Of-Rack-Switch/images/AzureLocalPhysicalNetworkDiagram_FullyConverged.png"
  ```

- [ ] **Backup current working code** for reference:
  ```bash
  cp frontend/index.html frontend/index.html.v1-reference
  cp frontend/src/app.ts frontend/src/app.ts.v1-reference
  ```

---

### (2) HTML Restructure

**File:** `frontend/index.html`

#### 2.1 Navigation Bar

- [ ] **Replace 7-step nav with 3-phase nav**:
  ```html
  <nav class="top-nav">
    <div class="nav-phase active" data-phase="1">
      <div class="phase-number">1</div>
      <div class="phase-label">Pattern & Switch</div>
    </div>
    <div class="nav-phase" data-phase="2">
      <div class="phase-number">2</div>
      <div class="phase-label">Network</div>
      <div class="sub-steps">
        <span data-step="2.1">VLANs</span>
        <span data-step="2.2">Ports</span>
        <span data-step="2.3">Redundancy</span>
        <span data-step="2.4">Uplinks</span>
      </div>
    </div>
    <div class="nav-phase" data-phase="3">
      <div class="phase-number">3</div>
      <div class="phase-label">Routing</div>
    </div>
  </nav>
  ```

#### 2.2 Persistent Pattern Sidebar

- [ ] **Add sidebar after nav, before main content**:
  ```html
  <aside id="pattern-sidebar" class="pattern-sidebar" style="display: none;">
    <div class="sidebar-thumbnail">
      <img id="sidebar-pattern-img" src="" alt="Selected pattern">
      <button onclick="expandPatternImage()">🔍 Expand</button>
    </div>
    <div class="sidebar-info">
      <strong id="sidebar-pattern-name"></strong>
      <p class="storage-rule">⚠️ Storage VLANs never on peer-link</p>
    </div>
    <button class="change-pattern-btn" onclick="changePattern()">Change Pattern</button>
  </aside>
  ```

#### 2.3 Phase 1: Pattern & Switch

- [ ] **Pattern selection FIRST with visual cards**:
  ```html
  <div id="phase1" class="phase active">
    <h2>Phase 1: Pattern & Switch</h2>
    
    <!-- 1.1 Pattern Selection (FIRST) -->
    <section class="form-section pattern-selection">
      <h3>1.1 Select Deployment Pattern</h3>
      <p>Choose how storage traffic flows in your Azure Local deployment</p>
      
      <div class="pattern-cards">
        <div class="pattern-card" data-pattern="switchless" onclick="selectPattern('switchless')">
          <img src="media/pattern-switchless.png" alt="Switchless topology">
          <h4>🔌 Switchless</h4>
          <p>Storage direct host-to-host. Edge/cost-sensitive.</p>
          <span class="pattern-tag">VLANs: M, C only</span>
        </div>
        
        <div class="pattern-card" data-pattern="switched" onclick="selectPattern('switched')">
          <img src="media/pattern-switched.png" alt="Switched topology">
          <h4>💾 Switched</h4>
          <p>Storage on dedicated switch ports. Enterprise isolation.</p>
          <span class="pattern-tag">VLANs: M, C, S1 or S2</span>
        </div>
        
        <div class="pattern-card recommended" data-pattern="fully_converged" onclick="selectPattern('fully_converged')">
          <img src="media/pattern-fully-converged.png" alt="Fully Converged topology">
          <h4>🔄 Fully Converged ★</h4>
          <p>All traffic on shared ports. General purpose.</p>
          <span class="pattern-tag">VLANs: M, C, S1, S2</span>
        </div>
      </div>
    </section>
    
    <!-- 1.2 Hardware Selection (dropdowns) -->
    <section class="form-section hardware-selection" style="display: none;">
      <h3>1.2 Select Hardware</h3>
      <div class="form-row">
        <label for="vendor-select">Vendor</label>
        <select id="vendor-select" onchange="onVendorChange()">
          <option value="">-- Select Vendor --</option>
          <option value="cisco">Cisco</option>
          <option value="dellemc">Dell EMC</option>
        </select>
      </div>
      <div class="form-row">
        <label for="model-select">Model</label>
        <select id="model-select" disabled>
          <option value="">-- Select Vendor First --</option>
        </select>
      </div>
    </section>
    
    <!-- 1.3 Role Selection -->
    <section class="form-section role-selection" style="display: none;">
      <h3>1.3 Select Role</h3>
      <div class="role-cards">
        <div class="role-card" data-role="TOR1" onclick="selectRole('TOR1')">
          <h4>TOR1</h4>
          <p>Primary (HSRP priority 150)</p>
        </div>
        <div class="role-card" data-role="TOR2" onclick="selectRole('TOR2')">
          <h4>TOR2</h4>
          <p>Secondary (HSRP priority 100)</p>
        </div>
      </div>
    </section>
    
    <!-- 1.4 Hostname -->
    <section class="form-section hostname-section" style="display: none;">
      <h3>1.4 Hostname</h3>
      <input type="text" id="hostname" placeholder="Auto-generated based on role">
    </section>
  </div>
  ```

#### 2.4 Phase 2: Network

- [ ] **Create Phase 2 container with 4 sub-sections** (consolidate current Steps 2-5):
  - `2.1 VLANs` — from current Step 2
  - `2.2 Host Ports` — from current Step 3
  - `2.3 Redundancy` — from current Step 4
  - `2.4 Uplinks` — from current Step 5

#### 2.5 Phase 3: Routing

- [ ] **Create Phase 3 with BGP/Static toggle** (from current Step 6)

#### 2.6 Template Modal

- [ ] **Reorganize by pattern** (not by role):
  - Fully Converged: `sample-tor1`, `sample-tor2`
  - Switched: `sample-tor1`, `sample-tor2`
  - Switchless: `sample-tor1`

---

### (3) TypeScript Rewrite

**File:** `frontend/src/app.ts`

#### 3.1 State Management

- [ ] **Update state interface** in `state.ts`:
  ```typescript
  interface WizardState {
    currentPhase: 1 | 2 | 3;
    currentSubStep: string;  // "2.1", "2.2", etc.
    selectedPattern: DeploymentPattern | null;
    // ... keep existing fields
  }
  ```

#### 3.2 New Pattern-First Functions

| Function | Purpose |
|----------|---------|
| `selectPattern(pattern)` | Set pattern, show sidebar, reveal hardware section |
| `showPatternSidebar(pattern)` | Display persistent thumbnail (150×100px) |
| `expandPatternImage()` | Lightbox for full topology image |
| `changePattern()` | Return to Phase 1 with confirmation |
| `getPatternVlans(pattern)` | Return allowed VLANs for pattern |
| `getPatternHostVlans(pattern)` | Return `tagged_vlans` string for pattern |

#### 3.3 Navigation Rewrite

- [ ] **Replace `showStep(stepNum)` with `showPhase(phase, subStep?)`**
- [ ] **Replace `nextStep()` with `nextPhase()`**:
  - Phase 1 → Phase 2.1
  - Phase 2.1 → 2.2 → 2.3 → 2.4 → Phase 3
  - Phase 3 → Review
- [ ] **Update `updateNavigationUI()`** for phases

#### 3.4 Pattern-Driven Logic

- [ ] **`getPatternVlans(pattern)`**:
  ```typescript
  switch (pattern) {
    case 'switchless': return ['management', 'compute'];
    case 'switched': return ['management', 'compute', role === 'TOR1' ? 'storage_1' : 'storage_2'];
    case 'fully_converged': return ['management', 'compute', 'storage_1', 'storage_2'];
  }
  ```

- [ ] **`getPatternHostVlans(pattern)`**:
  ```typescript
  switch (pattern) {
    case 'switchless': return '7,201';
    case 'switched': return role === 'TOR1' ? '7,201,711' : '7,201,712';
    case 'fully_converged': return '7,201,711,712';
  }
  ```

#### 3.5 Keep From Current (Reference)

| Keep | File | Reason |
|------|------|--------|
| `validateConfig()` | `validator.ts` | AJV schema validation works |
| `exportJSON()` | `app.ts` | Output format unchanged |
| `importJSON()` | `app.ts` | Input format unchanged |
| VLAN form handling | `app.ts` | Wire to pattern logic |
| BGP neighbor management | `app.ts` | Dynamic add/remove works |

---

### (4) CSS Updates

**File:** `frontend/style.css`

- [ ] **Pattern card styles** — cards with images, selected/recommended states
- [ ] **Pattern sidebar styles** — fixed position, thumbnail, expand button
- [ ] **Phase navigation styles** — 3 phases, expandable sub-steps
- [ ] **Lightbox styles** — full-screen image overlay

---

### (5) Example JSON Files

**Location:** `frontend/examples/`

| File | Pattern | VLANs | Host tagged_vlans |
|------|---------|-------|-------------------|
| `fully-converged/sample-tor1.json` | fully_converged | M, C, S1, S2 | `7,201,711,712` |
| `fully-converged/sample-tor2.json` | fully_converged | M, C, S1, S2 | `7,201,711,712` |
| `switched/sample-tor1.json` | switched | M, C, S1 | `7,201,711` |
| `switched/sample-tor2.json` | switched | M, C, S2 | `7,201,712` |
| `switchless/sample-tor1.json` | switchless | M, C | `7,201` |

> **Critical Rule:** Peer-link `tagged_vlans` is always `7,201` (no storage) in all patterns.

---

### (6) Tests

**File:** `tests/wizard-e2e.spec.ts`

- [ ] **Pattern-first flow test**:
  ```typescript
  test('pattern-first flow', async ({ page }) => {
    await page.goto('/');
    await page.click('.pattern-card[data-pattern="fully_converged"]');
    await expect(page.locator('#pattern-sidebar')).toBeVisible();
    await page.selectOption('#vendor-select', 'cisco');
    await page.selectOption('#model-select', '93180YC-FX3');
    await page.click('.role-card[data-role="TOR1"]');
    await expect(page.locator('#hostname')).toHaveValue(/tor1/i);
  });
  ```

- [ ] **Pattern-specific VLAN visibility tests**
- [ ] **Peer-link storage VLAN exclusion test**

---

### (7) Backend (After Frontend)

- [ ] **Cisco NX-OS template stubs** in `backend/templates/cisco/nxos/`:
  - `full_config.j2`, `system.j2`, `vlan.j2`, `interface.j2`, `port_channel.j2`, `bgp.j2`

- [ ] **Verify Dell OS10 templates** work with new examples

---

## Validation Checkpoints

| After | Run | Expected |
|-------|-----|----------|
| HTML changes | `npm run dev` | Page loads, no console errors |
| TypeScript changes | `npm run typecheck` | No type errors |
| Pattern images added | Manual check | Images display in cards |
| Example JSONs created | `npm run backend:test` | Schema validation passes |
| Full flow | `npm run test` | E2E tests pass |

---

## Acceptance Checklist

| Design Doc Requirement | Verification |
|------------------------|--------------|
| Pattern visual cards first | Phase 1.1 shows 3 cards with images |
| Vendor dropdown (not cards) | Phase 1.2 uses `<select>` |
| Persistent pattern sidebar | Sidebar visible after pattern selection |
| 3-phase navigation | Nav shows Phase 1, 2 (with sub-steps), 3 |
| Pattern drives VLANs | Switchless hides S1/S2; Switched shows one |
| Peer-link no storage | `tagged_vlans` on peer-link is always `7,201` |
| Templates by pattern | Modal organized as Fully Converged / Switched / Switchless |

---

## Risk & Rollback

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing validation | Export fails | Keep `validator.ts` unchanged |
| State migration issues | Form data lost | Backup v1-reference files |
| Image fetch fails | Cards show broken images | Add fallback placeholder |

**Rollback:** Restore from `*.v1-reference` backup files.

---

## Commands Reference

```bash
# Frontend
cd /workspace/frontend && npm install
cd /workspace/frontend && npm run dev       # Start dev server
cd /workspace/frontend && npm run typecheck # Check types
cd /workspace/frontend && npm run build     # Build for production

# Backend
cd /workspace/backend && python -m src.cli validate <input.json>
cd /workspace/backend && python -m src.cli generate <input.json> -o <output_dir>
cd /workspace/backend && python -m pytest tests/ -v

# E2E Tests
npm run test          # Run Playwright tests
npm run test:ui       # Run with UI
```

---

## Reference Files

| Purpose | Location |
|---------|----------|
| Design Doc | `.github/docs/AzureLocal_NetworkConfTool_Project_Design_Doc.md` |
| JSON Schema | `backend/schema/standard.json` |
| Current app.ts (reference) | `frontend/src/app.ts.v1-reference` (after backup) |
| Current index.html (reference) | `frontend/index.html.v1-reference` (after backup) |
| Azure Deployment Patterns | [GitHub](https://github.com/Azure/AzureLocal-Supportability/blob/main/TSG/Networking/Top-Of-Rack-Switch/Overview-Azure-Local-Deployment-Pattern.md) |

---

**Next Step:** Start with **(1) Prep / Assets** — download pattern images.
