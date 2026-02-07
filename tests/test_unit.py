"""Unit tests for src/constants.py, src/utils.py, src/loader.py, and BMC converter."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent
SRC_PATH = ROOT_DIR / "src"
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.constants import (
    CISCO, DELL, NXOS, OS10, TOR1, TOR2, BMC,
    VLAN_GROUP_MAP, VENDOR_FIRMWARE_MAP,
    TOR_SWITCH_TYPES, BMC_HARDCODED_VLANS, BMC_RELEVANT_GROUPS,
    JUMBO_MTU, DEFAULT_OUTPUT_DIR,
    SWITCH_TEMPLATE, SVI_TEMPLATE, VLAN_TEMPLATE,
)
from src.utils import infer_firmware, classify_vlan_group
from src.loader import load_input_json, get_real_path
from src.convertors.convertors_bmc_switch_json import BMCSwitchConverter


# ── infer_firmware ────────────────────────────────────────────────────────

class TestInferFirmware:
    def test_cisco(self):
        assert infer_firmware("cisco") == "nxos"

    def test_dell(self):
        assert infer_firmware("dellemc") == "os10"

    def test_cisco_uppercase(self):
        assert infer_firmware("Cisco") == "nxos"

    def test_unknown_vendor_passthrough(self):
        assert infer_firmware("juniper") == "juniper"

    def test_empty_string(self):
        assert infer_firmware("") == ""

    def test_whitespace(self):
        assert infer_firmware("  cisco  ") == "nxos"


# ── classify_vlan_group ──────────────────────────────────────────────────

class TestClassifyVlanGroup:
    @pytest.mark.parametrize("group_name,expected", [
        ("HNVPA_Pool1", "C"),
        ("INFRA_Mgmt", "M"),
        ("TENANT_1", "C"),
        ("L3FORWARD_1", "C"),
        ("STORAGE_A", "S"),
        ("UNUSED_1", "UNUSED"),
        ("NATIVE_1", "NATIVE"),
    ])
    def test_known_groups(self, group_name, expected):
        assert classify_vlan_group(group_name) == expected

    def test_case_insensitive(self):
        assert classify_vlan_group("hnvpa_lower") == "C"

    def test_unknown_returns_none(self):
        assert classify_vlan_group("RANDOM_STUFF") is None

    def test_empty_returns_none(self):
        assert classify_vlan_group("") is None


# ── load_input_json ──────────────────────────────────────────────────────

class TestLoadInputJson:
    def test_valid_json(self, tmp_path):
        f = tmp_path / "valid.json"
        f.write_text('{"a": 1}', encoding="utf-8")
        assert load_input_json(f) == {"a": 1}

    def test_file_not_found(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_input_json(tmp_path / "nope.json")

    def test_invalid_json(self, tmp_path):
        f = tmp_path / "bad.json"
        f.write_text("{not json", encoding="utf-8")
        with pytest.raises(ValueError, match="Failed to parse JSON"):
            load_input_json(f)


# ── get_real_path ────────────────────────────────────────────────────────

class TestGetRealPath:
    def test_resolves_relative(self):
        result = get_real_path(Path("input"))
        assert result.is_absolute()

    def test_frozen_mode(self, monkeypatch):
        monkeypatch.setattr(sys, "frozen", True, raising=False)
        monkeypatch.setattr(sys, "_MEIPASS", "/fake/meipass", raising=False)
        result = get_real_path(Path("input/templates"))
        assert str(result) == "/fake/meipass/input/templates"


# ── constants sanity ─────────────────────────────────────────────────────

class TestConstants:
    def test_tor_switch_types(self):
        assert TOR_SWITCH_TYPES == [TOR1, TOR2]

    def test_vendor_firmware_map_complete(self):
        assert CISCO in VENDOR_FIRMWARE_MAP
        assert DELL in VENDOR_FIRMWARE_MAP

    def test_bmc_hardcoded_vlans_structure(self):
        assert len(BMC_HARDCODED_VLANS) >= 1
        for vlan in BMC_HARDCODED_VLANS:
            assert "vlan_id" in vlan
            assert "name" in vlan

    def test_templates_not_mutated(self):
        """Ensure template dicts haven't been accidentally modified."""
        assert SWITCH_TEMPLATE["make"] == ""
        assert SVI_TEMPLATE["ip"] == ""
        assert VLAN_TEMPLATE["vlan_id"] == 0


# ── BMC converter ────────────────────────────────────────────────────────

def _make_bmc_input(*, site="testsite", bmc_make="Cisco", bmc_model="9348GC-FXP",
                     bmc_hostname="test-bmc-1", bmc_firmware="10.4.5",
                     bmc_gateway="10.0.0.1", bmc_network="10.0.0.0", bmc_cidr=24,
                     bmc_vlan_id=125):
    """Helper to create a minimal lab input with BMC switch and supernets."""
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


class TestBMCSwitchInfo:
    def test_site_from_main_env_data(self, tmp_path):
        input_data = _make_bmc_input(site="lab42")
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        switch_data = input_data["InputData"]["Switches"][0]
        info = conv._build_switch_info(switch_data)
        assert info["site"] == "lab42"

    def test_site_empty_when_missing(self, tmp_path):
        input_data = _make_bmc_input()
        input_data["InputData"]["MainEnvData"] = []
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        switch_data = input_data["InputData"]["Switches"][0]
        info = conv._build_switch_info(switch_data)
        assert info["site"] == ""

    def test_firmware_inferred(self, tmp_path):
        input_data = _make_bmc_input(bmc_make="Cisco")
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        switch_data = input_data["InputData"]["Switches"][0]
        info = conv._build_switch_info(switch_data)
        assert info["firmware"] == "nxos"
        assert info["make"] == "cisco"

    def test_hostname_lowered(self, tmp_path):
        input_data = _make_bmc_input(bmc_hostname="TEST-BMC-Upper")
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        switch_data = input_data["InputData"]["Switches"][0]
        info = conv._build_switch_info(switch_data)
        assert info["hostname"] == "test-bmc-upper"


class TestBMCVlans:
    def test_hardcoded_vlans_always_present(self, tmp_path):
        input_data = _make_bmc_input()
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        vlans = conv._build_vlans()
        vlan_ids = {v["vlan_id"] for v in vlans}
        assert 2 in vlan_ids
        assert 99 in vlan_ids

    def test_bmc_vlan_from_supernet(self, tmp_path):
        input_data = _make_bmc_input(bmc_vlan_id=125)
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        vlans = conv._build_vlans()
        v125 = next((v for v in vlans if v["vlan_id"] == 125), None)
        assert v125 is not None
        assert v125["name"] == "BMC_Mgmt_125"

    def test_bmc_svi_populated(self, tmp_path):
        input_data = _make_bmc_input(bmc_gateway="10.0.0.1", bmc_network="10.0.0.0",
                                     bmc_cidr=24, bmc_vlan_id=125)
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        vlans = conv._build_vlans()
        v125 = next(v for v in vlans if v["vlan_id"] == 125)
        assert "interface" in v125
        assert v125["interface"]["cidr"] == 24
        assert v125["interface"]["mtu"] == JUMBO_MTU

    def test_vlans_sorted_by_id(self, tmp_path):
        input_data = _make_bmc_input()
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        vlans = conv._build_vlans()
        ids = [v["vlan_id"] for v in vlans]
        assert ids == sorted(ids)

    def test_hardcoded_vlans_not_mutated(self, tmp_path):
        """Calling _build_vlans should not modify BMC_HARDCODED_VLANS."""
        before = [dict(v) for v in BMC_HARDCODED_VLANS]
        input_data = _make_bmc_input()
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        conv._build_vlans()
        after = [dict(v) for v in BMC_HARDCODED_VLANS]
        assert before == after


class TestBMCPortChannels:
    def test_port_channels_from_template(self, tmp_path):
        template_data = {
            "interface_templates": {"common": [{"name": "test", "type": "Access"}]},
            "port_channels": [
                {"id": 102, "description": "TOR_BMC", "type": "Trunk",
                 "native_vlan": "99", "tagged_vlans": "125", "members": ["1/51", "1/52"]}
            ],
        }
        pcs = BMCSwitchConverter._build_port_channels(template_data)
        assert len(pcs) == 1
        assert pcs[0]["id"] == 102
        assert pcs[0]["members"] == ["1/51", "1/52"]

    def test_empty_when_no_port_channels(self, tmp_path):
        template_data = {"interface_templates": {"common": [{"name": "test"}]}}
        pcs = BMCSwitchConverter._build_port_channels(template_data)
        assert pcs == []

    def test_deep_copy_prevents_mutation(self, tmp_path):
        original = [{"id": 1, "members": ["1/1"]}]
        template_data = {"port_channels": original}
        pcs = BMCSwitchConverter._build_port_channels(template_data)
        pcs[0]["id"] = 999
        assert original[0]["id"] == 1


class TestBMCStaticRoutes:
    def test_default_route_from_bmc_gateway(self, tmp_path):
        input_data = _make_bmc_input(bmc_gateway="10.0.0.1")
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        routes = conv._build_static_routes()
        assert len(routes) == 1
        assert routes[0]["prefix"] == "0.0.0.0/0"
        assert routes[0]["next_hop"] == "10.0.0.1"

    def test_no_routes_without_bmc_supernet(self, tmp_path):
        input_data = _make_bmc_input()
        # Remove BMC supernet
        input_data["InputData"]["Supernets"] = [
            s for s in input_data["InputData"]["Supernets"]
            if not s.get("GroupName", "").upper().startswith("BMC")
        ]
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        routes = conv._build_static_routes()
        assert routes == []

    def test_no_routes_without_gateway(self, tmp_path):
        input_data = _make_bmc_input()
        # Remove gateway
        for s in input_data["InputData"]["Supernets"]:
            if s.get("GroupName", "").upper().startswith("BMC"):
                s["IPv4"]["Gateway"] = ""
        conv = BMCSwitchConverter(input_data, str(tmp_path))
        routes = conv._build_static_routes()
        assert routes == []


class TestBMCInterfaces:
    def test_interfaces_from_template(self, tmp_path):
        template_data = {
            "interface_templates": {
                "common": [
                    {"name": "Unused", "type": "Access", "access_vlan": "2"},
                    {"name": "Host_BMC", "type": "Access", "access_vlan": "125"},
                ]
            }
        }
        intfs = BMCSwitchConverter._build_interfaces(template_data)
        assert len(intfs) == 2
        assert intfs[0]["name"] == "Unused"
        assert intfs[1]["name"] == "Host_BMC"

    def test_raises_on_empty_common(self, tmp_path):
        template_data = {"interface_templates": {"common": []}}
        with pytest.raises(ValueError, match="No common interfaces"):
            BMCSwitchConverter._build_interfaces(template_data)
