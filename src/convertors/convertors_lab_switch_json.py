"""
Lab-format → Standard JSON converter for TOR switches.

Reads an Azure Local lab definition JSON, extracts per-switch data for each
TOR (TOR1, TOR2), resolves VLANs/IPs from Supernets, loads model-specific
interface templates, and writes one standard JSON per switch.  Also triggers
the BMC converter if available.
"""
from __future__ import annotations
import json
import logging
from copy import deepcopy
from pathlib import Path
from collections import defaultdict

# IMPORTANT: Unconditional import for PyInstaller detection
# PyInstaller's static analysis needs to see this import at module level without any conditionals
from . import convertors_bmc_switch_json  # noqa: F401

from ..loader import get_real_path
from ..constants import (
    TOR1, TOR2, BMC,
    CISCO, DELL, NXOS, OS10,
    DEFAULT_OUTPUT_DIR, OUTPUT_FILE_EXTENSION,
    JUMBO_MTU,
    HSRP, VRRP,
    REDUNDANCY_PRIORITY_ACTIVE, REDUNDANCY_PRIORITY_STANDBY,
    TOR_SWITCH_TYPES,
    PATTERN_HYPERCONVERGED, PATTERN_FULLY_CONVERGED,
    PATTERN_FULLY_CONVERGED1, PATTERN_FULLY_CONVERGED2,
    PATTERN_SWITCHED,
    SWITCH_TEMPLATE, SVI_TEMPLATE, VLAN_TEMPLATE,
    IP_PREFIX_P2P_BORDER1, IP_PREFIX_P2P_BORDER2,
    IP_PREFIX_LOOPBACK0, IP_PREFIX_P2P_IBGP,
)
from ..utils import infer_firmware, classify_vlan_group

# Import BMC converter function
try:
    from .convertors_bmc_switch_json import convert_bmc_switches
    _bmc_available = True
except ImportError:
    convert_bmc_switches = None
    _bmc_available = False

logger = logging.getLogger(__name__)

# ── Builder class ─────────────────────────────────────────────────────────
class StandardJSONBuilder:
    def __init__(self, input_data: dict):
        self.input_data = input_data
        self.sections   = {}
        self.vlan_map = defaultdict(list)
        self.ip_map = defaultdict(list)
        self.bgp_map = defaultdict(dict)
        self.deployment_pattern = input_data.get("InputData", {}).get("DeploymentPattern", "").lower()
        self.site = input_data.get("InputData", {}).get("MainEnvData", [{}])[0].get("Site", "")
        
        # Store original pattern for VLAN-based logic
        self.original_pattern = self.deployment_pattern
        
        # Initial translation for template compatibility
        if self.deployment_pattern == PATTERN_HYPERCONVERGED:
            self.deployment_pattern = PATTERN_FULLY_CONVERGED

    # ------------------------------------------------------------------ #
    # Build switch section
    # ------------------------------------------------------------------ #
    def build_switch(self, switch_type: str):

        switches_json = self.input_data.get("InputData", {}).get("Switches", [])
        self.sections["switch"] = {}

        for sw in switches_json:
            sw_type = sw.get("Type")

            # Create BGP Mapping
            if sw_type.startswith("Border"):
                self.bgp_map["ASN_BORDER"] = sw.get("ASN", 0)
            elif sw_type.startswith("TOR"):
                self.bgp_map["ASN_TOR"] = sw.get("ASN", 0)
            elif sw_type.startswith("MUX"):
                self.bgp_map["ASN_MUX"] = sw.get("ASN", 0)

            if sw_type != switch_type:
                continue

            sw_make = sw.get("Make", "").lower()
            firmware = infer_firmware(sw_make)

            sw_entry = deepcopy(SWITCH_TEMPLATE)
            sw_entry.update(
                make     = sw_make,
                model    = sw.get("Model", "").lower(),
                type     = sw_type,
                hostname = sw.get("Hostname", "").lower(),
                version  = sw.get("Firmware", "").lower(),
                firmware = firmware,
                site     = self.site
            )

            self.sections["switch"][sw_type] = sw_entry

        if not self.sections["switch"]:
            logger.warning("No valid switches found in input.")

    # ------------------------------------------------------------------ #
    # Build VLAN section
    # ------------------------------------------------------------------ #
    def build_vlans(self, switch_type: str):
        self.vlan_map.clear()
        vlans_out = []
        supernets = self.input_data.get("InputData", {}).get("Supernets", [])

        for net in supernets:
            group_name  = net.get("GroupName", "").upper()
            vlan_name  = net.get("Name", "").upper()
            ipv4        = net.get("IPv4", {})
            vlan_id     = ipv4.get("VlanId") or ipv4.get("VLANID") or 0
            if vlan_id == 0:
                continue                                # skip invalid IDs

            # Classify VLAN into symbolic sets using shared utility
            symbol = classify_vlan_group(group_name)
            if symbol:
                self.vlan_map[symbol].append(vlan_id)
            # collect TOR1 and TOR2 specific storage VLANs
            if vlan_name.endswith(TOR1):
                self.vlan_map["S1"].append(vlan_id)
            elif vlan_name.endswith(TOR2):
                self.vlan_map["S2"].append(vlan_id)

            # ── Storage VLAN per-TOR filtering (Switched pattern only) ─
            # Switched design: one storage VLAN per TOR switch (enforced).
            #   Storage VLAN A → TOR1 only, Storage VLAN B → TOR2 only.
            # HyperConverged: one per TOR is also recommended, but both
            #   storage VLANs on both TORs is allowed as optional.
            # Skip storage VLANs that don't belong to this TOR so they
            # are not defined in the VLAN section at all.
            if (symbol == "S"
                    and self.original_pattern == PATTERN_SWITCHED
                    and switch_type in (TOR1, TOR2)):
                if vlan_name.endswith(TOR1) and switch_type != TOR1:
                    continue
                if vlan_name.endswith(TOR2) and switch_type != TOR2:
                    continue

            # collect IP / GW
            ip          = ""
            virtual_ip  = ""
            for assign in ipv4.get("Assignment", []):
                a_name = assign.get("Name", "").upper()
                a_ip   = assign.get("IP", "")
                if a_name == "GATEWAY":
                    virtual_ip = a_ip
                elif a_name == switch_type.upper() or a_name.startswith(switch_type.upper()):
                    ip = a_ip

            vlan_entry = deepcopy(VLAN_TEMPLATE)
            vlan_entry.update(vlan_id=vlan_id, name=ipv4.get("Name"))
            
            # Mark UNUSED VLANs as shutdown
            if group_name.startswith("UNUSED"):
                vlan_entry["shutdown"] = True

            # add interface only if IP present & non-blank
            if ip.strip() and ipv4.get("Cidr"):
                iface = deepcopy(SVI_TEMPLATE)
                iface["ip"]   = ip
                iface["cidr"] = ipv4["Cidr"]

                if switch_type in (TOR1, TOR2):
                    sw_make = self.sections["switch"][switch_type]["make"]
                    redundancy_type = HSRP if sw_make == CISCO else VRRP
                    priority        = (
                        REDUNDANCY_PRIORITY_ACTIVE if switch_type == TOR1
                        else REDUNDANCY_PRIORITY_STANDBY
                    )

                    iface["redundancy"].update(
                        type       = redundancy_type,
                        group      = vlan_id,
                        priority   = priority,
                        virtual_ip = virtual_ip
                    )
                else:
                    # BMC: remove redundancy block entirely
                    iface.pop("redundancy", None)

                vlan_entry["interface"] = iface    # attach interface

            vlans_out.append(vlan_entry)

        self.sections["vlans"] = sorted(vlans_out, key=lambda v: v["vlan_id"])
        if not self.sections["vlans"]:
            logger.warning("No VLANs produced for %s", switch_type)

    # ------------------------------------------------------------------ #
    # Build interface and port-channels section
    # ------------------------------------------------------------------ #
    def build_interfaces(self, switch_type: str):
        """
        Load and build both interfaces and port-channels from model-based templates.
        """
        switch = self.sections["switch"].get(switch_type)
        if not switch:
            logger.warning("No switch of type %s found for interface build.", switch_type)
            return

        make = switch.get("make", "").lower()
        model = switch.get("model", "").upper()
        template_path = get_real_path(Path("input/switch_interface_templates") / make / f"{model}.json")

        if not template_path.exists():
            raise FileNotFoundError(f"[!] Interface template not found: {template_path}")

        with open(template_path) as f:
            template_data = json.load(f)

        self._build_interfaces_from_template(switch_type, template_data)
        self._build_port_channels_from_template(switch_type, template_data)

    def _build_interfaces_from_template(self, switch_type: str, template_data: dict):
        """
        Build interfaces from template data, processing both Common and deployment pattern specific interfaces.
        Intelligently selects template variant based on available VLAN sets.
        """
        templates = template_data.get("interface_templates", {})
        common_templates = templates.get("common", [])
        
        # Smart template selection for HyperConverged deployments
        effective_pattern = self.deployment_pattern
        if self.original_pattern == PATTERN_HYPERCONVERGED and self.deployment_pattern == PATTERN_FULLY_CONVERGED:
            # Check which VLAN sets are available
            has_m = bool(self.vlan_map.get("M", []))
            has_c = bool(self.vlan_map.get("C", []))
            has_s = bool(self.vlan_map.get("S", [])) or bool(self.vlan_map.get("S1", [])) or bool(self.vlan_map.get("S2", []))
            
            # If only M exists (no C or S), use fully_converged2 (Access mode)
            if has_m and not has_c and not has_s:
                effective_pattern = PATTERN_FULLY_CONVERGED2
                logger.info("Using fully_converged2 template (Access mode) - only Infrastructure VLANs detected")
            # Otherwise use fully_converged (Trunk mode with M,C,S)
            else:
                effective_pattern = PATTERN_FULLY_CONVERGED1
        
        pattern_templates = templates.get(effective_pattern, [])

        # Build IP mapping for BGP and L3 interfaces
        self._build_ip_mapping()

        interfaces = []

        # Process Common interfaces
        for template in common_templates:
            interface = self._process_interface_template(switch_type, template)
            if interface:
                interfaces.append(interface)

        # Process deployment pattern specific interfaces
        for template in pattern_templates:
            interface = self._process_interface_template(switch_type, template)
            if interface:
                interfaces.append(interface)

        self.sections["interfaces"] = interfaces

    def _build_ip_mapping(self):
        """
        Build IP mapping from supernets for L3 interface configuration.
        """
        self.ip_map.clear()
        supernets = self.input_data.get("InputData", {}).get("Supernets", [])
        
        for net in supernets:
            group_name = net.get("GroupName", "").upper()
            vlan_name = net.get("Name", "").upper()
            ipv4 = net.get("IPv4", {})
            ip_subnet = ipv4.get("Subnet", "")
            cidr = ipv4.get("Cidr", 0)
            first_ip = ipv4.get("FirstAddress", "")
            last_ip = ipv4.get("LastAddress", "")

            # Classify using shared utility for standard groups
            symbol = classify_vlan_group(group_name)
            if symbol == "C" and group_name.startswith("HNVPA"):
                self.ip_map["HNVPA"].append(ip_subnet)
            elif symbol == "M":
                self.ip_map["M"].append(ip_subnet)
            elif symbol == "C":
                self.ip_map["C"].append(ip_subnet)
            elif vlan_name.endswith(TOR1) and vlan_name.startswith(IP_PREFIX_P2P_BORDER1):
                self.ip_map[f"{IP_PREFIX_P2P_BORDER1}_{TOR1}"].append(f"{last_ip}/{cidr}")
                self.ip_map[f"P2P_{TOR1}_BORDER1"].append(f"{first_ip}")
            elif vlan_name.endswith(TOR1) and vlan_name.startswith(IP_PREFIX_P2P_BORDER2):
                self.ip_map[f"{IP_PREFIX_P2P_BORDER2}_{TOR1}"].append(f"{last_ip}/{cidr}")
                self.ip_map[f"P2P_{TOR1}_BORDER2"].append(f"{first_ip}")
            elif vlan_name.endswith(TOR2) and vlan_name.startswith(IP_PREFIX_P2P_BORDER1):
                self.ip_map[f"{IP_PREFIX_P2P_BORDER1}_{TOR2}"].append(f"{last_ip}/{cidr}")
                self.ip_map[f"P2P_{TOR2}_BORDER1"].append(f"{first_ip}")
            elif vlan_name.endswith(TOR2) and vlan_name.startswith(IP_PREFIX_P2P_BORDER2):
                self.ip_map[f"{IP_PREFIX_P2P_BORDER2}_{TOR2}"].append(f"{last_ip}/{cidr}")
                self.ip_map[f"P2P_{TOR2}_BORDER2"].append(f"{first_ip}")
            elif vlan_name.endswith(TOR1) and vlan_name.startswith("LOOPBACK"):
                self.ip_map[f"{IP_PREFIX_LOOPBACK0}_{TOR1}"].append(ip_subnet)
            elif vlan_name.endswith(TOR2) and vlan_name.startswith("LOOPBACK"):
                self.ip_map[f"{IP_PREFIX_LOOPBACK0}_{TOR2}"].append(ip_subnet)
            elif vlan_name.startswith(IP_PREFIX_P2P_IBGP):
                self.ip_map[f"{IP_PREFIX_P2P_IBGP}_{TOR1}"].append(first_ip)
                self.ip_map[f"{IP_PREFIX_P2P_IBGP}_{TOR2}"].append(last_ip)

    def _process_interface_template(self, switch_type: str, template: dict) -> dict:
        """
        Process a single interface template and return the configured interface.
        """
        interface = deepcopy(template)
        
        # Handle VLAN reference resolution for access interfaces
        if interface.get("type") == "Access":
            if "access_vlan" in interface:
                interface["access_vlan"] = self._resolve_interface_vlans(switch_type, interface["access_vlan"])
        
        # Handle VLAN reference resolution for trunk interfaces
        if interface.get("type") == "Trunk":
            if "native_vlan" in interface:
                interface["native_vlan"] = self._resolve_interface_vlans(switch_type, interface["native_vlan"])
            
            if "tagged_vlans" in interface:
                interface["tagged_vlans"] = self._resolve_interface_vlans(switch_type, interface["tagged_vlans"])

        # Handle IP assignment for L3 interfaces
        if interface.get("type") == "L3" and interface.get("ipv4") == "":
            interface["ipv4"] = self._get_l3_ip_for_interface(switch_type, interface)

        return interface

    def _resolve_interface_vlans(self, switch_type: str, vlans_name_string: str) -> str:
        """
        Resolve VLANs for interface configurations from name string to actual VLAN IDs.
        """
        if not vlans_name_string:
            return ""
            
        resolved_vlans = []
        vlan_parts = vlans_name_string.split(",")
        
        for part in vlan_parts:
            part = part.strip()
            # Explicit storage handling with fallback
            if part == "S":
                # Prefer ToR-specific storage lists if present
                s_list = []
                if switch_type == TOR1:
                    s_list = self.vlan_map.get("S1", [])
                elif switch_type == TOR2:
                    s_list = self.vlan_map.get("S2", [])

                if s_list:
                    resolved_vlans.extend([str(vid) for vid in s_list])
                else:
                    # Fallback to generic storage list if available
                    resolved_vlans.extend([str(vid) for vid in self.vlan_map.get("S", [])])
                continue

            # Allow explicit S1/S2 references
            if part in ("S1", "S2"):
                resolved_vlans.extend([str(vid) for vid in self.vlan_map.get(part, [])])
                continue

            # Direct mapping for other symbolic sets (e.g., M, C, UNUSED, NATIVE)
            if part in self.vlan_map:
                resolved_vlans.extend([str(vid) for vid in self.vlan_map.get(part, [])])
                continue

            # Literal VLAN ID - keep as is (only if it's numeric)
            if part.isdigit():
                resolved_vlans.append(part)
            # Unknown symbols are skipped (not added)
        
        # De-duplicate while preserving order
        seen = set()
        unique_vlans = []
        for v in resolved_vlans:
            if v not in seen:
                seen.add(v)
                unique_vlans.append(v)

        return ",".join(unique_vlans)

    def _get_l3_ip_for_interface(self, switch_type: str, interface: dict) -> str:
        """
        Get appropriate IP address for L3 interfaces based on interface name/type.
        """
        intf_name = interface.get("name", "")
        ip_map_key = (f"{intf_name}_{switch_type}").upper()

        if ip_map_key in self.ip_map:
            return self.ip_map[ip_map_key][0]

        return ""

    def _build_port_channels_from_template(self, switch_type: str, template_data: dict):
        port_channels = template_data.get("port_channels", [])
        enriched_pcs = []

        for pc in port_channels:
            pc_copy = deepcopy(pc)

            # Enrich with values based on ID
            if pc_copy["description"] == "P2P_IBGP" and pc_copy["type"] == "L3":
                ip_map_key = (f"P2P_IBGP_{switch_type}").upper()
                pc_copy["ipv4"] = self.ip_map[ip_map_key][0]

            enriched_pcs.append(pc_copy)

        self.sections["port_channels"] = enriched_pcs

    # ------------------------------------------------------------------ #
    # Build BGP section
    # ------------------------------------------------------------------ #
    def build_bgp(self, switch_type: str):
        """
        Build BGP config with neighbor and network structure.
        IPs are abstracted with placeholders for future parsing.
        
        Network advertisement policy:
        - Advertise P2P subnets (Border1/Border2) using subnet prefixes, not host IPs
        - Advertise iBGP P2P subnet from the port-channel peer link (/30 derived from peer IP)
        - Advertise VLAN interface subnets (e.g., BMC Mgmt, Infrastructure) by computing network from interface IP/CIDR
        - Avoid duplicates and ignore blank entries
        These rules ensure all necessary routes are announced upstream without missing required subnets.
        """
        import ipaddress
        switch = self.sections["switch"].get(switch_type)
        if not switch:
            logger.warning("No switch info for BGP")
            return

        # Build networks list using subnet prefixes
        networks: list[str] = []

        # 1) P2P subnets to Border routers (stored as subnet strings in ip_map)
        b1_key = f"P2P_BORDER1_{switch_type.upper()}"
        b2_key = f"P2P_BORDER2_{switch_type.upper()}"
        b1_subnet = self.ip_map.get(b1_key, [""])[0]
        b2_subnet = self.ip_map.get(b2_key, [""])[0]
        if b1_subnet:
            networks.append(b1_subnet)
        if b2_subnet:
            networks.append(b2_subnet)

        # 2) Loopback0 host route (always advertise as /32)
        loopback = self.ip_map.get(f"LOOPBACK0_{switch_type.upper()}", [""])[0]
        if loopback:
            networks.append(loopback)

        # 3) iBGP P2P subnet: derive /30 network from peer IP
        ibgp_peer_ip = ""
        if switch_type == TOR1:
            ibgp_peer_ip = self.ip_map.get("P2P_IBGP_TOR2", [""])[0]
        elif switch_type == TOR2:
            ibgp_peer_ip = self.ip_map.get("P2P_IBGP_TOR1", [""])[0]
        if ibgp_peer_ip:
            try:
                ibgp_net = ipaddress.ip_network(f"{ibgp_peer_ip}/30", strict=False)
                networks.append(ibgp_net.with_prefixlen)
            except Exception:
                pass

        # 4) VLAN interface subnets: compute from SVI IP/CIDR (e.g., BMC Mgmt, Infra)
        for vlan in self.sections.get("vlans", []):
            iface = vlan.get("interface")
            if iface and iface.get("ip") and iface.get("cidr"):
                try:
                    svi_net = ipaddress.ip_network(f"{iface['ip']}/{iface['cidr']}", strict=False)
                    networks.append(svi_net.with_prefixlen)
                except Exception:
                    continue

        # 5) Include any additional compute/tenant networks from ip_map["C"]
        networks.extend(self.ip_map.get("C", []))

        # De-duplicate while preserving order
        seen = set()
        networks = [n for n in networks if n and (n not in seen and not seen.add(n))]

        # iBGP Peer IPs
        ibgp_ip = ""
        if switch_type == TOR1:
            ibgp_ip = self.ip_map.get("P2P_IBGP_TOR2", [""])[0]
        elif switch_type == TOR2:
            ibgp_ip = self.ip_map.get("P2P_IBGP_TOR1", [""])[0]

        neighbors = [
            {
                "ip": self.ip_map.get(f"P2P_{switch_type.upper()}_BORDER1", [""])[0],
                "description": "TO_Border1",
                "remote_as": self.bgp_map.get("ASN_BORDER", 0),
                "af_ipv4_unicast": {
                    "prefix_list_in": "DefaultRoute"
                }
            },
            {
                "ip": self.ip_map.get(f"P2P_{switch_type.upper()}_BORDER2", [""])[0],
                "description": "TO_Border2",
                "remote_as": self.bgp_map.get("ASN_BORDER", 0),
                "af_ipv4_unicast": {
                    "prefix_list_in": "DefaultRoute"
                }
            },
            {
                "ip": ibgp_ip,
                "description": "iBGP_PEER",
                "remote_as": self.bgp_map.get("ASN_TOR", 0),
                "af_ipv4_unicast": {}
            }
        ]

        # Add HNVPA neighbor if ASN_MUX is defined
        asn_mux = self.bgp_map.get("ASN_MUX", 0)
        if asn_mux:
            neighbors.append({
                "ip": self.ip_map.get("HNVPA", [""])[0],
                "description": "TO_HNVPA",
                "remote_as": asn_mux,
                "update_source": "Loopback0",
                "ebgp_multihop": 3,
                "af_ipv4_unicast": {
                    "prefix_list_out": "DefaultRoute"
                }
            })

        bgp = {
            "asn": self.bgp_map.get("ASN_TOR", 0),
            "router_id": self.ip_map.get(f"LOOPBACK0_{switch_type.upper()}", [""])[0].split('/')[0],
            "networks": networks,
            "neighbors": neighbors
        }

        self.sections["bgp"] = bgp


    # ------------------------------------------------------------------ #
    # Build Prefix-List section (Hardcoded for now)
    # ------------------------------------------------------------------ #
    def build_prefix_lists(self):
        """
        Build basic prefix-lists. Values can be reused or extended easily.
        """
        self.sections["prefix_lists"] = {
            "DefaultRoute": [
                {
                    "seq": 10,
                    "action": "permit",
                    "prefix": "0.0.0.0/0"
                },
                {
                    "seq": 50,
                    "action": "deny",
                    "prefix": "0.0.0.0/0",
                    "prefix_filter": "le 32"
                }
            ]
        }

    # ------------------------------------------------------------------ #
    # Build QoS section (Hardcoded for now)
    # ------------------------------------------------------------------ #
    def build_qos(self):
        """
        Build basic QoS policies. Values can be reused or extended easily.
        """
        self.sections["qos"] = True


# ── Helper to create per-switch JSON files ────────────────────────────────
def convert_switch_input_json(input_data: dict, output_dir: str = DEFAULT_OUTPUT_DIR, *, debug: bool = False):
    out_path = Path(output_dir)
    out_path.mkdir(exist_ok=True, parents=True)

    builder = StandardJSONBuilder(input_data)

    for sw_type in TOR_SWITCH_TYPES:
        builder.sections = {}               # reset between runs
        builder.build_switch(sw_type)
        builder.build_vlans(sw_type)

        # Debug: Print key VLAN symbol mappings for visibility
        m_vlans = builder.vlan_map.get("M", [])
        c_vlans = builder.vlan_map.get("C", [])
        s_vlans = builder.vlan_map.get("S", [])
        s1_vlans = builder.vlan_map.get("S1", [])
        s2_vlans = builder.vlan_map.get("S2", [])
        logger.debug("VLAN sets for %s: M=%s C=%s S=%s S1=%s S2=%s", sw_type, m_vlans, c_vlans, s_vlans, s1_vlans, s2_vlans)

        # Validation: Check VLAN requirements based on deployment pattern
        missing_critical = []
        if not m_vlans:
            missing_critical.append("M")
        
        # For HyperConverged: allow M-only (uses fully_converged2/Access mode) or M+C+S (uses fully_converged1/Trunk mode)
        is_hyperconverged = builder.original_pattern == PATTERN_HYPERCONVERGED
        has_c = bool(c_vlans)
        has_s = bool(s_vlans) or bool(s1_vlans) or bool(s2_vlans)
        
        if is_hyperconverged:
            # HyperConverged: M-only is valid (Access mode), or require full M+C for Trunk mode
            if m_vlans and not has_c and not has_s:
                logger.info("HyperConverged deployment with M-only: using Access mode (fully_converged2)")
            elif not has_c:
                missing_critical.append("C")
        else:
            # Non-HyperConverged: always require C
            if not has_c:
                missing_critical.append("C")

        if missing_critical:
            raise ValueError(
                "Required VLAN set(s) missing for {sw}: {sets}. "
                "Input Supernets must define Infrastructure (M) and Tenant/Compute (C) VLANs.".format(
                    sw=sw_type,
                    sets=", ".join(missing_critical)
                )
            )

        if not s_vlans and not s1_vlans and not s2_vlans:
            logger.warning("Storage VLAN set S is empty for %s; proceeding without storage tagging.", sw_type)

        builder.build_interfaces(sw_type)
        # Per-interface VLAN security belt: ensure required VLAN values resolved
        for iface in builder.sections.get("interfaces", []):
            itype = iface.get("type", "")
            name = iface.get("name", "(unnamed)")
            if itype == "Access":
                if not str(iface.get("access_vlan", "")).strip():
                    raise ValueError(f"Access interface '{name}' has empty access_vlan. Define a valid VLAN ID in input template.")
            elif itype == "Trunk":
                if not str(iface.get("native_vlan", "")).strip():
                    raise ValueError(f"Trunk interface '{name}' has empty native_vlan after resolution. Ensure Infrastructure (M) mapping or literal VLAN ID is present.")
                if not str(iface.get("tagged_vlans", "")).strip():
                    raise ValueError(f"Trunk interface '{name}' has empty tagged_vlans after resolution. Provide Tenant/Compute (C) / Storage (S) VLANs or explicit IDs.")

        # Port-channel VLAN validation (trunk-type port-channels)
        for pc in builder.sections.get("port_channels", []):
            pctype = pc.get("type", "")
            desc = pc.get("description", f"ID {pc.get('id','?')}")
            if pctype == "Trunk":
                if not str(pc.get("native_vlan", "")).strip():
                    raise ValueError(f"Port-channel '{desc}' missing native_vlan. Define native VLAN or remove trunk type.")
                # tagged_vlans may be intentionally empty (e.g., only native) so only warn
                if not str(pc.get("tagged_vlans", "")).strip():
                    logger.warning("Port-channel '%s' has no tagged_vlans; only native VLAN will be carried.", desc)
        builder.build_bgp(sw_type)
        builder.build_prefix_lists()
        builder.build_qos()
        
        sw_info = builder.sections.get("switch", {}).get(sw_type)
        if not sw_info:                     # no matching switch of this type
            continue

        hostname = sw_info["hostname"] or sw_type.lower()
        final_json = {
            "switch": sw_info,
            "vlans" : builder.sections["vlans"],
            "interfaces": builder.sections["interfaces"],
            "port_channels": builder.sections["port_channels"],
            "bgp": builder.sections["bgp"],
            "prefix_lists": builder.sections["prefix_lists"],
            "qos": builder.sections["qos"],
        }

        # Only include debug data when explicitly requested (DC3)
        if debug:
            final_json["debug"] = {
                "vlan_map": dict(builder.vlan_map),
                "ip_map": dict(builder.ip_map),
                "resolved_trunks": [
                    {
                        "name": iface.get("name", ""),
                        "native_vlan": iface.get("native_vlan", ""),
                        "tagged_vlans": iface.get("tagged_vlans", "")
                    }
                    for iface in builder.sections.get("interfaces", [])
                    if iface.get("type") == "Trunk"
                ]
            }

        out_file = out_path / f"{hostname}{OUTPUT_FILE_EXTENSION}"
        with out_file.open("w", encoding="utf-8") as f:
            json.dump(final_json, f, indent=2)

        logger.info("Wrote %s", out_file)

    # Convert BMC switches using the module-level import
    if _bmc_available and convert_bmc_switches:
        try:
            convert_bmc_switches(input_data, output_dir)
        except Exception as e:
            logger.error("Error converting BMC switches: %s", e)
