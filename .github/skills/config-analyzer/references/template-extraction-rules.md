# Template Extraction Rules

Guidelines for converting raw configurations into Jinja2 templates.

## Your Role as Architect

These rules are **starting guidelines, not rigid constraints**. When extracting templates:
- **Evaluate each pattern** — Is it optimal for the JSON→template flow?
- **Improve existing patterns** — If you see a better approach, use it
- **Challenge assumptions** — Current examples may not be ideal; refine them
- **Optimize for generation** — Templates should map cleanly to frontend JSON input

> **Mindset:** You are empowered to refine and improve extraction patterns based on your expertise.

## Variable vs Static Content

> **Not hardcoded:** These tables show **common patterns**. Apply the same logic to any content type you encounter.

### Make Variables

| Content Type | Example Raw | Example Template |
|--------------|-------------|------------------|
| Hostname | `hostname my-switch` | `hostname {{hostname}}` |
| IP addresses | `192.168.7.2` | `{{vlan.interface.ip}}` |
| VLAN IDs in commands | `vlan 7` | `vlan {{vlan.vlan_id}}` |
| ASN | `router bgp 65001` | `router bgp {{asn}}` |
| Passwords | `password secret123` | `password {{password}}` |
| Port ranges | `interface Ethernet1/1` | `interface Ethernet{{intf.intf}}` |

### Keep Static

| Content Type | Example | Reason |
|--------------|---------|--------|
| Keywords | `switchport mode trunk` | Vendor syntax |
| Commands | `no shutdown` | Always same |
| Protocol names | `router bgp` | Vendor syntax |
| Feature toggles | `feature vpc` | Always same for vendor |

## Looping Patterns

### VLAN Loop

```jinja2
{% for vlan in vlans %}
vlan {{ vlan.vlan_id }}
  name {{ vlan.name }}
{% if vlan.shutdown %}
  shutdown
{% endif %}
{% endfor %}
```

### Interface Range Loop

```jinja2
{% for intf in interfaces %}
{% if intf.start_intf is defined %}
interface range Ethernet{{ intf.start_intf }} - {{ intf.end_intf }}
{% else %}
interface Ethernet{{ intf.intf }}
{% endif %}
  description {{ intf.name }}
{% endfor %}
```

### BGP Neighbor Loop

```jinja2
{% for neighbor in bgp.neighbors %}
  neighbor {{ neighbor.ip }} remote-as {{ neighbor.remote_as }}
{% if neighbor.description is defined %}
    description {{ neighbor.description }}
{% endif %}
{% endfor %}
```

## Conditional Sections

Use conditionals for optional configuration:

```jinja2
{% if bgp is defined %}
router bgp {{ bgp.asn }}
  router-id {{ bgp.router_id }}
  ...
{% endif %}

{% if mlag is defined %}
vpc domain {{ mlag.domain_id }}
  ...
{% endif %}
```

## JSON Context Mapping

| JSON Path | Template Variable |
|-----------|-------------------|
| `switch.hostname` | `{{switch.hostname}}` |
| `vlans[*].vlan_id` | `{{vlan.vlan_id}}` (in loop) |
| `interfaces[*].intf` | `{{intf.intf}}` (in loop) |
| `bgp.asn` | `{{bgp.asn}}` |
| `bgp.neighbors[*].ip` | `{{neighbor.ip}}` (in loop) |
| `mlag.domain_id` | `{{mlag.domain_id}}` |

## Whitespace & Formatting

- Preserve vendor-specific indentation (2 spaces for Cisco, etc.)
- Keep blank lines between sections
- Use `{#- ... -#}` for comment-only lines to avoid extra blank lines

## Comments for Review

Mark uncertain extractions:

```jinja2
{# TODO: Verify this QoS policy matches Azure Local requirements #}
policy-map type qos ...

{# NOTE: This section may need manual adjustment for your environment #}
```
