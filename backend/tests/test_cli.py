"""Tests for CLI commands"""
import json
import pytest
from pathlib import Path
from src.cli import validate_command, transform_command, generate_command
from unittest.mock import Mock


@pytest.fixture
def example_config_path():
    """Path to example configuration"""
    return Path(__file__).parent.parent.parent / "frontend" / "examples" / "fully-converged" / "sample-tor1.json"


def test_validate_command_valid_file(example_config_path, capsys):
    """Test validate command with valid file"""
    args = Mock()
    args.input = str(example_config_path)
    
    result = validate_command(args)
    
    assert result == 0
    captured = capsys.readouterr()
    assert "Validation successful" in captured.out


def test_validate_command_missing_file(capsys):
    """Test validate command with missing file"""
    args = Mock()
    args.input = "nonexistent.json"
    
    result = validate_command(args)
    
    assert result == 1
    captured = capsys.readouterr()
    assert "not found" in captured.err


def test_validate_command_invalid_json(tmp_path, capsys):
    """Test validate command with invalid JSON"""
    invalid_file = tmp_path / "invalid.json"
    invalid_file.write_text("{ invalid json")
    
    args = Mock()
    args.input = str(invalid_file)
    
    result = validate_command(args)
    
    assert result == 1
    captured = capsys.readouterr()
    assert "Invalid JSON" in captured.err


def test_validate_command_schema_error(tmp_path, capsys):
    """Test validate command with schema validation error"""
    invalid_config = tmp_path / "invalid_config.json"
    invalid_config.write_text(json.dumps({
        "switch": {
            "vendor": "invalid_vendor",
            "model": "test",
            "hostname": "test",
            "role": "TOR1",
            "firmware": "os10"
        }
    }))
    
    args = Mock()
    args.input = str(invalid_config)
    
    result = validate_command(args)
    
    assert result == 1
    captured = capsys.readouterr()
    assert "Validation failed" in captured.err


def test_transform_command_valid_file(example_config_path, capsys):
    """Test transform command with valid file"""
    args = Mock()
    args.input = str(example_config_path)
    
    result = transform_command(args)
    
    assert result == 0
    captured = capsys.readouterr()
    
    # Should output JSON
    output_json = json.loads(captured.out)
    assert "_computed" in output_json
    assert output_json["_computed"]["hsrp_priority"] == 150


def test_transform_command_invalid_file(tmp_path, capsys):
    """Test transform command with invalid config"""
    invalid_config = tmp_path / "invalid.json"
    invalid_config.write_text(json.dumps({
        "switch": {
            "vendor": "invalid_vendor"
        }
    }))
    
    args = Mock()
    args.input = str(invalid_config)
    
    result = transform_command(args)
    
    assert result == 1
    captured = capsys.readouterr()
    assert "Validation failed" in captured.err


def test_generate_command_valid_file(example_config_path, tmp_path, capsys):
    """Test generate command with valid file"""
    args = Mock()
    args.input = str(example_config_path)
    args.output = str(tmp_path)
    
    result = generate_command(args)
    
    assert result == 0
    captured = capsys.readouterr()
    assert "Configuration generated" in captured.out
    
    # Check output file was created
    output_files = list(tmp_path.glob("*.cfg"))
    assert len(output_files) == 1
    
    # Check output contains some expected content
    content = output_files[0].read_text()
    assert "hostname" in content


def test_generate_command_default_output(example_config_path, tmp_path, monkeypatch, capsys):
    """Test generate command with default output directory"""
    # Change to temp directory
    monkeypatch.chdir(tmp_path)
    
    args = Mock()
    args.input = str(example_config_path)
    args.output = None  # Use default (current directory)
    
    result = generate_command(args)
    
    assert result == 0
    
    # Check output file was created in current directory
    output_files = list(tmp_path.glob("*.cfg"))
    assert len(output_files) == 1


def test_generate_command_invalid_file(tmp_path, capsys):
    """Test generate command with invalid config"""
    invalid_config = tmp_path / "invalid.json"
    invalid_config.write_text(json.dumps({
        "switch": {
            "vendor": "invalid_vendor"
        }
    }))
    
    args = Mock()
    args.input = str(invalid_config)
    args.output = str(tmp_path)
    
    result = generate_command(args)
    
    assert result == 1
    captured = capsys.readouterr()
    assert "Validation failed" in captured.err
