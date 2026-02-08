# Copilot Custom Instructions — AzureStack Network Switch Config Generator

## Project Overview

Python + Jinja2 CLI tool that generates production network switch configurations for
**Azure Local (Azure Stack HCI)** deployments. It takes a lab-format JSON definition,
converts it to a standardised JSON schema, then renders vendor-specific `.cfg` files
using Jinja2 templates.

**Supported vendors:** Cisco NX-OS, Dell EMC OS10.
**Supported roles:** TOR1, TOR2 (production switches), BMC (internal lab-only switch).

## Architecture

```
Lab JSON → Converter → Standard JSON → Generator + Jinja2 Templates → .cfg files
```

| Stage | Module | Purpose |
|-------|--------|---------|
| Entry | `src/main.py` | CLI parser, logging setup, orchestration |
| Load | `src/loader.py` | JSON/file loading, `get_real_path()` for PyInstaller |
| Convert | `src/convertors/convertors_lab_switch_json.py` | Lab JSON → Standard JSON (TOR switches) |
| Convert | `src/convertors/convertors_bmc_switch_json.py` | Lab JSON → Standard JSON (BMC switches, optional) |
| Generate | `src/generator.py` | Standard JSON + Jinja2 → `.cfg` output files |
| Constants | `src/constants.py` | All magic strings, defaults, lookup tables |
| Utilities | `src/utils.py` | Shared helpers (IP math, etc.) |

## Key Design Principles

1. **Unified, generic implementation** — templates and converter logic are parameterized
   and data-driven. No sample-specific or model-specific code branches.
2. **Data-driven** — port counts, VLAN IDs, ASNs, IPs, hostnames come from input JSON.
   Only structural constants (fixed port roles) are hardcoded.
3. **TOR = production-quality, BMC = internal-minimal** — TOR code must be fully
   parameterized. BMC code may hardcode settings but must have clear comments.
4. **BMC is optional** — BMC configs are only generated when a `Type: "BMC"` entry
   exists in the input JSON. No BMC entry → only TOR configs.
5. **Refactor freely** — we're on a dev branch; breaking changes are fine with tests.

## Code Conventions

- **Package imports**: `src/` is a proper Python package with `__init__.py`.
  Use relative imports within `src/` (e.g., `from .constants import CISCO`).
- **Constants**: ALL magic strings, VLAN maps, template dicts live in `src/constants.py`.
  Never hardcode values directly in converter or generator code.
- **Path handling**: Use `pathlib.Path` everywhere, never `os.path`.
  Use `get_real_path()` from `loader.py` for PyInstaller compatibility (`sys._MEIPASS`).
- **Logging**: Use `logging` module, never `print()`. Get logger via `logging.getLogger(__name__)`.
- **Type hints**: Use `from __future__ import annotations` and modern type hints
  (`dict[str, str]` not `Dict[str, str]`).
- **Deep-copy templates**: In-code JSON templates (`SWITCH_TEMPLATE`, `SVI_TEMPLATE`, etc.)
  must be deep-copied before mutation — never modify the module-level constant.

## File Layout

```
src/
├── __init__.py
├── main.py                  # CLI entry point
├── generator.py             # Jinja2 template rendering
├── loader.py                # File loading, path resolution
├── constants.py             # All constants, lookup tables
├── utils.py                 # Shared utilities
└── convertors/
    ├── __init__.py
    ├── convertors_lab_switch_json.py   # TOR converter (StandardJSONBuilder)
    └── convertors_bmc_switch_json.py   # BMC converter (BMCSwitchConverter)

input/
├── standard_input.json                 # Example standard-format input
├── jinja2_templates/
│   ├── cisco/nxos/     # 10 templates: bgp, interface, login, port_channel, ...
│   └── dellemc/os10/   # 11 templates: same + vlt.j2
└── switch_interface_templates/
    ├── cisco/           # Per-model port layouts (93180YC-FX.json, etc.)
    └── dellemc/         # Per-model port layouts (s5248f-on.json, etc.)

tests/
├── conftest.py          # Shared fixtures, helpers, pytest hooks
├── test_unit.py         # Unit tests for StandardJSONBuilder methods
├── test_convertors.py   # Golden-file integration tests (converter pipeline)
├── test_generator.py    # Golden-file integration tests (generator pipeline)
└── test_cases/          # Test data (input JSON + expected outputs)
```

## Testing Rules

- **Framework**: `pytest` — run with `python -m pytest tests/ -v`.
- **Three test files**: `test_unit.py` (unit), `test_convertors.py` (converter integration),
  `test_generator.py` (generator integration).
- **Golden-file pattern**: Converter and generator tests compare output against expected
  files in `tests/test_cases/<case>/expected_outputs/`.
- **Unit tests**: Use small synthetic inputs, test one method at a time. Use `tmp_path`
  fixture for any file I/O. No global state, no side effects at import time.
- **Fixtures in `conftest.py`**: Shared fixtures, `load_json()`, `find_json_differences()`.
- **New features need tests**: Every converter method, template change, or bug fix
  should have corresponding test coverage.

## Template Conventions

- **Jinja2 templates** live in `input/jinja2_templates/<vendor>/<firmware>/`.
  Template names match config sections: `bgp.j2`, `vlan.j2`, `interface.j2`, etc.
- **Switch interface templates** live in `input/switch_interface_templates/<vendor>/`.
  These are JSON files defining per-model port layouts (which physical ports get which roles).
- Templates use guards (e.g., `{% if port_channels %}`) so they render safely for any
  switch type — a BMC switch with no BGP section produces empty BGP output, not an error.

## Build & Release

- **PyInstaller** builds cross-platform executables (Windows + Linux).
- **CI/CD** runs pytest → PyInstaller build → GitHub Release (tag-based with environment approval).
- **Python 3.12** is the target version for CI and dev container.
