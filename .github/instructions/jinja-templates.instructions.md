---
applyTo: 'backend/templates/**/*.j2'
---

# Jinja2 Template Development

Guidelines for creating vendor-agnostic switch configuration templates.

## Your Role as Architect

You are **empowered to design and improve** the template structure, not just follow it:
- **Evaluate current patterns** — Refine if suboptimal for frontend→backend flow
- **Recommend improvements** — Suggest better organization when you see it
- **Refactor freely** — Restructure templates to improve maintainability
- **Challenge assumptions** — Don't blindly copy existing patterns; improve them

> **Mindset:** "What would the ideal implementation look like?" — then build that.

## Philosophy

### Strict Rules (Non-Negotiable)
- **Azure Local requirements** — Deployment patterns, storage VLAN isolation, DCB/QoS are mandatory
- **Source of truth** — `backend/schema/standard.json` defines the data contract

### Best Practice (Use Your Judgment)
- **Don't just copy existing code** — Improve it. Refactor if suboptimal.
- **You are the expert** — Act as a world-class architect, developer, UX designer, and network engineer.
- **User experience first** — Templates serve the wizard UI; optimize for user workflow, not CLI structure.

## Template Categories (by UI Workflow)

Templates are organized by what the user configures in the wizard. **This is a guideline, not a fixed list** — create whatever templates make sense for the vendor.

| Category | Example Templates | User Workflow Step |
|----------|-------------------|-------------------|
| **Switch Identity** | `system.j2` | Hostname, role, credentials |
| **Network Segmentation** | `vlan.j2` | VLANs (mgmt, storage, compute) |
| **Port Assignments** | `interface.j2` | Port-to-NIC mappings, uplinks |
| **Redundancy** | `port_channel.j2`, `mlag.j2` | LAGs, MLAG/VPC |
| **Routing** | `bgp.j2`, `prefix_list.j2` | L3 peering (if needed) |
| **Traffic Priority** | `qos.j2` | DCB for RDMA |
| **Master** | `full_config.j2` | Assembles all sections |

> **Flexibility:** Add, remove, combine, or split templates based on vendor needs. Examples: `acl.j2`, `snmp.j2`, `ntp.j2`, `aaa.j2`.

## Directory Structure

```
backend/templates/
├── {vendor}/
│   └── {firmware}/
│       └── *.j2    # Whatever templates the vendor needs
```

## Template Conventions

### Variables Come from JSON Context

Templates receive the full JSON context. Use Jinja2 expressions:

```jinja2
hostname {{ switch.hostname }}
```

### Conditional Sections

Use `{% if %}` for optional sections, not separate template files:

```jinja2
{% if bgp is defined %}
router bgp {{ bgp.asn }}
  router-id {{ bgp.router_id }}
{% endif %}
```

### Loops for Repeated Elements

```jinja2
{% for vlan in vlans %}
vlan {{ vlan.vlan_id }}
  name {{ vlan.name }}
{% endfor %}
```

### Include Sub-templates

```jinja2
{# full_config.j2 #}
{{ include('system.j2') }}
{{ include('vlan.j2') }}
{{ include('interface.j2') }}
```

### Comments (Required)

Always add comments for maintainability, review, and debugging. **But keep output clean** — network configs should not have ugly blank lines.

**Whitespace Control:**
```jinja2
{#- Use dash to strip newlines from comments -#}
{%- if condition -%}   {# Dash strips surrounding whitespace #}
```

**Good: Comments that don't pollute output:**
```jinja2
{#- ============================================================ -#}
{#- VLAN CONFIGURATION                                           -#}
{#- Purpose: Define VLANs for Azure Local deployment             -#}
{#- ============================================================ -#}
{%- for vlan in vlans %}
{%- if vlan.vlan_id != 1 %}  {#- Skip VLAN 1 - reserved by most vendors -#}
vlan {{ vlan.vlan_id }}
  name {{ vlan.name }}
{%- endif %}
{%- endfor %}
```

**Bad: Creates ugly blank lines in output:**
```jinja2
{# This comment adds a blank line above #}

{% for vlan in vlans %}
{# This too #}
vlan {{ vlan.vlan_id }}
{% endfor %}
```

**Comment guidelines:**
- **Use `{#- -#}`** — Dash strips newlines, keeps output clean
- **Inline when short** — `{%- if x %}  {#- reason -#}` on same line
- **Section headers** — Use dashes, place directly above code block
- **WHY not WHAT** — Explain intent, Azure Local rules, vendor quirks
- **TODOs** — Mark incomplete sections: `{#- TODO: ... -#}`

## Testing

Every new template needs a fixture:

```
backend/tests/fixtures/
└── {vendor}-{firmware}/
  ├── std_{case}.json              # Input
  └── generated_full_config.cfg    # Expected output
```

> [!NOTE]
> Fixtures are regression test inputs/outputs. Keep them sanitized, deterministic, and small.
