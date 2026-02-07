# Troubleshooting

## Quick Fixes

### "Input is in lab format — conversion required"

Your data isn't in standard format. The tool can auto-convert if you specify a converter:

```bash
python src/main.py --input_json your_file.json --convertor lab
```

If that doesn't work, check whether your JSON has `Version`/`InputData` keys (lab format) vs `switch`/`vlans` keys (standard format).

---

### "Template folder not found"

The tool can't find templates that match your switch's `make`/`firmware`.

1. Check you're running from the project root
2. Verify the folder exists: `input/jinja2_templates/<make>/<firmware>/`
3. Check your JSON has matching values:
   ```json
   { "switch": { "make": "cisco", "firmware": "nxos" } }
   ```

---

### "No configs generated" or empty output

1. **Vendor/firmware mismatch** — `make` and `firmware` must match a template folder name
2. **Empty data** — if no VLANs in input, no VLAN config is generated
3. **Missing templates** — check that the folder contains `.j2` files

---

### "Failed to parse JSON"

Common JSON syntax errors:

```
Missing commas:    {"key1": "v1" "key2": "v2"}     ← needs comma
Trailing commas:   {"key": "value",}                ← remove trailing comma
Single quotes:     {'key': 'value'}                 ← use double quotes
Comments:          {"key": "value" // note}         ← JSON doesn't allow comments
```

Validate with: `python -m json.tool your_file.json`

---

### Permission errors

```bash
# Linux — ensure output folder is writable
mkdir -p output/ && chmod 755 output/

# Windows — run from a folder you own, or as Administrator
```

---

## Debug Steps

### 1. Test with the included example

```bash
python src/main.py --input_json input/standard_input.json --output_folder test_output/
```

### 2. Check generated files

```bash
ls -la test_output/
# Should see: generated_*.cfg files
```

### 3. Examine the standard JSON

If using a converter, look at the intermediate `std_*.json` files to verify the conversion.

### 4. Enable debug logging

```bash
python src/main.py --input_json data.json --output_folder out/ --debug
```

### 5. Run tests

```bash
python -m pytest tests/ -v
```

---

## Template Rendering Errors

**Undefined variable:**
```jinja2
{# Use safe access #}
{{ interface.mtu | default(1500) }}

{% if interface.mtu is defined %}
  mtu {{ interface.mtu }}
{% endif %}
```

**Missing `endfor`/`endif`:**
Every `{% for %}` needs `{% endfor %}`, every `{% if %}` needs `{% endif %}`.

**Debug data in templates:**
```jinja2
<!-- DEBUG -->
{{ vlans | pprint }}
```

---

## Executable Issues

**Linux — "command not found":**
```bash
chmod +x ./network_config_generator
./network_config_generator --help
```

**Windows — "cannot execute":**
1. Right-click → Properties → General → Unblock
2. Run from PowerShell: `.\network_config_generator.exe --help`

---

## Getting Help

Before reporting an issue:
1. Check this guide and test with sample data
2. Validate your JSON syntax
3. Verify template folder structure

When reporting, include:
- Command used and full error message
- Input file structure (sanitized)
- OS and Python version
- Expected vs actual behavior
