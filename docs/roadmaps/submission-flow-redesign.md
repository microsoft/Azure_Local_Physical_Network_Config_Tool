# Roadmap: Submission Flow Redesign

> **Branch:** `feature/submission-flow-redesign`
> **Created:** 2026-02-10
> **Status:** 🟡 In Progress

---

## Goal

Enable non-technical network engineers to submit config fixes and new vendor support
through a GitHub Issue, with AI (Copilot Coding Agent) processing the submission and
filing a PR for human maintainer review. The engineer describes what's wrong in plain
English, pastes their working config as evidence, and the automation handles the rest.

---

## Context & Decisions

### Why This Work

The tool generates production switch configs for Azure Local deployments. Network
engineers in the field find issues — wrong HSRP priority, missing BGP neighbor, VLAN
not on the right port — but they don't know which file to change (`constants.py`?
`bgp.j2`? the switch interface template JSON?). They need a way to report issues with
minimal developer knowledge and have AI translate their plain-English description into
a code fix.

### Key Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Single issue template** with submission type dropdown | Both "fix" and "new vendor" share the same required fields (vendor, model, role, pattern, config). Type dropdown splits processing logic, not the template. |
| 2 | **Deployment pattern always required** | It's the primary architectural driver in Azure Local — determines VLAN layout, port roles, BGP structure. Can't diagnose issues without it. |
| 3 | **Customer-facing pattern names** in dropdown | Engineers know `HyperConverged` from Azure Local docs, not `fully_converged`. The converter already remaps internally. |
| 4 | **Keep current separate fields** for vendor/firmware/model/role | Already works, structured data is easier to normalize than free text. |
| 5 | **No backend Python modules** | Process instructions rewritten for Copilot Coding Agent to execute inline. Keeps main branch clean for future GitHub Pages UI work (separate branch). |
| 6 | **Copilot + Actions hybrid** | Actions runs triage/validation, Copilot Coding Agent creates the PR with fixes or new artifacts. |
| 7 | **Customer data sanitized** before archiving | IPs → example ranges, hostnames → `sample-<role>`, ASNs → 65000-range. Original structure preserved via mapping in `analysis.json`. |
| 8 | **BMC role marked lab-only** | Single template with "(lab use only)" note on BMC option. No separate template needed. |

### Deployment Pattern Mapping

| Customer-Facing (Issue Dropdown) | Internal Constant | Template Key | Description |
|----------------------------------|-------------------|--------------|-------------|
| `HyperConverged` | `PATTERN_HYPERCONVERGED` = `"hyperconverged"` | `fully_converged` / `fully_converged1` / `fully_converged2` | Storage + Compute on same NICs. Most common. |
| `Switched` | *(raw string `"switched"`)* | `switched` | Dedicated storage ports, separate from compute. |
| `Switchless` | *(raw string `"switchless"`)* | `switchless` | Storage direct-attached between nodes, no TOR. |

> The converter at `src/convertors/convertors_lab_switch_json.py:58-63` remaps
> `hyperconverged` → `fully_converged` internally. Sub-variants (`fully_converged1`
> trunk mode, `fully_converged2` access mode) are selected based on which VLAN sets
> exist in the input data.

---

## Scope of Changes

### Files to Create

| File | Purpose |
|------|---------|
| `docs/roadmaps/submission-flow-redesign.md` | This file — tracks plan, progress, decisions |

### Files to Modify

| File | Change Summary |
|------|----------------|
| `.github/ISSUE_TEMPLATE/config-submission.yml` | Redesign: add submission type, fix deployment patterns, add "What's wrong?" field, update sanitization note, mark BMC as lab-only |
| `.github/instructions/process-submission.instructions.md` | Rewrite: remove backend references, add fix-vs-new-vendor processing split, add file-mapping guide, add sanitization step |
| `.github/workflows/triage-submissions.yml` | Update: validate new fields, accept `HyperConverged` pattern name, handle submission type |
| `src/constants.py` | Add `PATTERN_SWITCHED` and `PATTERN_SWITCHLESS` constants for consistency |
| `CONTRIBUTING.md` | Update: customer-facing pattern names, add "Fix/Improvement" guidance, strengthen sanitization section |

### Directories to Create

| Directory | Purpose |
|-----------|---------|
| `submissions/` | Archive reference configs from processed submissions |
| `docs/roadmaps/` | Roadmap tracking documents |

### No Changes (Out of Scope)

| Item | Reason |
|------|--------|
| `backend/` Python modules | Not needed — Copilot processes inline |
| `src/convertors/` logic | No converter changes in this PR — submission flow only |
| `input/jinja2_templates/` | Templates untouched — only the submission pipeline changes |
| GitHub Pages UI | Separate branch, separate effort |

---

## Task Tracker

### Phase 1: Foundation

- [x] Create feature branch `feature/submission-flow-redesign`
- [x] Create roadmap document (`docs/roadmaps/submission-flow-redesign.md`)
- [x] Create `submissions/` directory with `.gitkeep`
- [x] Add `PATTERN_SWITCHED` / `PATTERN_SWITCHLESS` constants to `src/constants.py`

### Phase 2: Issue Template Redesign

- [x] Redesign `.github/ISSUE_TEMPLATE/config-submission.yml`
  - [x] Add "Submission Type" dropdown (Fix/Improvement vs New Vendor/Model)
  - [x] Fix deployment pattern dropdown (HyperConverged, Switched, Switchless)
  - [x] Add "What's wrong?" textarea
  - [x] Mark BMC role as "(lab use only)"
  - [x] Add optional Node Count field
  - [x] Add optional Lab JSON Input field
  - [x] Update sanitization note (IPs + hostnames + SSH keys, not just passwords)

### Phase 3: Process-Submission Instructions Rewrite

- [x] Rewrite `.github/instructions/process-submission.instructions.md`
  - [x] Remove all `backend/` script references
  - [x] Update Step 1: extraction with corrected normalization maps
  - [x] Replace Steps 2-4: inline Copilot analysis (no Python imports)
  - [x] Add submission type processing split (Fix vs New Vendor)
  - [x] Add file-mapping guide: description → codebase file lookup
  - [x] Add data sanitization step
  - [x] Update credential check patterns
  - [x] Update PR template format

### Phase 4: Triage Workflow Update

- [x] Update `.github/workflows/triage-submissions.yml`
  - [x] Validate "Submission Type" field
  - [x] Validate "What's wrong?" field (warn if empty for Fix type)
  - [x] Accept `HyperConverged` as valid pattern (customer-facing name)
  - [x] Handle both submission types in label logic
  - [x] Add credential scan (basic pattern matching)
  - [x] Add Lab JSON syntax validation
  - [x] Auto-add `new-vendor` label for New Vendor submissions

### Phase 5: Documentation

- [x] Update `CONTRIBUTING.md`
  - [x] Replace deployment pattern table with customer-facing names (HyperConverged)
  - [x] Add "Fix / Improvement" submission guidance with examples
  - [x] Add "How to identify your pattern" using HyperConverged terminology
  - [x] Strengthen sanitization section (IPs, hostnames, SSH keys, SNMP)
  - [x] Add "For Advanced Users" — Lab JSON submissions
  - [x] Mark BMC role as lab-only
  - [x] Add two example submissions (Fix + New Vendor)

### Phase 6: Verification

- [ ] Mock walkthrough: Fix submission (Cisco TOR1 HyperConverged, wrong HSRP priority)
- [ ] Mock walkthrough: New vendor submission (Arista 7050X3 TOR1)
- [ ] Verify pattern names consistent across all modified files
- [ ] Run `python -m pytest tests/ -v` — no regressions
- [ ] PR review checklist completion

---

## Submission Flow — End-to-End

```
┌──────────────────────────────────────────────────────────────────────┐
│  ENGINEER opens GitHub Issue using template                          │
│  Fills in: Type, Vendor, Firmware, Model, Role, Pattern,            │
│            What's wrong (if fix), Config, Notes                      │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  TRIAGE WORKFLOW (GitHub Actions — automatic)                        │
│  • Validates required fields present                                 │
│  • Checks config has switch-like patterns (≥10 lines)               │
│  • Scans for credentials / injection                                 │
│  • Verifies checkboxes                                               │
│  ✅ Valid → removes 'needs-triage', adds 'copilot' + 'validated'    │
│  ❌ Invalid → adds 'needs-info', comments with fix instructions     │
└──────────────┬───────────────────────────────────────────────────────┘
               │ label: copilot + validated
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  COPILOT CODING AGENT (triggered by 'copilot' label)                │
│                                                                      │
│  IF submission type = "Fix / Improvement":                           │
│  ├─ Read "What's wrong?" description                                │
│  ├─ Map description → affected codebase files                       │
│  │   ├─ HSRP/VRRP priority → src/constants.py                      │
│  │   ├─ Wrong VLAN on port → input/switch_interface_templates/      │
│  │   ├─ Missing BGP neighbor → src/convertors/ + bgp.j2            │
│  │   ├─ QoS policy → qos.j2                                        │
│  │   └─ Interface config → interface.j2                             │
│  ├─ Compare submitted config vs current template output             │
│  ├─ Create targeted fix PR                                          │
│  └─ Update affected golden-file test cases                          │
│                                                                      │
│  IF submission type = "New Vendor / Model":                          │
│  ├─ Analyze config sections (VLANs, interfaces, BGP, QoS)          │
│  ├─ Sanitize customer data → dummy values                           │
│  ├─ Create: constants entries, switch interface JSON,               │
│  │          Jinja2 template scaffolds, reference config archive     │
│  └─ Create PR with 'needs-heavy-review' label                      │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  HUMAN MAINTAINER reviews PR                                         │
│  • Verifies fix is correct for the stated deployment pattern        │
│  • Checks no customer data leaked                                   │
│  • Runs tests                                                        │
│  • Merges                                                            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## File-Mapping Reference

When Copilot processes a "Fix / Improvement" submission, use this guide to map the
engineer's description to the correct file(s):

| Engineer Says | Look In | File(s) |
|---------------|---------|---------|
| "HSRP priority wrong" / "VRRP priority should be X" | Redundancy defaults | `src/constants.py` → `REDUNDANCY_PRIORITY_ACTIVE/STANDBY` |
| "Wrong VLAN on port X" / "Missing VLAN on trunk" | Port layout for that model | `input/switch_interface_templates/<vendor>/<model>.json` |
| "Missing BGP neighbor" / "BGP ASN wrong" | BGP builder + template | `src/convertors/convertors_lab_switch_json.py` → `build_bgp()` + `input/jinja2_templates/<vendor>/<firmware>/bgp.j2` |
| "QoS policy wrong" / "PFC settings" | QoS template | `input/jinja2_templates/<vendor>/<firmware>/qos.j2` |
| "Interface config wrong" / "MTU wrong" | Interface template | `input/jinja2_templates/<vendor>/<firmware>/interface.j2` |
| "Port-channel config" / "MLAG / VPC / VLT wrong" | Port-channel template + VLT | `input/jinja2_templates/<vendor>/<firmware>/port_channel.j2` (+ `vlt.j2` for Dell) |
| "Login / AAA / TACACS wrong" | Login template | `input/jinja2_templates/<vendor>/<firmware>/login.j2` |
| "System settings" / "hostname format" | System template | `input/jinja2_templates/<vendor>/<firmware>/system.j2` |
| "VLAN name wrong" / "SVI config" | VLAN template + converter | `input/jinja2_templates/<vendor>/<firmware>/vlan.j2` + `src/convertors/convertors_lab_switch_json.py` → `build_vlans()` |
| "Static route missing" | Static route template | `input/jinja2_templates/<vendor>/<firmware>/static_route.j2` |
| "Prefix list wrong" | Prefix list template + converter | `input/jinja2_templates/<vendor>/<firmware>/prefix_list.j2` + `build_prefix_lists()` |
| "DHCP relay wrong" | VLAN template (SVI section) | `input/jinja2_templates/<vendor>/<firmware>/vlan.j2` (dhcp_relay block) |
| "New switch model — port layout different" | Switch interface template | `input/switch_interface_templates/<vendor>/<model>.json` (create new) |

---

## Enrichment Artifacts

When a processed submission produces new artifacts, they go here:

| Artifact | Location | When Created |
|----------|----------|--------------|
| Reference config (sanitized) | `submissions/<vendor>-<model>-<role>-issue<N>/config.txt` | New Vendor submissions |
| Submission metadata | `submissions/<vendor>-<model>-<role>-issue<N>/metadata.yaml` | New Vendor submissions |
| Config analysis | `submissions/<vendor>-<model>-<role>-issue<N>/analysis.json` | New Vendor submissions |
| Switch interface template | `input/switch_interface_templates/<vendor>/<model>.json` | New model support |
| Jinja2 template scaffold | `input/jinja2_templates/<vendor>/<firmware>/*.j2` | New vendor/firmware |
| Constants entry | `src/constants.py` | New vendor/firmware |
| Golden-file test case | `tests/test_cases/convert_<case>/` | Both (when tests affected) |
