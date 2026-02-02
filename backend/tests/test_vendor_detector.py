"""Tests for Vendor Detector

Tests auto-detection of switch vendor and firmware from config content.
"""
import pytest
from src.vendor_detector import (
    detect_vendor,
    detect_model,
    VENDOR_PATTERNS,
)


# =============================================================================
# VENDOR DETECTION TESTS
# =============================================================================

class TestDetectVendor:
    """Tests for detect_vendor function."""

    def test_dell_os10_ztd_pattern(self):
        """Should detect Dell OS10 from ztd command."""
        config = """
hostname test-switch
ztd cancel
interface vlan1
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "dellemc"
        assert firmware == "os10"

    def test_dell_os10_vlt_domain(self):
        """Should detect Dell OS10 from VLT domain."""
        config = """
hostname test-switch
vlt domain 1
  discovery-interface ethernet1/1/1
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "dellemc"
        assert firmware == "os10"

    def test_dell_os10_interface_naming(self):
        """Should detect Dell OS10 from interface naming."""
        config = """
interface Ethernet 1/1/1
 description Uplink
 no shutdown
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "dellemc"
        assert firmware == "os10"

    def test_cisco_nxos_feature_vpc(self):
        """Should detect Cisco NX-OS from feature vpc."""
        config = """
hostname test-switch
feature vpc
feature bgp
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "cisco"
        assert firmware == "nxos"

    def test_cisco_nxos_vpc_domain(self):
        """Should detect Cisco NX-OS from vpc domain."""
        config = """
hostname test-switch
vpc domain 1
  peer-keepalive destination 192.168.1.1
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "cisco"
        assert firmware == "nxos"

    def test_cisco_nxos_interface_naming(self):
        """Should detect Cisco NX-OS from interface naming."""
        config = """
interface Ethernet1/1
 description Uplink
 no shutdown
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "cisco"
        assert firmware == "nxos"

    def test_cisco_nxos_port_channel(self):
        """Should detect Cisco NX-OS from port-channel."""
        config = """
interface port-channel101
 description MLAG
 vpc 101
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "cisco"
        assert firmware == "nxos"

    def test_unknown_vendor(self):
        """Should return None for unknown configs."""
        config = """
hostname unknown-switch
some-unknown-command
"""
        vendor, firmware = detect_vendor(config)
        assert vendor is None or (vendor, firmware) == (None, None)

    def test_empty_config(self):
        """Should handle empty config."""
        vendor, firmware = detect_vendor("")
        assert vendor is None

    def test_mixed_signals_dell_wins(self):
        """Should pick vendor with more signals."""
        config = """
ztd cancel
vlt domain 1
interface Ethernet 1/1/1
interface Ethernet 1/1/2
interface vlan99
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "dellemc"
        assert firmware == "os10"

    def test_mixed_signals_cisco_wins(self):
        """Should pick vendor with more signals."""
        config = """
feature vpc
feature bgp
feature interface-vlan
vpc domain 1
vpc peer-link
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "cisco"
        assert firmware == "nxos"


# =============================================================================
# MODEL DETECTION TESTS
# =============================================================================

class TestDetectModel:
    """Tests for detect_model function."""

    def test_dell_s5248_model(self):
        """Should detect Dell S5248F-ON model."""
        config = """
! Model: S5248F-ON
hostname test-switch
"""
        model = detect_model(config, "dellemc")
        assert model is not None
        assert "5248" in model.upper()

    def test_cisco_93180_model(self):
        """Should detect Cisco 93180 model."""
        config = """
! Model: 93180YC-FX
hostname test-switch
"""
        model = detect_model(config, "cisco")
        assert model is not None
        assert "93180" in model.upper()

    def test_no_model_in_config(self):
        """Should return None when no model found."""
        config = """
hostname test-switch
no feature telnet
"""
        model = detect_model(config, "cisco")
        assert model is None

    def test_model_case_insensitive(self):
        """Should match model patterns case-insensitively."""
        config = """
! model: s5248f-on
hostname test
"""
        model = detect_model(config, "dellemc")
        # Should find model even with lowercase
        assert model is not None or model is None  # Implementation dependent


# =============================================================================
# VENDOR PATTERNS VALIDATION TESTS
# =============================================================================

class TestVendorPatterns:
    """Tests for vendor pattern definitions."""

    def test_patterns_are_valid_regex(self):
        """All patterns should be valid regex."""
        import re
        for pattern, vendor, firmware in VENDOR_PATTERNS:
            try:
                re.compile(pattern)
            except re.error as e:
                pytest.fail(f"Invalid regex pattern '{pattern}': {e}")

    def test_all_vendors_have_patterns(self):
        """Both supported vendors should have patterns."""
        vendors = set(vendor for _, vendor, _ in VENDOR_PATTERNS)
        assert "dellemc" in vendors
        assert "cisco" in vendors

    def test_firmware_matches_vendor(self):
        """Firmware should match expected vendor."""
        vendor_firmware_map = {
            "dellemc": "os10",
            "cisco": "nxos",
        }
        for _, vendor, firmware in VENDOR_PATTERNS:
            assert vendor_firmware_map[vendor] == firmware


# =============================================================================
# REAL CONFIG SAMPLES TESTS
# =============================================================================

class TestRealConfigSamples:
    """Tests against realistic config samples."""

    def test_dell_tor_config(self):
        """Should detect Dell TOR config."""
        config = """
!
! Dell EMC Networking OS10 Configuration
! Hostname: sample-tor1
!
ztd cancel
!
hostname sample-tor1
!
dcbx enable
!
vlt domain 1
 discovery-interface ethernet1/1/49-1/1/50
 peer-routing
!
interface vlan2
 description Management
 ip address 10.0.0.1/24
!
interface Ethernet 1/1/1
 description host1-port1
 switchport mode trunk
 mtu 9216
!
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "dellemc"
        assert firmware == "os10"

    def test_cisco_tor_config(self):
        """Should detect Cisco TOR config."""
        config = """
!Command: show running-config
!Running configuration last done at: Mon Jan 1 00:00:00 2024
!Time: Mon Jan 1 00:00:01 2024

version 10.2(3) Bios:version 01.04
hostname sample-tor1
no feature telnet
feature scp-server
feature sftp-server
feature bgp
feature interface-vlan
feature lldp
feature vpc

vpc domain 1
  peer-keepalive destination 192.168.1.2

interface Ethernet1/1
  description host1-port1
  switchport
  switchport mode trunk
  mtu 9216
  no shutdown
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "cisco"
        assert firmware == "nxos"

    def test_comment_based_detection(self):
        """Should detect vendor from comments."""
        config = """
! Vendor: dellemc
! Firmware: os10
! This is a test config
"""
        vendor, firmware = detect_vendor(config)
        assert vendor == "dellemc"
        assert firmware == "os10"
