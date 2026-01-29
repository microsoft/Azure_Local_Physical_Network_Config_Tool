"""JSON Schema Validator for Azure Local network configurations"""
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
import jsonschema
from jsonschema import Draft7Validator


class ValidationError:
    """Represents a validation error"""
    def __init__(self, path: str, message: str, error_type: str = "schema"):
        self.path = path
        self.message = message
        self.error_type = error_type
    
    def __str__(self) -> str:
        return f"[{self.error_type}] {self.path}: {self.message}"
    
    def to_dict(self) -> Dict[str, str]:
        return {
            "path": self.path,
            "message": self.message,
            "type": self.error_type
        }


class ValidationResult:
    """Validation result container"""
    def __init__(self):
        self.errors: List[ValidationError] = []
    
    def add_error(self, path: str, message: str, error_type: str = "schema"):
        self.errors.append(ValidationError(path, message, error_type))
    
    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0
    
    def __str__(self) -> str:
        if self.is_valid:
            return "Validation successful"
        return "\n".join([str(e) for e in self.errors])


class StandardValidator:
    """Validates network configuration JSON against standard schema"""
    
    def __init__(self, schema_path: Optional[Path] = None):
        if schema_path is None:
            # Default to schema in backend/schema/standard.json
            schema_path = Path(__file__).parent.parent / "schema" / "standard.json"
        
        with open(schema_path, 'r') as f:
            self.schema = json.load(f)
        
        self.validator = Draft7Validator(self.schema)
    
    def validate(self, config: Dict[str, Any]) -> ValidationResult:
        """Validate configuration against schema and perform cross-reference checks"""
        result = ValidationResult()
        
        # Schema validation
        for error in self.validator.iter_errors(config):
            path = ".".join([str(p) for p in error.path]) if error.path else "root"
            result.add_error(path, error.message, "schema")
        
        # Only perform cross-reference checks if schema is valid
        if result.is_valid:
            self._check_cross_references(config, result)
        
        return result
    
    def _check_cross_references(self, config: Dict[str, Any], result: ValidationResult):
        """Check cross-references between different parts of the config"""
        
        # Collect VLAN IDs
        vlan_ids = set()
        if "vlans" in config:
            for vlan in config["vlans"]:
                vlan_ids.add(str(vlan.get("vlan_id")))
        
        # Collect interface names for port-channel member validation
        interface_names = set()
        if "interfaces" in config:
            for intf in config["interfaces"]:
                if "intf" in intf:
                    interface_names.add(intf["intf"])
                if "start_intf" in intf and "end_intf" in intf:
                    # For ranges, we can't easily enumerate all, just note the range exists
                    pass
        
        # Validate interface VLAN references
        if "interfaces" in config:
            for idx, intf in enumerate(config["interfaces"]):
                # Check access VLAN exists
                if "access_vlan" in intf and intf["access_vlan"]:
                    if intf["access_vlan"] not in vlan_ids:
                        result.add_error(
                            f"interfaces[{idx}].access_vlan",
                            f"Referenced VLAN {intf['access_vlan']} does not exist",
                            "cross_reference"
                        )
                
                # Check native VLAN exists
                if "native_vlan" in intf and intf["native_vlan"]:
                    if intf["native_vlan"] not in vlan_ids:
                        result.add_error(
                            f"interfaces[{idx}].native_vlan",
                            f"Referenced VLAN {intf['native_vlan']} does not exist",
                            "cross_reference"
                        )
                
                # Check tagged VLANs exist
                if "tagged_vlans" in intf and intf["tagged_vlans"]:
                    tagged = intf["tagged_vlans"].split(",")
                    for vlan in tagged:
                        vlan = vlan.strip()
                        if vlan and vlan not in vlan_ids:
                            result.add_error(
                                f"interfaces[{idx}].tagged_vlans",
                                f"Referenced VLAN {vlan} does not exist",
                                "cross_reference"
                            )
        
        # Validate port-channel VLAN and member references
        if "port_channels" in config:
            for idx, pc in enumerate(config["port_channels"]):
                # Check native VLAN exists
                if "native_vlan" in pc and pc["native_vlan"]:
                    if pc["native_vlan"] not in vlan_ids:
                        result.add_error(
                            f"port_channels[{idx}].native_vlan",
                            f"Referenced VLAN {pc['native_vlan']} does not exist",
                            "cross_reference"
                        )
                
                # Check tagged VLANs exist
                if "tagged_vlans" in pc and pc["tagged_vlans"]:
                    tagged = pc["tagged_vlans"].split(",")
                    for vlan in tagged:
                        vlan = vlan.strip()
                        if vlan and vlan not in vlan_ids:
                            result.add_error(
                                f"port_channels[{idx}].tagged_vlans",
                                f"Referenced VLAN {vlan} does not exist",
                                "cross_reference"
                            )
                
                # Check members is not empty
                if "members" in pc:
                    if not pc["members"]:
                        result.add_error(
                            f"port_channels[{idx}].members",
                            "Port-channel must have at least one member",
                            "cross_reference"
                        )
        
        # Validate BGP prefix list references
        if "bgp" in config and "neighbors" in config["bgp"]:
            prefix_lists = set(config.get("prefix_lists", {}).keys())
            
            for idx, neighbor in enumerate(config["bgp"]["neighbors"]):
                af = neighbor.get("af_ipv4_unicast", {})
                
                if "prefix_list_in" in af and af["prefix_list_in"]:
                    if af["prefix_list_in"] not in prefix_lists:
                        result.add_error(
                            f"bgp.neighbors[{idx}].af_ipv4_unicast.prefix_list_in",
                            f"Referenced prefix list '{af['prefix_list_in']}' does not exist",
                            "cross_reference"
                        )
                
                if "prefix_list_out" in af and af["prefix_list_out"]:
                    if af["prefix_list_out"] not in prefix_lists:
                        result.add_error(
                            f"bgp.neighbors[{idx}].af_ipv4_unicast.prefix_list_out",
                            f"Referenced prefix list '{af['prefix_list_out']}' does not exist",
                            "cross_reference"
                        )
