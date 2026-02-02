"""
Context Builder - Prepares template rendering context

Provides helper flags and computed values for Jinja2 templates.
These helpers simplify template logic and enable conditional rendering.
"""
from typing import Dict, Any, List


class ContextBuilder:
    """Builds template context from transformed configuration"""
    
    def build_context(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build template context by:
        1. Combining original data with _computed
        2. Adding helper flags (has_bgp, has_mlag, has_qos_interfaces, etc.)
        3. Adding role-based helpers (is_tor1, is_tor2, is_bmc)
        4. Adding filtered lists (storage_vlans)
        
        Returns a context dict suitable for template rendering
        """
        # Start with the full config
        context = config.copy()
        
        # =================================================================
        # SECTION EXISTENCE FLAGS
        # =================================================================
        context["has_bgp"] = "bgp" in config and config["bgp"] is not None
        context["has_mlag"] = "mlag" in config and config["mlag"] is not None
        context["has_static_routes"] = "static_routes" in config and len(config.get("static_routes", [])) > 0
        context["has_prefix_lists"] = "prefix_lists" in config and len(config.get("prefix_lists", {})) > 0
        context["has_vlans"] = "vlans" in config and len(config.get("vlans", [])) > 0
        context["has_interfaces"] = "interfaces" in config and len(config.get("interfaces", [])) > 0
        context["has_port_channels"] = "port_channels" in config and len(config.get("port_channels", [])) > 0
        
        # =================================================================
        # QoS - Interface-level, renders global config if any interface needs it
        # =================================================================
        interfaces = config.get("interfaces", [])
        context["has_qos_interfaces"] = any(intf.get("qos", False) for intf in interfaces)
        
        # =================================================================
        # ROLE-BASED HELPERS
        # =================================================================
        switch = config.get("switch", {})
        role = switch.get("role", "").upper()
        context["is_tor1"] = role == "TOR1"
        context["is_tor2"] = role == "TOR2"
        context["is_bmc"] = role == "BMC"
        
        # =================================================================
        # DEPLOYMENT PATTERN HELPERS
        # =================================================================
        pattern = switch.get("deployment_pattern", "fully_converged")
        context["is_fully_converged"] = pattern == "fully_converged"
        context["is_switched"] = pattern == "switched"
        context["is_switchless"] = pattern == "switchless"
        
        # =================================================================
        # FILTERED VLAN LISTS
        # =================================================================
        vlans = config.get("vlans", [])
        context["storage_vlans"] = self._get_storage_vlans(vlans)
        context["management_vlans"] = self._get_vlans_by_purpose(vlans, "management")
        context["compute_vlans"] = self._get_vlans_by_purpose(vlans, "compute")
        
        # =================================================================
        # CONVENIENCE STRINGS
        # =================================================================
        context["vlan_ids_string"] = self._get_vlan_ids_string(vlans)
        context["storage_vlan_ids_string"] = self._get_vlan_ids_string(context["storage_vlans"])
        
        return context
    
    def _get_storage_vlans(self, vlans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter VLANs with storage_1 or storage_2 purpose"""
        return [v for v in vlans if v.get("purpose") in ("storage_1", "storage_2")]
    
    def _get_vlans_by_purpose(self, vlans: List[Dict[str, Any]], purpose: str) -> List[Dict[str, Any]]:
        """Filter VLANs by purpose"""
        return [v for v in vlans if v.get("purpose") == purpose]
    
    def _get_vlan_ids_string(self, vlans: List[Dict[str, Any]]) -> str:
        """Get comma-separated string of VLAN IDs (e.g., '10,20,30')"""
        return ",".join(str(v.get("vlan_id", "")) for v in vlans if v.get("vlan_id"))
