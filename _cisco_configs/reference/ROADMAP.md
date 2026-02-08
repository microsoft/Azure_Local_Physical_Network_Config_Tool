# Cisco NX-OS BMC Switch Support — Implementation Roadmap

> **Status:** Phase 0 + Phase 1 complete — CI/CD & `.github` overhaul next  
> **Branch:** `dev/nl/cisconxos`  
> **Updated:** 2025-02-07  
> **Goal:** Add Cisco BMC switch configuration generation, with option to use with or without BMC

---

## Table of Contents

1. [Reference Samples](#reference-samples)
2. [Input Format Clarification](#input-format-clarification)
3. [BMC Switch Config Pattern](#bmc-switch-config-pattern)
4. [Current Framework Architecture](#current-framework-architecture)
5. [Code Quality Audit](#code-quality-audit)
6. [Gap Analysis](#gap-analysis)
7. [Implementation Phases](#implementation-phases)
8. [CI/CD & GitHub Overhaul](#cicd--github-overhaul)
9. [Unit Test Plan](#unit-test-plan)
10. [Port Layout Reference](#port-layout-reference)
11. [File Mapping](#file-mapping)
12. [Key Decisions](#key-decisions)
13. [Decision Checkpoints](#decision-checkpoints)

---

## Design Principles

> The three customer samples are **validation references**, not three separate implementations.

1. **Unified templates & code** — Templates and converter logic must be generic and parameterized. A single Cisco BMC interface template per model handles any node count, VLAN set, or topology. The converter drives variation through input data, not through model-specific code branches.
2. **Data-driven, not sample-driven** — Port counts, VLAN IDs, ASNs, IP addresses, and hostnames come from the lab definition JSON. Nothing from the three samples should be hardcoded into templates or converter logic (except structural constants like fixed port roles on Eth1/46, 1/49-1/50, 1/51-1/52).
3. **One code path for all topologies** — The BMC converter should work identically whether the parent topology is Switched, HyperConverged, or Switchless. BMC config is topology-independent.
4. **Samples validate, not define** — The three samples are used to generate expected test outputs and verify correctness. If a sample has a quirk that conflicts with the standard pattern, prefer the standard.
5. **Refactor freely, test at every turn** — The existing code was written manually and has known flaws. We're on `dev/nl/cisconxos` — breaking changes are acceptable. Upgrade and refine the codebase with best practices. Every critical change or bug fix gets a unit test.
6. **Tests are rewritable** — Existing tests can be destroyed and rewritten from scratch if the current structure doesn't serve us. Use best-practice patterns (proper isolation, fixtures, `conftest.py`, no side effects at import time). Don't copy existing test anti-patterns.
7. **Discuss before deciding** — For any uncertainty or critical architectural decisions, pause and discuss with the team before proceeding. Document decision points in the [Decision Checkpoints](#decision-checkpoints) section.
8. **TOR = production-quality, BMC = internal-minimal** — TOR switch configs are customer-facing deliverables used in real production environments. TOR templates and converter code must be fully data-driven, parameterized, and follow best practices — no shortcuts. BMC switch configs are **internal-only** tooling for lab/deployment use. BMC code may hardcode complex settings (VLANs, QoS, port-channel config) to keep implementation simple, but every hardcoded value **must have a clear comment** explaining what it is and why, so future engineers can troubleshoot or update values without reverse-engineering the logic.
9. **BMC is optional — TOR-only is the default** — Not all deployment patterns have a BMC switch. BMC configs are only generated when a BMC entry (`Type: "BMC"`) exists in the lab input JSON. If no BMC entry is present, only TOR configs are produced. The converter gracefully skips BMC processing with an info log. This is already enforced in code (`BMCSwitchConverter.convert_all_bmc_switches` returns early if no BMC switches found) and validated by the `nobmc` test case.

---

## Reference Samples

Three production configurations kept in `_cisco_configs/samples/` as **validation reference** — used to verify the unified implementation, not to drive sample-specific code.

### 1. b88_b20 — Switched, 16 nodes, **no BMC switch**

| Field | Value |
|-------|-------|
| **Definition** | `samples/b88_b20/b88rb20-sw4-definition.json` |
| **Topology** | Switched |
| **TOR Model** | 93108TC-FX3P |
| **TOR Firmware** | 10.3(4a) |
| **TOR ASN** | 64584 |
| **Border ASN** | 64809 |
| **MUX ASN** | 65052 (16-bit) |
| **BMC Switch** | `Make: "None"`, `Type: "None"` — **needs BMC entry added** |
| **Configs** | TOR1a, TOR1b, storage switch (9336C L2-only) |

**Notes:**
- This definition is **missing its BMC switch entry**. It needs to be updated with a BMC switch (e.g., 9348GC-FXP) to test the with-BMC flow for Switched topology.
- Currently shows the embedded-BMC-on-TOR pattern (HOST_BMC ports on Eth1/31-1/38 of TOR itself).
- Has a dedicated L2 storage switch (9336C) — separate concern, not in initial BMC scope.
- Uses port breakout on Eth1/53-54 for border uplinks.

### 2. b88_n03 — HyperConverged, 16 nodes, **has BMC switch**

| Field | Value |
|-------|-------|
| **Definition** | `samples/b88_n03/b88rn03-hc8-definition.json` |
| **Topology** | HyperConverged |
| **TOR Model** | 93180YC-FX |
| **TOR Firmware** | 10.4.5 |
| **TOR ASN** | 65265 |
| **Border ASN** | 64804 |
| **MUX ASN** | **4200003000 (32-bit)** — new standard |
| **BMC Model** | Cisco 9348GC-FXP |
| **Configs** | TOR1a, TOR1b, BMC switch |

**Notes:**
- First example of **32-bit ASN** for MUX BGP peering — this is the standard going forward.
- Complete BMC switch config reference (`b88-n03-9348bmc-2-1.txt`).
- HyperConverged ports carry storage VLAN 711 on same ports as compute (PFC+QoS enabled).
- Port-channel 102 present on TOR for TOR_BMC uplink (Eth1/44).

### 3. rr1_n42_r24 — Switched, 20 nodes, **has BMC switch**

| Field | Value |
|-------|-------|
| **Definition** | `samples/rr1_n42_r24/rr1n42r24-sw8-definition.json` |
| **Topology** | Switched |
| **TOR Model** | 93180YC-FX3 |
| **TOR Firmware** | 10.3(4a) |
| **TOR ASN** | 64797 |
| **Border ASN** | 64841 |
| **MUX ASN** | 64686 (16-bit) |
| **BMC Model** | Cisco 9348GC-FX3 |
| **Configs** | TOR1a, TOR1b, BMC switch |

**Notes:**
- 20-node rack — largest node count example, demonstrates dynamic port count.
- Complete BMC switch config reference (`rr1-n42-r24-9348bmc-7-1.conf`).
- Has WANSIM section in definition — not relevant for our tool.
- BMC switch has static default route: `ip route 0.0.0.0/0 <BMC_Gateway>`.

---

## Input Format Clarification

> **IMPORTANT:** All three definition files are **lab format JSON**, NOT standard format JSON.

### Lab JSON → Standard JSON → Config Pipeline

```
Lab Definition JSON          Standard JSON (per-switch)         Config Files
┌──────────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│ Version          │   │ switch: {...}         │   │ generated_system.cfg    │
│ Description      │──▶│ vlans: [...]          │──▶│ generated_vlan.cfg      │
│ InputData:       │   │ interfaces: [...]     │   │ generated_interface.cfg │
│   Switches: [...] │   │ port_channels: [...]  │   │ generated_bgp.cfg     │
│   Supernets: [...] │   │ bgp: {...}            │   │ generated_*.cfg       │
│   DeploymentPattern │   │ prefix_lists: {...}   │   │                    │
└──────────────────┘   └──────────────────────┘   └──────────────────┘
                              ▲                           ▲
                              │                           │
                     convertors_lab_     generator.py +
                     switch_json.py      Jinja2 templates
                     convertors_bmc_
                     switch_json.py
```

### Processing Flow in Code

1. `main.py` detects lab format (`Version`/`Description`/`InputData` keys)
2. Calls `convert_lab_switches(input_data, output_dir)` from `convertors_lab_switch_json.py`
3. Converter iterates over `SWITCH_TYPES = ["TOR1", "TOR2"]`:
   - Instantiates `StandardJSONBuilder` per switch
   - Calls `build_switch → build_vlans → build_interfaces → build_bgp → build_prefix_lists → build_qos`
   - Writes `{hostname}.json` per switch
4. After TOR loop, calls `convert_bmc_switches(input_data, output_dir)` from `convertors_bmc_switch_json.py`
   - `BMCSwitchConverter` filters switches where `Type == "BMC"`
   - Builds simplified JSON (switch + vlans + interfaces only)
   - Writes `{hostname}.json`
5. `main.py` then runs `generator.py` on each generated standard JSON
   - Reads `switch.make` + `switch.firmware` to find template directory (e.g., `cisco/nxos/`)
   - Renders all `.j2` templates against the JSON data
   - Writes `generated_*.cfg` files

### Key Converter Behaviors

| Behavior | TOR Converter | BMC Converter |
|----------|--------------|---------------|
| **Template selection** | Uses deployment pattern key (`switched`, `fully_converged`, etc.) | Uses `common` section only |
| **VLAN resolution** | Symbolic (M, C, S → resolved from Supernets) | Hardcoded VLAN 2/7 + BMC-relevant from Supernets |
| **Port-channels** | Deep-copies from template, enriches iBGP IP | **Not supported yet** |
| **BGP** | Full neighbor/network build (Border, iBGP, MUX) | **Not generated** |
| **QoS** | `"qos": true` flag in output | **Not generated** |
| **Static routes** | Not generated | **Not generated yet** (BMC needs this) |
| **Output sections** | switch, vlans, interfaces, port_channels, bgp, prefix_lists, qos | switch, vlans, interfaces |

---

## BMC Switch Config Pattern

Derived from analysis of both BMC switch configs (b88_n03 9348GC-FXP + rr1_n42_r24 9348GC-FX3).

### VLANs (minimal set — no compute/storage/tenant VLANs)

| VLAN | Name | Purpose |
|------|------|---------|
| 2 | UNUSED_VLAN | Default for unused ports, shutdown |
| 99 | NativeVlan | Trunk native |
| 125 | BMC_Mgmt_125 | BMC management, SVI with IP |

> **Note:** Current BMC converter hardcodes VLAN 2 and **VLAN 7** (Infra_7). Real Cisco BMC configs use VLAN 2 and 99 — **VLAN 7 is incorrect** for Cisco BMC. This needs fixing.

### SVI

- `interface Vlan125` — BMC management, MTU 9216, IP from BMC supernet
- No HSRP/VRRP (BMC switch is standalone, not paired)

### Port Layout (common pattern — both 9348 models)

| Ports | Role | Mode | VLAN | Notes |
|-------|------|------|------|-------|
| Eth1/1 – 1/N | HOST_BMC | Access | 125 | N = node count (16 or 20) |
| Eth1/(N+1) – 1/45 | Unused | Access | 2 | Shutdown |
| Eth1/46 | HLH_BMC | Access | 125 | |
| Eth1/47 – 1/48 | Unused | Access | 2 | |
| Eth1/49 – 1/50 | HLH_OS | Access | 125 | |
| Eth1/51 – 1/52 | TOR_BMC | Trunk | native 99, allowed 125 | channel-group 102 |
| Eth1/53 – 1/54 | Unused | Access | 2 | |

### Port-Channel

- `port-channel102`: TOR_BMC uplink, trunk, native 99, allowed 125
- Members: Eth1/51 + Eth1/52
- No VPC (standalone switch)

### Routing

- **No BGP** (despite `feature bgp` being enabled in NX-OS)
- Static default route: `ip route 0.0.0.0/0 <BMC_Gateway_IP>`

### STP

- `spanning-tree mode mst`
- MST 2 priority 28672 (lower than TOR's 16384)

---

## Current Framework Architecture

### Existing Switch Interface Templates (Cisco)

| File | Model | Type | Patterns | Port-Channels |
|------|-------|------|----------|---------------|
| `93108TC-FX3P.json` | 93108TC-FX3P | TOR | common, fully_converged, switched, switchless | PC50 (iBGP), PC101 (MLAG) |
| `93180YC-FX.json` | 93180YC-FX | TOR | common, fully_converged, switched, switchless | PC50 (iBGP), PC101 (MLAG) |
| `93180YC-FX3.json` | 93180YC-FX3 | TOR | common, fully_converged, switched, switchless | PC50 (iBGP), PC101 (MLAG) |

**Dell BMC reference template:** `dellemc/N3248TE-ON.json` — uses `common` section only, no port-channels section, hardcoded VLAN IDs.

### Existing Jinja2 Template Guards (Cisco NX-OS)

| Template | Guard | BMC-Safe? |
|----------|-------|-----------|
| `bgp.j2` | `{% if bgp is defined %}` | ✅ Yes — BMC JSON has no `bgp` key, renders empty |
| `port_channel.j2` | `{% if port_channels is defined %}` | ✅ Yes — renders empty if missing |
| `prefix_list.j2` | `{% if prefix_lists is defined %}` | ✅ Yes |
| `qos.j2` | `{% if qos is defined %}` | ✅ Yes |
| `static_route.j2` | `{% if static_routes is defined and static_routes %}` | ✅ Yes |
| `vlan.j2` | `{% if vlans is defined %}` | ✅ Yes |
| `interface.j2` | `{% if interfaces is defined %}` | ✅ Yes |
| `system.j2` | No guard — always renders | ⚠️ References `switch.site` which BMC converter doesn't set |
| `login.j2` | No guard — always renders | ✅ No data dependencies |

> **Finding:** All data-driven Jinja2 templates already have conditional guards. No new guards needed. Only `system.j2` has a minor issue — BMC converter doesn't set `switch.site` (renders as empty string, not an error).

### Existing Test Structure

**Converter tests** (`test_convertors.py`):
- Scans `tests/test_cases/convert_*` folders for `*_input.json` files
- Runs `convert_lab_switches(input_data, output_dir)` → compares `generated_outputs/*.json` vs `expected_outputs/*.json`
- Uses `find_json_differences()` for detailed diff reporting
- 3 test types per case: `test_convert_switch_input_json`, `test_input_format_validation`, `test_output_format_validation`

**Generator tests** (`test_generator.py`):
- Scans `tests/test_cases/std_*` folders for `*_input.json` files
- Runs `generate_config()` → compares `generated_*.cfg` vs `expected_*.cfg`
- Uses line-by-line text diff comparison
- 3 test types per case: `test_generated_config_output`, `test_config_syntax_validation`, `test_output_file_generation`

**Current test cases:**

| Folder | Type | Status | Notes |
|--------|------|--------|-------|
| `convert_lab_switch_input_json_cisco_nxos_fc` | Converter | ✅ Passing | FC topology, 2 TOR outputs |
| `convert_lab_switch_input_json_cisco_nxos_switched` | Converter | ⏭️ Skipped | **Missing BMC expected outputs** |
| `convert_lab_switch_input_json_cisco_nxos_switchless` | Converter | ✅ Passing | Switchless, 2 TOR outputs |
| `convert_lab_switch_input_json_dell_os10` | Converter | ✅ Passing | Dell FC, has BMC output (3 files) |
| `std_cisco_nxos_fc` | Generator | ✅ Passing | 9 cfg files validated |
| `std_cisco_nxos_switched` | Generator | ✅ Passing | 8 passed, 1 skipped |
| `std_dell_os10_fc` | Generator | ✅ Passing | 10 passed, 1 skipped |

**Key observation:** The `dell_os10` converter test case already has 3 expected outputs (TOR1a, TOR1b, **BMC**). This proves the framework already supports BMC output — we just need the Cisco BMC templates and converter fixes.

---

## Code Quality Audit

> The existing code works but was written manually with some flaws. This audit identifies concrete issues to fix during implementation. We have freedom to refactor/rewrite — we're on a dev branch.

### Critical — Fix during Phase 0

| # | Issue | File(s) | Description |
|---|-------|---------|-------------|
| Q1 | **Duplicated firmware inference** | `convertors_lab_switch_json.py`, `convertors_bmc_switch_json.py` | `if CISCO → NXOS / if DELL → OS10` logic duplicated verbatim. Extract to shared utility. |
| Q2 | **BMC converter ignores `get_real_path()`** | `convertors_bmc_switch_json.py` L212-226 | Reimplements 3-way path resolution (PyInstaller, resolve, parent fallback) instead of using the existing `get_real_path()` from loader. Fragile and inconsistent. |
| Q3 | **Bare `except:` clauses** | `convertors_bmc_switch_json.py` L178, `main.py` L23 | Swallows all exceptions silently. Should be `except Exception` at minimum. |
| Q4 | **No shared constants** | All `src/` files | `DEFAULT_OUTPUT_DIR` is `"output"` in lab converter and `"_output"` in BMC converter (silent mismatch). VLAN group prefixes, IP map keys, and ASN type strings are scattered magic strings. |
| Q5 | **Debug data in production output** | `convertors_lab_switch_json.py` L726-736 | `vlan_map`/`ip_map` debug dict injected into every output JSON. Should be opt-in or removed. |
| Q6 | **Dual import pattern fragility** | Every `src/` file | 6 separate `try: from . / except: from` blocks. Brittle, untested, causes issues between `python -m` and direct execution. |

### High — Fix during Phase 1

| # | Issue | File(s) | Description |
|---|-------|---------|-------------|
| Q7 | **`generate_for_switch` is dead code** | `convertors_lab_switch_json.py` L632 | Alternative builder method that's incomplete (missing BGP, prefix-lists, QoS) and appears unused. Remove or complete. |
| Q8 | **Template render failures swallowed** | `generator.py` L48 | `warnings.warn()` instead of raising. Caller has no way to know a template failed. |
| Q9 | **`load_input_json` returns None on error** | `loader.py` L16 | Every caller must null-check. Should raise exceptions like `load_template` does. |
| Q10 | **`main()` is a 95-line monolith** | `main.py` L88-183 | Mixes arg parsing, validation, format detection, conversion, generation, cleanup, summary. Decompose. |
| Q11 | **No `logging` module** | All files | Everything uses `print()`. No log levels, no configurability, no suppression in tests. |
| Q12 | **Inconsistent `os` vs `pathlib` usage** | `loader.py`, `generator.py`, `main.py` | `os.path.exists` mixed with `Path.exists()`, `os.makedirs` with `Path.mkdir()`. Pick one. |

### Medium — Fix during Phase 2+

| # | Issue | File(s) | Description |
|---|-------|---------|-------------|
| Q13 | **Mutable class state across switches** | `convertors_lab_switch_json.py` | `builder.bgp_map` accumulates across TOR1→TOR2 iterations. Works by accident — TOR2 inherits TOR1's ASN entries. |
| Q14 | **VLAN group classification duplicated** | `convertors_lab_switch_json.py` L140-154, L285-302 | Same `if group_name.startswith("HNVPA")...` chain in `build_vlans` and `_build_ip_mapping`. Extract to `classify_vlan_group()`. |
| Q15 | **`pretty_print_json` is dead code** | `loader.py` L31 | No callers anywhere. Remove. |
| Q16 | **Unused constants** | `convertors_lab_switch_json.py` L37 | `UNUSED_VLAN` and `NATIVE_VLAN` declared but never referenced. |
| Q17 | **No schema validation** | All files | Neither input nor output JSON is validated against a schema. Format detection in `main.py` is heuristic. |

### Test-Specific Issues — Fix in test rewrite

| # | Issue | File(s) | Description |
|---|-------|---------|-------------|
| T1 | **`pytest_sessionfinish` in test files** | Both test files | Hook defined in both `test_convertors.py` and `test_generator.py`. Only one executes. Should be in `conftest.py`. |
| T2 | **Side effects at import time** | Both test files | `sys.path.insert`, `find_input_cases()`, and `generate_all_configs()` run during collection. Generation failures become invisible "0 parametrized cases". |
| T3 | **Stdout suppression anti-pattern** | `test_convertors.py` L145-151 | `sys.stdout = io.StringIO()` instead of `pytest.capsys` or `contextlib.redirect_stdout`. |
| T4 | **No test cleanup** | Both test files | Generated outputs never removed between runs. Stale files can cause false passes. |
| T5 | **Full deep equality fragile** | `test_convertors.py` L169 | Adding any new key to converter output (e.g., `debug`) breaks all tests. No mechanism to ignore extra keys. |
| T6 | **No negative tests** | Both test files | Every case is happy-path. No tests for invalid input, missing files, malformed data, unknown vendors. |
| T7 | **Module-level mutable tracking** | `test_convertors.py` L17 | `convertor_results` defaultdict couples test order to summary. Not thread-safe. |

---

## Gap Analysis

### CRITICAL — Blocks BMC config generation

| # | Gap | Current State | Impact |
|---|-----|--------------|--------|
| G1 | **No Cisco BMC switch interface templates** | `9348GC-FXP.json` and `9348GC-FX3.json` don't exist | `FileNotFoundError` when converter processes Cisco BMC switch |
| G2 | **BMC converter missing port-channel support** | Output JSON has no `port_channels` section | BMC TOR uplink (PC102) not generated |
| G3 | **BMC converter missing static route** | Output JSON has no `static_routes` section | BMC has no default route |
| G4 | **BMC converter hardcodes wrong VLANs** | Hardcodes VLAN 2 + VLAN 7; real Cisco BMC uses VLAN 2 + 99 | Wrong VLAN set in output |
| G5 | **b88_b20 definition missing BMC entry** | `Make: "None"`, `Type: "None"` for BMC | Can't test "with BMC" flow for this sample |

### HIGH — Should fix for correctness

| # | Gap | Current State | Impact |
|---|-----|--------------|--------|
| G6 | **TOR templates missing PC102** | No port-channel 102 in any Cisco TOR template | TOR side of TOR↔BMC uplink not generated |
| G7 | **BMC converter doesn't set `switch.site`** | `system.j2` references it, renders empty | Cosmetic — empty site in BMC system config |
| G8 | **No Cisco BMC converter test expected outputs** | `cisco_nxos_switched` test skipped | No validation baseline for BMC |
| G9 | **32-bit ASN test coverage** | Code handles it natively, no test validates it | No regression protection for 32-bit MUX ASN |

### MEDIUM — Improvements for completeness

| # | Gap | Notes |
|---|-----|-------|
| G10 | Dynamic HOST_BMC port count | Should be derived from node count (16 vs 20 nodes) |
| G11 | TOR `Trunk_TO_BMC_SWITCH` port varies by model | 93108TC-FX3P uses 1/49; 93180YC-FX/FX3 uses 1/44 in production |
| G12 | `IncludeBMC` toggle | No explicit way to skip BMC generation from input |
| G13 | Port breakout support | b88_b20 uses breakout on Eth1/53-54 for borders |
| G14 | Dedicated storage switch (Type: "Storage") | b88_b20 has L2 storage switch — new switch type |

---

## Implementation Phases

> **Reminder:** These phases are for planning alignment only. Implementation starts after roadmap approval.

### Phase 0: Framework Refactoring (P0 — foundation for all phases)

**Objective:** Clean up the existing codebase so BMC additions land on solid ground. All changes covered by tests.

| Task | Audit | Description |
|------|-------|-------------|
| 0.1 | Q4 | Create `src/constants.py` — shared constants for output dirs, VLAN group prefixes, IP map keys, switch types, firmware mappings |
| 0.2 | Q1 | Extract `infer_firmware(make)` utility — shared between TOR and BMC converters |
| 0.3 | Q2 | Fix BMC converter path resolution — use `get_real_path()` from loader, remove 3-way fallback |
| 0.4 | Q3 | Fix bare `except:` clauses — use `except Exception` or specific types |
| 0.5 | Q5 | Remove or gate debug data in converter output — add `--debug` flag if needed |
| 0.6 | Q6 | Centralize import pattern — single path setup helper at entry point, PyInstaller-compatible. Remove 6 scattered try/except blocks. |
| 0.7 | Q7 | Remove dead `generate_for_switch` method or merge into `convert_switch_input_json` |
| 0.8 | Q8, Q9 | Fix error handling — `load_input_json` raises exceptions, `generator.py` propagates render errors |
| 0.9 | Q11 | **[DECISION CHECKPOINT]** Introduce `logging` module — decide log format, levels, and where to configure |
| 0.10 | Q12, Q15, Q16 | Clean up dead code, standardize on `pathlib` |
| 0.11 | T1-T7 | Rewrite test framework (see [Unit Test Plan](#unit-test-plan)) |

**Guiding rule:** Every refactored function gets a unit test. If refactoring breaks an existing test, rewrite the test — don't preserve a bad test.

### Phase 1: Cisco BMC Foundation (P0 — blocks all BMC generation)

**Objective:** Make the existing converter produce valid Cisco BMC switch configs without crashing.

| Task | Gap | Description |
|------|-----|-------------|
| 1.1 | G1 | Create `input/switch_interface_templates/cisco/9348GC-FXP.json` — 16-node BMC template based on `b88-n03-9348bmc-2-1.txt` |
| 1.2 | G1 | Create `input/switch_interface_templates/cisco/9348GC-FX3.json` — 20-node BMC template based on `rr1-n42-r24-9348bmc-7-1.conf` |
| 1.3 | G4 | Fix BMC converter VLAN logic — make VLAN set data-driven or vendor-aware instead of hardcoding VLAN 7. Cisco BMC uses VLANs 2/99/125; Dell uses 2/7/125. |
| 1.4 | G2 | Add `port_channels` support to BMC converter — read from template `port_channels` section (same pattern as TOR converter), not hardcoded |
| 1.5 | G3 | Add `static_routes` support to BMC converter — extract BMC gateway from Supernets, generic logic for any BMC switch |
| 1.6 | G7 | Set `switch.site` in BMC converter `_build_switch_info()` |
| 1.7 | G5 | Update `samples/b88_b20/b88rb20-sw4-definition.json` — add valid BMC switch entry (9348GC-FXP) |

**Template design** (both 9348 models follow Dell N3248TE-ON pattern):

The two BMC templates differ **only** in `HOST_BMC` port range (1/1-1/16 vs 1/1-1/20). All other ports (HLH, TOR uplink, unused) are identical. If a future model has a different port count, only `start_intf`/`end_intf` on `HOST_BMC` changes — no code changes needed.

VLAN IDs in the template (2, 99, 125) are structural constants for all Cisco BMC switches, not sample-specific values. The converter does not resolve symbolic VLANs for BMC — these are literal.

```json
{
    "make": "Cisco",
    "model": "9348GC-FXP",
    "type": "BMC",
    "interface_templates": {
        "common": [
            // Unused (all ports 1/1-1/54, access VLAN 2, shutdown)
            // HOST_BMC (1/1-1/16, access VLAN 125) ← only this range varies by model
            // HLH_BMC (1/46, access VLAN 125)      ← fixed across all models
            // HLH_OS (1/49-1/50, access VLAN 125)   ← fixed across all models
            // TOR_BMC (1/51-1/52, trunk, native 99, allowed 125) ← fixed
        ]
    },
    "port_channels": [
        // PC102: TOR_BMC, trunk, native 99, tagged 125, members 1/51 + 1/52
    ]
}
```

### Phase 2: TOR-side BMC Integration (P0)

**Objective:** TOR templates produce the TOR-side port-channel 102 for BMC connectivity.

| Task | Gap | Description |
|------|-----|-------------|
| 2.1 | G6 | Add port-channel 102 to `93180YC-FX.json` (member: 1/44) |
| 2.2 | G6 | Add port-channel 102 to `93180YC-FX3.json` (member: 1/44) |
| 2.3 | G6 | Add port-channel 102 to `93108TC-FX3P.json` (member: TBD from config analysis) |
| 2.4 | G11 | Verify `Trunk_TO_BMC_SWITCH` port alignment per model — current templates use 1/49 but real FX/FX3 configs show 1/44 |

**Note:** Current TOR templates already have `Trunk_TO_BMC_SWITCH` in common section (port 1/49 for all models). Real configs show 93180YC-FX and 93180YC-FX3 use Eth1/44 for BMC. Port mismatch needs correction.

### Phase 3: 32-bit ASN Standard (P1)

**Objective:** Validate and document 32-bit ASN support for MUX BGP peering.

| Task | Gap | Description |
|------|-----|-------------|
| 3.1 | G9 | Create test case with 32-bit MUX ASN (based on b88_n03 definition) |
| 3.2 | — | Document in code: "32-bit ASN for SDN/MUX is standard from now on" |
| 3.3 | — | Verify NX-OS template renders 4-byte ASN in asplain notation correctly |

**Current state:** Code passes ASN as integer, Jinja2 renders `{{ bgp.asn }}` as plain integer. NX-OS accepts asplain notation. This likely works already — just needs test coverage.

### Phase 4: BMC Toggle (P1)

**Objective:** Allow explicit control over BMC generation.

| Task | Gap | Description |
|------|-----|-------------|
| 4.1 | G12 | Support `"IncludeBMC": true/false` at `InputData` level |
| 4.2 | G12 | When `false`, skip `convert_bmc_switches()` call entirely |
| 4.3 | — | When BMC switch has `Make: "None"`, already skips — keep this behavior |

### Phase 5: Extended Support (P2 — future)

| Task | Gap | Description |
|------|-----|-------------|
| 5.1 | G10 | Dynamic HOST_BMC port count from node count |
| 5.2 | G13 | Port breakout support for border uplinks |
| 5.3 | G14 | Dedicated storage switch type (`Type: "Storage"`) |
| 5.4 | — | Embedded BMC on TOR pattern (b88_b20 — BMC ports on TOR itself) |
| 5.5 | — | WANSIM exclusion (ensure it's not generated) |

---

## CI/CD & GitHub Overhaul

> **Status:** Planned — audit complete, ready for implementation  
> **Scope:** `.github/` folder — workflows, triage, Copilot instructions  
> **Blocked by:** Nothing — independent of BMC phases

### Audit Findings

Full audit of `.github/` found 4 critical/high issues, 4 medium, and 4 low-severity items.

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | **HIGH** | `build-switchgentool.yml` | No pytest execution — 103 tests exist but never run in CI. The only "test" is `python src/main.py --help`. |
| 2 | **HIGH** | `build-switchgentool.yml` | No separate CI test workflow despite full test suite. |
| 3 | **HIGH** | `triage-submissions.yml` | Checkbox threshold bug — requires ≥3 checked but template only has 2 required checkboxes. Valid submissions fail validation. |
| 4 | **HIGH** | `process-submission.instructions.md` | Steps 2–4 reference `/workspace/backend/` Python modules (`metadata_validator`, `vendor_detector`, `config_sectioner`) that don't exist. Entirely non-functional. |
| 5 | **MEDIUM** | `build-switchgentool.yml` | Stale branch `dev/nl/newDesignv1` in triggers. |
| 6 | **MEDIUM** | `build-switchgentool.yml` | Release job fully commented out — tagged builds produce artifacts but no release. |
| 7 | **MEDIUM** | `triage-submissions.yml` | Unsafe JSON interpolation via `JSON.parse('${{ steps.validate.outputs.result }}')` — single quote in result breaks JavaScript. |
| 8 | **MEDIUM** | `triage-submissions.yml` | Spam regex `${}` and `{{}}` false-positive on legitimate config content (Dell OS10, Jinja2). |
| 9 | **LOW** | `triage-submissions.yml` | No `permissions:` block — inherits repo defaults. |
| 10 | **LOW** | `triage-submissions.yml` | Checkbox error message doesn't match actual checkbox labels. |
| 11 | **LOW** | `build-switchgentool.yml` | Fallback `requirements.txt` creation masks real errors. |
| 12 | **LOW** | `.github/` | No project-level `copilot-instructions.md` for development guidance. |

### Plan: Unified Build Workflow (`build-switchgentool.yml`)

Restructure into 3 jobs with dependencies:

```
test (ubuntu) ──→ build (windows + linux matrix) ──→ release (ubuntu, tag-only)
     │                      │                              │
   pytest              PyInstaller                  GitHub Release
   103 tests           smoke test                   with environment
   must pass            must pass                   approval gate
```

#### Job 1: `test`

- **Runs on:** `ubuntu-latest`
- **Trigger:** Push to `main`, PRs to `main`, `workflow_dispatch`, tag pushes
- **Steps:** Checkout → Python 3.12 → `pip install -r requirements.txt` → `python -m pytest tests/ -v`
- **Gate:** Build job depends on this passing

#### Job 2: `build` (needs: test)

- **Matrix:** `windows-latest` + `ubuntu-latest`
- **Changes from current:**
  - Remove fake "Quick source test" (replaced by real pytest in `test` job)
  - Fix Python version: 3.11 → 3.12
  - Remove stale `dev/nl/newDesignv1` branch from triggers
  - Remove fallback `requirements.txt` creation (masks errors)
  - Keep BMC converter import check and smoke test

#### Job 3: `release` (needs: build, tag-only)

- **Condition:** `startsWith(github.ref, 'refs/tags/v')`
- **Environment:** `production` with required reviewer approval
- **Action:** `softprops/action-gh-release@v2` — uploads both executables
- **Permissions:** `contents: write` scoped to this job only

**Safety analysis for automated release:**

| Concern | Mitigation |
|---------|------------|
| Accidental release | Tag push is a deliberate manual action (`git tag v1.0.0 && git push origin v1.0.0`) |
| Broken binary | Tests must pass → build must pass → then release. Two quality gates. |
| Partial release (one OS fails) | `fail-fast: true` on build matrix — if either OS fails, both fail, release blocked. |
| Wrong person releases | GitHub Environment `production` requires reviewer approval before release job runs. |
| Half-tested code | pytest runs the full 103-test suite before build even starts. |

**Decision:** Use environment approval gate. Fully automated pipeline, but a human clicks "Approve" before the release publishes. Can be removed later once comfortable.

#### Branch Triggers

| Event | Trigger | Jobs |
|-------|---------|------|
| Push to `main` | With path filters (`src/`, `input/`, `tests/`, etc.) | test → build |
| PR to `main` | Same path filters | test → build |
| Tag `v*` | No path filters (tags don't match paths) | test → build → release |
| `workflow_dispatch` | Manual | test → build |

### Plan: Triage Workflow Fixes (`triage-submissions.yml`)

4 targeted fixes, no structural rewrite:

| Fix | Current | Fixed |
|-----|---------|-------|
| Checkbox threshold | `checkedBoxes < 3` | `checkedBoxes < 2` (only 2 required in template) |
| Error message | "sanitization, responsibility acknowledgment, contributing guide" | "password sanitization and CONTRIBUTING.md review" |
| JSON interpolation | `JSON.parse('${{ ... }}')` (unsafe) | Pass via environment variable → `JSON.parse(process.env.RESULT)` |
| Spam patterns | `${}` and `{{}}` as errors | Downgrade to warnings (legitimate Dell OS10 content) |
| Permissions | Missing | Add `permissions: issues: write` |

### Plan: Copilot Custom Instructions (`.github/copilot-instructions.md`)

New file providing project-level development guidance to Copilot:

| Section | Content |
|---------|---------|
| Project overview | Python + Jinja2 switch config generator for Azure Local |
| Architecture | Lab JSON → Converter → Standard JSON → Generator + Templates → .cfg |
| Code conventions | `src/` package structure, constants in `constants.py`, `pathlib` over `os.path` |
| Key files | `main.py` (CLI), `generator.py` (rendering), `convertors/` (conversion) |
| Testing rules | `pytest`, 3 test files (unit/converter/generator), golden-file pattern, `tmp_path` |
| Design principles | TOR = production-quality, BMC = internal-minimal |
| Template conventions | Jinja2 in `input/jinja2_templates/<make>/<firmware>/`, switch models in `input/switch_interface_templates/<make>/` |

### Submission Instructions — Skipped

`process-submission.instructions.md` references backend Python modules that don't exist (`metadata_validator`, `vendor_detector`, `config_sectioner`). Steps 2–4 are non-functional. This is a WIP feature on another branch — **skip rewrite for now**, will be addressed when that feature lands.

---

## Unit Test Plan

> Existing tests can be **destroyed and rewritten** from scratch. The current test code has structural issues (import-time side effects, no cleanup, no negative tests, fragile deep equality). We will rebuild the test suite using best practices.

### Test Strategy Decision: Hybrid Approach

**Decision:** Use a hybrid strategy — golden files for what they're good at, unit tests for what's missing.

| Stage | Strategy | Rationale |
|-------|----------|-----------|
| **Stage 2: Generator/Jinja2 → .cfg** | **Golden files only** | Jinja2 rendering is pure text output — golden files are the ONLY reasonable approach. You can't meaningfully unit-test template rendering without rendering. |
| **Stage 1: Converter → Standard JSON** | **Golden files + unit tests** | Golden files serve as thin integration smoke tests (does the full pipeline still produce correct output?). Unit tests target individual `StandardJSONBuilder` methods with small synthetic inputs for fast, pinpointed failure diagnosis. |

**Key gap filled:** `StandardJSONBuilder` (684 lines, 14 methods) had ZERO unit tests. Now covered by `test_unit.py` with focused tests for `build_switch()`, `build_vlans()`, `_resolve_interface_vlans()`, `build_interfaces()`, `build_bgp()`, etc.

**Golden-file test cases serve as integration smoke tests:**
- Converter tests: Lab JSON → converter → compare full standard JSON output against expected
- Generator tests: Standard JSON → generator + Jinja2 → compare .cfg output against expected
- These catch regressions in the overall pipeline but give poor failure localization

**Unit tests give fast pinpointed failure diagnosis:**
- Each `StandardJSONBuilder` method tested with small synthetic inputs
- Tests run in milliseconds, no file I/O, no template loading
- When a golden-file test fails, unit tests tell you WHICH method broke

### Test Architecture Rewrite

**Problems with current tests (T1–T7):**
- `pytest_sessionfinish` defined in both test files — conflicts, should be in `conftest.py`
- `sys.path.insert` and test discovery at import time — side effects during collection
- `sys.stdout` suppression instead of capsys/redirect — loses output on failure
- Generated files never cleaned up — stale files cause false passes
- Full deep equality comparison — any new key breaks all tests
- No negative tests — zero coverage for error paths
- Module-level mutable state tracking — fragile, order-dependent

**Proposed new structure:**

```
tests/
├── conftest.py                          ← Shared fixtures, hooks, pytest_sessionfinish
├── test_convertors.py                   ← Converter integration tests (golden-file)
├── test_generator.py                    ← Generator integration tests (golden-file)
├── test_converter_unit.py               ← NEW: Unit tests for converter methods
├── test_bmc_converter_unit.py           ← NEW: Unit tests for BMC converter
├── test_loader.py                       ← NEW: Unit tests for loader utilities
├── test_negative.py                     ← NEW: Error handling / edge case tests
└── test_cases/
    ├── convert_<name>/                  ← Golden-file test data (same folder convention)
    │   ├── lab_*_switch_input.json
    │   └── expected_outputs/
    └── std_<name>/                      ← Generator golden-file test data
        ├── std_*_input.json
        └── expected_*.cfg
```

**Key changes:**

| Current | Proposed | Rationale |
|---------|----------|----------|
| `pytest_sessionfinish` in test files | Move to `conftest.py` | Single hook, no conflicts |
| `sys.path.insert` at import | Fixture-based setup or `pyproject.toml` paths | No side effects at collection |
| `sys.stdout = io.StringIO()` | `capsys` fixture or `contextlib.redirect_stdout` | Proper pytest integration |
| No cleanup of generated files | `tmp_path` fixture or `autouse` cleanup fixture | Test isolation between runs |
| `expected_data != generated_data` (strict) | Comparison that ignores `debug` key, reports structured diffs | Resilient to additive changes |
| `convertor_results` global dict | Let pytest handle results natively | No custom tracking needed |
| All happy-path | Add `test_negative.py` | Cover error paths |

### Golden-File Test Cases (Integration)

Keep the golden-file pattern (it works well for end-to-end validation) but fix the infrastructure.

Each test case folder follows the existing convention:
```
tests/test_cases/convert_<name>/
├── lab_<vendor>_<firmware>_switch_input.json    ← Lab format definition JSON
└── expected_outputs/
    ├── <tor1a-hostname>.json                     ← Expected standard JSON for TOR1
    ├── <tor1b-hostname>.json                     ← Expected standard JSON for TOR2
    └── <bmc-hostname>.json                       ← Expected standard JSON for BMC (if applicable)
```

#### Test Case 1: `convert_lab_switch_input_json_cisco_nxos_switched_bmc`

| Field | Value |
|-------|-------|
| **Source** | Based on `rr1n42r24-sw8-definition.json` (Switched, 20-node, with BMC) |
| **Input file** | `lab_cisco_nxos_switch_input.json` |
| **Purpose** | Validate end-to-end Switched + BMC conversion |
| **Expected outputs** | 3 files: TOR1a.json, TOR1b.json, **BMC.json** |
| **Validates** | BMC interface template loading (9348GC-FX3), PC102 in output, static route, VLANs 2/99/125, 20 HOST_BMC ports |

**BMC expected output structure:**
```json
{
    "switch": { "make": "cisco", "firmware": "nxos", "model": "9348gc-fx3", "type": "BMC", "site": "...", ... },
    "vlans": [ {vlan 2}, {vlan 99}, {vlan 125 + SVI} ],
    "interfaces": [ {Unused 1/1-1/54}, {HOST_BMC 1/1-1/20}, {HLH_BMC 1/46}, {HLH_OS 1/49-1/50}, {TOR_BMC 1/51-1/52} ],
    "port_channels": [ { "id": 102, "description": "TOR_BMC", "type": "Trunk", "native_vlan": "99", "tagged_vlans": "125", "members": ["1/51", "1/52"] } ],
    "static_routes": [ { "prefix": "0.0.0.0/0", "next_hop": "<bmc_gateway>" } ]
}
```

#### Test Case 2: `convert_lab_switch_input_json_cisco_nxos_hc_bmc`

| Field | Value |
|-------|-------|
| **Source** | Based on `b88rn03-hc8-definition.json` (HyperConverged, 16-node, with BMC, 32-bit ASN) |
| **Input file** | `lab_cisco_nxos_switch_input.json` |
| **Purpose** | Validate HyperConverged + BMC + 32-bit MUX ASN |
| **Expected outputs** | 3 files: TOR1a.json, TOR1b.json, **BMC.json** |
| **Validates** | 32-bit ASN 4200003000 in TOR BGP neighbors, HC pattern → `fully_converged` template, PFC/QoS on TOR, BMC with 16 HOST_BMC ports |

**Additionally validates for TOR outputs:**
- MUX ASN `4200003000` appears correctly in `bgp.neighbors` as integer (not truncated)
- HyperConverged `DeploymentPattern` → converter selects `fully_converged` template key
- Storage VLAN 711 included in trunk `tagged_vlans` on host ports
- Port-channel 102 present in TOR port_channels

#### Test Case 3: `convert_lab_switch_input_json_cisco_nxos_switched_nobmc`

| Field | Value |
|-------|-------|
| **Source** | Based on `b88rb20-sw4-definition.json` (Switched, 16-node, **without BMC**) |
| **Input file** | `lab_cisco_nxos_switch_input.json` |
| **Purpose** | Validate Switched topology correctly handles `Make: "None"` BMC |
| **Expected outputs** | 2 files: TOR1a.json, TOR1b.json (**no BMC output**) |
| **Validates** | BMC converter gracefully skips when `Make: "None"`, only TOR configs generated, no crash |

#### Update Existing: `convert_lab_switch_input_json_cisco_nxos_switched`

| Field | Value |
|-------|-------|
| **Current status** | ⏭️ Skipped — missing BMC expected outputs |
| **Action** | Add missing BMC expected output JSON to `expected_outputs/`, un-skip the test |
| **Validates** | Existing Switched test case works end-to-end including BMC output |

### New Generator Test Cases

Generator tests validate standard JSON → .cfg rendering. These use standard JSON inputs (output from converter, or hand-crafted).

#### Test Case 4: `std_cisco_nxos_bmc`

| Field | Value |
|-------|-------|
| **Input** | `std_cisco_nxos_bmc_input.json` — BMC standard JSON (hand-crafted or from converter output) |
| **Purpose** | Validate Jinja2 templates correctly render BMC standard JSON |
| **Expected outputs** | `expected_system.cfg`, `expected_vlan.cfg`, `expected_interface.cfg`, `expected_static_route.cfg`, `expected_port_channel.cfg` |
| **Validates** | Templates handle BMC JSON: no BGP/QoS/prefix_list generated, static route rendered, PC102 rendered |

**Key assertions:**
- `generated_bgp.cfg` is empty or header-only (guarded by `{% if bgp is defined %}`)
- `generated_qos.cfg` is empty or header-only
- `generated_prefix_list.cfg` is empty or header-only
- `generated_port_channel.cfg` contains port-channel 102 config
- `generated_static_route.cfg` contains `ip route 0.0.0.0/0 <gateway>`
- `generated_vlan.cfg` contains only VLANs 2, 99, 125 (not VLAN 7)

#### Test Case 5: `std_cisco_nxos_switched_32bit_asn`

| Field | Value |
|-------|-------|
| **Input** | `std_cisco_nxos_switched_32bit_asn_input.json` — TOR standard JSON with MUX ASN 4200003000 |
| **Purpose** | Validate 32-bit MUX ASN renders correctly in BGP config |
| **Expected outputs** | `expected_bgp.cfg` containing `neighbor <mux_ip> remote-as 4200003000` |
| **Validates** | NX-OS BGP template handles 4-byte ASN in asplain notation without truncation |

### Test Matrix Summary

| Test Case | Type | Topology | BMC? | 32-bit ASN? | Phase |
|-----------|------|----------|------|-------------|-------|
| `convert_..._cisco_nxos_switched_bmc` | Converter | Switched | ✅ | ❌ | 1 |
| `convert_..._cisco_nxos_hc_bmc` | Converter | HyperConverged | ✅ | ✅ | 1+3 |
| `convert_..._cisco_nxos_switched_nobmc` | Converter | Switched | ❌ | ❌ | 1 |
| Update existing `_cisco_nxos_switched` | Converter | Switched | ✅ | ❌ | 1 |
| `std_cisco_nxos_bmc` | Generator | N/A (BMC) | ✅ | ❌ | 1 |
| `std_cisco_nxos_switched_32bit_asn` | Generator | Switched | ❌ | ✅ | 3 |

### Unit Tests (New — Phase 0)

These test individual functions/methods in isolation, not the full pipeline.

#### `test_converter_unit.py`

| Test | Validates |
|------|-----------|
| `test_infer_firmware_cisco` | `infer_firmware("cisco") → "nxos"` |
| `test_infer_firmware_dell` | `infer_firmware("dellemc") → "os10"` |
| `test_infer_firmware_unknown` | `infer_firmware("juniper") → raises or returns raw` |
| `test_classify_vlan_group_hnvpa` | `classify_vlan_group("HNVPA") → "C"` |
| `test_classify_vlan_group_storage` | `classify_vlan_group("STORAGE") → "S"` |
| `test_resolve_interface_vlans_symbolic` | `"M,C,S"` → resolved to actual VLAN IDs |
| `test_resolve_interface_vlans_literal` | `"99"` → `["99"]` passthrough |
| `test_build_ip_mapping_p2p` | P2P border IPs extracted correctly |
| `test_build_ip_mapping_loopback` | Loopback0 IP extracted correctly |
| `test_mux_asn_32bit` | ASN `4200003000` stored as integer, not truncated |
| `test_mux_asn_16bit` | ASN `65052` stored correctly |

#### `test_bmc_converter_unit.py`

| Test | Validates |
|------|-----------|
| `test_build_switch_info_cisco` | `make: "cisco"`, `firmware: "nxos"`, `site` present |
| `test_build_switch_info_dell` | `make: "dellemc"`, `firmware: "os10"` |
| `test_build_vlans_cisco` | VLANs 2, 99, 125 (not 7), Vlan125 has SVI |
| `test_build_vlans_dell` | VLANs 2, 7, 125 (vendor-appropriate) |
| `test_bmc_skipped_when_make_none` | No output when `Make: "None"` |
| `test_bmc_port_channels_from_template` | PC102 read from template, not hardcoded |
| `test_bmc_static_route_extracted` | Default route from BMC supernet gateway |
| `test_template_not_found_raises` | `FileNotFoundError` with clear message |

#### `test_loader.py`

| Test | Validates |
|------|-----------|
| `test_load_input_json_valid` | Returns parsed dict |
| `test_load_input_json_missing_file` | Raises `FileNotFoundError` (after fix Q9) |
| `test_load_input_json_invalid_json` | Raises `json.JSONDecodeError` |
| `test_get_real_path_resolves` | Correct path resolution |

#### `test_negative.py`

| Test | Validates |
|------|-----------|
| `test_converter_empty_switches` | Graceful handling, no KeyError |
| `test_converter_missing_supernets` | Clear error message |
| `test_converter_unknown_vendor` | Doesn't crash, returns raw firmware |
| `test_generator_missing_template_dir` | Clear error, not silent |
| `test_generator_invalid_json_input` | Propagates error |
| `test_bmc_template_missing_common` | `ValueError` with clear message |

### Test Execution

Golden-file tests auto-discover from folder naming. Unit tests run independently.

```bash
# Run all tests
python -m pytest tests/ -v

# Run only unit tests (fast, no I/O)
python -m pytest tests/test_converter_unit.py tests/test_bmc_converter_unit.py tests/test_loader.py -v

# Run only integration tests
python -m pytest tests/test_convertors.py tests/test_generator.py -v

# Run only negative/edge case tests
python -m pytest tests/test_negative.py -v

# Run specific golden-file test case
python -m pytest tests/test_convertors.py -v -k "cisco_nxos_switched_bmc"
```

**Expected test counts after full implementation:**

| Category | Current | After Phase 0 | After Phase 1+ |
|----------|---------|---------------|------------------|
| Converter integration | 12 (4×3) | 12 (rewritten) | 21 (7×3) |
| Generator integration | 34 (3 cases) | 34 (rewritten) | 50+ (5 cases) |
| Converter unit | 0 | ~11 | ~15 |
| BMC converter unit | 0 | ~8 | ~12 |
| Loader unit | 0 | ~4 | ~4 |
| Negative tests | 0 | ~6 | ~10 |
| **Total** | **46** | **~75** | **~112** |

---

## Port Layout Reference

### Switched (with separate BMC) — rr1_n42_r24 pattern

```
TOR (93180YC-FX3):
┌─────────────────────────────────────────────────────┐
│ Eth1/1-1/20   Switched-Compute (trunk M,C)          │ ← Node count dependent
│ Eth1/21-1/40  Switched-Storage (trunk S, PFC+QoS)   │ ← Node count dependent
│ Eth1/41-1/42  P2P_IBGP → port-channel 50 (PFC)     │
│ Eth1/43        Unused                                │
│ Eth1/44        TOR_BMC → port-channel 102            │ ← BMC uplink
│ Eth1/45-1/46  Unused                                 │
│ Eth1/47        P2P_Border2 (routed)                  │
│ Eth1/48        P2P_Border1 (routed)                  │
│ Eth1/49-1/51  MLAG_Peer → port-channel 101 (PFC)    │
│ Eth1/52-1/54  Unused                                 │
└─────────────────────────────────────────────────────┘

BMC (9348GC-FX3):
┌─────────────────────────────────────────────────────┐
│ Eth1/1-1/20   HOST_BMC (access VLAN 125)             │ ← Node count dependent
│ Eth1/21-1/45  Unused (access VLAN 2)                 │
│ Eth1/46        HLH_BMC (access VLAN 125)             │
│ Eth1/47-1/48  Unused (access VLAN 2)                 │
│ Eth1/49-1/50  HLH_OS (access VLAN 125)               │
│ Eth1/51-1/52  TOR_BMC → port-channel 102 (trunk 125) │ ← TOR uplink
│ Eth1/53-1/54  Unused (access VLAN 2)                 │
└─────────────────────────────────────────────────────┘
```

### HyperConverged (with BMC) — b88_n03 pattern

```
TOR (93180YC-FX):
┌─────────────────────────────────────────────────────┐
│ Eth1/1-1/16   HyperConverged (trunk M,C,S, PFC+QoS) │
│ Eth1/17-1/40  Unused                                 │
│ Eth1/41-1/42  P2P_IBGP → port-channel 50 (PFC)      │
│ Eth1/43        Unused                                │
│ Eth1/44        TOR_BMC → port-channel 102            │ ← BMC uplink
│ Eth1/45-1/46  Unused                                 │
│ Eth1/47        P2P_Border1 (routed)                  │
│ Eth1/48        P2P_Border2 (routed)                  │
│ Eth1/49-1/51  MLAG_Peer → port-channel 101 (PFC)    │
│ Eth1/52-1/54  Unused                                 │
└─────────────────────────────────────────────────────┘

BMC (9348GC-FXP):
┌─────────────────────────────────────────────────────┐
│ Eth1/1-1/16   HOST_BMC (access VLAN 125)             │
│ Eth1/17-1/45  Unused (access VLAN 2)                 │
│ Eth1/46        HLH_BMC (access VLAN 125)             │
│ Eth1/47-1/48  Unused (access VLAN 2)                 │
│ Eth1/49-1/50  HLH_OS (access VLAN 125)               │
│ Eth1/51-1/52  TOR_BMC → port-channel 102 (trunk 125) │ ← TOR uplink
│ Eth1/53-1/54  Unused (access VLAN 2)                 │
└─────────────────────────────────────────────────────┘
```

### Switched (embedded BMC on TOR, no separate BMC switch) — b88_b20 pattern

```
TOR (93108TC-FX3P):
┌─────────────────────────────────────────────────────┐
│ Eth1/1-1/16   Switched-Compute (trunk M,C)           │
│ Eth1/17-1/30  Unused                                 │
│ Eth1/31-1/38  HOST_BMC (access VLAN 125)             │ ← BMC on TOR itself!
│ Eth1/39-1/46  Unused                                 │
│ Eth1/47        HLH_BMC (access VLAN 125)             │
│ Eth1/48        HLH_OS (access VLAN 125)              │
│ Eth1/49-1/50  MLAG_Peer → port-channel 101           │
│ Eth1/51-1/52  P2P_IBGP → port-channel 50             │
│ Eth1/53/1      P2P_Border2 (breakout)                │
│ Eth1/54/1      P2P_Border1 (breakout)                │
└─────────────────────────────────────────────────────┘
  ↑ No separate BMC switch. No port-channel 102. Phase 5.
```

---

## File Mapping

```
_cisco_configs/
├── samples/
│   ├── b88_b20/                                        ← Switched, no BMC switch
│   │   ├── b88rb20-sw4-definition.json                 ← Lab format JSON (needs BMC entry added)
│   │   ├── b88-b20-93108hl-10-1a.conf                 ← TOR1 config (93108TC-FX3P)
│   │   ├── b88-b20-93108hl-10-1b.conf                 ← TOR2 config
│   │   └── b88-b20-9336st-10-1.conf                   ← Storage switch (L2-only, future scope)
│   │
│   ├── b88_n03/                                        ← HyperConverged, with BMC
│   │   ├── b88rn03-hc8-definition.json                 ← Lab format JSON (32-bit MUX ASN!)
│   │   ├── b88-n03-93180hl-2-1a.txt                   ← TOR1 config (93180YC-FX)
│   │   ├── b88-n03-93180hl-2-1b.txt                   ← TOR2 config
│   │   └── b88-n03-9348bmc-2-1.txt                    ← BMC config (9348GC-FXP, 16 nodes)
│   │
│   └── rr1_n42_r24/                                    ← Switched, with BMC
│       ├── rr1n42r24-sw8-definition.json               ← Lab format JSON
│       ├── rr1-n42-r24-93180hl-7-1a.conf              ← TOR1 config (93180YC-FX3)
│       ├── rr1-n42-r24-93180hl-7-1b.conf              ← TOR2 config
│       └── rr1-n42-r24-9348bmc-7-1.conf               ← BMC config (9348GC-FX3, 20 nodes)
│
└── reference/
    └── ROADMAP.md                                      ← This file
```

---

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **All input files are lab format JSON** | They go through the converter (`convertors_lab_switch_json.py` + `convertors_bmc_switch_json.py`), not directly to the generator |
| 2 | **Unified, generic implementation** | Templates and converter code are parameterized and data-driven. The three samples are validation data, not three separate code paths. Any valid lab JSON should produce correct output without sample-specific logic. |
| 3 | **Reuse existing Jinja2 templates for BMC** | Guards already exist — BMC JSON with missing sections renders empty output. No separate BMC-only templates needed. |
| 4 | **BMC interface templates use `common` section only** | BMC port layout is topology-independent (follows Dell N3248TE-ON pattern). Only HOST_BMC port range varies by model. |
| 5 | **32-bit ASN for MUX is the standard going forward** | `4200003000` from b88_n03. Code already handles it natively. Need test coverage. |
| 6 | **Two Cisco BMC models: 9348GC-FXP + 9348GC-FX3** | Differ only in HOST_BMC port count (16 vs 20). Same template structure, same converter code path. |
| 7 | **b88_b20 definition needs BMC entry added** | Currently `Make: "None"` — update to enable testing with-BMC flow |
| 8 | **VLAN 7 in BMC converter is incorrect for Cisco** | Real Cisco BMC uses VLAN 99 (NativeVlan), not VLAN 7 (Infra). Fix in Phase 1 — make vendor-aware or data-driven. |
| 9 | **Port-channel 102 needed in both BMC and TOR templates** | BMC side: members 1/51-1/52. TOR side: member 1/44 (FX/FX3) or TBD (FX3P). Defined in templates, not code. |
| 10 | **Tests follow existing golden-file auto-discovery pattern** | Folder naming convention (`convert_*`, `std_*`). No test framework changes needed. |
| 11 | **Embedded BMC on TOR (b88_b20 pattern) is Phase 5** | Priority is separate BMC switch support first |
| 12 | **Storage switch (9336C) is out of initial scope** | New `Type: "Storage"` would need its own converter — Phase 5 |
| 13 | **WANSIM is excluded** | Old tool artifact, not relevant for new config generator |
| 14 | **Refactor existing code freely** | Dev branch — breaking changes acceptable. Fix flaws, upgrade patterns, apply best practices. Every critical fix gets a unit test. |
| 15 | **Rewrite tests from scratch if needed** | Current tests have structural issues (T1-T7). Don't copy anti-patterns. Use `conftest.py`, fixtures, `tmp_path`, proper cleanup. |
| 16 | **Phase 0 before Phase 1** | Clean foundation first — shared constants, consistent error handling, path resolution, logging. BMC work lands on solid ground. |
| 17 | **Tag-based release with environment approval** | `v*` tags trigger test→build→release pipeline. GitHub Environment `production` requires human approval before release publishes. Safe because: tag push is manual, tests gate build, build gates release. |
| 18 | **Single workflow over separate CI/test** | Simpler — test job gates build job within one workflow. No need for a separate `ci-test.yml`. |
| 19 | **`main`-only push trigger** | PRs automatically test dev branches. Push triggers only for `main` and tags. Removes stale `dev/nl/newDesignv1`. |
| 20 | **BMC is optional per deployment pattern** | BMC configs generated only when `Type: "BMC"` entry exists in input JSON. No BMC entry → only TOR configs. Converter skips gracefully. Validated by `nobmc` test case. |

---

## Decision Checkpoints

> For critical decisions, pause and discuss before proceeding.

| # | Decision Needed | Phase | Context |
|---|----------------|-------|--------|
| DC1 | **Import pattern standardization** | 0 | **DECIDED:** CLI + PyInstaller for Windows users. Centralize dual-import into a single path setup helper at entry point. Keep `get_real_path()` PyInstaller-aware (`sys._MEIPASS`). Remove the 6 scattered `try/except` blocks. |
| DC2 | **Logging strategy** | 0 | Replace all `print()` with `logging`. Need to decide: log format, default level, where to configure (env var? CLI flag?), how tests suppress output. |
| DC3 | **Debug output in production JSON** | 0 | **DECIDED:** Gate behind `--debug` CLI flag, off by default. Debug data (`vlan_map`/`ip_map`) only included when explicitly requested. |
| DC4 | **BMC VLAN source** | 1 | **DECIDED:** Hardcode consistent set (VLANs 2, 99, 125) for all vendors — lab-internal use, same for quick POC. Design code so it's easy to make data-driven later. VLAN 7 removed from Cisco path. |
| DC5 | **Schema validation** | 2+ | No JSON schema validation today. Adding it would catch bad inputs early but requires defining schemas. Worth the effort? Which format (JSON Schema, Pydantic, dataclasses)? |
| DC6 | **Test comparison strategy** | 0 | Ignore `debug` key in JSON comparisons. Compare everything else strictly. Simple and effective. |
| DC7 | **Release automation strategy** | CI/CD | **DECIDED:** Tag-based with environment approval gate. Pipeline: test→build→release. GitHub Environment `production` requires reviewer click before release publishes. Fully automated but human-gated. Can remove approval later once comfortable. |
| DC8 | **CI branch triggers** | CI/CD | **DECIDED:** Push to `main` only (with path filters). PRs to `main` catch all dev branches automatically. Tags `v*` trigger full pipeline including release. `workflow_dispatch` for manual runs. |
| DC9 | **Submission instructions rewrite** | CI/CD | **DECIDED:** Skip for now — WIP feature on another branch. Steps 2–4 reference non-existent backend modules. Will address when that feature is ready. |
