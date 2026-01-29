"""Data Transformer - Adds computed fields based on role"""
from typing import Dict, Any, Optional
import copy


class Transformer:
    """Transforms and enriches network configuration data"""
    
    # Computed values based on role
    ROLE_DEFAULTS = {
        "TOR1": {
            "hsrp_priority": 150,
            "mlag_role_priority": 1,
            "mst_priority": 8192
        },
        "TOR2": {
            "hsrp_priority": 100,
            "mlag_role_priority": 32667,
            "mst_priority": 16384
        },
        "BMC": {
            "hsrp_priority": None,
            "mlag_role_priority": None,
            "mst_priority": 32768
        }
    }
    
    def transform(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform configuration by:
        1. Normalizing legacy fields
        2. Adding _computed section based on role
        
        Returns a new dict without modifying the original
        """
        # Deep copy to avoid modifying original
        result = copy.deepcopy(config)
        
        # Normalize legacy fields
        self._normalize_legacy_fields(result)
        
        # Add computed section
        self._add_computed_fields(result)
        
        return result
    
    def _normalize_legacy_fields(self, config: Dict[str, Any]):
        """Normalize legacy field names (make→vendor, os→firmware)"""
        if "switch" in config:
            switch = config["switch"]
            
            # make → vendor
            if "make" in switch:
                if "vendor" not in switch:
                    switch["vendor"] = switch["make"]
                del switch["make"]
            
            # os → firmware
            if "os" in switch:
                if "firmware" not in switch:
                    switch["firmware"] = switch["os"]
                del switch["os"]
    
    def _add_computed_fields(self, config: Dict[str, Any]):
        """Add _computed section based on role"""
        if "switch" not in config:
            return
        
        role = config["switch"].get("role")
        if not role or role not in self.ROLE_DEFAULTS:
            return
        
        # Get computed values for this role
        computed = self.ROLE_DEFAULTS[role].copy()
        
        # Add to config
        config["_computed"] = computed
