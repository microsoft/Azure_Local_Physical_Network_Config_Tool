"""Context Builder - Prepares template rendering context"""
from typing import Dict, Any


class ContextBuilder:
    """Builds template context from transformed configuration"""
    
    def build_context(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build template context by:
        1. Combining original data with _computed
        2. Adding helper flags (has_bgp, has_mlag, has_qos)
        
        Returns a context dict suitable for template rendering
        """
        # Start with the full config
        context = config.copy()
        
        # Add helper flags
        context["has_bgp"] = "bgp" in config and config["bgp"] is not None
        context["has_mlag"] = "mlag" in config and config["mlag"] is not None
        context["has_qos"] = config.get("qos", False)
        context["has_static_routes"] = "static_routes" in config and len(config.get("static_routes", [])) > 0
        context["has_prefix_lists"] = "prefix_lists" in config and len(config.get("prefix_lists", {})) > 0
        
        # Add helper for checking if VLANs exist
        context["has_vlans"] = "vlans" in config and len(config.get("vlans", [])) > 0
        
        # Add helper for checking if interfaces exist
        context["has_interfaces"] = "interfaces" in config and len(config.get("interfaces", [])) > 0
        
        # Add helper for checking if port-channels exist
        context["has_port_channels"] = "port_channels" in config and len(config.get("port_channels", [])) > 0
        
        return context
