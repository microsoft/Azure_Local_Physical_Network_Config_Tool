# Model Normalization

Standardize switch model names for consistent naming across the repo.

## Your Role as Architect

Model names are **highly variable** — be generous with normalization:
- **Add new models** — Expand tables when you encounter new hardware
- **Handle variants** — Users may omit suffixes (-ON, -FX3); infer when possible
- **Flag uncertainties** — Mark unclear models for manual review

> **Mindset:** Accept what users provide, normalize internally, expand the mapping over time.

## General Rules

1. Use the official model identifier
2. Remove redundant prefixes (e.g., `N9K-` for Cisco)
3. Keep variant suffixes (e.g., `-FX3`, `-ON`)
4. Use uppercase for model letters

> **Not hardcoded:** The examples below show **patterns**, not a fixed list. New models follow the same normalization logic.

## Vendor-Specific Patterns (Examples)

### Cisco

| User Input | Normalized | Notes |
|------------|------------|-------|
| N9K-C93180YC-FX3 | `93180YC-FX3` | Drop N9K-C prefix |
| N9K-C9336C-FX2 | `9336C-FX2` | Drop N9K-C prefix |
| Nexus 93180 | `93180YC-FX3` | Add full variant |
| C93180 | `93180YC-FX3` | Add variant suffix |

### Dell EMC

| User Input | Normalized | Notes |
|------------|------------|-------|
| S5248F-ON | `S5248F-ON` | Keep as-is |
| PowerSwitch S5248F | `S5248F-ON` | Add -ON suffix |
| S5248 | `S5248F-ON` | Add full suffix |
| S4048-ON | `S4048-ON` | Keep as-is |

### Juniper

| User Input | Normalized | Notes |
|------------|------------|-------|
| QFX5120-48Y | `QFX5120-48Y` | Keep as-is |
| qfx5120 | `QFX5120-48Y` | Uppercase, add port count |
| QFX5120 | `QFX5120-48Y` | Add port variant |

### Arista

| User Input | Normalized | Notes |
|------------|------------|-------|
| 7050X3-48YC8 | `7050X3-48YC8` | Keep as-is |
| DCS-7050X3 | `7050X3-48YC8` | Drop DCS-, add port config |

## Validation

When normalizing, verify:
- Model exists for the specified vendor
- Firmware version is compatible with model
- If uncertain, flag for manual review

## Example: Issue Submission

**User provides:**
```
Vendor: Cisco Nexus
Model: N9K-C93180YC-FX3
Firmware: NXOS 10.3(2)
```

**Normalized to:**
```
vendor: cisco
model: 93180YC-FX3
firmware: nxos
path: backend/templates/cisco/nxos/
```
