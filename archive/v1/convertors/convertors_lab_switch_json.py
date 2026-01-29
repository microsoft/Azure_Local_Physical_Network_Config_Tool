import json
from copy import deepcopy
from pathlib import Path
from collections import defaultdict
from loader import get_real_path

# ── Static config ─────────────────────────────────────────────────────────
SWITCH_TYPES          = ["TOR1", "TOR2"]
TOR1, TOR2                   = "TOR1", "TOR2"
BMC                          = "BMC"

CISCO, NXOS                  = "cisco", "nxos"
DELL,  OS10                  = "dellemc",  "os10"

OUTPUT_FILE_EXTENSION        = ".json"
DEFAULT_OUTPUT_DIR           = "output"

JUMBO_MTU                    = 9216
REDUNDANCY_PRIORITY_ACTIVE   = 150
REDUNDANCY_PRIORITY_STANDBY  = 140
HSRP                         = "hsrp"
VRRP                         = "vrrp"

UNUSED_VLAN       = "UNUSED_VLAN"  
NATIVE_VLAN      = "NATIVE_VLAN"


# ── In-code templates (never mutate these!) ───────────────────────────────
SWITCH_TEMPLATE = {
    "make"    : "",
    "model"   : "",
    "type"    : "",
    "hostname": "",
    "version" : "",
    "firmware": ""
}

SVI_TEMPLATE = {
    "ip"        : "",
    "cidr"      : 0,
    "mtu"       : JUMBO_MTU,
    "redundancy": {          # this whole block is removed for BMC
        "type"      : "",
        "group"     : 0,
        "priority"  : 0,
        "virtual_ip": ""
    }
}

VLAN_TEMPLATE = {
    "vlan_id" : 0,
    "name"    : "",
    # "interface" key is added later only if needed
}

# ── Builder class ─────────────────────────────────────────────────────────
class StandardJSONBuilder:
    def __init__(self, input_data: dict):
        self.input_data = input_data
        self.sections   = {}
        self.vlan_map = defaultdict(list)
        self.ip_map = defaultdict(list)
        self.bgp_map = defaultdict(dict)
        self.deployment_pattern = input_data.get("InputData", {}).get("DeploymentPattern", "").lower()
        
        # Translate hyperconverged to fully_converged for template compatibility
        if self.deployment_pattern == "hyperconverged":
            self.deployment_pattern = "fully_converged"

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
            firmware = (
                NXOS if sw_make == CISCO else
                OS10 if sw_make == DELL  else
                sw.get("Firmware", "").lower()
            )

            sw_entry = deepcopy(SWITCH_TEMPLATE)
            sw_entry.update(
                make     = sw_make,
                model    = sw.get("Model", "").lower(),
                type     = sw_type,
                hostname = sw.get("Hostname", "").lower(),
                version  = sw.get("Firmware", "").lower(),
                firmware = firmware
            )

            self.sections["switch"][sw_type] = sw_entry

        if not self.sections["switch"]:
            print("[!] No valid switches found in input.")

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

            # Construct M,C,S Mapping, GroupName hardcode defined
            if group_name.startswith("HNVPA"):
                self.vlan_map["C"].append(vlan_id)
            elif group_name.startswith("INFRA"):
                self.vlan_map["M"].append(vlan_id)
            elif group_name.startswith("TENANT"):
                self.vlan_map["C"].append(vlan_id)
            elif group_name.startswith("L3FORWARD"):
                self.vlan_map["C"].append(vlan_id)
            elif group_name.startswith("STORAGE"):
                self.vlan_map["S"].append(vlan_id)
            elif group_name.startswith("UNUSED"):
                self.vlan_map["UNUSED"].append(vlan_id)
            elif group_name.startswith("NATIVE"):
                self.vlan_map["NATIVE"].append(vlan_id)
            # collect TOR1 and TOR2 specific storage VLANs
            if vlan_name.endswith(TOR1):
                self.vlan_map["S1"].append(vlan_id)
            elif vlan_name.endswith(TOR2):
                self.vlan_map["S2"].append(vlan_id)

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
            print(f"[!] No VLANs produced for {switch_type}")

    # ------------------------------------------------------------------ #
    # Build interface and port-channels section
    # ------------------------------------------------------------------ #
    def build_interfaces(self, switch_type: str):
        """
        Load and build both interfaces and port-channels from model-based templates.
        """
        switch = self.sections["switch"].get(switch_type)
        if not switch:
            print(f"[!] No switch of type {switch_type} found for interface build.")
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
        """
        templates = template_data.get("interface_templates", {})
        common_templates = templates.get("common", [])
        pattern_templates = templates.get(self.deployment_pattern, [])

        # Build IP mapping for BGP and L3 interfaces
        self._build_ip_mapping()

        # # Debug output
        # print(f"VLAN Map: {dict(self.vlan_map)}")
        # print(f"IP Map: {dict(self.ip_map)}")
        # print(f"Deployment Pattern: {self.deployment_pattern}")

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

            if group_name.startswith("HNVPA"):
                self.ip_map["HNVPA"].append(ip_subnet)
            elif group_name.startswith("INFRA"):
                self.ip_map["M"].append(ip_subnet)
            elif group_name.startswith("TENANT"):
                self.ip_map["C"].append(ip_subnet)
            elif group_name.startswith("L3FORWARD"):
                self.ip_map["C"].append(ip_subnet)
            elif vlan_name.endswith(TOR1) and vlan_name.startswith("P2P_BORDER1"):
                self.ip_map["P2P_BORDER1_TOR1"].append(f"{last_ip}/{cidr}")
                self.ip_map["P2P_TOR1_BORDER1"].append(f"{first_ip}")
            elif vlan_name.endswith(TOR1) and vlan_name.startswith("P2P_BORDER2"):
                self.ip_map["P2P_BORDER2_TOR1"].append(f"{last_ip}/{cidr}")
                self.ip_map["P2P_TOR1_BORDER2"].append(f"{first_ip}")
            elif vlan_name.endswith(TOR2) and vlan_name.startswith("P2P_BORDER1"):
                self.ip_map["P2P_BORDER1_TOR2"].append(f"{last_ip}/{cidr}")
                self.ip_map["P2P_TOR2_BORDER1"].append(f"{first_ip}")
            elif vlan_name.endswith(TOR2) and vlan_name.startswith("P2P_BORDER2"):
                self.ip_map["P2P_BORDER2_TOR2"].append(f"{last_ip}/{cidr}")
                self.ip_map["P2P_TOR2_BORDER2"].append(f"{first_ip}")
            elif vlan_name.endswith(TOR1) and vlan_name.startswith("LOOPBACK"):
                self.ip_map["LOOPBACK0_TOR1"].append(ip_subnet)
            elif vlan_name.endswith(TOR2) and vlan_name.startswith("LOOPBACK"):
                self.ip_map["LOOPBACK0_TOR2"].append(ip_subnet)
            elif vlan_name.endswith(TOR2) and vlan_name.startswith("LOOPBACK"):
                self.ip_map["LOOPBACK0_TOR2"].append(ip_subnet)
            elif vlan_name.startswith("P2P_IBGP"):
                self.ip_map["P2P_IBGP_TOR1"].append(first_ip)
                self.ip_map["P2P_IBGP_TOR2"].append(last_ip)

    def _process_interface_template(self , switch_type: str, template: dict) -> dict:
        """
        Process a single interface template and return the configured interface.
        """
        interface = deepcopy(template)
        
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
            if "S" in part:
                # if TOR1 then resolve to S1, else S2
                if switch_type == TOR1:
                    resolved_vlans.extend([str(vid) for vid in self.vlan_map["S1"]])
                elif switch_type == TOR2:
                    resolved_vlans.extend([str(vid) for vid in self.vlan_map["S2"]])
            elif part in self.vlan_map and self.vlan_map[part]:
                # Direct mapping from vlan_map
                resolved_vlans.extend([str(vid) for vid in self.vlan_map[part]])
            elif part in self.vlan_map and not self.vlan_map[part]:
                # Known VLAN symbol but empty list - skip this part
                continue
            else:
                # Literal VLAN ID - keep as is (only if it's numeric)
                if part.isdigit():
                    resolved_vlans.append(part)
                # Unknown symbols are skipped (not added)
        
        return ",".join(resolved_vlans)

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
        """
        switch = self.sections["switch"].get(switch_type)
        if not switch:
            print(f"[!] No switch info for BGP")
            return

        # Build networks list by flattening all network entries
        networks = [
            self.ip_map.get(f"P2P_BORDER1_{switch_type.upper()}", [""])[0],
            self.ip_map.get(f"P2P_BORDER2_{switch_type.upper()}", [""])[0],
            self.ip_map.get(f"LOOPBACK0_{switch_type.upper()}", [""])[0],
        ]
        # Extend with all tenant/compute networks from "C" key
        networks.extend(self.ip_map.get("C", []))

        # iBGP Peer IPs
        ibgp_ip = ""
        if switch_type == TOR1:
            ibgp_ip = self.ip_map.get(f"P2P_IBGP_TOR2", [""])[0]
        elif switch_type == TOR2:
            ibgp_ip = self.ip_map.get(f"P2P_IBGP_TOR1", [""])[0]

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


    # ------------------------------------------------------------------ #
    # Generate all sections for a specific switch type
    def generate_for_switch(self, switch_type):
        self.build_switch(switch_type)
        self.build_vlans(switch_type)
        self.build_interfaces(switch_type)
        return self.sections



# ── Helper to create per-switch JSON files ────────────────────────────────
def convert_switch_input_json(input_data: dict, output_dir: str = DEFAULT_OUTPUT_DIR):
    out_path = Path(output_dir)
    out_path.mkdir(exist_ok=True, parents=True)

    builder = StandardJSONBuilder(input_data)

    for sw_type in SWITCH_TYPES:
        builder.sections = {}               # reset between runs
        builder.build_switch(sw_type)
        builder.build_vlans(sw_type)
        builder.build_interfaces(sw_type)
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
            "qos": builder.sections["qos"]
        }

        out_file = out_path / f"{hostname}{OUTPUT_FILE_EXTENSION}"
        with out_file.open("w", encoding="utf-8") as f:
            json.dump(final_json, f, indent=2)

        print(f"[✓] Wrote {out_file}")

    # Convert BMC switches
    try:
        from .convertors_bmc_switch_json import convert_bmc_switches
        convert_bmc_switches(input_data, output_dir)
    except ImportError as e:
        print(f"[!] BMC converter not available: {e}")
    except Exception as e:
        print(f"[!] Error converting BMC switches: {e}")


def convert_all_switches_json(input_data: dict, output_dir: str = DEFAULT_OUTPUT_DIR):
    """
    Convert all switches (ToRs and BMC) to standard JSON format.
    This function calls both ToR and BMC conversion functions.
    """
    print("[*] Converting ToR switches...")
    convert_switch_input_json(input_data, output_dir)
    
    # Import and call BMC converter (separate module for clean separation)
    try:
        from .convertors_bmc_switch_json import convert_bmc_switches
        print("[*] Converting BMC switches...")
        convert_bmc_switches(input_data, output_dir)
    except ImportError as e:
        print(f"[!] BMC converter not available: {e}")
    
    print("[✓] All switch conversions completed.")

