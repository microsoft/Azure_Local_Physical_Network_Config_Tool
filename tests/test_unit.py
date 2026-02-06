"""Unit tests for src/constants.py, src/utils.py, and src/loader.py."""

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
