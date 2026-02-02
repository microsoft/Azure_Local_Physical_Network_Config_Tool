#!/usr/bin/env python3
"""
Metadata Validator for Lab Submissions

User-friendly validation with auto-correction for common mistakes.
Network engineers can self-fix issues by reading clear log messages.

Design Principles:
- No blockers: Validation guides, never blocks processing
- Auto-fix obvious mistakes: Case, whitespace, common typos
- New vendors welcome: Unknown vendor = contribution opportunity
- Self-service debugging: Detailed logs let users fix issues themselves
"""

import re
from dataclasses import dataclass, field
from datetime import datetime
from difflib import get_close_matches
from typing import Dict, List, Optional, Tuple


# =============================================================================
# KNOWN VALUES AND VARIATIONS
# =============================================================================

# Known vendors with common variations/typos
VENDOR_VARIATIONS: Dict[str, List[str]] = {
    "dellemc": [
        "dell emc", "dell-emc", "dell_emc", "dellemc", "dell",
        "delltech", "dell technologies", "dell tech",
        "emc", "dell/emc", "dell & emc",
        # Common typos
        "dellemc", "dellmc", "dellem", "delemc", "del emc",
    ],
    "cisco": [
        "cisco", "cisco systems", "cisco-systems", "cisco_systems",
        # Common typos
        "csco", "cisc", "ciscco", "cisoc",
    ],
}

# Known firmware with common variations/typos
FIRMWARE_VARIATIONS: Dict[str, List[str]] = {
    "nxos": [
        "nxos", "nx-os", "nx os", "nexus", "nexus-os", "nexus os",
        "cisco nxos", "cisco nx-os",
        # Common typos
        "nxox", "nxso", "nox",
    ],
    "os10": [
        "os10", "os-10", "os 10", "dnos10", "dnos-10", "dn-os10",
        "dell os10", "dellemc os10", "smartfabric os10",
        # Common typos
        "os1o", "o10", "os01",
    ],
}

# Valid roles (Azure Local concept - strict matching)
ROLE_VARIATIONS: Dict[str, List[str]] = {
    "TOR1": ["tor1", "tor-1", "tor 1", "top-of-rack-1", "torofrack1", "switch1", "sw1"],
    "TOR2": ["tor2", "tor-2", "tor 2", "top-of-rack-2", "torofrack2", "switch2", "sw2"],
    "BMC": ["bmc", "bmc-switch", "bmc switch", "baseboard", "management", "mgmt", "oob"],
}

# Valid deployment patterns (Azure Local concept - strict matching)
PATTERN_VARIATIONS: Dict[str, List[str]] = {
    "fully_converged": [
        "fully_converged", "fully-converged", "fullyconverged", "converged",
        "full-converged", "full_converged", "fc",
    ],
    "switched": [
        "switched", "switch", "switched-mode", "switched_mode",
    ],
    "switchless": [
        "switchless", "switch-less", "switch_less", "storage-only", 
        "storage_only", "no-switch", "direct",
    ],
}

# Known vendor-firmware pairs
VENDOR_FIRMWARE_PAIRS: Dict[str, str] = {
    "cisco": "nxos",
    "dellemc": "os10",
}


# =============================================================================
# VALIDATION RESULT CLASSES
# =============================================================================

@dataclass
class FieldResult:
    """Result of validating a single field."""
    field_name: str
    original_value: str
    normalized_value: Optional[str] = None
    status: str = "valid"  # valid, auto_fixed, warning, needs_attention, new_value
    message: str = ""
    suggestions: List[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    """Complete validation result for a submission."""
    submission_name: str
    is_valid: bool = True
    field_results: List[FieldResult] = field(default_factory=list)
    is_new_vendor: bool = False
    new_vendor_name: Optional[str] = None
    log_lines: List[str] = field(default_factory=list)
    
    def get_corrected_metadata(self, original: Dict) -> Dict:
        """Return metadata with auto-corrections applied."""
        corrected = original.copy()
        for fr in self.field_results:
            if fr.normalized_value is not None:
                corrected[fr.field_name] = fr.normalized_value
        return corrected


# =============================================================================
# CORE VALIDATION FUNCTIONS
# =============================================================================

def normalize_string(value: str) -> str:
    """Normalize a string for comparison: lowercase, strip, collapse spaces."""
    if not value:
        return ""
    return re.sub(r'\s+', ' ', str(value).lower().strip())


def find_match(value: str, variations: Dict[str, List[str]], threshold: float = 0.6) -> Tuple[Optional[str], float, str]:
    """
    Find the best match for a value against known variations.
    
    Returns:
        (canonical_value, confidence, match_type)
        - canonical_value: The standard value to use (e.g., 'dellemc')
        - confidence: 0.0 to 1.0
        - match_type: 'exact', 'variation', 'fuzzy', 'none'
    """
    if not value:
        return None, 0.0, "none"
    
    normalized = normalize_string(value)
    
    # Check for exact match with canonical value
    for canonical, variations_list in variations.items():
        if normalized == canonical.lower():
            return canonical, 1.0, "exact"
    
    # Check for known variation match
    for canonical, variations_list in variations.items():
        normalized_variations = [normalize_string(v) for v in variations_list]
        if normalized in normalized_variations:
            return canonical, 0.95, "variation"
    
    # Try fuzzy matching against all variations
    all_variations = []
    variation_to_canonical = {}
    for canonical, variations_list in variations.items():
        all_variations.append(canonical.lower())
        variation_to_canonical[canonical.lower()] = canonical
        for v in variations_list:
            nv = normalize_string(v)
            all_variations.append(nv)
            variation_to_canonical[nv] = canonical
    
    matches = get_close_matches(normalized, all_variations, n=1, cutoff=threshold)
    if matches:
        canonical = variation_to_canonical[matches[0]]
        # Calculate rough confidence based on string similarity
        confidence = 0.7 + (0.25 * (1 - abs(len(normalized) - len(matches[0])) / max(len(normalized), len(matches[0]))))
        return canonical, min(confidence, 0.9), "fuzzy"
    
    return None, 0.0, "none"


def validate_vendor(value: str) -> FieldResult:
    """Validate and normalize vendor field."""
    result = FieldResult(field_name="vendor", original_value=value)
    
    if not value:
        result.status = "needs_attention"
        result.message = "Missing vendor. Please add 'vendor' to metadata.yaml"
        result.suggestions = list(VENDOR_VARIATIONS.keys())
        return result
    
    canonical, confidence, match_type = find_match(value, VENDOR_VARIATIONS)
    
    if match_type == "exact":
        result.status = "valid"
        result.normalized_value = canonical
        result.message = f"✅ vendor: {canonical}"
    elif match_type in ("variation", "fuzzy"):
        result.status = "auto_fixed"
        result.normalized_value = canonical
        result.message = f"✅ Auto-fixed to '{canonical}' (matched known variation)"
    else:
        # Unknown vendor - this is a new vendor contribution!
        result.status = "new_value"
        result.normalized_value = normalize_string(value).replace(" ", "").replace("-", "")
        result.message = f"🎉 New vendor detected: '{value}'"
    
    return result


def validate_firmware(value: str, vendor: Optional[str] = None, is_new_vendor: bool = False) -> FieldResult:
    """Validate and normalize firmware field."""
    result = FieldResult(field_name="firmware", original_value=value)
    
    if not value:
        result.status = "needs_attention"
        result.message = "Missing firmware. Please add 'firmware' to metadata.yaml"
        result.suggestions = list(FIRMWARE_VARIATIONS.keys())
        return result
    
    # For new vendors, accept any firmware value as-is
    if is_new_vendor:
        normalized = normalize_string(value).replace(" ", "").replace("-", "")
        result.status = "new_value"
        result.normalized_value = normalized
        result.message = f"ℹ️  firmware: {normalized} (new vendor, accepted as-is)"
        return result
    
    canonical, confidence, match_type = find_match(value, FIRMWARE_VARIATIONS)
    
    if match_type == "exact":
        result.status = "valid"
        result.normalized_value = canonical
        result.message = f"✅ firmware: {canonical}"
    elif match_type in ("variation", "fuzzy"):
        result.status = "auto_fixed"
        result.normalized_value = canonical
        result.message = f"✅ Auto-fixed to '{canonical}' (matched known variation)"
    else:
        # Unknown firmware - accept for new vendor scenarios
        result.status = "new_value"
        result.normalized_value = normalize_string(value).replace(" ", "").replace("-", "")
        result.message = f"ℹ️  New firmware: '{value}' (will be used as-is)"
    
    return result


def validate_role(value: str) -> FieldResult:
    """Validate and normalize role field (Azure Local concept - strict)."""
    result = FieldResult(field_name="role", original_value=value)
    
    if not value:
        result.status = "needs_attention"
        result.message = "Missing role. Please add 'role' to metadata.yaml"
        result.suggestions = list(ROLE_VARIATIONS.keys())
        return result
    
    canonical, confidence, match_type = find_match(value, ROLE_VARIATIONS, threshold=0.5)
    
    if match_type == "exact":
        result.status = "valid"
        result.normalized_value = canonical
        result.message = f"✅ role: {canonical}"
    elif match_type in ("variation", "fuzzy"):
        result.status = "auto_fixed"
        result.normalized_value = canonical
        result.message = f"✅ Auto-fixed to '{canonical}' (case normalized)"
    else:
        result.status = "needs_attention"
        result.message = f"❓ Unknown role: '{value}'"
        result.suggestions = [
            "Azure Local uses these roles:",
            "  TOR1 = First Top-of-Rack switch",
            "  TOR2 = Second Top-of-Rack switch (MLAG pair)",
            "  BMC  = Baseboard Management Controller switch",
            "Please update metadata.yaml with one of: TOR1, TOR2, BMC",
        ]
    
    return result


def validate_deployment_pattern(value: str) -> FieldResult:
    """Validate and normalize deployment_pattern field (Azure Local concept - strict)."""
    result = FieldResult(field_name="deployment_pattern", original_value=value)
    
    if not value:
        result.status = "needs_attention"
        result.message = "Missing deployment_pattern. Please add to metadata.yaml"
        result.suggestions = list(PATTERN_VARIATIONS.keys())
        return result
    
    canonical, confidence, match_type = find_match(value, PATTERN_VARIATIONS, threshold=0.5)
    
    if match_type == "exact":
        result.status = "valid"
        result.normalized_value = canonical
        result.message = f"✅ deployment_pattern: {canonical}"
    elif match_type in ("variation", "fuzzy"):
        result.status = "auto_fixed"
        result.normalized_value = canonical
        result.message = f"✅ Auto-fixed to '{canonical}' (matched known variation)"
    else:
        result.status = "needs_attention"
        result.message = f"❓ Unknown deployment_pattern: '{value}'"
        result.suggestions = [
            "Azure Local deployment patterns:",
            "  fully_converged = Compute + Storage on same network",
            "  switched        = Separate storage network with switches",
            "  switchless      = Direct-attached storage (no switch)",
            "Please update metadata.yaml with one of: fully_converged, switched, switchless",
        ]
    
    return result


def validate_hostname(value: str) -> FieldResult:
    """Validate hostname field (flexible, just format check)."""
    result = FieldResult(field_name="hostname", original_value=value)
    
    if not value:
        result.status = "needs_attention"
        result.message = "Missing hostname. Please add 'hostname' to metadata.yaml"
        return result
    
    # Normalize: strip whitespace, replace spaces with dashes
    normalized = str(value).strip()
    if ' ' in normalized:
        normalized = normalized.replace(' ', '-')
        result.status = "auto_fixed"
        result.normalized_value = normalized
        result.message = f"✅ Auto-fixed hostname: spaces replaced with dashes"
    elif not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9._-]*$', normalized):
        result.status = "warning"
        result.normalized_value = normalized
        result.message = f"⚠️  hostname: '{normalized}' contains unusual characters (proceeding anyway)"
    else:
        result.status = "valid"
        result.normalized_value = normalized
        result.message = f"✅ hostname: {normalized}"
    
    return result


def check_vendor_firmware_pair(vendor: str, firmware: str) -> Optional[str]:
    """Check if vendor-firmware pair makes sense."""
    if not vendor or not firmware:
        return None
    
    expected_firmware = VENDOR_FIRMWARE_PAIRS.get(vendor)
    if expected_firmware and firmware != expected_firmware:
        return (
            f"⚠️  Unusual combination: '{firmware}' is typically used with "
            f"'{next(k for k, v in VENDOR_FIRMWARE_PAIRS.items() if v == firmware)}', "
            f"not '{vendor}'. Is this correct?"
        )
    
    return None


# =============================================================================
# MAIN VALIDATION FUNCTION
# =============================================================================

def validate_metadata(metadata: Dict, submission_name: str = "submission") -> ValidationResult:
    """
    Validate submission metadata with auto-correction and detailed logging.
    
    Args:
        metadata: Dictionary from metadata.yaml
        submission_name: Name of submission folder (for logging)
    
    Returns:
        ValidationResult with all field results and log lines
    """
    result = ValidationResult(submission_name=submission_name)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Start logging
    result.log_lines.append(f"[{timestamp}] Processing: {submission_name}")
    result.log_lines.append(f"[{timestamp}] ├─ Reading metadata.yaml")
    result.log_lines.append(f"[{timestamp}] ├─ Validating fields...")
    
    # Validate each field
    vendor_result = validate_vendor(metadata.get("vendor", ""))
    result.field_results.append(vendor_result)
    
    # Check for new vendor BEFORE validating firmware
    is_new_vendor = vendor_result.status == "new_value"
    if is_new_vendor:
        result.is_new_vendor = True
        result.new_vendor_name = vendor_result.normalized_value
    
    firmware_result = validate_firmware(
        metadata.get("firmware", ""),
        vendor_result.normalized_value,
        is_new_vendor=is_new_vendor  # Pass new vendor flag
    )
    result.field_results.append(firmware_result)
    
    role_result = validate_role(metadata.get("role", ""))
    result.field_results.append(role_result)
    
    pattern_result = validate_deployment_pattern(metadata.get("deployment_pattern", ""))
    result.field_results.append(pattern_result)
    
    hostname_result = validate_hostname(metadata.get("hostname", ""))
    result.field_results.append(hostname_result)
    
    # Build log output for each field
    auto_fixed_count = 0
    needs_attention_count = 0
    
    for fr in result.field_results:
        if fr.status == "valid":
            result.log_lines.append(f"[{timestamp}] │  {fr.message}")
        elif fr.status == "auto_fixed":
            auto_fixed_count += 1
            result.log_lines.append(f"[{timestamp}] │  ⚠️  {fr.field_name}: '{fr.original_value}'")
            result.log_lines.append(f"[{timestamp}] │     └─ {fr.message}")
        elif fr.status == "new_value":
            result.log_lines.append(f"[{timestamp}] │  {fr.message}")
        elif fr.status == "warning":
            result.log_lines.append(f"[{timestamp}] │  {fr.message}")
        elif fr.status == "needs_attention":
            needs_attention_count += 1
            result.log_lines.append(f"[{timestamp}] │  {fr.message}")
            for suggestion in fr.suggestions:
                result.log_lines.append(f"[{timestamp}] │     └─ {suggestion}")
    
    # Cross-validation: vendor-firmware pair
    if vendor_result.normalized_value and firmware_result.normalized_value:
        pair_warning = check_vendor_firmware_pair(
            vendor_result.normalized_value,
            firmware_result.normalized_value
        )
        if pair_warning:
            result.log_lines.append(f"[{timestamp}] │  {pair_warning}")
    
    # Summary
    if auto_fixed_count > 0:
        result.log_lines.append(f"[{timestamp}] ├─ {auto_fixed_count} field(s) auto-corrected")
    
    if needs_attention_count > 0:
        result.log_lines.append(f"[{timestamp}] ├─ {needs_attention_count} field(s) need attention (see above)")
        result.log_lines.append(f"[{timestamp}] └─ Processing continues, but output may be incomplete")
        result.is_valid = False
    else:
        result.log_lines.append(f"[{timestamp}] └─ Continuing to config analysis...")
    
    return result


def print_new_vendor_guidance(vendor_name: str) -> List[str]:
    """Generate guidance lines for new vendor contribution."""
    return [
        "",
        "┌─────────────────────────────────────────────────────────────┐",
        f"│  🎉 NEW VENDOR DETECTED: {vendor_name:<34} │",
        "├─────────────────────────────────────────────────────────────┤",
        "│  This vendor isn't in our templates yet — that's OK!        │",
        "│  Your submission helps us add support for new vendors.      │",
        "│                                                             │",
        "│  What happens next:                                         │",
        "│  1. We'll analyze your config to understand the syntax      │",
        "│  2. A maintainer will create templates for this vendor      │",
        "│  3. Your config becomes a test case for the new templates   │",
        "│                                                             │",
        "│  Continuing with validation of other fields...              │",
        "└─────────────────────────────────────────────────────────────┘",
        "",
    ]


# =============================================================================
# CLI INTERFACE (for standalone testing)
# =============================================================================

if __name__ == "__main__":
    import argparse
    import yaml
    from pathlib import Path
    
    parser = argparse.ArgumentParser(description="Validate submission metadata")
    parser.add_argument("submission_path", type=Path, help="Path to submission folder")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()
    
    metadata_path = args.submission_path / "metadata.yaml"
    if not metadata_path.exists():
        print(f"Error: {metadata_path} not found")
        exit(1)
    
    with open(metadata_path) as f:
        metadata = yaml.safe_load(f)
    
    result = validate_metadata(metadata, args.submission_path.name)
    
    # Print new vendor guidance if applicable
    if result.is_new_vendor:
        for line in print_new_vendor_guidance(result.new_vendor_name):
            print(line)
    
    # Print validation log
    for line in result.log_lines:
        print(line)
    
    # Print corrected values if any auto-fixes
    if args.verbose:
        corrected = result.get_corrected_metadata(metadata)
        if corrected != metadata:
            print("\nCorrected metadata:")
            print(yaml.dump(corrected, default_flow_style=False))
