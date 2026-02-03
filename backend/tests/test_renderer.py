"""Tests for Template Renderer

Comprehensive tests for Dell OS10 and Cisco NX-OS template rendering.
Validates:
- Config generation for both vendors
- All 3 deployment patterns
- Guard conditions (has_qos_interfaces, has_static_routes, has_bgp, has_mlag)
- Output contains expected sections
"""
import json
import pytest
from pathlib import Path
from src.renderer import Renderer
from src.context import ContextBuilder
from src.validator import StandardValidator


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def renderer():
    """Create a renderer instance"""
    return Renderer()


@pytest.fixture
def context_builder():
    """Create a context builder instance"""
    return ContextBuilder()


@pytest.fixture
def validator():
    """Create a validator instance"""
    return StandardValidator()


def build_context(config):
    """Helper to build context from config"""
    builder = ContextBuilder()
    return builder.build_context(config)


@pytest.fixture
def dell_fully_converged_config():
    """Load Dell OS10 fully-converged example"""
    config_path = Path(__file__).parent.parent.parent / "frontend" / "examples" / "fully-converged" / "sample-tor1.json"
    with open(config_path, 'r') as f:
        return json.load(f)


@pytest.fixture
def dell_switchless_config():
    """Load Dell OS10 switchless example"""
    config_path = Path(__file__).parent.parent.parent / "frontend" / "examples" / "switchless" / "sample-tor1.json"
    with open(config_path, 'r') as f:
        return json.load(f)


@pytest.fixture
def cisco_fully_converged_config():
    """Load Cisco NX-OS fully-converged fixture"""
    config_path = Path(__file__).parent / "fixtures" / "cisco-nxos" / "sample-tor1.json"
    with open(config_path, 'r') as f:
        return json.load(f)


@pytest.fixture
def cisco_switchless_config():
    """Load Cisco NX-OS switchless fixture"""
    config_path = Path(__file__).parent / "fixtures" / "cisco-nxos" / "sample-switchless.json"
    with open(config_path, 'r') as f:
        return json.load(f)


# ============================================================================
# RENDERER INITIALIZATION TESTS
# ============================================================================

def test_renderer_initialization(renderer):
    """Test renderer initializes correctly"""
    assert renderer is not None
    assert renderer.template_dir.exists()
    assert renderer.env is not None


def test_renderer_get_main_template_dell(renderer):
    """Test getting Dell OS10 template path"""
    template_path = renderer.get_main_template("dellemc", "os10")
    assert template_path == "dellemc/os10/full_config.j2"


def test_renderer_get_main_template_cisco(renderer):
    """Test getting Cisco NX-OS template path"""
    template_path = renderer.get_main_template("cisco", "nxos")
    assert template_path == "cisco/nxos/full_config.j2"


def test_renderer_invalid_vendor_raises(renderer):
    """Test that invalid vendor raises ValueError"""
    with pytest.raises(ValueError, match="No template found"):
        renderer.get_main_template("invalid", "os10")


# ============================================================================
# DELL OS10 GENERATION TESTS
# ============================================================================

class TestDellOS10Generation:
    """Test Dell OS10 config generation"""
    
    def test_fully_converged_generates_config(self, renderer, dell_fully_converged_config):
        """Test fully-converged pattern generates valid config"""
        context = build_context(dell_fully_converged_config)
        template_path = renderer.get_main_template("dellemc", "os10")
        
        output = renderer.render_template(template_path, context)
        
        assert output is not None
        assert len(output) > 0
        assert "hostname sample-tor1" in output
    
    def test_fully_converged_has_vlan_section(self, renderer, dell_fully_converged_config):
        """Test fully-converged config has VLAN section"""
        context = build_context(dell_fully_converged_config)
        template_path = renderer.get_main_template("dellemc", "os10")
        
        output = renderer.render_template(template_path, context)
        
        # Check for VLAN config (Dell OS10 format)
        assert "interface vlan7" in output or "vlan 7" in output.lower()
        assert "vlan 201" in output.lower() or "interface vlan201" in output
    
    def test_fully_converged_has_bgp_section(self, renderer, dell_fully_converged_config):
        """Test fully-converged config has BGP section"""
        context = build_context(dell_fully_converged_config)
        template_path = renderer.get_main_template("dellemc", "os10")
        
        output = renderer.render_template(template_path, context)
        
        # Check for BGP config (actual content, not header)
        assert "router bgp 65001" in output
        assert "neighbor 198.51.100.5" in output
    
    def test_fully_converged_has_mlag_section(self, renderer, dell_fully_converged_config):
        """Test fully-converged config has MLAG/VLT section"""
        context = build_context(dell_fully_converged_config)
        template_path = renderer.get_main_template("dellemc", "os10")
        
        output = renderer.render_template(template_path, context)
        
        # Dell uses VLT (Virtual Link Trunking)
        assert "vlt domain" in output.lower()
    
    def test_fully_converged_has_qos_section(self, renderer, dell_fully_converged_config):
        """Test fully-converged config has QoS section when interface has qos:true"""
        context = build_context(dell_fully_converged_config)
        template_path = renderer.get_main_template("dellemc", "os10")
        
        output = renderer.render_template(template_path, context)
        
        # QoS should render because Host_Trunk has qos: true
        assert "QOS CONFIGURATION" in output
        assert "policy-map" in output.lower() or "dcb" in output.lower()
    
    def test_switchless_no_bgp(self, renderer, dell_switchless_config):
        """Test switchless pattern has no BGP section"""
        context = build_context(dell_switchless_config)
        template_path = renderer.get_main_template("dellemc", "os10")
        
        output = renderer.render_template(template_path, context)
        
        # Switchless should NOT have BGP
        assert "router bgp" not in output.lower()
    
    def test_switchless_has_static_routes(self, renderer, dell_switchless_config):
        """Test switchless pattern has static routes"""
        context = build_context(dell_switchless_config)
        template_path = renderer.get_main_template("dellemc", "os10")
        
        output = renderer.render_template(template_path, context)
        
        # Switchless should have static routes
        assert "STATIC ROUTE" in output
        assert "ip route 0.0.0.0/0" in output
    
    def test_switchless_no_mlag(self, renderer, dell_switchless_config):
        """Test switchless pattern has no MLAG/VLT section"""
        context = build_context(dell_switchless_config)
        template_path = renderer.get_main_template("dellemc", "os10")
        
        output = renderer.render_template(template_path, context)
        
        # Switchless should NOT have VLT domain
        assert "vlt-domain" not in output.lower()
    
    def test_has_login_section(self, renderer, dell_fully_converged_config):
        """Test config has login section with credential placeholder"""
        context = build_context(dell_fully_converged_config)
        template_path = renderer.get_main_template("dellemc", "os10")
        
        output = renderer.render_template(template_path, context)
        
        assert "LOGIN CONFIGURATION" in output
        assert "$CREDENTIAL_PLACEHOLDER$" in output


# ============================================================================
# CISCO NX-OS GENERATION TESTS
# ============================================================================

class TestCiscoNXOSGeneration:
    """Test Cisco NX-OS config generation"""
    
    def test_fully_converged_generates_config(self, renderer, cisco_fully_converged_config):
        """Test fully-converged pattern generates valid config"""
        context = build_context(cisco_fully_converged_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        assert output is not None
        assert len(output) > 0
        assert "hostname cisco-tor1" in output
    
    def test_fully_converged_has_feature_section(self, renderer, cisco_fully_converged_config):
        """Test NX-OS config enables required features"""
        context = build_context(cisco_fully_converged_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        assert "feature vpc" in output
        assert "feature bgp" in output
        assert "feature lacp" in output
    
    def test_fully_converged_has_vlan_section(self, renderer, cisco_fully_converged_config):
        """Test NX-OS config has VLAN section"""
        context = build_context(cisco_fully_converged_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        assert "VLAN CONFIGURATION" in output
        assert "vlan 7" in output
        assert "interface Vlan7" in output
    
    def test_fully_converged_has_hsrp(self, renderer, cisco_fully_converged_config):
        """Test NX-OS config has HSRP for redundancy"""
        context = build_context(cisco_fully_converged_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        # Cisco uses HSRP for gateway redundancy
        assert "hsrp" in output.lower()
    
    def test_fully_converged_has_vpc_section(self, renderer, cisco_fully_converged_config):
        """Test NX-OS config has vPC section"""
        context = build_context(cisco_fully_converged_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        assert "VPC CONFIGURATION" in output
        assert "vpc domain 1" in output
        assert "peer-keepalive" in output
    
    def test_fully_converged_has_bgp_section(self, renderer, cisco_fully_converged_config):
        """Test NX-OS config has BGP section"""
        context = build_context(cisco_fully_converged_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        assert "BGP CONFIGURATION" in output
        assert "router bgp 65001" in output
        assert "neighbor 198.51.100.5" in output
    
    def test_fully_converged_has_qos_section(self, renderer, cisco_fully_converged_config):
        """Test NX-OS config has QoS section when interface has qos:true"""
        context = build_context(cisco_fully_converged_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        # QoS should render because Host_Trunk has qos: true
        assert "QOS CONFIGURATION" in output
        assert "policy-map type network-qos" in output
        assert "pause pfc-cos 3" in output
    
    def test_switchless_no_bgp(self, renderer, cisco_switchless_config):
        """Test switchless pattern has no BGP section"""
        context = build_context(cisco_switchless_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        # Switchless should NOT have BGP
        assert "router bgp" not in output.lower()
    
    def test_switchless_has_static_routes(self, renderer, cisco_switchless_config):
        """Test switchless pattern has static routes"""
        context = build_context(cisco_switchless_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        # Switchless should have static routes
        assert "STATIC ROUTE" in output
        assert "ip route 0.0.0.0/0 192.0.2.1" in output
    
    def test_switchless_no_vpc(self, renderer, cisco_switchless_config):
        """Test switchless pattern has no vPC section"""
        context = build_context(cisco_switchless_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        # Switchless should NOT have vPC domain
        assert "vpc domain" not in output.lower()
    
    def test_switchless_no_qos(self, renderer, cisco_switchless_config):
        """Test switchless pattern without qos interfaces has no QoS section"""
        context = build_context(cisco_switchless_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        # Switchless fixture has no qos: true interfaces
        assert "QOS CONFIGURATION" not in output
    
    def test_has_login_section(self, renderer, cisco_fully_converged_config):
        """Test NX-OS config has login section with credential placeholder"""
        context = build_context(cisco_fully_converged_config)
        template_path = renderer.get_main_template("cisco", "nxos")
        
        output = renderer.render_template(template_path, context)
        
        assert "LOGIN CONFIGURATION" in output
        assert "$CREDENTIAL_PLACEHOLDER$" in output


# ============================================================================
# CROSS-VENDOR PARITY TESTS
# ============================================================================

class TestCrossVendorParity:
    """Test that Dell and Cisco generate equivalent logical configs"""
    
    def test_both_vendors_have_same_vlans(self, renderer, dell_fully_converged_config, cisco_fully_converged_config):
        """Test both vendors generate configs with same VLANs"""
        dell_context = build_context(dell_fully_converged_config)
        cisco_context = build_context(cisco_fully_converged_config)
        
        dell_output = renderer.render_template(
            renderer.get_main_template("dellemc", "os10"),
            dell_context
        )
        cisco_output = renderer.render_template(
            renderer.get_main_template("cisco", "nxos"),
            cisco_context
        )
        
        # Both should have the same VLANs
        for vlan_id in ["7", "201", "711", "712", "99"]:
            assert f"vlan {vlan_id}" in dell_output.lower() or f"vlan{vlan_id}" in dell_output.lower()
            assert f"vlan {vlan_id}" in cisco_output.lower()
    
    def test_both_vendors_have_bgp_neighbors(self, renderer, dell_fully_converged_config, cisco_fully_converged_config):
        """Test both vendors generate configs with same BGP neighbors"""
        dell_context = build_context(dell_fully_converged_config)
        cisco_context = build_context(cisco_fully_converged_config)
        
        dell_output = renderer.render_template(
            renderer.get_main_template("dellemc", "os10"),
            dell_context
        )
        cisco_output = renderer.render_template(
            renderer.get_main_template("cisco", "nxos"),
            cisco_context
        )
        
        # Both should have the same BGP neighbors
        assert "198.51.100.5" in dell_output
        assert "198.51.100.5" in cisco_output
        assert "198.51.100.9" in dell_output
        assert "198.51.100.9" in cisco_output


# ============================================================================
# GUARD CONDITION TESTS
# ============================================================================

class TestGuardConditions:
    """Test that has_* guards work correctly"""
    
    def test_qos_guard_with_qos_interface(self, renderer, cisco_fully_converged_config):
        """Test QoS renders when interface has qos: true"""
        context = build_context(cisco_fully_converged_config)
        
        # Verify context has qos flag
        assert context.get("has_qos_interfaces") is True
        
        output = renderer.render_template(
            renderer.get_main_template("cisco", "nxos"),
            context
        )
        
        assert "QOS CONFIGURATION" in output
    
    def test_qos_guard_without_qos_interface(self, renderer, cisco_switchless_config):
        """Test QoS does NOT render when no interface has qos: true"""
        context = build_context(cisco_switchless_config)
        
        # Verify context has no qos flag
        assert context.get("has_qos_interfaces") is False
        
        output = renderer.render_template(
            renderer.get_main_template("cisco", "nxos"),
            context
        )
        
        assert "QOS CONFIGURATION" not in output
    
    def test_static_routes_guard_with_routes(self, renderer, cisco_switchless_config):
        """Test static routes render when routes exist"""
        context = build_context(cisco_switchless_config)
        
        # Verify context has static routes flag
        assert context.get("has_static_routes") is True
        
        output = renderer.render_template(
            renderer.get_main_template("cisco", "nxos"),
            context
        )
        
        assert "STATIC ROUTE" in output
    
    def test_static_routes_guard_without_routes(self, renderer, cisco_fully_converged_config):
        """Test static routes do NOT render when no routes exist"""
        context = build_context(cisco_fully_converged_config)
        
        # Verify context has no static routes flag
        assert context.get("has_static_routes") is False
        
        output = renderer.render_template(
            renderer.get_main_template("cisco", "nxos"),
            context
        )
        
        assert "STATIC ROUTE" not in output
    
    def test_bgp_guard_with_bgp(self, renderer, cisco_fully_converged_config):
        """Test BGP renders when BGP config exists"""
        context = build_context(cisco_fully_converged_config)
        
        assert context.get("has_bgp") is True
        
        output = renderer.render_template(
            renderer.get_main_template("cisco", "nxos"),
            context
        )
        
        assert "BGP CONFIGURATION" in output
    
    def test_bgp_guard_without_bgp(self, renderer, cisco_switchless_config):
        """Test BGP does NOT render when no BGP config"""
        context = build_context(cisco_switchless_config)
        
        assert context.get("has_bgp") is False
        
        output = renderer.render_template(
            renderer.get_main_template("cisco", "nxos"),
            context
        )
        
        assert "BGP CONFIGURATION" not in output
    
    def test_mlag_guard_with_mlag(self, renderer, cisco_fully_converged_config):
        """Test MLAG/vPC renders when mlag config exists"""
        context = build_context(cisco_fully_converged_config)
        
        assert context.get("has_mlag") is True
        
        output = renderer.render_template(
            renderer.get_main_template("cisco", "nxos"),
            context
        )
        
        assert "VPC CONFIGURATION" in output
    
    def test_mlag_guard_without_mlag(self, renderer, cisco_switchless_config):
        """Test MLAG/vPC does NOT render when no mlag config"""
        context = build_context(cisco_switchless_config)
        
        assert context.get("has_mlag") is False
        
        output = renderer.render_template(
            renderer.get_main_template("cisco", "nxos"),
            context
        )
        
        assert "VPC CONFIGURATION" not in output


# ============================================================================
# VALIDATION INTEGRATION TESTS
# ============================================================================

class TestValidationIntegration:
    """Test that fixtures pass schema validation"""
    
    def test_dell_fixture_validates(self, validator, dell_fully_converged_config):
        """Test Dell fixture passes schema validation"""
        result = validator.validate(dell_fully_converged_config)
        assert result.is_valid, f"Validation failed: {result.errors}"
    
    def test_cisco_fully_converged_fixture_validates(self, validator, cisco_fully_converged_config):
        """Test Cisco fully-converged fixture passes schema validation"""
        result = validator.validate(cisco_fully_converged_config)
        assert result.is_valid, f"Validation failed: {result.errors}"
    
    def test_cisco_switchless_fixture_validates(self, validator, cisco_switchless_config):
        """Test Cisco switchless fixture passes schema validation"""
        result = validator.validate(cisco_switchless_config)
        assert result.is_valid, f"Validation failed: {result.errors}"
