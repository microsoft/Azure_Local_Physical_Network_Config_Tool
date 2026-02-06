"""
Shared utility functions for the AzureStack Network Switch Config Generator.

Houses logic that is used by multiple modules so it isn't duplicated across
converters, loaders, or the CLI entry point.
"""

from __future__ import annotations

from .constants import VENDOR_FIRMWARE_MAP, VLAN_GROUP_MAP


def infer_firmware(make: str) -> str:
    """Derive firmware identifier from vendor make string.

    >>> infer_firmware("cisco")
    'nxos'
    >>> infer_firmware("dellemc")
    'os10'
    >>> infer_firmware("juniper")
    'juniper'
    """
    make_lower = make.lower().strip()
    return VENDOR_FIRMWARE_MAP.get(make_lower, make_lower)


def classify_vlan_group(group_name: str) -> str | None:
    """Map a supernet GroupName to its symbolic VLAN-set key (M, C, S, …).

    Returns ``None`` when no mapping matches.

    >>> classify_vlan_group("HNVPA_Pool1")
    'C'
    >>> classify_vlan_group("STORAGE_A")
    'S'
    >>> classify_vlan_group("RANDOM_STUFF") is None
    True
    """
    upper = group_name.upper()
    for prefix, symbol in VLAN_GROUP_MAP.items():
        if upper.startswith(prefix):
            return symbol
    return None
