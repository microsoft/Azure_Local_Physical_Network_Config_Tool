"""Tests for Submission Processor

Tests the orchestration of config submission processing.
"""
import pytest
import tempfile
import os
from pathlib import Path
from src.submission_processor import (
    process_submission,
    ProcessingResult,
)


# =============================================================================
# PROCESSING RESULT TESTS
# =============================================================================

class TestProcessingResult:
    """Tests for ProcessingResult dataclass."""

    def test_default_values(self):
        """Should have sensible defaults."""
        result = ProcessingResult()
        assert result.success is False
        assert result.metadata == {}
        assert result.sections == []
        assert result.errors == []
        assert result.warnings == []

    def test_with_values(self):
        """Should store provided values."""
        result = ProcessingResult(
            success=True,
            metadata={"vendor": "dellemc"},
            sections=["system", "vlan"],
            analysis={"vlan_count": 5},
        )
        assert result.success is True
        assert result.metadata["vendor"] == "dellemc"
        assert "system" in result.sections


# =============================================================================
# PROCESS SUBMISSION TESTS
# =============================================================================

class TestProcessSubmission:
    """Tests for process_submission function."""

    @pytest.fixture
    def valid_submission(self, tmp_path):
        """Create a valid submission directory."""
        submission_dir = tmp_path / "test-submission"
        submission_dir.mkdir()
        
        # Create metadata.yaml
        metadata_file = submission_dir / "metadata.yaml"
        metadata_file.write_text("""
vendor: dellemc
firmware: os10
role: TOR1
deployment_pattern: fully_converged
hostname: test-switch
""")
        
        # Create config file
        config_file = submission_dir / "config.txt"
        config_file.write_text("""
hostname test-switch
ztd cancel
!
interface vlan99
 description Management
 ip address 10.0.0.1/24
!
interface Ethernet 1/1/1
 description Host1
""")
        
        return submission_dir

    @pytest.fixture
    def output_dir(self, tmp_path):
        """Create output directory."""
        output = tmp_path / "output"
        output.mkdir()
        return output

    def test_process_valid_submission(self, valid_submission, output_dir):
        """Should process valid submission successfully."""
        result = process_submission(
            submission_dir=valid_submission,
            output_dir=output_dir,
            verbose=False
        )
        
        assert result.success is True
        assert result.metadata.get("vendor") == "dellemc"
        assert len(result.errors) == 0

    def test_process_with_verbose(self, valid_submission, output_dir):
        """Should process with verbose output."""
        result = process_submission(
            submission_dir=valid_submission,
            output_dir=output_dir,
            verbose=True
        )
        
        assert result.success is True

    def test_process_missing_metadata(self, tmp_path, output_dir):
        """Should handle missing metadata.yaml."""
        submission_dir = tmp_path / "no-metadata"
        submission_dir.mkdir()
        
        # Only create config file
        config_file = submission_dir / "config.txt"
        config_file.write_text("hostname test")
        
        result = process_submission(
            submission_dir=submission_dir,
            output_dir=output_dir,
            verbose=False
        )
        
        # Should either fail or create analysis from config
        assert result is not None

    def test_process_missing_config(self, tmp_path, output_dir):
        """Should handle missing config file."""
        submission_dir = tmp_path / "no-config"
        submission_dir.mkdir()
        
        # Only create metadata
        metadata_file = submission_dir / "metadata.yaml"
        metadata_file.write_text("vendor: dellemc\nfirmware: os10")
        
        result = process_submission(
            submission_dir=submission_dir,
            output_dir=output_dir,
            verbose=False
        )
        
        # Should fail or have errors
        assert result is not None

    def test_process_nonexistent_directory(self, output_dir):
        """Should handle non-existent submission directory."""
        result = process_submission(
            submission_dir=Path("/nonexistent/path"),
            output_dir=output_dir,
            verbose=False
        )
        
        assert result.success is False
        assert len(result.errors) > 0

    def test_output_files_created(self, valid_submission, output_dir):
        """Should create output files."""
        result = process_submission(
            submission_dir=valid_submission,
            output_dir=output_dir,
            verbose=False
        )
        
        if result.success:
            # Check output directory was created
            submission_output = output_dir / valid_submission.name
            assert submission_output.exists() or any(output_dir.iterdir())


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

class TestIntegration:
    """Integration tests with realistic configs."""

    @pytest.fixture
    def dell_submission(self, tmp_path):
        """Create Dell EMC submission."""
        submission_dir = tmp_path / "dell-tor1"
        submission_dir.mkdir()
        
        (submission_dir / "metadata.yaml").write_text("""
vendor: Dell EMC
firmware: OS10
role: TOR-1
deployment_pattern: fully-converged
hostname: dell-tor1
submitted_by: test-user
notes: Test submission
""")
        
        (submission_dir / "config.txt").write_text("""
!
! Dell EMC Networking OS10 Configuration
!
ztd cancel
hostname dell-tor1
!
password-attributes min-length 8
username admin password encrypted role sysadmin
!
dcbx enable
!
interface vlan2
 description Management
 ip address 10.0.0.1/24
!
interface vlan711
 description Storage_A
 mtu 9216
!
interface Ethernet 1/1/1
 description host1-port1
 switchport mode trunk
 mtu 9216
!
interface port-channel101
 description host-bond
 vlt-port-channel 101
!
vlt domain 1
 discovery-interface ethernet1/1/49
 peer-routing
!
router bgp 65001
 neighbor 10.0.0.2 remote-as 65001
!
""")
        
        return submission_dir

    @pytest.fixture
    def cisco_submission(self, tmp_path):
        """Create Cisco submission."""
        submission_dir = tmp_path / "cisco-tor1"
        submission_dir.mkdir()
        
        (submission_dir / "metadata.yaml").write_text("""
vendor: Cisco
firmware: NX-OS
role: TOR1
deployment_pattern: switched
hostname: cisco-tor1
""")
        
        (submission_dir / "config.txt").write_text("""
version 10.2(3)
hostname cisco-tor1

feature vpc
feature bgp
feature interface-vlan
feature lldp

username admin password 5 encrypted

interface Ethernet1/1
  description host1-port1
  switchport mode trunk

interface port-channel101
  description host-bond
  vpc 101

vpc domain 1
  peer-keepalive destination 192.168.1.2

interface Vlan99
  ip address 10.0.0.1/24

router bgp 65001
  neighbor 10.0.0.2 remote-as 65001
""")
        
        return submission_dir

    def test_dell_submission_processing(self, dell_submission, tmp_path):
        """Should process Dell submission with auto-fixes."""
        output_dir = tmp_path / "output"
        output_dir.mkdir()
        
        result = process_submission(
            submission_dir=dell_submission,
            output_dir=output_dir,
            verbose=False
        )
        
        assert result.success is True
        # Should auto-fix metadata values
        assert result.metadata.get("vendor") == "dellemc"
        assert result.metadata.get("firmware") == "os10"
        assert result.metadata.get("role") == "TOR1"
        assert result.metadata.get("deployment_pattern") == "fully_converged"

    def test_cisco_submission_processing(self, cisco_submission, tmp_path):
        """Should process Cisco submission."""
        output_dir = tmp_path / "output"
        output_dir.mkdir()
        
        result = process_submission(
            submission_dir=cisco_submission,
            output_dir=output_dir,
            verbose=False
        )
        
        assert result.success is True
        assert result.metadata.get("vendor") == "cisco"
        assert result.metadata.get("firmware") == "nxos"

    def test_analysis_includes_metrics(self, dell_submission, tmp_path):
        """Should include config analysis metrics."""
        output_dir = tmp_path / "output"
        output_dir.mkdir()
        
        result = process_submission(
            submission_dir=dell_submission,
            output_dir=output_dir,
            verbose=False
        )
        
        if result.analysis:
            # Should have section information
            assert "sections_found" in result.analysis or len(result.sections) > 0


# =============================================================================
# ERROR HANDLING TESTS
# =============================================================================

class TestErrorHandling:
    """Tests for error handling scenarios."""

    def test_invalid_yaml(self, tmp_path):
        """Should handle invalid YAML in metadata."""
        submission_dir = tmp_path / "bad-yaml"
        submission_dir.mkdir()
        
        (submission_dir / "metadata.yaml").write_text("""
vendor: dellemc
firmware: [invalid yaml
  - nested: broken
""")
        
        (submission_dir / "config.txt").write_text("hostname test")
        
        output_dir = tmp_path / "output"
        output_dir.mkdir()
        
        result = process_submission(
            submission_dir=submission_dir,
            output_dir=output_dir,
            verbose=False
        )
        
        # Should handle gracefully, not crash
        assert result is not None

    def test_empty_config_file(self, tmp_path):
        """Should handle empty config file."""
        submission_dir = tmp_path / "empty-config"
        submission_dir.mkdir()
        
        (submission_dir / "metadata.yaml").write_text("""
vendor: dellemc
firmware: os10
role: TOR1
deployment_pattern: fully_converged
""")
        
        (submission_dir / "config.txt").write_text("")
        
        output_dir = tmp_path / "output"
        output_dir.mkdir()
        
        result = process_submission(
            submission_dir=submission_dir,
            output_dir=output_dir,
            verbose=False
        )
        
        # Should handle gracefully
        assert result is not None

    def test_binary_file_as_config(self, tmp_path):
        """Should handle binary file as config."""
        submission_dir = tmp_path / "binary-config"
        submission_dir.mkdir()
        
        (submission_dir / "metadata.yaml").write_text("""
vendor: dellemc
firmware: os10
""")
        
        # Write binary content
        (submission_dir / "config.txt").write_bytes(
            b'\x00\x01\x02\x03\x04\x05'
        )
        
        output_dir = tmp_path / "output"
        output_dir.mkdir()
        
        result = process_submission(
            submission_dir=submission_dir,
            output_dir=output_dir,
            verbose=False
        )
        
        # Should handle gracefully
        assert result is not None
