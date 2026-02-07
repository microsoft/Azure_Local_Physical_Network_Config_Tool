"""
BMC Switch JSON Converter

Converts BMC switch definitions from lab input JSON to standardised JSON format.
Called from the main TOR converter but kept separate for modularity.

Since BMC switches are for internal lab use only, some configurations are hardcoded
for simplicity (see DC4 decision) and can be refined later.
"""

from __future__ import annotations

import ipaddress
import json
import logging
from copy import deepcopy
from pathlib import Path
from typing import Dict, List

from ..loader import get_real_path
from ..constants import (
    DEFAULT_OUTPUT_DIR, OUTPUT_FILE_EXTENSION,
    BMC, JUMBO_MTU,
    BMC_HARDCODED_VLANS, BMC_RELEVANT_GROUPS,
)
from ..utils import infer_firmware

logger = logging.getLogger(__name__)


class BMCSwitchConverter:
    """Dedicated converter for BMC switches."""

    def __init__(self, input_data: Dict, output_dir: str = DEFAULT_OUTPUT_DIR):
        self.input_data = input_data
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)

    # ── public API ────────────────────────────────────────────────────────

    def convert_all_bmc_switches(self) -> None:
        """Convert every BMC switch found in the input data."""
        switches_json = self.input_data.get("InputData", {}).get("Switches", [])
        bmc_switches = [sw for sw in switches_json if sw.get("Type") == BMC]

        if not bmc_switches:
            logger.info("No BMC switches found in input data")
            return

        logger.info("Found %d BMC switch(es) to convert", len(bmc_switches))

        for bmc_switch in bmc_switches:
            self._convert_single_bmc(bmc_switch)

        logger.info("BMC conversion completed — %d switch(es) processed", len(bmc_switches))

    # ── private helpers ───────────────────────────────────────────────────

    def _convert_single_bmc(self, switch_data: Dict) -> None:
        template_data = self._load_template(switch_data)
        switch_info = self._build_switch_info(switch_data)
        vlans = self._build_vlans()
        interfaces = self._build_interfaces(template_data)
        port_channels = self._build_port_channels(template_data)
        static_routes = self._build_static_routes()

        bmc_json: dict = {
            "switch": switch_info,
            "vlans": vlans,
            "interfaces": interfaces,
            "port_channels": port_channels,
            "static_routes": static_routes,
        }

        hostname = switch_info.get("hostname", "bmc")
        output_file = self.output_dir / f"{hostname}{OUTPUT_FILE_EXTENSION}"
        output_file.write_text(json.dumps(bmc_json, indent=2), encoding="utf-8")
        logger.info("Generated BMC config: %s", output_file)

    # -- template loading --------------------------------------------------

    @staticmethod
    def _load_template(switch_data: Dict) -> Dict:
        """Load the model-specific interface template JSON."""
        make = switch_data.get("Make", "").lower()
        model = switch_data.get("Model", "").upper()

        template_path = get_real_path(
            Path("input/switch_interface_templates") / make / f"{model}.json"
        )

        if not template_path.exists():
            raise FileNotFoundError(
                f"BMC interface template not found: {template_path} "
                f"(model={model}, make={make})"
            )

        try:
            with template_path.open() as fh:
                template_data = json.load(fh)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid JSON in BMC template {template_path}: {exc}") from exc

        logger.info("Loaded BMC interface template: %s", template_path)
        return template_data

    # -- switch metadata ---------------------------------------------------

    def _build_switch_info(self, switch_data: Dict) -> Dict:
        """Build switch metadata dict including site from input data."""
        sw_make = switch_data.get("Make", "").lower()
        # Site is stored in MainEnvData[0].Site (same path as TOR converter)
        main_env = self.input_data.get("InputData", {}).get("MainEnvData", [{}])
        site = main_env[0].get("Site", "") if main_env else ""
        return {
            "make": sw_make,
            "model": switch_data.get("Model", "").lower(),
            "type": switch_data.get("Type"),
            "hostname": switch_data.get("Hostname", "").lower(),
            "version": switch_data.get("Firmware", "").lower(),
            "firmware": infer_firmware(sw_make),
            "site": site.lower() if site else "",
        }

    # -- VLANs -------------------------------------------------------------

    def _build_vlans(self) -> List[Dict]:
        """Build VLAN list.

        Starts with the hardcoded BMC VLANs (DC4), then appends any extra
        BMC-relevant VLANs found in the Supernets section.
        """
        # Start with hardcoded VLANs (deep-copied to avoid mutation)
        vlans_out: list[dict] = [deepcopy(v) for v in BMC_HARDCODED_VLANS]
        hardcoded_ids = {v["vlan_id"] for v in BMC_HARDCODED_VLANS}

        supernets = self.input_data.get("InputData", {}).get("Supernets", [])

        for net in supernets:
            group_name = net.get("GroupName", "").upper()
            ipv4 = net.get("IPv4", {})
            vlan_id = ipv4.get("VlanId") or ipv4.get("VLANID") or 0

            if vlan_id == 0 or vlan_id in hardcoded_ids:
                continue

            if not self._is_bmc_relevant_vlan(group_name):
                continue

            vlan_entry: dict = {
                "vlan_id": vlan_id,
                "name": ipv4.get("Name", f"VLAN_{vlan_id}"),
            }

            # Add SVI for management VLANs that declare a gateway
            if group_name.startswith("BMC") and ipv4.get("SwitchSVI", False):
                gateway_ip = ipv4.get("Gateway", "")
                if gateway_ip:
                    try:
                        network = ipaddress.IPv4Network(
                            f"{ipv4.get('Network')}/{ipv4.get('Cidr', 24)}", strict=False
                        )
                        bmc_ip = str(network.broadcast_address - 1)
                    except (ValueError, TypeError):
                        bmc_ip = gateway_ip
                else:
                    bmc_ip = ""

                if bmc_ip:
                    vlan_entry["interface"] = {
                        "ip": bmc_ip,
                        "cidr": ipv4.get("Cidr", 24),
                        "mtu": JUMBO_MTU,
                    }

            vlans_out.append(vlan_entry)

        return sorted(vlans_out, key=lambda v: v["vlan_id"])

    @staticmethod
    def _is_bmc_relevant_vlan(group_name: str) -> bool:
        return any(group_name.startswith(prefix) for prefix in BMC_RELEVANT_GROUPS)

    # -- interfaces --------------------------------------------------------

    @staticmethod
    def _build_interfaces(template_data: Dict) -> List[Dict]:
        """Extract common interfaces from the loaded template."""
        common_templates = template_data.get("interface_templates", {}).get("common", [])
        if not common_templates:
            raise ValueError("No common interfaces found in BMC template")
        return [deepcopy(t) for t in common_templates]

    # -- port channels -----------------------------------------------------

    @staticmethod
    def _build_port_channels(template_data: Dict) -> List[Dict]:
        """Extract port-channels from the loaded template.

        BMC port-channels (e.g. TOR_BMC trunk) are defined in the template
        and used as-is — no IP enrichment needed (unlike TOR P2P_IBGP).
        """
        port_channels = template_data.get("port_channels", [])
        return [deepcopy(pc) for pc in port_channels]

    # -- static routes -----------------------------------------------------

    def _build_static_routes(self) -> List[Dict]:
        """Build static routes for the BMC switch.

        The BMC switch typically has a default route pointing to the BMC
        management VLAN gateway (derived from the BMC supernet).
        """
        supernets = self.input_data.get("InputData", {}).get("Supernets", [])

        for net in supernets:
            group_name = net.get("GroupName", "").upper()
            if not group_name.startswith("BMC"):
                continue

            ipv4 = net.get("IPv4", {})
            gateway = ipv4.get("Gateway", "")
            if gateway:
                return [
                    {
                        "prefix": "0.0.0.0/0",
                        "next_hop": gateway,
                        "description": "BMC default gateway",
                    }
                ]

        return []


# ── Module-level convenience function ──────────────────────────────────────

def convert_bmc_switches(input_data: Dict, output_dir: str = DEFAULT_OUTPUT_DIR) -> None:
    """Entry point called from the TOR converter to process BMC switches."""
    converter = BMCSwitchConverter(input_data, output_dir)
    converter.convert_all_bmc_switches()

