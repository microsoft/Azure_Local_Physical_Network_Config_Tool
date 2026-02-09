# Converter Guide

## When You Need a Converter

You need a converter if your input data is **not** in the standard JSON format expected by the generator. The converter transforms your format into standard JSON, which the templates can render.

You **don't** need this if your data already works with the tool or you're using the provided example files.

---

## How It Works

```
Your Format  →  Converter  →  Standard JSON  →  Generator + Templates  →  .cfg files
```

The tool ships with two converters:
- `convertors_lab_switch_json.py` — Converts lab-format JSON (TOR switches)
- `convertors_bmc_switch_json.py` — Converts lab-format JSON (BMC switches)

---

## Creating a Converter

### Step 1: Create the File

Create `src/convertors/my_converter.py`

### Step 2: Implement the Function

Your converter must export a function named `convert_switch_input_json`:

```python
from __future__ import annotations

import json
from pathlib import Path

def convert_switch_input_json(input_data: dict, output_directory: str) -> None:
    """Convert custom format to standard format.

    Args:
        input_data: Your JSON data (as Python dict)
        output_directory: Where to save converted JSON files
    """
    out_dir = Path(output_directory)
    out_dir.mkdir(parents=True, exist_ok=True)

    for device in input_data["devices"]:
        standard = {
            "switch": {
                "hostname": device["name"],
                "make": device["type"],
                "firmware": "nxos",
            },
            "vlans": [],
            "interfaces": [],
            "port_channels": [],
            "bgp": {},
        }

        # Convert VLANs
        for vid in device.get("vlans", "").split(","):
            if vid.strip():
                standard["vlans"].append({
                    "vlan_id": int(vid),
                    "name": f"VLAN_{vid}",
                })

        # Write one file per switch
        filepath = out_dir / f"{device['name']}.json"
        filepath.write_text(json.dumps(standard, indent=2))
```

### Step 3: Run It

```bash
python src/main.py --input_json your_data.json --convertor my_converter
```

### Step 4: Check Results

The converter writes standard JSON files to the output directory. The generator then renders each one against the Jinja2 templates.

---

## Standard JSON Format

Your converter must produce JSON with this structure. Only `switch` is required; all other sections are optional.

```json
{
  "switch": {
    "hostname": "switch-01",
    "make": "cisco",
    "firmware": "nxos",
    "model": "93180YC-FX"
  },
  "vlans": [
    { "vlan_id": 100, "name": "VLAN_100", "description": "Server VLAN" }
  ],
  "interfaces": [
    { "name": "Ethernet1/1", "type": "access", "vlan": 100, "description": "Server port" }
  ],
  "port_channels": [
    { "id": 50, "type": "L3", "members": ["Ethernet1/41", "Ethernet1/42"] }
  ],
  "bgp": {
    "asn": 65001,
    "router_id": "10.0.0.1",
    "neighbors": [
      { "ip": "10.0.0.2", "remote_as": 65100, "description": "Border1" }
    ]
  },
  "prefix_lists": [],
  "qos": {}
}
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| `Module not found` | File must be in `src/convertors/`. Use dot notation: `--convertor my_converter` |
| `Function not found` | Must be named exactly `convert_switch_input_json` |
| No output files | Check file permissions; add `logging.debug()` statements for debugging |

---

## Tips

- Start simple — convert just `switch` info first, then add sections incrementally
- Look at the existing converters in `src/convertors/` for real-world examples
- Check `tests/test_cases/` for sample inputs and expected outputs
- Each switch should produce its own JSON file
