#!/usr/bin/env python3
"""
Vendor Detector

Auto-detects switch vendor and firmware from configuration content.
Uses pattern matching to identify vendor-specific syntax.
"""

import re
from typing import Tuple, Optional


# Vendor detection patterns
# Each pattern is a tuple of (regex, vendor, firmware)
VENDOR_PATTERNS = [
    # Dell EMC OS10 patterns
    (r'^\s*ztd cancel', 'dellemc', 'os10'),
    (r'^\s*vlt domain', 'dellemc', 'os10'),
    (r'^\s*vlt-port-channel', 'dellemc', 'os10'),
    (r'! Vendor:\s*dellemc', 'dellemc', 'os10'),
    (r'! Firmware:\s*os10', 'dellemc', 'os10'),
    (r'^\s*interface vlan\d+', 'dellemc', 'os10'),  # OS10 style VLAN interface
    (r'^\s*interface Ethernet\s+\d+/\d+/\d+', 'dellemc', 'os10'),  # OS10 interface naming
    
    # Cisco NX-OS patterns
    (r'^\s*feature vpc', 'cisco', 'nxos'),
    (r'^\s*feature bgp', 'cisco', 'nxos'),
    (r'^\s*feature interface-vlan', 'cisco', 'nxos'),
    (r'^\s*vpc domain', 'cisco', 'nxos'),
    (r'^\s*vpc peer-link', 'cisco', 'nxos'),
    (r'! Make:\s*[Cc]isco', 'cisco', 'nxos'),
    (r'^\s*interface Ethernet\d+/\d+$', 'cisco', 'nxos'),  # NX-OS interface naming
    (r'^\s*interface port-channel\d+$', 'cisco', 'nxos'),  # NX-OS port-channel
    (r'^\s*no feature telnet', 'cisco', 'nxos'),
]

# Model detection patterns
MODEL_PATTERNS = {
    'dellemc': [
        (r'! Model:\s*(\S+)', None),  # Generic model comment
        (r'[Ss]5248[Ff]?-[Oo][Nn]', 'S5248F-ON'),
        (r'[Ss]5232[Ff]?-[Oo][Nn]', 'S5232F-ON'),
        (r'[Ss]5224[Ff]?-[Oo][Nn]', 'S5224F-ON'),
        (r'[Ss]4148[Ff]?-[Oo][Nn]', 'S4148F-ON'),
        (r'[Ss]4128[Ff]?-[Oo][Nn]', 'S4128F-ON'),
    ],
    'cisco': [
        (r'! Model:\s*(\S+)', None),  # Generic model comment
        (r'93180[A-Z]{2,3}-[A-Z0-9]+', None),  # 93180 series
        (r'9336[A-Z]{1,2}-[A-Z0-9]+', None),  # 9336 series
        (r'9364[A-Z]{1,2}-[A-Z0-9]+', None),  # 9364 series
    ],
}


def detect_vendor(config_text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Detect vendor and firmware from config content.
    
    Args:
        config_text: Raw switch configuration text
        
    Returns:
        Tuple of (vendor, firmware) or (None, None) if unknown
    """
    # Count matches for each vendor
    vendor_scores = {'dellemc': 0, 'cisco': 0}
    firmware_map = {'dellemc': 'os10', 'cisco': 'nxos'}
    
    for pattern, vendor, firmware in VENDOR_PATTERNS:
        if re.search(pattern, config_text, re.MULTILINE | re.IGNORECASE):
            vendor_scores[vendor] += 1
    
    # Return vendor with highest score
    if vendor_scores['dellemc'] > vendor_scores['cisco']:
        return 'dellemc', 'os10'
    elif vendor_scores['cisco'] > vendor_scores['dellemc']:
        return 'cisco', 'nxos'
    
    # If tied or no matches, return None
    if vendor_scores['dellemc'] == 0 and vendor_scores['cisco'] == 0:
        return None, None
    
    # Default to the one with any matches
    for vendor, score in vendor_scores.items():
        if score > 0:
            return vendor, firmware_map[vendor]
    
    return None, None


def detect_model(config_text: str, vendor: str) -> Optional[str]:
    """
    Detect switch model from config content.
    
    Args:
        config_text: Raw switch configuration text
        vendor: Detected vendor name
        
    Returns:
        Model string or None if unknown
    """
    if vendor not in MODEL_PATTERNS:
        return None
    
    for pattern, default_model in MODEL_PATTERNS[vendor]:
        match = re.search(pattern, config_text, re.IGNORECASE)
        if match:
            # If pattern has a capture group, use it
            if match.groups():
                return match.group(1)
            # Otherwise use default_model or the matched text
            return default_model or match.group(0)
    
    return None


def detect_hostname(config_text: str) -> Optional[str]:
    """
    Extract hostname from config.
    
    Args:
        config_text: Raw switch configuration text
        
    Returns:
        Hostname string or None
    """
    patterns = [
        r'^hostname\s+(\S+)',
        r'! Name:\s*(\S+)',
        r'switchname\s+(\S+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, config_text, re.MULTILINE)
        if match:
            return match.group(1)
    
    return None


def detect_all(config_text: str) -> dict:
    """
    Detect all available information from config.
    
    Args:
        config_text: Raw switch configuration text
        
    Returns:
        Dict with vendor, firmware, model, hostname
    """
    vendor, firmware = detect_vendor(config_text)
    model = detect_model(config_text, vendor) if vendor else None
    hostname = detect_hostname(config_text)
    
    return {
        'vendor': vendor,
        'firmware': firmware,
        'model': model,
        'hostname': hostname,
        'detected': vendor is not None,
    }


# CLI interface
if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python vendor_detector.py <config_file>")
        sys.exit(1)
    
    config_file = sys.argv[1]
    
    try:
        with open(config_file, 'r') as f:
            config_text = f.read()
    except FileNotFoundError:
        print(f"Error: File not found: {config_file}")
        sys.exit(1)
    
    result = detect_all(config_text)
    
    print(f"Vendor:   {result['vendor'] or 'Unknown'}")
    print(f"Firmware: {result['firmware'] or 'Unknown'}")
    print(f"Model:    {result['model'] or 'Unknown'}")
    print(f"Hostname: {result['hostname'] or 'Unknown'}")
    print(f"Detected: {'Yes' if result['detected'] else 'No'}")
