"""
BMC Switch JSON Converter

This module handles the conversion of BMC switch definitions from lab input JSON
to standardized JSON format. It's designed to be called from the main converter
but kept separate for modularity and easy maintenance.

Since BMC switches are for internal lab use only, some configurations are hardcoded
for simplicity and can be refined as needed.
"""

import json
from pathlib import Path
from typing import Dict, List
from copy import deepcopy

# Import constants from main converter
try:
    from .convertors_lab_switch_json import (
        DEFAULT_OUTPUT_DIR, OUTPUT_FILE_EXTENSION, BMC, CISCO, DELL, NXOS, OS10, JUMBO_MTU
    )
    from ..loader import get_real_path
except ImportError:
    # Fallback constants if main converter is not available
    DEFAULT_OUTPUT_DIR = "_output"
    OUTPUT_FILE_EXTENSION = ".json"
    BMC = "BMC"
    CISCO = "cisco"
    DELL = "dellemc"
    NXOS = "nxos"
    OS10 = "os10"
    JUMBO_MTU = 9216
    
    def get_real_path(path):
        return Path(path)


class BMCSwitchConverter:
    """
    Dedicated converter for BMC switches.
    Handles the generation of standardized JSON configuration for BMC switches.
    """
    
    def __init__(self, input_data: Dict, output_dir: str = DEFAULT_OUTPUT_DIR):
        """
        Initialize BMC converter with input data and output directory.
        
        Args:
            input_data: Dictionary containing the lab definition JSON
            output_dir: Directory where output files will be written
        """
        self.input_data = input_data
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)
        
    def convert_all_bmc_switches(self) -> None:
        """
        Convert all BMC switches found in the input data to standard JSON format.
        """
        switches_json = self.input_data.get("InputData", {}).get("Switches", [])
        bmc_switches = [sw for sw in switches_json if sw.get("Type") == BMC]
        
        if not bmc_switches:
            print("[i] No BMC switches found in input data")
            return
            
        print(f"[*] Found {len(bmc_switches)} BMC switch(es) to convert")
        
        for bmc_switch in bmc_switches:
            self._convert_single_bmc(bmc_switch)
            
        print(f"[✓] BMC conversion completed - {len(bmc_switches)} switch(es) processed")
    
    def _convert_single_bmc(self, switch_data: Dict) -> None:
        """
        Convert a single BMC switch to standard JSON format.
        
        Args:
            switch_data: Dictionary containing BMC switch information
        """
        # Build switch metadata
        switch_info = self._build_switch_info(switch_data)
        
        # Build configuration sections
        vlans = self._build_vlans()
        interfaces = self._build_interfaces(switch_data)
        
        # Assemble final JSON structure (BMC only needs switch, vlans, interfaces)
        bmc_json = {
            "switch": switch_info,
            "vlans": vlans,
            "interfaces": interfaces
        }
        
        # Write output file
        hostname = switch_info.get("hostname", "bmc")
        output_file = self.output_dir / f"{hostname}{OUTPUT_FILE_EXTENSION}"
        
        with output_file.open("w", encoding="utf-8") as f:
            json.dump(bmc_json, f, indent=2)
            
        print(f"[✓] Generated BMC config: {output_file}")
    
    def _build_switch_info(self, switch_data: Dict) -> Dict:
        """
        Build the switch metadata section.
        
        Args:
            switch_data: Dictionary containing switch information
            
        Returns:
            Dictionary with switch metadata
        """
        sw_make = switch_data.get("Make", "").lower()
        
        # Determine firmware based on make
        firmware = (
            NXOS if sw_make == CISCO else
            OS10 if sw_make == DELL else
            switch_data.get("Firmware", "").lower()
        )
        
        return {
            "make": sw_make,
            "model": switch_data.get("Model", "").lower(),
            "type": switch_data.get("Type"),
            "hostname": switch_data.get("Hostname", "").lower(),
            "version": switch_data.get("Firmware", "").lower(),
            "firmware": firmware
        }
    
    def _build_vlans(self) -> List[Dict]:
        """
        Build VLAN configuration for BMC switch.
        Extracts BMC-relevant VLANs from the supernets definition.
        
        Returns:
            List of VLAN dictionaries
        """
        vlans_out = []
        
        # Always add VLAN 2 (UNUSED_VLAN) for BMC switches - hardcoded requirement (shutdown)
        vlans_out.append({
            "vlan_id": 2,
            "name": "UNUSED_VLAN",
            "shutdown": True
        })
        
        # Always add VLAN 7 (Infra_7) for BMC switches - hardcoded requirement
        vlans_out.append({
            "vlan_id": 7,
            "name": "Infra_7"
        })
        
        supernets = self.input_data.get("InputData", {}).get("Supernets", [])
        
        for net in supernets:
            group_name = net.get("GroupName", "").upper()
            ipv4 = net.get("IPv4", {})
            vlan_id = ipv4.get("VlanId") or ipv4.get("VLANID") or 0
            
            if vlan_id == 0:
                continue
            
            # Skip VLAN 2 and VLAN 7 since they're already hardcoded above
            if vlan_id == 2 or vlan_id == 7:
                continue
            
            # Only include BMC-relevant VLANs (can be customized)
            if self._is_bmc_relevant_vlan(group_name):
                vlan_entry = {
                    "vlan_id": vlan_id,
                    "name": ipv4.get("Name", f"VLAN_{vlan_id}")
                }
                
                # Add interface configuration for management VLANs
                if group_name.startswith("BMC") and ipv4.get("SwitchSVI", False):
                    # For BMC, we need to determine the correct IP address
                    gateway_ip = ipv4.get("Gateway", "")
                    
                    # Based on your manual JSON, BMC gets a different IP than gateway
                    # This logic can be refined based on your requirements
                    if gateway_ip:
                        # Parse IP and calculate BMC switch IP (e.g., gateway + 60)
                        import ipaddress
                        try:
                            network = ipaddress.IPv4Network(f"{ipv4.get('Network')}/{ipv4.get('Cidr', 24)}", strict=False)
                            gateway = ipaddress.IPv4Address(gateway_ip)
                            # Calculate BMC switch IP (using last available IP in range)
                            bmc_ip = str(network.broadcast_address - 1)
                        except:
                            bmc_ip = gateway_ip  # Fallback to gateway
                    else:
                        bmc_ip = ""
                    
                    interface = {
                        "ip": bmc_ip,
                        "cidr": ipv4.get("Cidr", 24),
                        "mtu": JUMBO_MTU
                        # Note: No redundancy (HSRP/VRRP) for BMC switches
                    }
                    if interface["ip"]:  # Only add if IP is present
                        vlan_entry["interface"] = interface
                
                vlans_out.append(vlan_entry)
        
        return sorted(vlans_out, key=lambda v: v["vlan_id"])
    
    def _is_bmc_relevant_vlan(self, group_name: str) -> bool:
        """
        Determine if a VLAN is relevant for BMC switches.
        
        Args:
            group_name: VLAN group name from supernets
            
        Returns:
            True if VLAN is relevant for BMC
        """
        bmc_relevant_prefixes = ["BMC", "UNUSED", "NATIVE"]
        return any(group_name.startswith(prefix) for prefix in bmc_relevant_prefixes)
    
    def _build_interfaces(self, switch_data: Dict) -> List[Dict]:
        """
        Build interface configuration for BMC switch using template files only.
        No hardcoded interfaces - everything comes from templates.
        
        Args:
            switch_data: Dictionary containing switch information
            
        Returns:
            List of interface dictionaries
        """
        make = switch_data.get("Make", "").lower()
        model = switch_data.get("Model", "").upper()
        
        # Load interface template for BMC switch
        template_path = get_real_path(Path("input/switch_interface_templates") / make / f"{model}.json")
        
        if not template_path.exists():
            raise FileNotFoundError(f"[!] BMC interface template not found: {template_path}")
        
        try:
            with open(template_path) as f:
                template_data = json.load(f)
            
            # Extract common interfaces from template
            common_templates = template_data.get("interface_templates", {}).get("common", [])
            
            if not common_templates:
                raise ValueError(f"[!] No common interfaces found in template: {template_path}")
            
            interfaces = []
            for template in common_templates:
                # Deep copy to avoid modifying original template
                interface = deepcopy(template)
                interfaces.append(interface)
            
            print(f"[✓] Loaded BMC interface template: {template_path}")
            return interfaces
            
        except (json.JSONDecodeError, KeyError) as e:
            raise RuntimeError(f"[!] Error loading BMC template {template_path}: {e}")
        except Exception as e:
            raise RuntimeError(f"[!] Unexpected error loading BMC template {template_path}: {e}")


def convert_bmc_switches(input_data: Dict, output_dir: str = DEFAULT_OUTPUT_DIR) -> None:
    """
    Main function to convert BMC switches from lab definition to standard JSON.
    This function can be called from the main converter.
    
    Args:
        input_data: Dictionary containing the lab definition JSON
        output_dir: Directory where output files will be written
    """
    converter = BMCSwitchConverter(input_data, output_dir)
    converter.convert_all_bmc_switches()


# Example usage for testing
if __name__ == "__main__":
    # This allows the module to be run standalone for testing
    import sys
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
        with open(input_file, 'r') as f:
            test_data = json.load(f)
        convert_bmc_switches(test_data)
    else:
        print("❌ Error: Missing input file!")
        print("💡 This script converts BMC switch definitions from lab input JSON to standardized format.")
