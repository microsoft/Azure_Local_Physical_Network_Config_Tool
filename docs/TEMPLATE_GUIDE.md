# Template Guide

This guide covers both **Jinja2 config templates** (which render `.cfg` outputs) and **switch interface templates** (JSON files that define port layouts per switch model).

---

## Jinja2 Config Templates

### How They Work

Templates are organized by vendor and firmware:

```
input/jinja2_templates/
├── cisco/nxos/          ← make=cisco, firmware=nxos
│   ├── bgp.j2
│   ├── full_config.j2
│   ├── interface.j2
│   ├── login.j2
│   ├── port_channel.j2
│   ├── prefix_list.j2
│   ├── qos.j2
│   ├── static_route.j2
│   ├── system.j2
│   └── vlan.j2
└── dellemc/os10/        ← make=dellemc, firmware=os10
    ├── (same sections)
    └── vlt.j2           ← Dell-specific
```

The generator reads your switch's `make` and `firmware` from the input JSON, finds the matching template folder, and renders every `.j2` file in it.

### Simple Example

**Input data:**
```json
{ "vlans": [{"vlan_id": 100, "name": "Servers"}, {"vlan_id": 200, "name": "Storage"}] }
```

**Template (`vlan.j2`):**
```jinja2
{% for vlan in vlans %}
vlan {{ vlan.vlan_id }}
  name {{ vlan.name }}
{% endfor %}
```

**Output:**
```
vlan 100
  name Servers
vlan 200
  name Storage
```

### Available Data in Templates

All fields from the standard JSON are available:

```jinja2
{{ switch.hostname }}         {# Switch name #}
{{ switch.make }}             {# cisco, dellemc #}
{{ switch.firmware }}         {# nxos, os10 #}

{% for vlan in vlans %}
  {{ vlan.vlan_id }}  {{ vlan.name }}
{% endfor %}

{% for iface in interfaces %}
  {{ iface.name }}  {{ iface.description }}  {{ iface.type }}
{% endfor %}

{{ bgp.asn }}  {{ bgp.router_id }}
{% for n in bgp.neighbors %}
  {{ n.ip }}  {{ n.remote_as }}
{% endfor %}
```

### Adding a New Vendor

1. Create the folder: `input/jinja2_templates/<vendor>/<firmware>/`
2. Add `.j2` template files (one per config section)
3. Ensure your input JSON has `"make": "<vendor>", "firmware": "<firmware>"`

### Jinja2 Tips

```jinja2
{# Comments — not in output #}
! Config comments — appears in output

{# Handle missing data #}
{% if interface.mtu is defined %}
  mtu {{ interface.mtu }}
{% endif %}

{# Default values #}
mtu {{ interface.mtu | default(1500) }}

{# Filter loops #}
{% for iface in interfaces if iface.type == "Trunk" %}
  switchport mode trunk
{% endfor %}

{# Macros for reuse #}
{% macro vlan_config(vlan) %}
vlan {{ vlan.vlan_id }}
  name {{ vlan.name }}
{% endmacro %}
```

---

## Switch Interface Templates

Switch interface templates are JSON files that define the physical port layout and logical interface assignments for each switch model. The converter uses these to build the standard JSON.

### File Location

```
input/switch_interface_templates/
├── cisco/
│   ├── 93108TC-FX3P.json      # TOR (16-port)
│   ├── 93180YC-FX.json        # TOR (16-port)
│   ├── 93180YC-FX3.json       # TOR (20-port)
│   ├── 9348GC-FXP.json        # BMC (16-node)
│   └── 9348GC-FX3.json        # BMC (20-node)
└── dellemc/
    ├── s5248f-on.json          # TOR
    └── N3248TE-ON.json         # BMC
```

### Template Structure

Each file contains:

```json
{
    "make": "Cisco",
    "model": "93180YC-FX",
    "type": "TOR",
    "interface_templates": {
        "common": [...],           // All deployment patterns
        "fully_converged": [...],  // HyperConverged
        "switched": [...],         // Switched
        "switchless": [...]        // Switchless
    },
    "port_channels": [...]
}
```

### Interface Properties

| Property | Description | Example |
|----------|-------------|---------|
| `name` | Descriptive name | `"HyperConverged_To_Host"` |
| `type` | Mode | `"Access"`, `"Trunk"`, `"L3"` |
| `intf_type` | Physical type | `"Ethernet"`, `"loopback"` |
| `intf` | Single port | `"1/48"` |
| `start_intf` / `end_intf` | Port range | `"1/1"` / `"1/16"` |
| `native_vlan` | Trunk native VLAN | `"99"` |
| `tagged_vlans` | Trunk tagged VLANs | `"M,C,S"` or `"100,200"` |
| `access_vlan` | Access port VLAN | `"100"` |
| `shutdown` | Disable interface | `true` / `false` |
| `ipv4` | IP address | `""` (empty = filled by converter) |

**VLAN symbols:** `M` = Management/INFRA, `C` = Compute, `S` = Storage. You can also use literal VLAN IDs.

### Common Use Cases

**New switch model:**
1. Copy the closest existing template
2. Rename to your model: e.g., `9336C-FX2.json`
3. Update `model`, port ranges, and uplink ports

**Change host ports:**
```json
"start_intf": "1/5",    // was 1/1
"end_intf": "1/24"      // was 1/16
```

**Change uplink ports:**
```json
"name": "P2P_Border1",
"intf": "1/52"           // was 1/48
```

**Change port channel members:**
```json
"port_channels": [{
    "id": 50,
    "members": ["1/49", "1/50"]   // your LAG ports
}]
```

### Interface Naming by Vendor

- **Cisco:** `1/48` (slot/port)
- **Dell EMC:** `1/1/48` (unit/slot/port)

### Deployment Patterns

| Pattern | Description | Host Interfaces |
|---------|-------------|-----------------|
| `fully_converged` | HCI — all traffic on one trunk | M+C+S tagged |
| `switched` | Separate compute and storage trunks | C trunk + S trunk |
| `switchless` | Storage direct-attached | C trunk only |

The `common` section defines interfaces shared across all patterns (loopbacks, uplinks, unused ports, BMC trunk).

---

## Troubleshooting Templates

**Template not found?** Check that your `make`/`firmware` values match the folder path under `input/jinja2_templates/`.

**Wrong interface config?** Verify interface names match your switch docs. Cisco uses `1/48`, Dell uses `1/1/48`.

**JSON syntax error in switch template?** Validate with `python -m json.tool your_template.json`.

**Undefined variable in Jinja2?** Use `{% if var is defined %}` guards or `{{ var | default("") }}` filters.
