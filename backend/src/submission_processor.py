#!/usr/bin/env python3
"""
Submission Processor

Orchestrates the full submission processing workflow:
1. Load metadata and config
2. Validate metadata (auto-fix typos, welcome new vendors)
3. Detect vendor from config content
4. Section config into logical parts
5. Analyze and output results

This module is designed to be used by:
- Lab CLI (lab/scripts/process.py)
- GitHub Actions workflow
- Direct Python imports
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, List, Optional

import yaml

from .metadata_validator import (
    validate_metadata,
    print_new_vendor_guidance,
    ValidationResult,
)
from .vendor_detector import detect_all
from .config_sectioner import section_config, analyze_sections


@dataclass
class ProcessingResult:
    """Result of processing a submission."""
    success: bool = False
    submission: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    detected: Dict[str, Any] = field(default_factory=dict)
    sections: List[str] = field(default_factory=list)
    analysis: Dict[str, Any] = field(default_factory=dict)
    validation_result: Optional[ValidationResult] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    output_dir: Optional[str] = None


def load_metadata(submission_dir: Path) -> Dict[str, Any]:
    """Load metadata.yaml from submission directory."""
    metadata_file = submission_dir / 'metadata.yaml'
    
    if not metadata_file.exists():
        return {}
    
    try:
        with open(metadata_file, 'r') as f:
            return yaml.safe_load(f) or {}
    except yaml.YAMLError:
        # Invalid YAML - return empty dict and let caller handle
        return {}


def load_config(submission_dir: Path) -> str:
    """Load config.txt from submission directory."""
    config_file = submission_dir / 'config.txt'
    
    if not config_file.exists():
        raise FileNotFoundError(f"Config file not found: {config_file}")
    
    with open(config_file, 'r') as f:
        return f.read()


def merge_metadata(
    user_metadata: Dict, 
    detected: Dict, 
    validated: Dict
) -> Dict[str, Any]:
    """
    Merge user-provided metadata with auto-detected and validated values.
    
    Priority (highest to lowest):
    1. Validated/normalized values (from smart validator)
    2. User-provided values (from metadata.yaml)
    3. Auto-detected values (from config content)
    """
    result = {**detected}
    
    # User-provided values override detected ones
    for key in ['vendor', 'firmware', 'model', 'hostname', 'role', 'deployment_pattern']:
        if key in user_metadata and user_metadata[key]:
            result[key] = user_metadata[key]
    
    # Validated values override everything (these are normalized/corrected)
    for key in ['vendor', 'firmware', 'role', 'deployment_pattern', 'hostname']:
        if key in validated and validated[key]:
            result[key] = validated[key]
    
    # Copy additional user metadata
    for key in ['os_version', 'description']:
        if key in user_metadata:
            result[key] = user_metadata[key]
    
    return result


def process_submission(
    submission_dir: Path, 
    output_dir: Optional[Path] = None,
    verbose: bool = False
) -> ProcessingResult:
    """
    Process a submission folder.
    
    Args:
        submission_dir: Path to submission folder (contains metadata.yaml, config.txt)
        output_dir: Path to output folder (optional)
        verbose: Whether to print detailed logs
        
    Returns:
        ProcessingResult with all processing data
    """
    result = ProcessingResult(submission=str(submission_dir))
    
    # ========================================
    # PHASE 1: Load Files
    # ========================================
    try:
        config_text = load_config(submission_dir)
        user_metadata = load_metadata(submission_dir)
    except FileNotFoundError as e:
        result.errors.append(str(e))
        return result
    
    # ========================================
    # PHASE 2: Smart Validation with Auto-Fix
    # ========================================
    validation_result = validate_metadata(user_metadata, submission_dir.name)
    result.validation_result = validation_result
    
    # Print validation logs if verbose
    if verbose:
        if validation_result.is_new_vendor:
            for line in print_new_vendor_guidance(validation_result.new_vendor_name):
                print(line)
        for line in validation_result.log_lines:
            print(line)
    
    # Get corrected metadata from validator
    corrected_metadata = validation_result.get_corrected_metadata(user_metadata)
    
    # Track auto-fixes as warnings
    for fr in validation_result.field_results:
        if fr.status == "auto_fixed":
            result.warnings.append(
                f"Auto-fixed {fr.field_name}: '{fr.original_value}' → '{fr.normalized_value}'"
            )
        elif fr.status == "needs_attention":
            result.warnings.append(f"Needs attention: {fr.field_name} - {fr.message}")
    
    # ========================================
    # PHASE 3: Auto-Detect from Config
    # ========================================
    detected = detect_all(config_text)
    result.detected = detected
    
    # Cross-validate: does detected vendor match metadata?
    if detected.get('vendor') and corrected_metadata.get('vendor'):
        if detected['vendor'] != corrected_metadata['vendor']:
            warning = (
                f"Config syntax looks like '{detected['vendor']}' "
                f"but metadata says '{corrected_metadata['vendor']}'. Please verify."
            )
            result.warnings.append(warning)
            if verbose:
                print(f"\n⚠️  {warning}\n")
    
    # ========================================
    # PHASE 4: Merge Metadata
    # ========================================
    metadata = merge_metadata(user_metadata, detected, corrected_metadata)
    result.metadata = metadata
    
    # Check if we have enough to continue
    required_for_processing = ['vendor', 'firmware']
    missing = [f for f in required_for_processing if not metadata.get(f)]
    
    if missing and not validation_result.is_new_vendor:
        result.errors.append(
            f"Cannot determine: {', '.join(missing)}. Please provide in metadata.yaml"
        )
        return result
    
    # ========================================
    # PHASE 5: Section the Config
    # ========================================
    vendor = metadata.get('vendor', 'unknown')
    firmware = metadata.get('firmware', 'unknown')
    
    sections = section_config(config_text, vendor, firmware)
    analysis = analyze_sections(sections)
    result.sections = list(sections.keys())
    result.analysis = analysis
    
    # ========================================
    # PHASE 6: Save Outputs (if output_dir provided)
    # ========================================
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Save sections
        sections_dir = output_dir / 'sections'
        sections_dir.mkdir(exist_ok=True)
        for name, content in sections.items():
            section_file = sections_dir / f'{name}.txt'
            with open(section_file, 'w') as f:
                f.write(content)
        
        # Save analysis
        analysis_file = output_dir / 'analysis.json'
        with open(analysis_file, 'w') as f:
            json.dump({
                'metadata': metadata,
                'sections': list(sections.keys()),
                'analysis': analysis,
                'validation': {
                    'is_new_vendor': validation_result.is_new_vendor,
                    'new_vendor_name': validation_result.new_vendor_name,
                    'auto_fixes': [
                        {
                            'field': fr.field_name, 
                            'from': fr.original_value, 
                            'to': fr.normalized_value
                        }
                        for fr in validation_result.field_results
                        if fr.status == "auto_fixed"
                    ],
                },
                'warnings': result.warnings,
            }, f, indent=2)
        
        result.output_dir = str(output_dir)
    
    result.success = True
    return result
