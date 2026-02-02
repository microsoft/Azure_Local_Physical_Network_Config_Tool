"""Tests for Metadata Validator

Tests auto-correction, new vendor detection, and validation logic.
"""
import pytest
from src.metadata_validator import (
    normalize_string,
    find_match,
    validate_vendor,
    validate_firmware,
    validate_role,
    validate_deployment_pattern,
    validate_metadata,
    VENDOR_VARIATIONS,
    FIRMWARE_VARIATIONS,
    ROLE_VARIATIONS,
    PATTERN_VARIATIONS,
    FieldResult,
    ValidationResult,
)


# =============================================================================
# STRING NORMALIZATION TESTS
# =============================================================================

class TestNormalizeString:
    """Tests for normalize_string function."""

    def test_lowercase_conversion(self):
        """Should convert to lowercase."""
        assert normalize_string("DELLEMC") == "dellemc"
        assert normalize_string("Cisco") == "cisco"

    def test_strip_whitespace(self):
        """Should strip leading/trailing whitespace."""
        assert normalize_string("  dellemc  ") == "dellemc"
        assert normalize_string("\tCisco\n") == "cisco"

    def test_collapse_multiple_spaces(self):
        """Should collapse multiple spaces to single space."""
        assert normalize_string("dell   emc") == "dell emc"
        assert normalize_string("nx  -  os") == "nx - os"

    def test_empty_string(self):
        """Should handle empty strings."""
        assert normalize_string("") == ""
        assert normalize_string(None) == ""

    def test_combined_normalization(self):
        """Should apply all normalizations together."""
        assert normalize_string("  DELL   EMC  ") == "dell emc"


# =============================================================================
# FIND MATCH TESTS
# =============================================================================

class TestFindMatch:
    """Tests for find_match function."""

    def test_exact_match(self):
        """Should find exact canonical matches."""
        canonical, confidence, match_type = find_match("dellemc", VENDOR_VARIATIONS)
        assert canonical == "dellemc"
        assert confidence == 1.0
        assert match_type == "exact"

    def test_variation_match(self):
        """Should match known variations."""
        canonical, confidence, match_type = find_match("Dell EMC", VENDOR_VARIATIONS)
        assert canonical == "dellemc"
        assert confidence == 0.95
        assert match_type == "variation"

    def test_fuzzy_match(self):
        """Should fuzzy match close typos."""
        canonical, confidence, match_type = find_match("dellmc", VENDOR_VARIATIONS)
        assert canonical == "dellemc"
        assert match_type in ("variation", "fuzzy")
        assert confidence > 0.5

    def test_no_match(self):
        """Should return None for unknown values."""
        canonical, confidence, match_type = find_match("juniper", VENDOR_VARIATIONS)
        assert canonical is None
        assert confidence == 0.0
        assert match_type == "none"

    def test_empty_value(self):
        """Should handle empty input."""
        canonical, confidence, match_type = find_match("", VENDOR_VARIATIONS)
        assert canonical is None
        assert match_type == "none"


# =============================================================================
# VENDOR VALIDATION TESTS
# =============================================================================

class TestValidateVendor:
    """Tests for validate_vendor function."""

    def test_valid_vendor(self):
        """Should accept known vendors."""
        result = validate_vendor("dellemc")
        assert result.status == "valid"
        assert result.normalized_value == "dellemc"

    def test_vendor_with_spaces(self):
        """Should auto-fix vendor with spaces."""
        result = validate_vendor("dell emc")
        assert result.status == "auto_fixed"
        assert result.normalized_value == "dellemc"

    def test_vendor_case_insensitive(self):
        """Should handle any case."""
        result = validate_vendor("CISCO")
        assert result.normalized_value == "cisco"

    def test_vendor_typo(self):
        """Should fix common typos."""
        result = validate_vendor("dellmc")
        assert result.normalized_value == "dellemc"
        assert result.status in ("auto_fixed", "valid")

    def test_new_vendor(self):
        """Should flag unknown vendors as new."""
        result = validate_vendor("arista")
        assert result.status == "new_value"
        assert "new vendor" in result.message.lower() or "unknown" in result.message.lower()

    def test_missing_vendor(self):
        """Should flag missing vendor."""
        result = validate_vendor("")
        assert result.status == "needs_attention"
        assert len(result.suggestions) > 0


# =============================================================================
# FIRMWARE VALIDATION TESTS
# =============================================================================

class TestValidateFirmware:
    """Tests for validate_firmware function."""

    def test_valid_firmware(self):
        """Should accept known firmware."""
        result = validate_firmware("os10")
        assert result.status == "valid"
        assert result.normalized_value == "os10"

    def test_firmware_with_hyphen(self):
        """Should normalize firmware with hyphens."""
        result = validate_firmware("nx-os")
        assert result.normalized_value == "nxos"

    def test_firmware_variations(self):
        """Should handle common variations."""
        variations = ["OS10", "os-10", "OS 10", "dnos10"]
        for v in variations:
            result = validate_firmware(v)
            assert result.normalized_value == "os10", f"Failed for: {v}"

    def test_nxos_variations(self):
        """Should handle NX-OS variations."""
        variations = ["nxos", "NXOS", "nx-os", "NX-OS", "nexus"]
        for v in variations:
            result = validate_firmware(v)
            assert result.normalized_value == "nxos", f"Failed for: {v}"


# =============================================================================
# ROLE VALIDATION TESTS
# =============================================================================

class TestValidateRole:
    """Tests for validate_role function."""

    def test_valid_roles(self):
        """Should accept valid Azure Local roles."""
        for role in ["TOR1", "TOR2", "BMC"]:
            result = validate_role(role)
            assert result.normalized_value == role
            assert result.status == "valid"

    def test_role_variations(self):
        """Should normalize role variations."""
        result = validate_role("tor-1")
        assert result.normalized_value == "TOR1"

        result = validate_role("bmc-switch")
        assert result.normalized_value == "BMC"

    def test_invalid_role(self):
        """Should handle invalid roles (may fuzzy-match or warn)."""
        result = validate_role("core")
        # The validator may fuzzy-match to a similar role or flag as warning
        # Either behavior is acceptable for typo handling
        assert result.status in ("warning", "needs_attention", "auto_fixed")

    def test_role_case_insensitive(self):
        """Should handle any case."""
        result = validate_role("tor1")
        assert result.normalized_value == "TOR1"


# =============================================================================
# DEPLOYMENT PATTERN VALIDATION TESTS
# =============================================================================

class TestValidateDeploymentPattern:
    """Tests for validate_deployment_pattern function."""

    def test_valid_patterns(self):
        """Should accept valid Azure Local patterns."""
        patterns = ["fully_converged", "switched", "switchless"]
        for p in patterns:
            result = validate_deployment_pattern(p)
            assert result.normalized_value == p
            assert result.status == "valid"

    def test_pattern_variations(self):
        """Should normalize pattern variations."""
        result = validate_deployment_pattern("fully-converged")
        assert result.normalized_value == "fully_converged"

        result = validate_deployment_pattern("fc")
        assert result.normalized_value == "fully_converged"

    def test_invalid_pattern(self):
        """Should reject invalid patterns."""
        result = validate_deployment_pattern("hybrid")
        assert result.status in ("warning", "needs_attention")


# =============================================================================
# FULL METADATA VALIDATION TESTS
# =============================================================================

class TestValidateMetadata:
    """Tests for validate_metadata function."""

    @pytest.fixture
    def valid_metadata(self):
        """Valid metadata for testing."""
        return {
            "vendor": "dellemc",
            "firmware": "os10",
            "role": "TOR1",
            "deployment_pattern": "fully_converged",
            "hostname": "test-switch"
        }

    def test_valid_metadata(self, valid_metadata):
        """Should pass for valid metadata."""
        result = validate_metadata(valid_metadata, "test-submission")
        assert result.is_valid

    def test_metadata_with_auto_fixes(self):
        """Should auto-fix and still pass validation."""
        metadata = {
            "vendor": "dell emc",  # Will be auto-fixed
            "firmware": "os-10",   # Will be auto-fixed
            "role": "tor-1",       # Will be auto-fixed
            "deployment_pattern": "fully-converged",  # Will be auto-fixed
            "hostname": "test-switch"
        }
        result = validate_metadata(metadata, "test-submission")
        assert result.is_valid

        corrected = result.get_corrected_metadata(metadata)
        assert corrected["vendor"] == "dellemc"
        assert corrected["firmware"] == "os10"
        assert corrected["role"] == "TOR1"
        assert corrected["deployment_pattern"] == "fully_converged"

    def test_new_vendor_detection(self):
        """Should detect new vendor contributions."""
        metadata = {
            "vendor": "arista",  # New vendor
            "firmware": "eos",
            "role": "TOR1",
            "deployment_pattern": "fully_converged",
            "hostname": "test-switch"
        }
        result = validate_metadata(metadata, "new-vendor-test")
        assert result.is_new_vendor or any(
            "new" in fr.message.lower() for fr in result.field_results
        )

    def test_log_output(self):
        """Should generate log lines for debugging."""
        metadata = {
            "vendor": "dellemc",
            "firmware": "os10",
            "role": "TOR1",
            "deployment_pattern": "fully_converged"
        }
        result = validate_metadata(metadata, "log-test")
        assert len(result.log_lines) > 0


# =============================================================================
# FIELD RESULT TESTS
# =============================================================================

class TestFieldResult:
    """Tests for FieldResult dataclass."""

    def test_default_values(self):
        """Should have sensible defaults."""
        result = FieldResult(field_name="test", original_value="value")
        assert result.status == "valid"
        assert result.message == ""
        assert result.suggestions == []

    def test_normalized_value(self):
        """Should track normalized value separately."""
        result = FieldResult(
            field_name="vendor",
            original_value="Dell EMC",
            normalized_value="dellemc",
            status="auto_fixed"
        )
        assert result.original_value == "Dell EMC"
        assert result.normalized_value == "dellemc"


# =============================================================================
# VALIDATION RESULT TESTS
# =============================================================================

class TestValidationResult:
    """Tests for ValidationResult dataclass."""

    def test_get_corrected_metadata(self):
        """Should apply corrections to metadata."""
        result = ValidationResult(
            submission_name="test",
            field_results=[
                FieldResult("vendor", "dell emc", "dellemc", "auto_fixed"),
                FieldResult("firmware", "os10", "os10", "valid"),
            ]
        )
        
        original = {"vendor": "dell emc", "firmware": "os10", "extra": "value"}
        corrected = result.get_corrected_metadata(original)
        
        assert corrected["vendor"] == "dellemc"
        assert corrected["firmware"] == "os10"
        assert corrected["extra"] == "value"
