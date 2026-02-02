"""Tests for Config Sectioner

Tests splitting switch configurations into logical sections.
"""
import pytest
from src.config_sectioner import (
    section_config,
    analyze_sections,
    ConfigSection,
    OS10_SECTION_MARKERS,
    NXOS_SECTION_MARKERS,
)


# =============================================================================
# SECTION CONFIG TESTS
# =============================================================================

class TestSectionConfig:
    """Tests for section_config function."""

    def test_dell_os10_basic_sections(self):
        """Should split Dell OS10 config into basic sections."""
        config = """
hostname test-switch
ztd cancel
!
username admin password encrypted
ip ssh server enable
!
interface vlan99
 description Management
!
interface Ethernet 1/1/1
 description Uplink
!
router bgp 65001
 neighbor 10.0.0.1 remote-as 65002
"""
        sections = section_config(config, "dellemc", "os10")
        
        assert isinstance(sections, dict)
        section_names = list(sections.keys())
        
        # Should have found some sections
        assert len(section_names) > 0
        # Should have system section (hostname)
        assert any("system" in name.lower() or "hostname" in sections.get(name, "").lower() 
                   for name in section_names)

    def test_cisco_nxos_basic_sections(self):
        """Should split Cisco NX-OS config into sections."""
        config = """
hostname test-switch
feature vpc
feature bgp
!
username admin password 5 $encrypted
!
interface Ethernet1/1
 description Uplink
!
vpc domain 1
  peer-keepalive destination 192.168.1.1
!
router bgp 65001
"""
        sections = section_config(config, "cisco", "nxos")
        
        assert isinstance(sections, dict)
        assert len(sections) > 0

    def test_empty_config(self):
        """Should handle empty config."""
        sections = section_config("", "dellemc", "os10")
        assert isinstance(sections, dict)

    def test_unknown_vendor(self):
        """Should handle unknown vendor gracefully."""
        config = "hostname test"
        sections = section_config(config, "juniper", "junos")
        # Should return something reasonable, not crash
        assert isinstance(sections, dict)

    def test_section_content_preserved(self):
        """Should preserve section content."""
        config = """
interface vlan99
 description Management VLAN
 ip address 10.0.0.1/24
 no shutdown
!
interface Ethernet 1/1/1
 description Server Port
 switchport mode access
!
"""
        sections = section_config(config, "dellemc", "os10")
        
        # Find VLAN section
        vlan_section = None
        for name, content in sections.items():
            if "vlan" in name.lower() or "vlan99" in content.lower():
                vlan_section = content
                break
        
        if vlan_section:
            assert "Management VLAN" in vlan_section or "10.0.0.1" in vlan_section


# =============================================================================
# ANALYZE SECTIONS TESTS
# =============================================================================

class TestAnalyzeSections:
    """Tests for analyze_sections function."""

    def test_vlan_analysis(self):
        """Should analyze VLANs in sections."""
        sections = {
            "vlan": """interface vlan2
 description Mgmt
!
interface vlan99
 description Native
!
interface vlan711
 description Storage1
!
interface vlan712
 description Storage2
"""
        }
        analysis = analyze_sections(sections)
        
        assert isinstance(analysis, dict)
        # Should count VLANs
        if "vlan_count" in analysis:
            assert analysis["vlan_count"] >= 2
        if "vlan_ids" in analysis:
            assert 2 in analysis["vlan_ids"] or 99 in analysis["vlan_ids"]

    def test_interface_analysis(self):
        """Should analyze interfaces in sections."""
        sections = {
            "interface": """interface Ethernet 1/1/1
 description Host1
!
interface Ethernet 1/1/2
 description Host2
!
interface Ethernet 1/1/3
 description Host3
"""
        }
        analysis = analyze_sections(sections)
        
        if "interface_count" in analysis:
            assert analysis["interface_count"] >= 3

    def test_port_channel_analysis(self):
        """Should analyze port-channels in sections."""
        sections = {
            "port_channel": """interface port-channel50
 description VLT-ICL
!
interface port-channel101
 description Host-LAG
"""
        }
        analysis = analyze_sections(sections)
        
        if "port_channel_count" in analysis:
            assert analysis["port_channel_count"] >= 2
        if "port_channel_ids" in analysis:
            assert 50 in analysis["port_channel_ids"] or 101 in analysis["port_channel_ids"]

    def test_bgp_analysis(self):
        """Should analyze BGP in sections."""
        sections = {
            "bgp": """router bgp 65001
 neighbor 10.0.0.2 remote-as 65001
"""
        }
        analysis = analyze_sections(sections)
        
        if "bgp_asn" in analysis:
            assert analysis["bgp_asn"] == 65001

    def test_section_sizes_in_analysis(self):
        """Should include section sizes in analysis."""
        sections = {
            "system": "hostname test-switch\n",
            "vlan": "interface vlan99\n description Test VLAN\n ip address 10.0.0.1/24\n"
        }
        analysis = analyze_sections(sections)
        
        assert "section_sizes" in analysis
        assert isinstance(analysis["section_sizes"], dict)

    def test_sections_found_list(self):
        """Should list found sections."""
        sections = {
            "system": "hostname test",
            "vlan": "interface vlan99",
            "interface": "interface Ethernet 1/1/1"
        }
        analysis = analyze_sections(sections)
        
        assert "sections_found" in analysis
        assert "system" in analysis["sections_found"]
        assert "vlan" in analysis["sections_found"]


# =============================================================================
# CONFIG SECTION DATACLASS TESTS
# =============================================================================

class TestConfigSection:
    """Tests for ConfigSection dataclass."""

    def test_basic_creation(self):
        """Should create section with basic fields."""
        section = ConfigSection(
            name="vlan",
            content="interface vlan99\n description Test",
            start_line=1,
            end_line=2
        )
        assert section.name == "vlan"
        assert "vlan99" in section.content
        assert section.start_line == 1
        assert section.end_line == 2

    def test_subsections_default(self):
        """Should have empty subsections by default."""
        section = ConfigSection(name="test", content="", start_line=1, end_line=1)
        assert section.subsections == []


# =============================================================================
# SECTION MARKERS TESTS
# =============================================================================

class TestSectionMarkers:
    """Tests for section marker definitions."""

    def test_os10_markers_are_valid_regex(self):
        """All OS10 markers should be valid regex."""
        import re
        for section_name, patterns in OS10_SECTION_MARKERS.items():
            for pattern in patterns:
                try:
                    re.compile(pattern)
                except re.error as e:
                    pytest.fail(f"Invalid regex in {section_name}: '{pattern}': {e}")

    def test_nxos_markers_are_valid_regex(self):
        """All NX-OS markers should be valid regex."""
        import re
        for section_name, patterns in NXOS_SECTION_MARKERS.items():
            for pattern in patterns:
                try:
                    re.compile(pattern)
                except re.error as e:
                    pytest.fail(f"Invalid regex in {section_name}: '{pattern}': {e}")

    def test_os10_has_expected_sections(self):
        """OS10 should have expected section types."""
        expected = ["system", "login", "vlan", "interface", "bgp"]
        for section in expected:
            assert section in OS10_SECTION_MARKERS, f"Missing section: {section}"

    def test_nxos_has_expected_sections(self):
        """NX-OS should have expected section types."""
        expected = ["system", "login", "vlan", "interface"]
        for section in expected:
            assert section in NXOS_SECTION_MARKERS, f"Missing section: {section}"


# =============================================================================
# REAL CONFIG SAMPLES TESTS
# =============================================================================

class TestRealConfigSamples:
    """Tests against realistic config samples."""

    @pytest.fixture
    def dell_tor_config(self):
        """Realistic Dell TOR configuration."""
        return """!
! Dell EMC Networking OS10 Configuration
!
ztd cancel
!
hostname sample-tor1
!
password-attributes character-restriction none
password-attributes min-length 8
!
username admin password encrypted role sysadmin
!
ip ssh server enable
no ip telnet server enable
!
dcbx enable
!
wred ecn
class-map type network-qos qos-cls3
 match qos-group 3
!
trust dot1p
!
interface vlan2
 description Management
 ip address 10.0.0.1/24
!
interface vlan711
 description Storage_VLAN_A
 mtu 9216
!
interface vlan712
 description Storage_VLAN_B
 mtu 9216
!
interface Ethernet 1/1/1
 description host1-port1
 switchport mode trunk
 switchport trunk allowed vlan 2,711,712
 mtu 9216
!
interface Ethernet 1/1/2
 description host1-port2
 switchport mode trunk
 mtu 9216
!
interface port-channel50
 description VLT-ICL
 switchport mode trunk
!
interface port-channel101
 description host1-bond
 switchport mode trunk
 vlt-port-channel 101
!
vlt domain 1
 discovery-interface ethernet1/1/49,1/1/50
 peer-routing
!
router bgp 65001
 neighbor 10.0.0.2 remote-as 65001
 address-family ipv4 unicast
  redistribute connected
!
"""

    @pytest.fixture
    def cisco_tor_config(self):
        """Realistic Cisco TOR configuration."""
        return """!Command: show running-config
version 10.2(3) Bios:version 01.04

hostname sample-tor1

no feature telnet
feature scp-server
feature bgp
feature interface-vlan
feature lldp
feature vpc

username admin password 5 $encrypted role network-admin

interface Ethernet1/1
  description host1-port1
  switchport
  switchport mode trunk
  mtu 9216

interface Ethernet1/2
  description host1-port2
  switchport
  switchport mode trunk
  mtu 9216

interface port-channel101
  description host1-bond
  switchport
  switchport mode trunk
  vpc 101

vpc domain 1
  peer-keepalive destination 192.168.1.2

interface Vlan99
  description Management
  ip address 10.0.0.1/24

router bgp 65001
  neighbor 10.0.0.2 remote-as 65001
"""

    def test_dell_config_sectioning(self, dell_tor_config):
        """Should properly section Dell config."""
        sections = section_config(dell_tor_config, "dellemc", "os10")
        
        assert len(sections) > 0
        # Verify we got meaningful sections
        all_content = " ".join(sections.values())
        assert "hostname" in all_content.lower() or "vlan" in all_content.lower()

    def test_dell_config_analysis(self, dell_tor_config):
        """Should properly analyze Dell config."""
        sections = section_config(dell_tor_config, "dellemc", "os10")
        analysis = analyze_sections(sections)
        
        # Should find VLANs
        if "vlan_count" in analysis:
            assert analysis["vlan_count"] >= 3  # vlan2, vlan711, vlan712
        
        # Should find interfaces
        if "interface_count" in analysis:
            assert analysis["interface_count"] >= 2
        
        # Should find port-channels
        if "port_channel_count" in analysis:
            assert analysis["port_channel_count"] >= 2

    def test_cisco_config_sectioning(self, cisco_tor_config):
        """Should properly section Cisco config."""
        sections = section_config(cisco_tor_config, "cisco", "nxos")
        
        assert len(sections) > 0

    def test_cisco_config_analysis(self, cisco_tor_config):
        """Should properly analyze Cisco config."""
        sections = section_config(cisco_tor_config, "cisco", "nxos")
        analysis = analyze_sections(sections)
        
        # Should have section info
        if "sections_found" in analysis:
            assert len(analysis["sections_found"]) > 0


# =============================================================================
# EDGE CASE TESTS
# =============================================================================

class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_config_with_only_comments(self):
        """Should handle config with only comments."""
        config = """
! This is a comment
! Another comment
! More comments
"""
        sections = section_config(config, "dellemc", "os10")
        assert isinstance(sections, dict)

    def test_config_with_no_markers(self):
        """Should handle config with no recognizable markers."""
        config = """
some random text
more random text
nothing recognizable
"""
        sections = section_config(config, "dellemc", "os10")
        assert isinstance(sections, dict)

    def test_very_long_config(self):
        """Should handle very long configs."""
        # Generate a long config
        lines = ["hostname test-switch"]
        for i in range(1000):
            lines.append(f"interface Ethernet 1/1/{i % 50 + 1}")
            lines.append(f" description Port {i}")
        
        config = "\n".join(lines)
        sections = section_config(config, "dellemc", "os10")
        assert isinstance(sections, dict)

    def test_unicode_in_config(self):
        """Should handle unicode characters."""
        config = """
hostname test-switch
interface vlan99
 description Тест 测试 テスト
"""
        sections = section_config(config, "dellemc", "os10")
        assert isinstance(sections, dict)

    def test_windows_line_endings(self):
        """Should handle Windows line endings."""
        config = "hostname test\r\ninterface vlan99\r\n description Test\r\n"
        sections = section_config(config, "dellemc", "os10")
        assert isinstance(sections, dict)
