# Azure Local Switch Configuration Wizard — Project Roadmap

**Version:** 10.2  
**Date:** February 1, 2026  
**Status:** UI Polish Phase 2  
**Reference:** [Odin for Azure Local](https://neilbird.github.io/Odin-for-AzureLocal/)

---

## Executive Summary

The Odin UI redesign is complete. Phase 1 UI Polish & Code Cleanup has been completed (breadcrumb active state, button styling, text contrast, typography system, CSS consolidation, E2E test refresh). Phase 2 focuses on VLAN section UX improvements (move Remove button to header, fix placeholder contrast), JSON preview enhancements, and final button styling consistency.

---

## Open Issues

| Issue | Description | Priority |
|-------|-------------|----------|
| **VLAN Remove button position** | Remove button inside each card; should be in section header next to Add | HIGH |
| **Placeholder text contrast** | `--text-muted` (#64748b) too dark; should match input text (#f1f5f9) | HIGH |
| **BMC section unnecessary** | BMC VLAN section not needed; remove from VLANs | MEDIUM |
| **JSON preview too small** | Need larger min-height for better visibility | LOW |
| **Copy button label** | "Copy to Clipboard" should be "Export Switch Config" | LOW |
| **Start Over button style** | Doesn't match other action buttons | LOW |

---

## Architecture Overview (Updated)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Azure Local Switch Configuration Wizard         [📋 Load] [📁 Import]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: [1 Pattern] › [2 VLANs] › [3 Ports] › [4 Redund] › [5 Routing]    │
├────────────────────────────────────────────────────┬────────────────────────────┤
│                                                    │                            │
│  ┌──────────────────────────────────────────────┐  │  ┌──────────────────────┐  │
│  │ 01 Pattern & Switch                          │  │  │ Progress    80% 4/5  │  │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐         │  │  │ ████████████████░░░  │  │
│  │ │Switchless│ │ Switched │ │Fully FC │         │  │  ├──────────────────────┤  │
│  │ └─────────┘ └─────────┘ └─────────┘         │  │  │ Font: [A-][A+]       │  │
│  │                                              │  │  │ Theme: [🌙/☀️]        │  │
│  │ Vendor: [▼ Dell EMC    ]                    │  │  ├──────────────────────┤  │
│  │ Model:  [▼ S5248F-ON   ]                    │  │  │ CONFIG SUMMARY       │  │
│  │                                              │  │  │ Pattern: Fully Conv  │  │
│  │ Role: [TOR1 ✓] [TOR2]  Hostname: [______]  │  │  │ Vendor: Dell EMC     │  │
│  └──────────────────────────────────────────────┘  │  │ ...                  │  │
│                                                    │  ├──────────────────────┤  │
│  ┌──────────────────────────────────────────────┐  │  │ 📄 JSON Preview [▼]  │  │
│  │ 02 VLANs                                     │  │  │ ┌──────────────────┐ │  │
│  │ ...                                          │  │  │ │ { "switch": ... }│ │  │
│  └──────────────────────────────────────────────┘  │  │ └──────────────────┘ │  │
│                                                    │  ├──────────────────────┤  │
│  ┌──────────────────────────────────────────────┐  │  │ [💾 Export JSON    ] │  │
│  │ 03 Host Ports                                │  │  │ [📋 Copy Clipboard ] │  │
│  │ ...                                          │  │  │ [📋 Load Template  ] │  │
│  └──────────────────────────────────────────────┘  │  │ [📁 Import JSON    ] │  │
│                                                    │  │ [🔄 Start Over     ] │  │
│  ┌──────────────────────────────────────────────┐  │  └──────────────────────┘  │
│  │ 04 Redundancy                                │  │                            │
│  │ ...                                          │  │                            │
│  └──────────────────────────────────────────────┘  │                            │
│                                                    │                            │
│  ┌──────────────────────────────────────────────┐  │                            │
│  │ 05 Routing                                   │  │                            │
│  │ ...                                          │  │                            │
│  └──────────────────────────────────────────────┘  │                            │
│                                                    │                            │
└────────────────────────────────────────────────────┴────────────────────────────┘
```

**Key Changes:**
- **5 sections** instead of 6 (Review removed)
- **JSON Preview** moved to collapsible section in sidebar
- **Export/Copy/Template/Import buttons** consolidated in sidebar
- **Progress** tracks 5 sections (20% each)

---

## Typography System (New)

### Design Tokens

```css
:root {
  /* Type Scale (rem for accessibility) */
  --text-xs: 0.75rem;     /* 12px - captions, hints */
  --text-sm: 0.875rem;    /* 14px - body, labels */
  --text-base: 1rem;      /* 16px - card titles */
  --text-lg: 1.125rem;    /* 18px - section titles */
  --text-xl: 1.5rem;      /* 24px - page title */
  
  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  
  /* Line Heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
}
```

### Hierarchy

| Element | Size | Weight | Use Case |
|---------|------|--------|----------|
| Page Title (h1) | `--text-xl` | `--font-bold` | Main header only |
| Section Title (h2) | `--text-lg` | `--font-semibold` | Step headers (01-05) |
| Card Title (h3) | `--text-base` | `--font-semibold` | Option cards, subsections |
| Sidebar Header (h4) | `--text-sm` | `--font-semibold` | Summary section titles |
| Body Text | `--text-sm` | `--font-normal` | Descriptions, paragraphs |
| Form Labels | `--text-sm` | `--font-medium` | Input labels |
| Helper Text | `--text-xs` | `--font-normal` | Hints, captions, small text |
| Buttons | `--text-sm` | `--font-semibold` | All buttons |

---

## Implementation Plan

### Phase 1: VLAN Section UX (Priority: HIGH) — CURRENT

**1.1 Move Remove Button to Section Header**

**Files:** `frontend/index.html`, `frontend/src/app.ts`, `frontend/odin-theme.css`

| Task | Status |
|------|--------|
| Add `.btn-group` container in section header with "+ Add" then "− Remove" | ⏳ |
| Remove button hidden when only 1 VLAN exists | ⏳ |
| Remove "× Remove" button from `createVlanCardHTML()` card-header | ⏳ |
| Add click handlers for `#btn-remove-mgmt` and `#btn-remove-compute` | ⏳ |
| Toggle Remove button visibility based on VLAN count (show when >1) | ⏳ |
| Add `.btn-group` flexbox CSS styling | ⏳ |

**1.2 Fix Placeholder/Helper Text Contrast**

**File:** `frontend/odin-theme.css`

| Task | Status |
|------|--------|
| Change `--text-muted` from `#64748b` to `#f1f5f9` | ⏳ |
| Placeholder text now matches filled input text (white) | ⏳ |

**1.3 Remove BMC Section**

**File:** `frontend/index.html`

| Task | Status |
|------|--------|
| Delete entire BMC VLAN collapsible section (`#vlan-bmc-section`) | ⏳ |

### Phase 2: Sidebar Polish (Priority: MEDIUM)

**2.1 JSON Preview Sizing**

**File:** `frontend/odin-theme.css`

| Task | Status |
|------|--------|
| Increase `#json-preview` min-height to ~400px | ⏳ |

**2.2 Button Labeling**

**File:** `frontend/index.html`

| Task | Status |
|------|--------|
| Change "📋 Copy to Clipboard" to "📤 Export Switch Config" | ⏳ |

**2.3 Start Over Button Styling**

**File:** `frontend/odin-theme.css`

| Task | Status |
|------|--------|
| Style `#btn-reset` to match Export/Copy buttons | ⏳ |

### Phase 3: Test Updates (Priority: MEDIUM)

**File:** `tests/wizard-e2e.spec.ts`

| Task | Status |
|------|--------|
| Update Remove button selector to `#btn-remove-mgmt` | ⏳ |
| Remove BMC collapsible test | ⏳ |
| Update copy button text selector | ⏳ |

---

## Standard Development Practices

> [!IMPORTANT]
> These practices must be followed after completing any implementation phase.

### 1. Code Review & Cleanup

After finishing all tasks in a phase:
- Review the entire `frontend/` folder for cleanliness
- Ensure logic is clear and well-organized
- Remove any duplicates, unused code, or dead imports
- Verify no conflicting styles or redundant CSS

### 2. Test Maintenance

After any code changes:
- Refresh and refine unit tests to match current implementation
- Remove unused, outdated, or invalidated tests
- Keep only the most relevant and focused test cases
- Ensure all tests pass with proper timeouts

### 3. Code Documentation

For all code changes:
- Add JSDoc comments to exported functions
- Include inline comments for complex logic
- Document any workarounds or non-obvious decisions
- Add section headers (`// === SECTION NAME ===`) for organization
- Write comments that help future debugging and review

---

## Section Mapping (Final)

| Number | Section | Completion Criteria |
|--------|---------|---------------------|
| 01 | Pattern & Switch | Pattern + Vendor + Model + Role + Hostname |
| 02 | VLANs | Management VLAN ID > 0 |
| 03 | Host Ports | Converged OR Storage port range defined |
| 04 | Redundancy | Peer-link + Keepalive IPs configured |
| 05 | Routing | BGP (ASN + Router ID) OR Static routes |

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `frontend/index.html` | **Modify** | Add btn-group for Add/Remove, remove BMC section, rename copy button |
| `frontend/odin-theme.css` | **Modify** | Fix --text-muted contrast, add btn-group CSS, enlarge JSON preview, style Start Over |
| `frontend/src/app.ts` | **Modify** | Remove button from createVlanCardHTML, add section Remove handlers |
| `tests/wizard-e2e.spec.ts` | **Modify** | Update Remove button selector, remove BMC test |

---

## Files to Keep (No Changes)

| File | Reason |
|------|--------|
| `frontend/src/state.ts` | State management working correctly |
| `frontend/src/types.ts` | TypeScript interfaces stable |
| `frontend/src/utils.ts` | Utility functions stable |
| `frontend/src/validator.ts` | Validation logic stable |
| `frontend/src/main.ts` | Entry point stable |
| `frontend/vite.config.ts` | Build config stable |
| `frontend/tsconfig.json` | TypeScript config stable |
| `frontend/package.json` | Dependencies stable |
| `playwright.config.ts` | Test config has correct timeouts |

---

## Switch Logic (Preserved - Do Not Modify)

These core functions in `frontend/src/app.ts` must remain unchanged:

| Category | Functions |
|----------|-----------|
| **Pattern Logic** | `getPatternVlans()`, `getPatternHostVlans()`, `updateHostPortsSections()` |
| **Config Building** | `collectConfig()`, `collectVLANs()`, `collectInterfaces()`, `collectPortChannels()`, `collectRouting()` |
| **Validation** | `validateConfig()`, `showValidationError()`, `showSuccessMessage()` |
| **Import/Export** | `exportConfig()`, `importJSON()`, `loadConfig()` |

---

## Acceptance Criteria

| Requirement | Verification |
|-------------|--------------|
| VLAN Add/Remove buttons in section header | Both buttons visible, Remove hidden when 1 VLAN |
| Placeholder text white like input text | Visual check - same contrast |
| BMC section removed | No BMC collapsible in VLANs |
| JSON preview larger | Min-height ~400px |
| Copy button renamed | Shows "Export Switch Config" |
| Start Over button styled | Matches Export/Copy buttons |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking switch logic | Export fails | Keep all app.ts config logic intact |
| CSS conflicts | Layout broken | Consolidate to single CSS file |
| Tests timeout | CI blocked | 30s per-test, 3min global |
| Template loading fails | UX broken | Verify glob import, add fallback |
| Progress/breadcrumb mismatch | User confusion | Use same criteria for both |

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

| Resource | Path/URL |
|----------|----------|
| **Design Document** | [.github/docs/AzureLocal_NetworkConfTool_Project_Design_Doc.md](.github/docs/AzureLocal_NetworkConfTool_Project_Design_Doc.md) |
| Odin Live Demo | https://neilbird.github.io/Odin-for-AzureLocal/ |
| Odin Source | `/workspace/archive/Odin-for-AzureLocal/` |
| JSON Schema | `backend/schema/standard.json` |
| Azure Patterns | [GitHub](https://github.com/Azure/AzureLocal-Supportability/blob/main/TSG/Networking/Top-Of-Rack-Switch/Overview-Azure-Local-Deployment-Pattern.md) |
