# Azure Local Network Config Tool - Backend

Python CLI for generating network switch configurations from JSON input.

## Features

- ✅ JSON schema validation with cross-reference checking
- ✅ Role-based configuration transformation (TOR1/TOR2/BMC)
- ✅ Jinja2 template rendering for vendor-specific configs
- ✅ Support for Dell OS10 switches
- ✅ Comprehensive test suite (29 tests, 80% coverage)

## Installation

```bash
cd backend
pip3 install -e .
```

## Usage

### Validate Configuration

```bash
python3 -m src.cli validate ../frontend/examples/dell-tor1.json
```

### Transform Configuration

Validate and add computed fields:

```bash
python3 -m src.cli transform ../frontend/examples/dell-tor1.json > enriched.json
```

### Generate Switch Configuration

```bash
# Generate to specific directory
python3 -m src.cli generate ../frontend/examples/dell-tor1.json -o output/

# Generate to current directory
python3 -m src.cli generate ../frontend/examples/dell-tor1.json
```

## Architecture

```
backend/
├── src/
│   ├── validator.py      # JSON schema validation
│   ├── transformer.py    # Data enrichment
│   ├── context.py        # Template context builder
│   ├── renderer.py       # Jinja2 rendering
│   └── cli.py           # CLI entry point
├── schema/
│   └── standard.json     # JSON Schema definition
├── templates/
│   └── dellemc/os10/    # Dell OS10 templates
└── tests/               # Pytest test suite
```

## Role-Based Computed Values

The transformer automatically adds role-specific values:

| Role | hsrp_priority | mlag_role_priority | mst_priority |
|------|---------------|-------------------|--------------|
| TOR1 | 150           | 1                 | 8192         |
| TOR2 | 100           | 32667             | 16384        |
| BMC  | null          | null              | 32768        |

## Testing

```bash
# Run all tests
python3 -m pytest tests/ -v

# Run with coverage
python3 -m pytest tests/ --cov=src --cov-report=term-missing
```

## Development

### Adding New Templates

1. Create template file in `templates/{vendor}/{firmware}/`
2. Use Jinja2 syntax with context variables
3. Include in `full_config.j2` orchestrator
4. Test with example configurations

### Adding New Validators

Cross-reference validators can be added in `validator.py`:

```python
def _check_cross_references(self, config, result):
    # Add custom validation logic
    pass
```

## Dependencies

- Python ≥ 3.9
- jinja2 ≥ 3.1.0
- jsonschema ≥ 4.20.0
- pytest ≥ 7.4.0 (dev)

## License

See LICENSE file in repository root.
