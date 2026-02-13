# Test Cases Summary

## Quick Reference
**Status**: All tests passing (227 passed)
**Run Tests**: `python -m pytest tests/ -v`

---

## Test Architecture

| Layer | File | Strategy | Count |
|-------|------|----------|-------|
| Unit | `test_unit.py` | Synthetic inputs, one method at a time | 88 |
| Converter integration | `test_convertors.py` | Golden-file comparison (lab JSON → standard JSON) | 12 |
| Generator integration | `test_generator.py` | Golden-file comparison (standard JSON → .cfg) | 6 |
| Submission flow | `test_submission_flow.py` | Schema + consistency checks (issue template, workflow) | 121 |
| **Total** | | | **227** |

---

## Unit Tests (`test_unit.py` — 88 tests)

Tests individual methods of `StandardJSONBuilder` and utility functions with small synthetic inputs. Each test targets one behaviour.

| Test Class | Tests | Coverage |
|------------|-------|----------|
| `TestInferFirmware` | 4 | Cisco→nxos, Dell→os10, unknown vendor, case insensitivity |
| `TestClassifyVlanGroup` | 3 | Infrastructure (M), Compute/Tenant (C), Storage (S) |
| `TestTORDeploymentPattern` | 3 | hyperconverged→fully_converged, switched, switchless |
| `TestTORBuildVlans` | 8 | VLAN construction from supernets, ID resolution, naming |
| `TestTORBuildSVIs` | 10 | SVI interface construction, HSRP/VRRP, IP assignment |
| `TestTORBuildInterfaces` | 12 | Interface template processing, access/trunk, shutdown |
| `TestTORBuildPortChannels` | 6 | Port-channel creation, member bundling, LACP |
| `TestTORBuildBGP` | 8 | BGP neighbors, ASN, router-id, networks, MUX peers |
| `TestTORBuildPrefixLists` | 3 | Prefix-list generation, permit/deny |
| `TestTORBuildQoS` | 2 | QoS policy flag |
| `TestTORBuildIPMapping` | 4 | P2P border IPs, loopback, iBGP, HNV-PA subnet |
| `TestTORBuildStaticRoutes` | 5 | Static route generation |
| `TestTORBuildSystem` | 5 | Hostname, MTU, firmware, model |
| `TestTORBuildLogin` | 3 | Login/AAA settings |
| *Other helper tests* | 9 | Edge cases and utilities |

## Converter Integration Tests (`test_convertors.py` — 12 tests)

End-to-end pipeline: lab JSON → converter → compare full standard JSON output against golden files.

| Test | Cases | Description |
|------|-------|-------------|
| `test_convert_produces_expected_json` | 4 | Per-switch JSON matches expected output |
| `test_convert_produces_correct_file_count` | 4 | Correct number of output files generated |
| `test_convert_produces_expected_bmc_json` | 4 | BMC switch output matches expected (where applicable) |

**Test cases:**
- `convert_lab_switch_input_json_cisco_nxos_fc` — Cisco NX-OS Fully Converged
- `convert_lab_switch_input_json_cisco_nxos_switched` — Cisco NX-OS Switched
- `convert_lab_switch_input_json_cisco_nxos_switched_20node` — Cisco NX-OS Switched (20-node)
- `convert_lab_switch_input_json_cisco_nxos_switched_nobmc` — Cisco NX-OS Switched (no BMC)
- `convert_lab_switch_input_json_cisco_nxos_switchless` — Cisco NX-OS Switchless
- `convert_lab_switch_input_json_dell_os10` — Dell OS10 Fully Converged

## Generator Integration Tests (`test_generator.py` — 6 tests)

End-to-end pipeline: standard JSON → generator + Jinja2 templates → compare `.cfg` output against golden files.

| Test | Cases | Description |
|------|-------|-------------|
| `test_generated_config_matches_expected` | 3 | Generated .cfg files match golden files |
| `test_generates_expected_file_count` | 3 | Correct number of .cfg files created |

**Test cases:**
- `std_cisco_nxos_fc` — Cisco NX-OS Fully Converged
- `std_cisco_nxos_switched` — Cisco NX-OS Switched
- `std_dell_os10_fc` — Dell OS10 Fully Converged

---

## Submission Flow Tests (`test_submission_flow.py` — 121 tests)

Validates the config submission workflow end-to-end: issue template schema, triage validation logic, cross-file consistency, and file-path existence.

| Area | Tests | Coverage |
|------|-------|----------|
| Triage validation | ~20 | Mock issue bodies covering every validation scenario |
| Issue template schema | ~15 | Field IDs, dropdowns, required fields |
| Cross-file consistency | ~40 | Pattern names, roles, field names across all submission files |
| File-path existence | ~25 | Every path in process-submission.instructions.md exists |
| Workflow guards | ~20 | Infinite loop prevention, label checks |

---

## Running Tests

```bash
# All tests
python -m pytest tests/ -v

# Unit tests only
python -m pytest tests/test_unit.py -v

# Integration tests only
python -m pytest tests/test_convertors.py tests/test_generator.py -v

# Submission flow tests only
python -m pytest tests/test_submission_flow.py -v

# Single test class
python -m pytest tests/test_unit.py::TestTORBuildVlans -v
```
