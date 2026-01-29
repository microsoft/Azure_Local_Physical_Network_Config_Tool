"""Tests for StandardValidator"""
import json
import pytest
from pathlib import Path
from src.validator import StandardValidator, ValidationResult


@pytest.fixture
def validator():
    """Create a validator instance"""
    return StandardValidator()


@pytest.fixture
def valid_config():
    """Load a valid example config"""
    config_path = Path(__file__).parent.parent.parent / "frontend" / "examples" / "dell-tor1.json"
    with open(config_path, 'r') as f:
        return json.load(f)


@pytest.fixture
def minimal_valid_config():
    """Create a minimal valid configuration"""
    return {
        "switch": {
            "vendor": "dellemc",
            "model": "s5248f-on",
            "hostname": "test-switch",
            "role": "TOR1",
            "firmware": "os10"
        }
    }


def test_validator_initialization(validator):
    """Test validator initializes correctly"""
    assert validator.schema is not None
    assert validator.validator is not None


def test_validate_valid_config(validator, valid_config):
    """Test validation of a valid configuration"""
    result = validator.validate(valid_config)
    
    # Print errors if validation failed (for debugging)
    if not result.is_valid:
        print("\nValidation errors:")
        for error in result.errors:
            print(f"  {error}")
    
    assert result.is_valid, f"Expected valid config to pass validation"


def test_validate_minimal_config(validator, minimal_valid_config):
    """Test validation of minimal valid configuration"""
    result = validator.validate(minimal_valid_config)
    assert result.is_valid


def test_validate_missing_required_field(validator):
    """Test validation fails when required field is missing"""
    config = {
        "switch": {
            "vendor": "dellemc",
            "model": "s5248f-on",
            # Missing hostname, role, firmware
        }
    }
    
    result = validator.validate(config)
    assert not result.is_valid
    assert len(result.errors) > 0


def test_validate_invalid_vendor(validator, minimal_valid_config):
    """Test validation fails with invalid vendor"""
    config = minimal_valid_config.copy()
    config["switch"]["vendor"] = "invalid_vendor"
    
    result = validator.validate(config)
    assert not result.is_valid


def test_validate_invalid_role(validator, minimal_valid_config):
    """Test validation fails with invalid role"""
    config = minimal_valid_config.copy()
    config["switch"]["role"] = "INVALID_ROLE"
    
    result = validator.validate(config)
    assert not result.is_valid


def test_vlan_cross_reference(validator):
    """Test VLAN cross-reference validation"""
    config = {
        "switch": {
            "vendor": "dellemc",
            "model": "s5248f-on",
            "hostname": "test-switch",
            "role": "TOR1",
            "firmware": "os10"
        },
        "vlans": [
            {"vlan_id": 10, "name": "test_vlan"}
        ],
        "interfaces": [
            {
                "name": "test_interface",
                "type": "Access",
                "intf_type": "Ethernet",
                "intf": "1/1/1",
                "access_vlan": "999"  # Non-existent VLAN
            }
        ]
    }
    
    result = validator.validate(config)
    assert not result.is_valid
    # Check that error is about cross-reference
    assert any("999" in str(err) for err in result.errors)


def test_port_channel_member_validation(validator):
    """Test port-channel must have members"""
    config = {
        "switch": {
            "vendor": "dellemc",
            "model": "s5248f-on",
            "hostname": "test-switch",
            "role": "TOR1",
            "firmware": "os10"
        },
        "port_channels": [
            {
                "id": 1,
                "description": "test_pc",
                "type": "Trunk",
                "native_vlan": "1",
                "members": []  # Empty members
            }
        ]
    }
    
    result = validator.validate(config)
    assert not result.is_valid


def test_bgp_prefix_list_reference(validator):
    """Test BGP prefix list cross-reference validation"""
    config = {
        "switch": {
            "vendor": "dellemc",
            "model": "s5248f-on",
            "hostname": "test-switch",
            "role": "TOR1",
            "firmware": "os10"
        },
        "bgp": {
            "asn": 65000,
            "router_id": "1.1.1.1",
            "neighbors": [
                {
                    "ip": "10.0.0.1",
                    "description": "test_neighbor",
                    "remote_as": 65001,
                    "af_ipv4_unicast": {
                        "prefix_list_in": "NonExistentList"
                    }
                }
            ]
        }
    }
    
    result = validator.validate(config)
    assert not result.is_valid
    assert any("NonExistentList" in str(err) for err in result.errors)


def test_validation_result_to_dict():
    """Test ValidationResult error dict conversion"""
    result = ValidationResult()
    result.add_error("test.path", "test message", "test_type")
    
    error_dict = result.errors[0].to_dict()
    assert error_dict["path"] == "test.path"
    assert error_dict["message"] == "test message"
    assert error_dict["type"] == "test_type"
