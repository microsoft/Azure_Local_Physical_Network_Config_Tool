# Syntax Patterns

Detect configuration sections across different vendor syntaxes.

## Your Role as Architect

These patterns are **starting points** — vendors have quirks:
- **Add new vendors** — Expand tables when adding vendor support
- **Handle variations** — Same vendor may have different syntax across firmware versions
- **Improve detection** — If regex patterns miss edge cases, refine them
- **Document exceptions** — Note vendor-specific quirks in comments

> **Mindset:** Real-world configs are messy. Patterns should be robust, not brittle.

## Section Detection Patterns

> **Not hardcoded:** These tables show **examples for known vendors**. New vendors follow similar patterns — detect section start/end markers.

### VLAN Configuration

| Vendor | Start Pattern | End Pattern |
|--------|---------------|-------------|
| Cisco NXOS | `^vlan \d+` | Next `^vlan` or `^interface` or blank line block |
| Dell OS10 | `^vlan \d+` | `^!` or next major section |
| Juniper | `vlans {` | `}` (matching brace) |
| Arista | `^vlan \d+` | Next `^vlan` or `^!` |

### Interface Configuration

| Vendor | Start Pattern | End Pattern |
|--------|---------------|-------------|
| Cisco NXOS | `^interface (Ethernet\|Vlan\|port-channel\|loopback)` | Next `^interface` or `^!` |
| Dell OS10 | `^interface (ethernet\|vlan\|port-channel\|loopback)` | `^!` |
| Juniper | `interfaces {` | `}` (matching brace) |
| Arista | `^interface (Ethernet\|Vlan\|Port-Channel\|Loopback)` | `^!` |

### BGP Configuration

| Vendor | Start Pattern | End Pattern |
|--------|---------------|-------------|
| Cisco NXOS | `^router bgp \d+` | Next `^router` or `^!` |
| Dell OS10 | `^router bgp \d+` | `^!` |
| Juniper | `protocols bgp {` | `}` (matching brace) |
| Arista | `^router bgp \d+` | `^!` |

### Port-Channel / LAG

| Vendor | Start Pattern |
|--------|---------------|
| Cisco NXOS | `^interface port-channel\d+` |
| Dell OS10 | `^interface port-channel\d+` |
| Juniper | `ae\d+` under interfaces |
| Arista | `^interface Port-Channel\d+` |

## Interface Naming Conventions

| Vendor | Physical Port | VLAN Interface | Loopback | Port-Channel |
|--------|---------------|----------------|----------|--------------|
| Cisco NXOS | `Ethernet1/1` | `Vlan7` | `loopback0` | `port-channel10` |
| Dell OS10 | `ethernet1/1/1` | `vlan7` | `loopback0` | `port-channel10` |
| Juniper | `xe-0/0/0` | `irb.7` | `lo0.0` | `ae0` |
| Arista | `Ethernet1` | `Vlan7` | `Loopback0` | `Port-Channel10` |

## Command Syntax Differences

### Trunk Port

```
# Cisco NXOS
switchport mode trunk
switchport trunk allowed vlan 7,201,711,712

# Dell OS10
switchport mode trunk
switchport trunk allowed vlan 7,201,711,712

# Juniper
family ethernet-switching {
    interface-mode trunk;
    vlan members [ VLAN7 VLAN201 ];
}

# Arista
switchport mode trunk
switchport trunk allowed vlan 7,201,711,712
```

### HSRP/VRRP

```
# Cisco NXOS (HSRP)
hsrp 7
  ip 192.168.7.1
  priority 150

# Dell OS10 (VRRP)
vrrp-group 7
  virtual-address 192.168.7.1
  priority 150
```
