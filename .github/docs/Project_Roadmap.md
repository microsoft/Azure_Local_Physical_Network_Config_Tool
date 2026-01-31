# Azure Local Switch Configuration Wizard — Project Roadmap

**Version:** 9.0  
**Date:** January 30, 2026  
**Status:** Frontend Redesign (Odin UI Integration)  
**Reference:** [Odin for Azure Local](https://neilbird.github.io/Odin-for-AzureLocal/)

---

## Executive Summary

Complete frontend redesign to match Odin for Azure Local's UI design system while preserving all existing switch configuration logic. The redesign adopts Odin's dark theme, single-page scroll layout, numbered sections, sticky summary sidebar, breadcrumb navigation, theme toggle, and accessibility controls.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Azure Local Switch Configuration Wizard         [📋 Load] [📁 Import]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ STATS: 👁️ Page Views: 268  📄 Configs Generated: 45  📦 Exports: 35            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: [1 Pattern ✓] › [2 VLANs ✓] › [3 Ports] › [4 Redund] › ...        │
├────────────────────────────────────────────────────┬────────────────────────────┤
│                                                    │                            │
│  ┌──────────────────────────────────────────────┐  │  ┌──────────────────────┐  │
│  │ 01 Pattern & Switch                          │  │  │ Progress    75% 5/7  │  │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐         │  │  │ ████████████░░░░░░░  │  │
│  │ │Switchless│ │ Switched │ │Fully FC │         │  │  ├──────────────────────┤  │
│  │ └─────────┘ └─────────┘ └─────────┘         │  │  │ Font: [A-][A+]       │  │
│  │                                              │  │  │ Theme: [🌙/☀️]        │  │
│  │ Vendor: [▼ Dell EMC    ]                    │  │  ├──────────────────────┤  │
│  │ Model:  [▼ S5248F-ON   ]                    │  │  │ CONFIG SUMMARY       │  │
│  │                                              │  │  │                      │  │
│  │ Role: [TOR1 ✓] [TOR2]  Hostname: [______]  │  │  │ Pattern: Fully Conv  │  │
│  └──────────────────────────────────────────────┘  │  │ Vendor: Dell EMC     │  │
│                                                    │  │ Model: S5248F-ON     │  │
│  ┌──────────────────────────────────────────────┐  │  │ Role: TOR1           │  │
│  │ 02 VLANs                                     │  │  │ Hostname: tor1       │  │
│  │                                              │  │  │                      │  │
│  │ Management: [7    ] Name: [Infra_7    ]     │  │  │ VLANs: 4 configured  │  │
│  │ Compute:    [201  ] Name: [Compute_201]     │  │  │ Routing: BGP         │  │
│  │ Storage 1:  [711  ] Name: [Storage1_711]    │  │  └──────────────────────┘  │
│  │ Storage 2:  [712  ] Name: [Storage2_712]    │  │                            │
│  └──────────────────────────────────────────────┘  │  ┌──────────────────────┐  │
│                                                    │  │ [📋 Load Template   ]│  │
│  ┌──────────────────────────────────────────────┐  │  ├──────────────────────┤  │
│  │ 03 Host Ports                                │  │  │[📁Import][💾Export] │  │
│  │ ...                                          │  │  ├──────────────────────┤  │
│  └──────────────────────────────────────────────┘  │  │ [   ↺ Start Over   ] │  │
│                                                    │  └──────────────────────┘  │
│  ... (04 Redundancy, 05 Uplinks, 06 Routing,      │                            │
│       07 Review & Export)                          │                            │
│                                                    │                            │
└────────────────────────────────────────────────────┴────────────────────────────┘
```

---

## Odin UI Design Patterns Analysis

### 1. Layout Structure

| Component | Odin Pattern | Implementation |
|-----------|--------------|----------------|
| **Container** | `.layout-flex` with 2 columns | Steps column + Summary column |
| **Steps Column** | `.steps-column` flex:1 | All numbered sections |
| **Summary Column** | `.summary-column` width:460px fixed | Sticky sidebar |
| **Sidebar** | `position: sticky; top: 2rem; max-height: calc(100vh - 4rem); overflow-y: auto` | Own scrollbar, pinned |

### 2. CSS Variables (Theme System)

```css
/* Dark Theme (Default) */
:root {
  --bg-dark: #000000;
  --card-bg: #111111;
  --card-bg-transparent: rgba(17, 17, 17, 0.95);
  --text-primary: #ffffff;
  --text-secondary: #a1a1aa;
  --accent-blue: #0078d4;
  --accent-purple: #8b5cf6;
  --success: #10b981;
  --glass-border: rgba(255, 255, 255, 0.1);
  --subtle-bg: rgba(255, 255, 255, 0.03);
  --subtle-bg-hover: rgba(255, 255, 255, 0.06);
}

/* Light Theme (Toggle) */
body.light-theme {
  --bg-dark: #f5f5f7;
  --card-bg: #ffffff;
  --text-primary: #1a1a1a;
  --text-secondary: #6b7280;
  --glass-border: rgba(0, 0, 0, 0.1);
}
```

### 3. Step/Section Structure

```html
<section class="step" id="step-1">
  <div class="step-header">
    <span class="step-number">01</span>
    <h2>Section Title</h2>
  </div>
  <!-- Content -->
</section>
```

```css
.step {
  margin-bottom: 3rem;
  background: var(--card-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 2rem;
}

.step-number {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--accent-blue);
  background: rgba(0, 120, 212, 0.1);
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  border: 1px solid rgba(0, 120, 212, 0.2);
}
```

### 4. Option Card Pattern

```html
<div class="option-card" data-value="value" onclick="selectOption('key', 'value')">
  <div class="icon"><svg>...</svg></div>
  <h3>Title</h3>
  <p>Description</p>
</div>
```

```css
.option-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.option-card:hover {
  background: rgba(255, 255, 255, 0.06);
  transform: translateY(-2px);
}

.option-card.selected {
  background: rgba(0, 120, 212, 0.1);
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 1px var(--accent-blue), 0 4px 20px rgba(0, 120, 212, 0.2);
}

.option-card.selected::after {
  content: '✓';
  position: absolute;
  top: 8px; right: 8px;
  width: 20px; height: 20px;
  background: var(--accent-blue);
  border-radius: 50%;
  color: white;
  font-size: 12px;
}
```

### 5. Progress Bar

```html
<div class="wizard-progress">
  <div class="wizard-progress__top">
    <div class="wizard-progress__title">Progress</div>
    <div class="wizard-progress__text">75% • 5/7</div>
  </div>
  <div class="wizard-progress__bar">
    <div class="wizard-progress__fill" style="width: 75%"></div>
  </div>
</div>
```

```css
.wizard-progress__fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(0, 120, 212, 0.85), rgba(139, 92, 246, 0.85));
}
```

### 6. Breadcrumb Navigation

```html
<nav class="breadcrumb-nav">
  <div class="breadcrumb-container">
    <button class="breadcrumb-item completed" onclick="scrollToStep('step-1')">
      <span class="breadcrumb-number">1</span>
      <span class="breadcrumb-label">Pattern</span>
      <span class="breadcrumb-check">✓</span>
    </button>
    <span class="breadcrumb-separator">›</span>
    <!-- More items -->
  </div>
</nav>
```

### 7. Summary Sidebar Structure

```html
<div id="summary-panel">
  <!-- Progress -->
  <div class="wizard-progress">...</div>
  
  <!-- Accessibility Controls -->
  <div class="controls-row">
    <span>Font: <button>A−</button> <button>A+</button></span>
    <span>Theme: <button id="theme-toggle">🌙</button></span>
  </div>
  
  <!-- Summary Content -->
  <h3>Configuration Summary</h3>
  <div id="summary-content">
    <div class="summary-section">
      <div class="summary-section-title">Switch</div>
      <div class="summary-row">
        <span class="summary-label">Pattern</span>
        <span class="summary-value">Fully Converged</span>
      </div>
    </div>
  </div>
  
  <!-- Action Buttons -->
  <button class="action-btn primary">📋 Load Example Template</button>
  <div class="btn-row">
    <button class="action-btn">📁 Import JSON</button>
    <button class="action-btn">💾 Export Config</button>
  </div>
  <button class="reset-button">↺ Start Over</button>
</div>
```

### 8. Toast Notifications

```javascript
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white; border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}
```

### 9. State Management Pattern

```javascript
const state = {
  // UI state
  theme: 'dark',
  fontSize: 'medium',
  
  // Config state (preserve from current app.ts)
  config: {
    switch: { vendor, model, firmware, hostname, role, deployment_pattern },
    vlans: [],
    interfaces: [],
    port_channels: [],
    mlag: {},
    bgp: {},
    static_routes: []
  }
};

// Auto-save to localStorage
function saveStateToLocalStorage() {
  localStorage.setItem('wizardState', JSON.stringify(state));
}

// Load on init
function loadStateFromLocalStorage() {
  const saved = localStorage.getItem('wizardState');
  if (saved) Object.assign(state, JSON.parse(saved));
}
```

---

## Implementation Plan

### Phase 1: CSS Foundation (Priority: High)

**File:** `frontend/odin-theme.css` (replace current)

| Task | Status |
|------|--------|
| Extract Odin CSS variables (dark/light themes) | ⏳ |
| Copy `.step`, `.step-header`, `.step-number` styles | ⏳ |
| Copy `.option-card` with selected/hover states | ⏳ |
| Copy `.layout-flex`, `.steps-column`, `.summary-column` | ⏳ |
| Copy `#summary-panel` sticky sidebar styles | ⏳ |
| Copy `.wizard-progress` progress bar | ⏳ |
| Copy `.breadcrumb-nav` styles | ⏳ |
| Copy `.info-box`, `.hidden`, animations | ⏳ |
| Copy responsive breakpoints (768px, 480px) | ⏳ |
| Add light theme overrides | ⏳ |

### Phase 2: HTML Restructure (Priority: High)

**File:** `frontend/index.html` (major rewrite)

| Task | Status |
|------|--------|
| Add `<div class="background-globes">` for subtle gradients | ⏳ |
| Add `<nav class="breadcrumb-nav">` with 7 steps | ⏳ |
| Add `<div id="page-statistics">` with view/export counters | ⏳ |
| Wrap content in `.layout-flex > .steps-column + .summary-column` | ⏳ |
| Convert phases to numbered sections (01-07) | ⏳ |
| Build `#summary-panel` with progress, controls, summary, buttons | ⏳ |
| Keep all form inputs and IDs intact for app.ts compatibility | ⏳ |

**Section Mapping:**

| Old Structure | New Section | Number |
|---------------|-------------|--------|
| Phase 1 | Pattern & Switch | 01 |
| Phase 2.1 VLANs | VLANs | 02 |
| Phase 2.2 Ports | Host Ports | 03 |
| Phase 2.3 Redundancy | Redundancy | 04 |
| Phase 3 Uplinks | Uplinks | 05 |
| Phase 3 Routing | Routing | 06 |
| Review | Review & Export | 07 |

### Phase 3: TypeScript Updates (Priority: High)

**File:** `frontend/src/app.ts` (modify, don't replace)

| Task | Status |
|------|--------|
| Remove `showPhase()`, `nextPhase()`, `previousPhase()` | ⏳ |
| Add `scrollToSection(id)` for breadcrumb navigation | ⏳ |
| Add `updateProgress()` counting 7 sections | ⏳ |
| Add `updateBreadcrumbs()` marking completed with ✓ | ⏳ |
| Add `toggleTheme()` dark/light toggle | ⏳ |
| Add `increaseFontSize()` / `decreaseFontSize()` | ⏳ |
| Add `trackPageView()`, `trackExport()` for stats | ⏳ |
| Update `updateConfigSummary()` for new sidebar format | ⏳ |
| Keep all validation, export, import logic intact | ✅ |

### Phase 4: Test Updates (Priority: High)

**File:** `tests/wizard-e2e.spec.ts` (rewrite for new UI)

| Test Category | Tests | Description |
|---------------|-------|-------------|
| 1. Page Load | 2 | Header, breadcrumbs visible |
| 2. Breadcrumb Navigation | 3 | Click jumps to section, completed shows ✓ |
| 3. Pattern Selection | 3 | Cards selectable, checkmark appears |
| 4. Hardware Selection | 3 | Vendor/model dropdowns work |
| 5. Summary Sidebar | 4 | Updates on changes, scrolls independently |
| 6. Theme Toggle | 2 | Switches dark/light, persists |
| 7. Font Controls | 2 | A-/A+ adjust size |
| 8. VLAN Configuration | 3 | Pattern-driven, auto-naming |
| 9. Port Configuration | 3 | Pattern-specific sections show |
| 10. Routing | 2 | BGP/Static toggle |
| 11. Export | 2 | JSON valid, download works |
| 12. Import/Template | 3 | Loads correctly, populates form |
| 13. Start Over | 1 | Resets with confirmation |
| **Total** | **33** | |

**Test Config (`playwright.config.ts`):**
```typescript
{
  globalTimeout: 180000,    // 3 min total
  timeout: 30000,           // 30s per test
  expect: { timeout: 5000 },
  actionTimeout: 10000,
  workers: 1,
  fullyParallel: false
}
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `frontend/index.html` | **Rewrite** | New Odin layout structure |
| `frontend/odin-theme.css` | **Replace** | Full Odin CSS with themes |
| `frontend/src/app.ts` | **Modify** | Add scroll nav, theme, progress |
| `frontend/src/state.ts` | Keep | No changes needed |
| `frontend/src/types.ts` | Keep | No changes needed |
| `frontend/src/utils.ts` | Keep | No changes needed |
| `frontend/src/validator.ts` | Keep | No changes needed |
| `tests/wizard-e2e.spec.ts` | **Rewrite** | Tests for new UI structure |
| `playwright.config.ts` | Keep | Timeouts already configured |

---

## Switch Logic to Preserve

The following logic from `app.ts` must remain unchanged:

### Pattern-Driven Logic
```typescript
// getPatternVlans() - Returns VLANs allowed per pattern
// getPatternHostVlans() - Returns tagged VLAN string per pattern
// updateHostPortsSections() - Shows/hides port sections by pattern
```

### Configuration Building
```typescript
// collectConfig() - Builds StandardConfig object
// collectVLANs() - Gathers VLAN entries
// collectInterfaces() - Gathers interface entries
// collectPortChannels() - Builds port-channel config
// collectRouting() - BGP or static routes
```

### Validation
```typescript
// validateConfig() - Uses AJV against schema
// showValidationError() / showSuccess() - Message display
```

### Import/Export
```typescript
// exportJSON() - Downloads config file
// importJSON() - Parses uploaded file
// loadTemplate() - Loads example configs
```

---

## Acceptance Criteria

| Requirement | Verification |
|-------------|--------------|
| Single-page scroll with 7 numbered sections | Scroll through all sections |
| Sticky summary sidebar with own scrollbar | Sidebar stays pinned while scrolling |
| Breadcrumb navigation with checkmarks | Click breadcrumb → scrolls to section |
| Theme toggle (dark/light) | Button switches theme, persists |
| Font size controls (A-/A+) | Text scales up/down |
| Page statistics display | Shows view/export counts |
| Pattern cards with selection checkmark | Blue glow + ✓ on selected |
| Progress bar updates | Reflects completed sections |
| All switch logic functional | Export produces valid JSON |
| Tests pass with timeouts | 33 tests complete in <3 min |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking switch logic | Export fails | Keep all app.ts logic functions |
| CSS conflicts | Layout broken | Use Odin classes exclusively |
| Tests timeout | CI blocked | 30s per-test, 3min global |
| Theme state lost | UX annoyance | Save to localStorage |

**Rollback:**
```bash
git checkout HEAD~1 -- frontend/
```

---

## ⚠️ Critical Development Rules

> [!WARNING]
> These rules are mandatory for all developers and AI agents working on this project.

### 1. NEVER Kill Node/Vite Processes

```bash
# ❌ FORBIDDEN - These commands will shut down the dev container
pkill -f node
pkill -f vite
pkill -9 node
kill $(pgrep -f vite)

# ✅ SAFE - Use Ctrl+C in the terminal running the server
# ✅ SAFE - Close the terminal tab running the server
# ✅ SAFE - Use VS Code's "Stop" button on the terminal
```

**Reason:** The development environment runs inside a container where Node.js processes are essential for the container's operation. Killing these processes will terminate the entire dev container, disconnecting your session.

### 2. ALWAYS Use Timeouts for Tests and Commands

```bash
# ❌ BAD - Can hang forever
npx playwright test
curl http://localhost:3000

# ✅ GOOD - Always use timeout
timeout 120 npx playwright test --reporter=line
timeout 10 curl -s http://localhost:3000
```

**Test Timeout Requirements:**

| Scope | Timeout | Purpose |
|-------|---------|---------|
| Global | 180s (3 min) | Maximum total test run |
| Per-test | 30s | Individual test timeout |
| Action | 10s | Single action (click, fill) |
| Expect | 5s | Assertion timeout |

**In test files:**
```typescript
// At file level
test.setTimeout(30000);

// Per action
await page.click('#button', { timeout: 10000 });
await expect(locator).toBeVisible({ timeout: 5000 });
```

**Reason:** Tests and network requests can hang indefinitely due to various issues (server not responding, network issues, race conditions). Timeouts ensure CI/CD pipelines don't get stuck and development sessions remain productive.

---

## Commands Reference

```bash
# Development
cd /workspace/frontend && npm run dev -- --port 3000

# Type Check
cd /workspace/frontend && npm run typecheck

# Run Tests (with timeout)
cd /workspace && timeout 180 npx playwright test --reporter=line

# Build
cd /workspace/frontend && npm run build

# Git
git add -A && git commit -m "Odin UI redesign"
```

---

## Reference Links

| Resource | URL |
|----------|-----|
| Odin Live | https://neilbird.github.io/Odin-for-AzureLocal/ |
| Odin Source | `/workspace/archive/Odin-for-AzureLocal/` |
| Design Doc | `.github/docs/AzureLocal_NetworkConfTool_Project_Design_Doc.md` |
| JSON Schema | `backend/schema/standard.json` |
| Azure Patterns | [GitHub](https://github.com/Azure/AzureLocal-Supportability/blob/main/TSG/Networking/Top-Of-Rack-Switch/Overview-Azure-Local-Deployment-Pattern.md) |
