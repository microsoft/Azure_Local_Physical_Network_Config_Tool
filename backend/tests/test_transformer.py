"""Tests for Transformer"""
import pytest
from src.transformer import Transformer


@pytest.fixture
def transformer():
    """Create a transformer instance"""
    return Transformer()


@pytest.fixture
def base_config():
    """Base configuration for testing"""
    return {
        "switch": {
            "vendor": "dellemc",
            "model": "s5248f-on",
            "hostname": "test-switch",
            "role": "TOR1",
            "firmware": "os10"
        }
    }


def test_transformer_initialization(transformer):
    """Test transformer initializes correctly"""
    assert transformer is not None
    assert hasattr(transformer, 'ROLE_DEFAULTS')


def test_transform_tor1(transformer, base_config):
    """Test transformation adds correct computed values for TOR1"""
    result = transformer.transform(base_config)
    
    assert "_computed" in result
    assert result["_computed"]["hsrp_priority"] == 150
    assert result["_computed"]["mlag_role_priority"] == 1
    assert result["_computed"]["mst_priority"] == 8192


def test_transform_tor2(transformer, base_config):
    """Test transformation adds correct computed values for TOR2"""
    base_config["switch"]["role"] = "TOR2"
    result = transformer.transform(base_config)
    
    assert "_computed" in result
    assert result["_computed"]["hsrp_priority"] == 100
    assert result["_computed"]["mlag_role_priority"] == 32667
    assert result["_computed"]["mst_priority"] == 16384


def test_transform_bmc(transformer, base_config):
    """Test transformation adds correct computed values for BMC"""
    base_config["switch"]["role"] = "BMC"
    result = transformer.transform(base_config)
    
    assert "_computed" in result
    assert result["_computed"]["hsrp_priority"] is None
    assert result["_computed"]["mlag_role_priority"] is None
    assert result["_computed"]["mst_priority"] == 32768


def test_transform_preserves_original(transformer, base_config):
    """Test transformation does not modify original config"""
    original_keys = set(base_config.keys())
    result = transformer.transform(base_config)
    
    # Original should not have _computed
    assert "_computed" not in base_config
    # Result should have all original keys plus _computed
    assert all(key in result for key in original_keys)


def test_normalize_legacy_make_field(transformer):
    """Test normalization of 'make' to 'vendor'"""
    config = {
        "switch": {
            "make": "dellemc",  # Legacy field
            "model": "s5248f-on",
            "hostname": "test-switch",
            "role": "TOR1",
            "firmware": "os10"
        }
    }
    
    result = transformer.transform(config)
    
    assert "vendor" in result["switch"]
    assert result["switch"]["vendor"] == "dellemc"
    assert "make" not in result["switch"]


def test_normalize_legacy_os_field(transformer):
    """Test normalization of 'os' to 'firmware'"""
    config = {
        "switch": {
            "vendor": "dellemc",
            "model": "s5248f-on",
            "hostname": "test-switch",
            "role": "TOR1",
            "os": "os10"  # Legacy field
        }
    }
    
    result = transformer.transform(config)
    
    assert "firmware" in result["switch"]
    assert result["switch"]["firmware"] == "os10"
    assert "os" not in result["switch"]


def test_normalize_prefers_new_fields(transformer):
    """Test normalization prefers new field names if both present"""
    config = {
        "switch": {
            "make": "old_vendor",
            "vendor": "dellemc",  # Should take precedence
            "model": "s5248f-on",
            "hostname": "test-switch",
            "role": "TOR1",
            "os": "old_os",
            "firmware": "os10"  # Should take precedence
        }
    }
    
    result = transformer.transform(config)
    
    assert result["switch"]["vendor"] == "dellemc"
    assert result["switch"]["firmware"] == "os10"
    assert "make" not in result["switch"]
    assert "os" not in result["switch"]


def test_transform_with_complex_config(transformer):
    """Test transformation with a more complex config"""
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
        "bgp": {
            "asn": 65000,
            "router_id": "1.1.1.1",
            "neighbors": []
        }
    }
    
    result = transformer.transform(config)
    
    # Check that all sections are preserved
    assert "vlans" in result
    assert "bgp" in result
    assert "_computed" in result
    
    # Check computed values
    assert result["_computed"]["hsrp_priority"] == 150


def test_transform_unknown_role(transformer, base_config):
    """Test transformation with unknown role doesn't add computed values"""
    base_config["switch"]["role"] = "UNKNOWN"
    result = transformer.transform(base_config)
    
    # Should not add _computed for unknown role
    assert "_computed" not in result
