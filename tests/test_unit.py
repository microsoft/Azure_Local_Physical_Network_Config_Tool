"""
Unit tests for the config-generator core modules.

Organized by module under test:
  1. Utility functions — infer_firmware, classify_vlan_group
  2. Loader — load_input_json, get_real_path
  3. Constants — sanity checks on shared config values
  4. BMC Converter — switch_info, vlans, interfaces, port_channels, static_routes

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
