#!/usr/bin/env python3
"""
Config Sectioner

Splits a switch configuration into logical sections for analysis.
Supports Dell EMC OS10 and Cisco NX-OS syntax.
"""

import re
from typing import Dict, List, Optional
from dataclasses import dataclass, field


@dataclass
class ConfigSection:
    """Represents a section of configuration."""
    name: str
    content: str
    start_line: int
    end_line: int
    subsections: List['ConfigSection'] = field(default_factory=list)


# Section markers for Dell EMC OS10
OS10_SECTION_MARKERS = {
    'system': [
        r'^hostname\s+',
        r'^banner\s+',
        r'^ztd\s+',
        r'^lldp\s+',
        r'^dcbx\s+',
        r'^mac address-table',
        r'^vrrp\s+',
    ],
    'login': [
        r'^password-attributes',
        r'^enable password',
        r'^username\s+',
        r'^ip ssh\s+',
        r'^no ip telnet',
        r'^login\s+',
    ],
    'qos': [
        r'^wred\s+',
        r'^class-map\s+',
        r'^trust\s+dot1p',
        r'^qos-map\s+',
        r'^policy-map\s+',
        r'^system qos',
    ],
    'vlan': [
        r'^interface vlan\d+',
        r'^\s*vlan\s+\d+',
    ],
    'interface': [
        r'^interface Ethernet',
        r'^interface loopback',
        r'^interface range',
    ],
    'port_channel': [
        r'^interface port-channel',
    ],
    'mlag': [
        r'^vlt domain',
        r'^vlt-port-channel',
    ],
    'bgp': [
        r'^router bgp',
    ],
    'static_route': [
        r'^ip route\s+',
    ],
    'prefix_list': [
        r'^ip prefix-list',
    ],
}

# Section markers for Cisco NX-OS
NXOS_SECTION_MARKERS = {
    'system': [
        r'^hostname\s+',
        r'^banner\s+',
        r'^feature\s+',
        r'^no feature\s+',
        r'^ssh key',
        r'^no cdp enable',
        r'^lldp',
        r'^spanning-tree',
    ],
    'login': [
        r'^username\s+',
        r'^role\s+',
        r'^aaa\s+',
        r'^tacacs-server',
        r'^radius-server',
    ],
    'qos': [
        r'^class-map\s+type\s+qos',
        r'^class-map\s+type\s+network-qos',
        r'^class-map\s+type\s+queuing',
        r'^policy-map\s+type',
        r'^system qos',
        r'^hardware qos',
    ],
    'vlan': [
        r'^vlan\s+\d+',
        r'^interface Vlan\d+',
    ],
    'interface': [
        r'^interface Ethernet\d+/\d+',
        r'^interface loopback',
    ],
    'port_channel': [
        r'^interface port-channel\d+',
    ],
    'vpc': [
        r'^vpc domain',
        r'^\s*vpc\s+\d+',
        r'^\s*vpc peer-link',
    ],
    'bgp': [
        r'^router bgp',
    ],
    'static_route': [
        r'^ip route\s+',
        r'^vrf context',
    ],
    'prefix_list': [
        r'^ip prefix-list',
        r'^route-map',
    ],
}


def get_section_markers(vendor: str, firmware: str) -> Dict[str, List[str]]:
    """Get section markers for vendor/firmware combination."""
    if vendor == 'dellemc' and firmware == 'os10':
        return OS10_SECTION_MARKERS
    elif vendor == 'cisco' and firmware == 'nxos':
        return NXOS_SECTION_MARKERS
    else:
        # Return combined markers for unknown vendors
        return {**OS10_SECTION_MARKERS, **NXOS_SECTION_MARKERS}


def section_config(config_text: str, vendor: str, firmware: str) -> Dict[str, str]:
    """
    Split configuration into sections.
    
    Args:
        config_text: Raw switch configuration text
        vendor: Vendor name ('dellemc' or 'cisco')
        firmware: Firmware name ('os10' or 'nxos')
        
    Returns:
        Dict mapping section names to their content
    """
    markers = get_section_markers(vendor, firmware)
    lines = config_text.split('\n')
    
    # Initialize sections
    sections: Dict[str, List[str]] = {name: [] for name in markers.keys()}
    sections['unknown'] = []
    
    current_section = 'unknown'
    in_block = False
    block_indent = 0
    
    for i, line in enumerate(lines):
        # Skip empty lines and comments at the start
        stripped = line.strip()
        if not stripped or stripped.startswith('!'):
            # Keep comments with their associated section
            if current_section != 'unknown':
                sections[current_section].append(line)
            continue
        
        # Check if this line starts a new section
        new_section = None
        for section_name, patterns in markers.items():
            for pattern in patterns:
                if re.match(pattern, line, re.IGNORECASE):
                    new_section = section_name
                    break
            if new_section:
                break
        
        if new_section:
            current_section = new_section
            in_block = True
            block_indent = len(line) - len(line.lstrip())
        
        # Add line to current section
        sections[current_section].append(line)
        
        # Check if we're exiting a block (return to base indentation)
        if in_block and stripped and not stripped.startswith('!'):
            line_indent = len(line) - len(line.lstrip())
            if line_indent <= block_indent and not re.match(r'^\s*(interface|router|vlt|vpc)', line):
                # Might be end of block, but keep going until next section marker
                pass
    
    # Convert lists to strings
    result = {}
    for name, content_lines in sections.items():
        content = '\n'.join(content_lines).strip()
        if content:
            result[name] = content
    
    return result


def analyze_sections(sections: Dict[str, str]) -> Dict[str, any]:
    """
    Analyze sections and extract key information.
    
    Args:
        sections: Dict of section name to content
        
    Returns:
        Dict with analysis results
    """
    analysis = {
        'sections_found': list(sections.keys()),
        'section_sizes': {k: len(v) for k, v in sections.items()},
        'total_lines': sum(v.count('\n') + 1 for v in sections.values()),
    }
    
    # Count specific items
    if 'vlan' in sections:
        vlan_matches = re.findall(r'(?:vlan|interface [Vv]lan)\s*(\d+)', sections['vlan'])
        analysis['vlan_count'] = len(set(vlan_matches))
        analysis['vlan_ids'] = sorted(set(int(v) for v in vlan_matches))
    
    if 'interface' in sections:
        intf_matches = re.findall(r'interface\s+(\S+)', sections['interface'])
        analysis['interface_count'] = len(intf_matches)
    
    if 'port_channel' in sections:
        pc_matches = re.findall(r'interface port-channel\s*(\d+)', sections['port_channel'], re.IGNORECASE)
        analysis['port_channel_count'] = len(pc_matches)
        analysis['port_channel_ids'] = [int(p) for p in pc_matches]
    
    if 'bgp' in sections:
        asn_match = re.search(r'router bgp\s+(\d+)', sections['bgp'])
        analysis['bgp_asn'] = int(asn_match.group(1)) if asn_match else None
    
    return analysis


# CLI interface
if __name__ == '__main__':
    import sys
    import json
    
    if len(sys.argv) < 2:
        print("Usage: python config_sectioner.py <config_file> [vendor] [firmware]")
        sys.exit(1)
    
    config_file = sys.argv[1]
    vendor = sys.argv[2] if len(sys.argv) > 2 else None
    firmware = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        with open(config_file, 'r') as f:
            config_text = f.read()
    except FileNotFoundError:
        print(f"Error: File not found: {config_file}")
        sys.exit(1)
    
    # Auto-detect vendor if not provided
    if not vendor:
        from vendor_detector import detect_vendor
        vendor, firmware = detect_vendor(config_text)
        print(f"Auto-detected: {vendor}/{firmware}")
    
    sections = section_config(config_text, vendor, firmware)
    analysis = analyze_sections(sections)
    
    print(f"\n=== Sections Found ({len(sections)}) ===")
    for name, content in sections.items():
        lines = content.count('\n') + 1
        print(f"  {name}: {lines} lines, {len(content)} chars")
    
    print(f"\n=== Analysis ===")
    print(json.dumps(analysis, indent=2, default=str))
