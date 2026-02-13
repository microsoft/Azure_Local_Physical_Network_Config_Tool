"""
Unit tests for the config-generator core modules.

Organized by module under test:
  1. Utility functions — infer_firmware, classify_vlan_group
  2. Loader — load_input_json, get_real_path
  3. Constants — sanity checks on shared config values
  4. BMC Converter — switch_info, vlans, interfaces, port_channels, static_routes
  5. TOR Converter (StandardJSONBuilder) — build_switch, build_vlans,
     _resolve_interface_vlans, build_bgp, build_prefix_lists, build_qos

All test data uses generic/sanitized values — no lab-specific identifiers.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.constants import (
    CISCO, DELL, TOR1, TOR2,
    VENDOR_FIRMWARE_MAP, TOR_SWITCH_TYPES,
    BMC_HARDCODED_VLANS, JUMBO_MTU,
    SWITCH_TEMPLATE, SVI_TEMPLATE, VLAN_TEMPLATE,
)
from src.utils import infer_firmware, classify_vlan_group
from src.loader import load_input_json, get_real_path
from src.convertors.convertors_bmc_switch_json import BMCSwitchConverter
from src.convertors.convertors_lab_switch_json import StandardJSONBuilder


# ═══════════════════════════════════════════════════════════════════════════
#  Fixtures & Factories
# ═══════════════════════════════════════════════════════════════════════════

def _make_bmc_input(*, site="testsite", bmc_make="Cisco", bmc_model="9348GC-FXP",
                     bmc_hostname="test-bmc-1", bmc_firmware="10.4.5",
                     bmc_gateway="10.0.0.1", bmc_network="10.0.0.0", bmc_cidr=24,
                     bmc_vlan_id=125):
    """Factory for creating minimal BMC switch input data.

    All values are generic — override keyword arguments to test specific scenarios.
    """
    return {
        "InputData": {
            "MainEnvData": [{"Site": site}],
            "Switches": [
                {
                    "Make": bmc_make,
                    "Model": bmc_model,
                    "Type": "BMC",
                    "Hostname": bmc_hostname,
                    "ASN": None,
                    "Firmware": bmc_firmware,
                }
            ],
            "Supernets": [
                {
                    "GroupName": "BMC",
                    "Name": f"BMC_Mgmt_{bmc_vlan_id}",
                    "VLANID": bmc_vlan_id,
                    "IPv4": {
                        "SwitchSVI": True,
                        "Name": f"BMC_Mgmt_{bmc_vlan_id}",
                        "VLANID": bmc_vlan_id,
                        "Cidr": bmc_cidr,
                        "Network": bmc_network,
                        "Gateway": bmc_gateway,
                    },
                },
                {
                    "GroupName": "UNUSED_VLAN",
                    "Name": "UNUSED_VLAN",
                    "IPv4": {"Name": "UNUSED_VLAN", "VLANID": 2},
                },
                {
                    "GroupName": "NativeVlan",
                    "Name": "NativeVlan",
                    "IPv4": {"Name": "NativeVlan", "VLANID": 99},
                },
            ],
        }
    }


@pytest.fixture
def bmc_converter(tmp_path):
    """A BMCSwitchConverter initialised with default test input."""
    return BMCSwitchConverter(_make_bmc_input(), str(tmp_path))


@pytest.fixture
def bmc_switch_data():
    """The switch dict from default BMC input (first Switches entry)."""
    return _make_bmc_input()["InputData"]["Switches"][0]


# ═══════════════════════════════════════════════════════════════════════════
#  1. Utility Functions
# ═══════════════════════════════════════════════════════════════════════════

class TestInferFirmware:
    """Maps vendor Make string to firmware identifier (e.g. 'cisco' -> 'nxos')."""

    @pytest.mark.parametrize("vendor, expected", [
        ("cisco",       "nxos"),
        ("Cisco",       "nxos"),     # case-insensitive
        ("  cisco  ",   "nxos"),     # strips whitespace
        ("dellemc",     "os10"),
    ])
    def test_known_vendors(self, vendor, expected):
        assert infer_firmware(vendor) == expected

    def test_unknown_vendor_returns_lowered(self):
        assert infer_firmware("juniper") == "juniper"

    def test_empty_string_returns_empty(self):
        assert infer_firmware("") == ""


class TestClassifyVlanGroup:
    """Maps Supernet GroupName prefix to VLAN set symbol (C, M, S, etc.)."""

    @pytest.mark.parametrize("group_name, expected", [
        ("HNVPA_Pool1",    "C"),
        ("INFRA_Mgmt",     "M"),
        ("TENANT_1",       "C"),
        ("L3FORWARD_1",    "C"),
        ("STORAGE_A",      "S"),
        ("UNUSED_1",       "UNUSED"),
        ("NATIVE_1",       "NATIVE"),
        ("hnvpa_lower",    "C"),       # case-insensitive
    ])
    def test_known_prefixes(self, group_name, expected):
        assert classify_vlan_group(group_name) == expected

    @pytest.mark.parametrize("group_name", ["RANDOM_STUFF", ""])
    def test_unknown_or_empty_returns_none(self, group_name):
        assert classify_vlan_group(group_name) is None


# ═══════════════════════════════════════════════════════════════════════════
#  2. Loader
# ═══════════════════════════════════════════════════════════════════════════

class TestLoadInputJson:
    """JSON file loading with validation."""

    def test_loads_valid_json(self, tmp_path):
        f = tmp_path / "valid.json"
        f.write_text('{"a": 1}', encoding="utf-8")
        assert load_input_json(f) == {"a": 1}

    def test_raises_on_missing_file(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_input_json(tmp_path / "nope.json")

    def test_raises_on_malformed_json(self, tmp_path):
        f = tmp_path / "bad.json"
        f.write_text("{not json", encoding="utf-8")
        with pytest.raises(ValueError, match="Failed to parse JSON"):
            load_input_json(f)


class TestGetRealPath:
    """Path resolution, including PyInstaller frozen mode."""

    def test_returns_absolute_path(self):
        assert get_real_path(Path("input")).is_absolute()

    def test_uses_meipass_when_frozen(self, monkeypatch):
        monkeypatch.setattr(sys, "frozen", True, raising=False)
        monkeypatch.setattr(sys, "_MEIPASS", "/fake/meipass", raising=False)
        assert str(get_real_path(Path("input/templates"))) == "/fake/meipass/input/templates"


# ═══════════════════════════════════════════════════════════════════════════
#  3. Constants
# ═══════════════════════════════════════════════════════════════════════════

class TestConstants:
    """Verify constant definitions and template integrity."""

    def test_tor_switch_types_includes_both(self):
        assert TOR_SWITCH_TYPES == [TOR1, TOR2]

    def test_vendor_firmware_map_covers_all_vendors(self):
        assert CISCO in VENDOR_FIRMWARE_MAP
        assert DELL in VENDOR_FIRMWARE_MAP

    def test_bmc_vlans_have_required_keys(self):
        for vlan in BMC_HARDCODED_VLANS:
            assert "vlan_id" in vlan
            assert "name" in vlan

    def test_in_code_templates_are_pristine(self):
        """Guard against accidental mutation of shared template dicts."""
        assert SWITCH_TEMPLATE["make"] == ""
        assert SVI_TEMPLATE["ip"] == ""
        assert VLAN_TEMPLATE["vlan_id"] == 0


# ═══════════════════════════════════════════════════════════════════════════
#  4. BMC Converter
# ═══════════════════════════════════════════════════════════════════════════

class TestBMCSwitchInfo:
    """BMCSwitchConverter._build_switch_info — switch metadata extraction."""

    def test_reads_site_from_main_env_data(self, tmp_path):
        data = _make_bmc_input(site="site42")
        conv = BMCSwitchConverter(data, str(tmp_path))
        info = conv._build_switch_info(data["InputData"]["Switches"][0])
        assert info["site"] == "site42"

    def test_site_defaults_to_empty_when_missing(self, tmp_path):
        data = _make_bmc_input()
        data["InputData"]["MainEnvData"] = []
        conv = BMCSwitchConverter(data, str(tmp_path))
        info = conv._build_switch_info(data["InputData"]["Switches"][0])
        assert info["site"] == ""

    def test_infers_firmware_from_make(self, bmc_converter, bmc_switch_data):
        info = bmc_converter._build_switch_info(bmc_switch_data)
        assert info["firmware"] == "nxos"
        assert info["make"] == "cisco"

    def test_lowercases_hostname(self, tmp_path):
        data = _make_bmc_input(bmc_hostname="UPPER-BMC-1")
        conv = BMCSwitchConverter(data, str(tmp_path))
        info = conv._build_switch_info(data["InputData"]["Switches"][0])
        assert info["hostname"] == "upper-bmc-1"


class TestBMCVlans:
    """BMCSwitchConverter._build_vlans — VLAN list construction."""

    def test_always_includes_hardcoded_vlans(self, bmc_converter):
        vlan_ids = {v["vlan_id"] for v in bmc_converter._build_vlans()}
        assert {2, 99} <= vlan_ids

    def test_adds_bmc_vlan_from_supernet(self, bmc_converter):
        vlans = bmc_converter._build_vlans()
        v125 = next((v for v in vlans if v["vlan_id"] == 125), None)
        assert v125 is not None
        assert v125["name"] == "BMC_Mgmt_125"

    def test_populates_svi_on_bmc_vlan(self, tmp_path):
        data = _make_bmc_input(bmc_gateway="10.0.0.1", bmc_network="10.0.0.0", bmc_cidr=24)
        conv = BMCSwitchConverter(data, str(tmp_path))
        v125 = next(v for v in conv._build_vlans() if v["vlan_id"] == 125)
        assert v125["interface"]["cidr"] == 24
        assert v125["interface"]["mtu"] == JUMBO_MTU

    def test_vlans_sorted_by_id(self, bmc_converter):
        ids = [v["vlan_id"] for v in bmc_converter._build_vlans()]
        assert ids == sorted(ids)

    def test_does_not_mutate_global_constant(self, bmc_converter):
        """Calling _build_vlans must not alter the shared BMC_HARDCODED_VLANS."""
        before = [dict(v) for v in BMC_HARDCODED_VLANS]
        bmc_converter._build_vlans()
        assert [dict(v) for v in BMC_HARDCODED_VLANS] == before


class TestBMCPortChannels:
    """BMCSwitchConverter._build_port_channels — static template extraction."""

    _SAMPLE_TEMPLATE = {
        "interface_templates": {"common": [{"name": "test", "type": "Access"}]},
        "port_channels": [
            {"id": 102, "description": "TOR_BMC", "type": "Trunk",
             "native_vlan": "99", "tagged_vlans": "125", "members": ["1/51", "1/52"]},
        ],
    }

    def test_extracts_port_channels_from_template(self):
        pcs = BMCSwitchConverter._build_port_channels(self._SAMPLE_TEMPLATE)
        assert len(pcs) == 1
        assert pcs[0]["id"] == 102
        assert pcs[0]["members"] == ["1/51", "1/52"]

    def test_returns_empty_when_absent(self):
        pcs = BMCSwitchConverter._build_port_channels({"interface_templates": {"common": []}})
        assert pcs == []

    def test_deep_copies_to_prevent_mutation(self):
        original = [{"id": 1, "members": ["1/1"]}]
        pcs = BMCSwitchConverter._build_port_channels({"port_channels": original})
        pcs[0]["id"] = 999
        assert original[0]["id"] == 1


class TestBMCStaticRoutes:
    """BMCSwitchConverter._build_static_routes — default route from BMC gateway."""

    def test_creates_default_route_from_gateway(self, bmc_converter):
        routes = bmc_converter._build_static_routes()
        assert len(routes) == 1
        assert routes[0] == {
            "prefix": "0.0.0.0/0",
            "next_hop": "10.0.0.1",
            "description": "BMC default gateway",
        }

    def test_no_routes_when_bmc_supernet_missing(self, tmp_path):
        data = _make_bmc_input()
        data["InputData"]["Supernets"] = [
            s for s in data["InputData"]["Supernets"]
            if not s["GroupName"].upper().startswith("BMC")
        ]
        assert BMCSwitchConverter(data, str(tmp_path))._build_static_routes() == []

    def test_no_routes_when_gateway_empty(self, tmp_path):
        data = _make_bmc_input()
        for s in data["InputData"]["Supernets"]:
            if s["GroupName"].upper().startswith("BMC"):
                s["IPv4"]["Gateway"] = ""
        assert BMCSwitchConverter(data, str(tmp_path))._build_static_routes() == []


class TestBMCInterfaces:
    """BMCSwitchConverter._build_interfaces — static template extraction."""

    def test_extracts_common_interfaces(self):
        template = {
            "interface_templates": {
                "common": [
                    {"name": "Unused", "type": "Access", "access_vlan": "2"},
                    {"name": "Host_BMC", "type": "Access", "access_vlan": "125"},
                ]
            }
        }
        intfs = BMCSwitchConverter._build_interfaces(template)
        assert len(intfs) == 2
        assert [i["name"] for i in intfs] == ["Unused", "Host_BMC"]

    def test_raises_when_no_common_interfaces(self):
        with pytest.raises(ValueError, match="No common interfaces"):
            BMCSwitchConverter._build_interfaces({"interface_templates": {"common": []}})


# ═══════════════════════════════════════════════════════════════════════════
#  5. TOR Converter — StandardJSONBuilder
# ═══════════════════════════════════════════════════════════════════════════


def _make_tor_input(*, site="site1", deployment_pattern="Switched", node_count=16,
                     tor_make="Cisco", tor_model="93180YC-FX", tor_firmware="10.3(4a)",
                     tor1_hostname="tor-1a", tor2_hostname="tor-1b",
                     tor_asn=65242, border_asn=64846, mux_asn=65112,
                     extra_supernets=None):
    """Factory for creating minimal TOR converter input data.

    Provides a realistic input structure with Switches, Supernets, and
    ClusterUnits.  Override keyword arguments to test specific scenarios.
    """
    supernets = [
        {
            "GroupName": "INFRA_MGMT",
            "Name": "Infra_7",
            "IPv4": {
                "SwitchSVI": True, "Name": "Infra_7", "VLANID": 7,
                "Cidr": 24, "NetworkType": "Infrastructure",
                "Subnet": "10.0.7.0/24", "Network": "10.0.7.0",
                "Netmask": "255.255.255.0", "FirstAddress": "10.0.7.1",
                "LastAddress": "10.0.7.254",
                "Gateway": "10.0.7.1",
                "Assignment": [
                    {"Name": "Gateway", "IP": "10.0.7.1"},
                    {"Name": "TOR1", "IP": "10.0.7.2"},
                    {"Name": "TOR2", "IP": "10.0.7.3"},
                ],
            },
        },
        {
            "GroupName": "HNVPA_Pool1",
            "Name": "HNVPA_6",
            "IPv4": {
                "SwitchSVI": False, "Name": "HNVPA_6", "VLANID": 6,
                "Cidr": 23, "NetworkType": "Compute",
                "Subnet": "10.0.6.0/23", "Network": "10.0.6.0",
                "Netmask": "255.255.254.0", "FirstAddress": "10.0.6.1",
                "LastAddress": "10.0.7.254",
                "Assignment": [],
            },
        },
        {
            "GroupName": "TENANT_1",
            "Name": "Tenant_201",
            "IPv4": {
                "SwitchSVI": True, "Name": "Tenant_201", "VLANID": 201,
                "Cidr": 23, "NetworkType": "Tenant",
                "Subnet": "10.1.0.0/23", "Network": "10.1.0.0",
                "Netmask": "255.255.254.0", "FirstAddress": "10.1.0.1",
                "LastAddress": "10.1.1.254",
                "Gateway": "10.1.0.1",
                "Assignment": [
                    {"Name": "Gateway", "IP": "10.1.0.1"},
                    {"Name": "TOR1", "IP": "10.1.0.2"},
                    {"Name": "TOR2", "IP": "10.1.0.3"},
                ],
            },
        },
        {
            "GroupName": "STORAGE_A",
            "Name": "Storage_711_TOR1",
            "IPv4": {
                "SwitchSVI": True, "Name": "Storage_711_TOR1", "VLANID": 711,
                "Cidr": 24, "NetworkType": "Storage",
                "Subnet": "10.2.0.0/24", "Network": "10.2.0.0",
                "Netmask": "255.255.255.0",
                "Gateway": "10.2.0.1",
                "Assignment": [
                    {"Name": "Gateway", "IP": "10.2.0.1"},
                    {"Name": "TOR1", "IP": "10.2.0.2"},
                ],
            },
        },
        {
            "GroupName": "STORAGE_B",
            "Name": "Storage_712_TOR2",
            "IPv4": {
                "SwitchSVI": True, "Name": "Storage_712_TOR2", "VLANID": 712,
                "Cidr": 24, "NetworkType": "Storage",
                "Subnet": "10.2.1.0/24", "Network": "10.2.1.0",
                "Netmask": "255.255.255.0",
                "Gateway": "10.2.1.1",
                "Assignment": [
                    {"Name": "Gateway", "IP": "10.2.1.1"},
                    {"Name": "TOR2", "IP": "10.2.1.2"},
                ],
            },
        },
        {
            "GroupName": "P2P_BORDER1",
            "Name": "P2P_Border1_TOR1",
            "IPv4": {
                "SwitchSVI": False, "Name": "P2P_Border1_TOR1", "VLANID": 0,
                "Cidr": 30, "Subnet": "10.3.0.0/30", "Network": "10.3.0.0",
                "FirstAddress": "10.3.0.1", "LastAddress": "10.3.0.2",
                "Assignment": [],
            },
        },
        {
            "GroupName": "P2P_BORDER2",
            "Name": "P2P_Border2_TOR1",
            "IPv4": {
                "SwitchSVI": False, "Name": "P2P_Border2_TOR1", "VLANID": 0,
                "Cidr": 30, "Subnet": "10.3.0.4/30", "Network": "10.3.0.4",
                "FirstAddress": "10.3.0.5", "LastAddress": "10.3.0.6",
                "Assignment": [],
            },
        },
        {
            "GroupName": "P2P_BORDER1",
            "Name": "P2P_Border1_TOR2",
            "IPv4": {
                "SwitchSVI": False, "Name": "P2P_Border1_TOR2", "VLANID": 0,
                "Cidr": 30, "Subnet": "10.3.0.8/30", "Network": "10.3.0.8",
                "FirstAddress": "10.3.0.9", "LastAddress": "10.3.0.10",
                "Assignment": [],
            },
        },
        {
            "GroupName": "P2P_BORDER2",
            "Name": "P2P_Border2_TOR2",
            "IPv4": {
                "SwitchSVI": False, "Name": "P2P_Border2_TOR2", "VLANID": 0,
                "Cidr": 30, "Subnet": "10.3.0.12/30", "Network": "10.3.0.12",
                "FirstAddress": "10.3.0.13", "LastAddress": "10.3.0.14",
                "Assignment": [],
            },
        },
        {
            "GroupName": "LOOPBACK0",
            "Name": "Loopback0_TOR1",
            "IPv4": {
                "SwitchSVI": False, "Name": "Loopback0_TOR1", "VLANID": 0,
                "Cidr": 32, "Subnet": "10.4.0.1/32", "Network": "10.4.0.1",
                "Assignment": [],
            },
        },
        {
            "GroupName": "LOOPBACK0",
            "Name": "Loopback0_TOR2",
            "IPv4": {
                "SwitchSVI": False, "Name": "Loopback0_TOR2", "VLANID": 0,
                "Cidr": 32, "Subnet": "10.4.0.2/32", "Network": "10.4.0.2",
                "Assignment": [],
            },
        },
        {
            "GroupName": "P2P_IBGP",
            "Name": "P2P_IBGP",
            "IPv4": {
                "SwitchSVI": False, "Name": "P2P_IBGP", "VLANID": 0,
                "Cidr": 30, "Subnet": "10.5.0.0/30", "Network": "10.5.0.0",
                "FirstAddress": "10.5.0.1", "LastAddress": "10.5.0.2",
                "Assignment": [],
            },
        },
        {
            "GroupName": "UNUSED_VLAN",
            "Name": "UNUSED_VLAN",
            "IPv4": {"SwitchSVI": False, "Name": "UNUSED_VLAN", "VLANID": 2},
        },
        {
            "GroupName": "NativeVlan",
            "Name": "NativeVlan",
            "IPv4": {"SwitchSVI": False, "Name": "NativeVlan", "VLANID": 99},
        },
    ]
    if extra_supernets:
        supernets.extend(extra_supernets)

    return {
        "Version": "1.0.0",
        "Description": "Unit test input",
        "InputData": {
            "MainEnvData": [{
                "Id": "Env01", "Site": site, "RackName": "rack01",
                "NodeCount": node_count,
                "ClusterUnits": [
                    {"Name": "Cl01", "NodeCount": 4, "Topology": deployment_pattern}
                ],
            }],
            "Switches": [
                {"Make": "Cisco", "Model": "C9336C-FX2", "Type": "Border1",
                 "Hostname": "border-1a", "ASN": border_asn},
                {"Make": "Cisco", "Model": "C9336C-FX2", "Type": "Border2",
                 "Hostname": "border-1b", "ASN": border_asn},
                {"Make": tor_make, "Model": tor_model, "Type": "TOR1",
                 "Hostname": tor1_hostname, "ASN": tor_asn, "Firmware": tor_firmware},
                {"Make": tor_make, "Model": tor_model, "Type": "TOR2",
                 "Hostname": tor2_hostname, "ASN": tor_asn, "Firmware": tor_firmware},
                {"Make": "Contoso", "Model": None, "Type": "MUX",
                 "Hostname": "mux-1", "ASN": mux_asn},
            ],
            "Supernets": supernets,
            "DeploymentPattern": deployment_pattern,
        },
    }


@pytest.fixture
def tor_builder():
    """A StandardJSONBuilder initialised with default Switched input."""
    return StandardJSONBuilder(_make_tor_input())


class TestTORBuildSwitch:
    """StandardJSONBuilder.build_switch — switch metadata from Switches array."""

    def test_builds_tor1_metadata(self, tor_builder):
        tor_builder.build_switch("TOR1")
        sw = tor_builder.sections["switch"]["TOR1"]
        assert sw["make"] == "cisco"
        assert sw["model"] == "93180yc-fx"
        assert sw["hostname"] == "tor-1a"
        assert sw["firmware"] == "nxos"

    def test_builds_tor2_metadata(self, tor_builder):
        tor_builder.build_switch("TOR2")
        sw = tor_builder.sections["switch"]["TOR2"]
        assert sw["hostname"] == "tor-1b"
        assert sw["type"] == "TOR2"

    def test_populates_bgp_map_from_switches(self, tor_builder):
        tor_builder.build_switch("TOR1")
        assert tor_builder.bgp_map["ASN_BORDER"] == 64846
        assert tor_builder.bgp_map["ASN_TOR"] == 65242
        assert tor_builder.bgp_map["ASN_MUX"] == 65112

    def test_site_from_main_env_data(self, tor_builder):
        tor_builder.build_switch("TOR1")
        assert tor_builder.sections["switch"]["TOR1"]["site"] == "site1"

    def test_custom_site(self):
        builder = StandardJSONBuilder(_make_tor_input(site="datacenter42"))
        builder.build_switch("TOR1")
        assert builder.sections["switch"]["TOR1"]["site"] == "datacenter42"

    def test_32bit_mux_asn(self):
        """Verify 32-bit ASN (4200003000) stored as integer, not truncated."""
        builder = StandardJSONBuilder(_make_tor_input(mux_asn=4200003000))
        builder.build_switch("TOR1")
        assert builder.bgp_map["ASN_MUX"] == 4200003000


class TestTORBuildVlans:
    """StandardJSONBuilder.build_vlans — VLAN list from Supernets."""

    def test_builds_vlans_sorted_by_id(self, tor_builder):
        tor_builder.build_switch("TOR1")
        tor_builder.build_vlans("TOR1")
        ids = [v["vlan_id"] for v in tor_builder.sections["vlans"]]
        assert ids == sorted(ids)

    def test_classifies_vlan_groups_to_symbols(self, tor_builder):
        tor_builder.build_switch("TOR1")
        tor_builder.build_vlans("TOR1")
        assert 7 in tor_builder.vlan_map["M"]     # INFRA
        assert 6 in tor_builder.vlan_map["C"]      # HNVPA
        assert 201 in tor_builder.vlan_map["C"]    # TENANT
        assert 711 in tor_builder.vlan_map["S1"]   # STORAGE ending TOR1
        assert 712 in tor_builder.vlan_map["S2"]   # STORAGE ending TOR2

    def test_svi_interface_attached_when_ip_present(self, tor_builder):
        tor_builder.build_switch("TOR1")
        tor_builder.build_vlans("TOR1")
        infra = next(v for v in tor_builder.sections["vlans"] if v["vlan_id"] == 7)
        assert "interface" in infra
        assert infra["interface"]["ip"] == "10.0.7.2"
        assert infra["interface"]["cidr"] == 24
        assert infra["interface"]["mtu"] == JUMBO_MTU

    def test_svi_hsrp_for_cisco_tor1(self, tor_builder):
        tor_builder.build_switch("TOR1")
        tor_builder.build_vlans("TOR1")
        infra = next(v for v in tor_builder.sections["vlans"] if v["vlan_id"] == 7)
        red = infra["interface"]["redundancy"]
        assert red["type"] == "hsrp"
        assert red["priority"] == 150   # ACTIVE
        assert red["virtual_ip"] == "10.0.7.1"

    def test_svi_hsrp_for_cisco_tor2_is_standby(self, tor_builder):
        tor_builder.build_switch("TOR2")
        tor_builder.build_vlans("TOR2")
        infra = next(v for v in tor_builder.sections["vlans"] if v["vlan_id"] == 7)
        assert infra["interface"]["redundancy"]["priority"] == 140  # STANDBY

    def test_unused_vlan_marked_shutdown(self, tor_builder):
        tor_builder.build_switch("TOR1")
        tor_builder.build_vlans("TOR1")
        unused = next(v for v in tor_builder.sections["vlans"] if v["vlan_id"] == 2)
        assert unused.get("shutdown") is True

    def test_no_svi_when_no_assignment_ip(self, tor_builder):
        """VLANs without Assignment IP for this switch type have no SVI."""
        tor_builder.build_switch("TOR1")
        tor_builder.build_vlans("TOR1")
        hnvpa = next(v for v in tor_builder.sections["vlans"] if v["vlan_id"] == 6)
        assert "interface" not in hnvpa

    def test_tor1_only_has_storage_vlan_a_switched(self, tor_builder):
        """Switched pattern: TOR1 should only define its own storage VLAN (A), not TOR2's."""
        tor_builder.build_switch("TOR1")
        tor_builder.build_vlans("TOR1")
        storage_ids = [v["vlan_id"] for v in tor_builder.sections["vlans"]
                       if "storage" in v.get("name", "").lower()]
        assert 711 in storage_ids, "TOR1 must have Storage VLAN A (711)"
        assert 712 not in storage_ids, "TOR1 must NOT have Storage VLAN B (712)"

    def test_tor2_only_has_storage_vlan_b_switched(self):
        """Switched pattern: TOR2 should only define its own storage VLAN (B), not TOR1's."""
        builder = StandardJSONBuilder(_make_tor_input())
        builder.build_switch("TOR2")
        builder.build_vlans("TOR2")
        storage_ids = [v["vlan_id"] for v in builder.sections["vlans"]
                       if "storage" in v.get("name", "").lower()]
        assert 712 in storage_ids, "TOR2 must have Storage VLAN B (712)"
        assert 711 not in storage_ids, "TOR2 must NOT have Storage VLAN A (711)"

    def test_hyperconverged_both_storage_vlans_on_tor(self):
        """HyperConverged: both storage VLANs allowed on each TOR (recommended: one, but both valid)."""
        builder = StandardJSONBuilder(_make_tor_input(deployment_pattern="HyperConverged"))
        builder.build_switch("TOR1")
        builder.build_vlans("TOR1")
        storage_ids = [v["vlan_id"] for v in builder.sections["vlans"]
                       if "storage" in v.get("name", "").lower()]
        assert 711 in storage_ids, "TOR1 must have Storage VLAN A (711)"
        assert 712 in storage_ids, "HyperConverged TOR1 may also have Storage VLAN B (712)"


class TestResolveInterfaceVlans:
    """StandardJSONBuilder._resolve_interface_vlans — symbolic VLAN resolution."""

    def _builder_with_vlans(self, switch_type="TOR1"):
        builder = StandardJSONBuilder(_make_tor_input())
        builder.build_switch(switch_type)
        builder.build_vlans(switch_type)
        return builder

    def test_resolves_M_to_infra_vlans(self):
        b = self._builder_with_vlans()
        assert "7" in b._resolve_interface_vlans("TOR1", "M").split(",")

    def test_resolves_C_to_compute_vlans(self):
        b = self._builder_with_vlans()
        ids = b._resolve_interface_vlans("TOR1", "C").split(",")
        assert "6" in ids and "201" in ids

    def test_resolves_S_for_tor1_uses_S1(self):
        b = self._builder_with_vlans()
        assert "711" in b._resolve_interface_vlans("TOR1", "S").split(",")

    def test_resolves_S_for_tor2_uses_S2(self):
        b = self._builder_with_vlans("TOR2")
        assert "712" in b._resolve_interface_vlans("TOR2", "S").split(",")

    def test_resolves_composite_string(self):
        b = self._builder_with_vlans()
        ids = b._resolve_interface_vlans("TOR1", "M,C").split(",")
        assert "7" in ids and "6" in ids

    def test_literal_vlan_passthrough(self):
        b = self._builder_with_vlans()
        assert b._resolve_interface_vlans("TOR1", "99") == "99"

    def test_empty_string_returns_empty(self):
        b = self._builder_with_vlans()
        assert b._resolve_interface_vlans("TOR1", "") == ""

    def test_deduplicates_vlans(self):
        b = self._builder_with_vlans()
        ids = b._resolve_interface_vlans("TOR1", "M,M").split(",")
        assert len(ids) == len(set(ids))

    def test_unknown_symbol_skipped(self):
        b = self._builder_with_vlans()
        assert b._resolve_interface_vlans("TOR1", "NOSUCHVLAN") == ""


class TestTORBuildBGP:
    """StandardJSONBuilder.build_bgp — BGP neighbor/network construction."""

    def _prepared_builder(self, **kw):
        builder = StandardJSONBuilder(_make_tor_input(**kw))
        builder.build_switch("TOR1")
        builder.build_vlans("TOR1")
        builder.sections["interfaces"] = []
        builder._build_ip_mapping()
        return builder

    def test_bgp_asn_matches_tor(self):
        b = self._prepared_builder()
        b.build_bgp("TOR1")
        assert b.sections["bgp"]["asn"] == 65242

    def test_bgp_router_id_from_loopback(self):
        b = self._prepared_builder()
        b.build_bgp("TOR1")
        assert b.sections["bgp"]["router_id"] == "10.4.0.1"

    def test_bgp_has_border_neighbors(self):
        b = self._prepared_builder()
        b.build_bgp("TOR1")
        descs = [n["description"] for n in b.sections["bgp"]["neighbors"]]
        assert "TO_Border1" in descs and "TO_Border2" in descs

    def test_bgp_border_asn(self):
        b = self._prepared_builder()
        b.build_bgp("TOR1")
        border1 = next(n for n in b.sections["bgp"]["neighbors"]
                       if n["description"] == "TO_Border1")
        assert border1["remote_as"] == 64846

    def test_bgp_ibgp_peer(self):
        b = self._prepared_builder()
        b.build_bgp("TOR1")
        ibgp = next(n for n in b.sections["bgp"]["neighbors"]
                    if n["description"] == "iBGP_PEER")
        assert ibgp["remote_as"] == 65242
        assert ibgp["ip"] == "10.5.0.2"

    def test_bgp_mux_neighbor(self):
        b = self._prepared_builder()
        b.build_bgp("TOR1")
        mux = next(n for n in b.sections["bgp"]["neighbors"]
                   if n["description"] == "TO_HNVPA")
        assert mux["remote_as"] == 65112
        assert mux["ebgp_multihop"] == 3

    def test_32bit_mux_asn_in_bgp(self):
        b = self._prepared_builder(mux_asn=4200003000)
        b.build_bgp("TOR1")
        mux = next(n for n in b.sections["bgp"]["neighbors"]
                   if n["description"] == "TO_HNVPA")
        assert mux["remote_as"] == 4200003000

    def test_bgp_networks_include_p2p(self):
        b = self._prepared_builder()
        b.build_bgp("TOR1")
        assert "10.3.0.2/30" in b.sections["bgp"]["networks"]

    def test_bgp_networks_include_loopback(self):
        b = self._prepared_builder()
        b.build_bgp("TOR1")
        assert "10.4.0.1/32" in b.sections["bgp"]["networks"]

    def test_bgp_networks_deduplicated(self):
        b = self._prepared_builder()
        b.build_bgp("TOR1")
        nets = b.sections["bgp"]["networks"]
        assert len(nets) == len(set(nets))

    def test_no_mux_when_asn_zero(self):
        b = self._prepared_builder(mux_asn=0)
        b.build_bgp("TOR1")
        descs = [n["description"] for n in b.sections["bgp"]["neighbors"]]
        assert "TO_HNVPA" not in descs


class TestTORBuildPrefixLists:
    """StandardJSONBuilder.build_prefix_lists — DefaultRoute entries."""

    def test_has_default_route(self, tor_builder):
        tor_builder.build_prefix_lists()
        assert "DefaultRoute" in tor_builder.sections["prefix_lists"]
        assert len(tor_builder.sections["prefix_lists"]["DefaultRoute"]) == 2

    def test_permit_and_deny(self, tor_builder):
        tor_builder.build_prefix_lists()
        actions = [e["action"] for e in tor_builder.sections["prefix_lists"]["DefaultRoute"]]
        assert "permit" in actions and "deny" in actions


class TestTORBuildQoS:
    """StandardJSONBuilder.build_qos — simple boolean flag."""

    def test_qos_is_true(self, tor_builder):
        tor_builder.build_qos()
        assert tor_builder.sections["qos"] is True


class TestTORDeploymentPattern:
    """StandardJSONBuilder pattern translation for template compatibility."""

    def test_hyperconverged_maps_to_fully_converged(self):
        b = StandardJSONBuilder(_make_tor_input(deployment_pattern="HyperConverged"))
        assert b.deployment_pattern == "fully_converged"
        assert b.original_pattern == "hyperconverged"

    def test_switched_stays_switched(self):
        b = StandardJSONBuilder(_make_tor_input(deployment_pattern="Switched"))
        assert b.deployment_pattern == "switched"

    def test_switchless_stays_switchless(self):
        b = StandardJSONBuilder(_make_tor_input(deployment_pattern="Switchless"))
        assert b.deployment_pattern == "switchless"


class TestTORBuildIPMapping:
    """StandardJSONBuilder._build_ip_mapping — IP extraction from Supernets."""

    def test_p2p_border_ips(self):
        b = StandardJSONBuilder(_make_tor_input())
        b._build_ip_mapping()
        assert b.ip_map["P2P_BORDER1_TOR1"] == ["10.3.0.2/30"]
        assert b.ip_map["P2P_TOR1_BORDER1"] == ["10.3.0.1"]

    def test_loopback_ips(self):
        b = StandardJSONBuilder(_make_tor_input())
        b._build_ip_mapping()
        assert b.ip_map["LOOPBACK0_TOR1"] == ["10.4.0.1/32"]
        assert b.ip_map["LOOPBACK0_TOR2"] == ["10.4.0.2/32"]

    def test_ibgp_ips(self):
        b = StandardJSONBuilder(_make_tor_input())
        b._build_ip_mapping()
        assert b.ip_map["P2P_IBGP_TOR1"] == ["10.5.0.1"]
        assert b.ip_map["P2P_IBGP_TOR2"] == ["10.5.0.2"]

    def test_hnvpa_subnet(self):
        b = StandardJSONBuilder(_make_tor_input())
        b._build_ip_mapping()
        assert "10.0.6.0/23" in b.ip_map["HNVPA"]
