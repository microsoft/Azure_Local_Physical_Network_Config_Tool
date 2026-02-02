# Vendor Normalization

Map user-provided vendor names to standardized folder names.

## Your Role as Architect

This mapping is **a starting point** — expand it based on real-world submissions:
- **Add new vendors** — When you encounter a new vendor, add it to the table
- **Handle edge cases** — User input varies wildly; be generous
- **Improve the logic** — If the normalization approach is suboptimal, refine it

> **Mindset:** The table below is a baseline. Grow it as the community submits configs.

## Normalization Rules

1. Convert to lowercase
2. Remove spaces and special characters
3. Map common variations to canonical name

> **Not hardcoded:** The tables below are **examples of current mappings**. New vendors follow the same pattern — normalize and create a folder.

## Vendor Mapping (Examples)

| User Input (variations) | Normalized Value | Template Path |
|------------------------|------------------|---------------|
| Cisco, cisco, CISCO | `cisco` | `backend/templates/cisco/` |
| Cisco Nexus, Nexus, nexus | `cisco` | `backend/templates/cisco/` |
| Dell, dell, DELL | `dellemc` | `backend/templates/dellemc/` |
| DellEMC, Dell EMC, Dell-EMC | `dellemc` | `backend/templates/dellemc/` |
| Dell PowerSwitch | `dellemc` | `backend/templates/dellemc/` |
| Juniper, juniper, JUNIPER | `juniper` | `backend/templates/juniper/` |
| Juniper Networks | `juniper` | `backend/templates/juniper/` |
| Arista, arista, ARISTA | `arista` | `backend/templates/arista/` |
| Arista Networks | `arista` | `backend/templates/arista/` |
| Aruba, aruba, ARUBA | `aruba` | `backend/templates/aruba/` |
| HPE Aruba, HP Aruba | `aruba` | `backend/templates/aruba/` |
| Mellanox, mellanox, MELLANOX | `mellanox` | `backend/templates/mellanox/` |
| NVIDIA Mellanox | `mellanox` | `backend/templates/mellanox/` |
| Lenovo, lenovo, LENOVO | `lenovo` | `backend/templates/lenovo/` |
| *(any new vendor)* | *lowercase, no spaces* | *create new folder* |

## Firmware Mapping (Examples)

Same pattern — normalize to lowercase, no dashes:

| Vendor | User Input | Normalized |
|--------|------------|------------|
| cisco | NX-OS, NXOS, nxos, nx-os | `nxos` |
| cisco | IOS-XE, IOSXE, ios-xe | `iosxe` |
| dellemc | OS10, os10, OS-10 | `os10` |
| dellemc | OS9, os9 | `os9` |
| juniper | Junos, JUNOS, junos | `junos` |
| arista | EOS, eos, Arista EOS | `eos` |

## Implementation

```python
def normalize_vendor(user_input: str) -> str:
    """Normalize vendor name to folder convention."""
    normalized = user_input.lower().strip()
    
    # Mapping dictionary
    vendor_map = {
        'cisco': 'cisco',
        'nexus': 'cisco',
        'cisco nexus': 'cisco',
        'dell': 'dellemc',
        'dellemc': 'dellemc',
        'dell emc': 'dellemc',
        # ... etc
    }
    
    return vendor_map.get(normalized, normalized.replace(' ', ''))
```

## Handling New Vendors

If vendor is not in mapping:
1. Lowercase the input
2. Remove spaces
3. Create new folder
4. Flag for manual review (add to mapping table)
