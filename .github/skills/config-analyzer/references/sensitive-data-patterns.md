# Sensitive Data Patterns

Patterns for detecting and sanitizing sensitive data in switch configurations.

## Your Role as Architect

Sanitization must be **thorough but not over-aggressive**:
- **Add new patterns** — Vendors have unique secret keywords; expand detection
- **Preserve readability** — Replace with meaningful variable names, not generic placeholders
- **Handle edge cases** — Some IPs are infrastructure (0.0.0.0, masks); don't redact those
- **Err on safe side** — When uncertain, sanitize; it's easier to restore than to leak

> **Mindset:** Never leak real credentials. But keep templates readable and understandable.

## Detection & Replacement (Examples)

> **Not hardcoded:** These patterns are **common examples**. Add new patterns when you encounter vendor-specific secrets.

| Data Type | Detection Patterns | Replacement |
|-----------|-------------------|-------------|
| **Hostname** | `hostname \S+`, `switchname \S+` | `{{hostname}}` |
| **IPv4 Address** | `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b` | Context-aware (see below) |
| **IPv6 Address** | `[0-9a-fA-F:]+::[0-9a-fA-F:]*` | `{{ipv6_address}}` |
| **Password** | `password \S+`, `secret \S+`, `password 7 \S+` | `{{password}}` |
| **Enable Secret** | `enable secret \S+` | `{{enable_secret}}` |
| **SNMP Community** | `snmp-server community \S+` | `{{snmp_community}}` |
| **SNMP User** | `snmp-server user \S+` | `{{snmp_user}}` |
| **Username** | `username (\S+) (?:password\|privilege)` | `{{username}}` |
| **TACACS Key** | `tacacs-server key \S+` | `{{tacacs_key}}` |
| **RADIUS Key** | `radius-server key \S+` | `{{radius_key}}` |
| **BGP ASN** | `router bgp (\d+)` | `{{asn}}` |
| **BGP Neighbor Password** | `neighbor \S+ password \S+` | `{{bgp_password}}` |

## Context-Aware IP Replacement

Replace IPs based on context to preserve template readability:

| Context | Pattern | Replacement |
|---------|---------|-------------|
| Management interface | `ip address X.X.X.X` under mgmt | `{{mgmt_ip}}` |
| Loopback | `interface [Ll]oopback\d+` | `{{loopback_ip}}` |
| SVI/VLAN interface | `interface [Vv]lan\d+` | `{{vlan_X_ip}}` |
| BGP neighbor | `neighbor X.X.X.X` | `{{peer_ip}}` |
| Peer keepalive | `peer-keepalive.*X.X.X.X` | `{{keepalive_ip}}` |
| General/Unknown | Any other IP | `{{ip_address}}` or preserve if infrastructure |

## Preserve Infrastructure IPs

Some IPs are generic infrastructure and can stay:
- `0.0.0.0` (any)
- `255.255.255.255` (broadcast)
- `127.0.0.1` (localhost)
- Subnet masks (e.g., in `ip address X.X.X.X 255.255.255.0`)

## VLAN IDs

**Do NOT sanitize VLAN IDs** — they are customer-configurable but need to stay as literals in examples. In templates, use:

```jinja2
vlan {{ vlan.vlan_id }}
```

## Example Transformation

**Before (raw config):**
```
hostname prod-switch-01
username admin password S3cr3tP@ss!
interface Vlan7
  ip address 192.168.7.2/24
  hsrp 7
    ip 192.168.7.1
router bgp 65001
  neighbor 10.0.0.1 remote-as 65000
    password BGPsecret123
```

**After (sanitized):**
```jinja2
hostname {{hostname}}
username {{username}} password {{password}}
interface Vlan{{ vlan.vlan_id }}
  ip address {{ vlan.interface.ip }}/{{ vlan.interface.cidr }}
  hsrp {{ vlan.vlan_id }}
    ip {{ vlan.interface.redundancy.virtual_ip }}
router bgp {{asn}}
  neighbor {{peer_ip}} remote-as {{peer_asn}}
    password {{bgp_password}}
```
