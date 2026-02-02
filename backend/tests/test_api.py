"""
Tests for the FastAPI backend API endpoints.
"""
import pytest
from fastapi.testclient import TestClient
import json
from pathlib import Path

from src.api import app

# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def client():
    """Create test client for API"""
    return TestClient(app)


@pytest.fixture
def valid_config():
    """Load a valid test config"""
    fixture_path = Path(__file__).parent.parent.parent / "tests" / "fixtures" / "cisco-nxos" / "sample-tor1.json"
    if fixture_path.exists():
        with open(fixture_path) as f:
            return json.load(f)
    
    # Fallback minimal config
    return {
        "switch": {
            "vendor": "cisco",
            "model": "93180YC-FX3",
            "firmware": "nxos",
            "hostname": "test-tor1",
            "role": "TOR1",
            "deployment_pattern": "fully_converged"
        },
        "vlans": [
            {"vlan_id": 100, "name": "Management", "purpose": "management"}
        ],
        "interfaces": [],
        "port_channels": []
    }


@pytest.fixture
def dell_config():
    """Load a Dell OS10 test config"""
    fixture_path = Path(__file__).parent.parent.parent / "tests" / "fixtures" / "rr1-n25-r20-5248hl-23-1a" / "std_rr1-n25-r20-5248hl-23-1a.json"
    if fixture_path.exists():
        with open(fixture_path) as f:
            return json.load(f)
    return None


# ============================================================================
# HEALTH CHECK TESTS
# ============================================================================

class TestHealthCheck:
    """Tests for /health endpoint"""
    
    def test_health_returns_200(self, client):
        """Health endpoint should return 200"""
        response = client.get("/health")
        assert response.status_code == 200
    
    def test_health_returns_status(self, client):
        """Health endpoint should return status"""
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data


# ============================================================================
# GENERATE ENDPOINT TESTS
# ============================================================================

class TestGenerateEndpoint:
    """Tests for /api/generate endpoint"""
    
    def test_generate_returns_success(self, client, valid_config):
        """Generate should return success for valid config"""
        response = client.post("/api/generate", json={"config": valid_config})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
    
    def test_generate_returns_config(self, client, valid_config):
        """Generate should return rendered config"""
        response = client.post("/api/generate", json={"config": valid_config})
        data = response.json()
        assert data["config"] is not None
        assert len(data["config"]) > 0
    
    def test_generate_returns_filename(self, client, valid_config):
        """Generate should return filename based on hostname"""
        response = client.post("/api/generate", json={"config": valid_config})
        data = response.json()
        hostname = valid_config["switch"]["hostname"]
        assert data["filename"] == f"{hostname}.cfg"
    
    def test_generate_cisco_contains_hostname(self, client, valid_config):
        """Generated Cisco config should contain hostname"""
        response = client.post("/api/generate", json={"config": valid_config})
        data = response.json()
        hostname = valid_config["switch"]["hostname"]
        assert f"hostname {hostname}" in data["config"]
    
    def test_generate_invalid_config_fails(self, client):
        """Generate should fail for invalid config"""
        invalid_config = {"switch": {}}  # Missing required fields
        response = client.post("/api/generate", json={"config": invalid_config})
        data = response.json()
        assert data["success"] is False
        assert data["error"] is not None
    
    def test_generate_invalid_vendor_fails(self, client, valid_config):
        """Generate should fail for unsupported vendor"""
        valid_config["switch"]["vendor"] = "unsupported"
        valid_config["switch"]["firmware"] = "unknown"
        response = client.post("/api/generate", json={"config": valid_config})
        data = response.json()
        # Should fail at validation or template lookup
        assert data["success"] is False


class TestGenerateRawEndpoint:
    """Tests for /api/generate/raw endpoint"""
    
    def test_raw_returns_plaintext(self, client, valid_config):
        """Raw endpoint should return plain text"""
        response = client.post("/api/generate/raw", json={"config": valid_config})
        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"]
    
    def test_raw_returns_config_directly(self, client, valid_config):
        """Raw endpoint should return config as response body"""
        response = client.post("/api/generate/raw", json={"config": valid_config})
        # Response text should be the config, not JSON
        assert "hostname" in response.text
    
    def test_raw_sets_download_header(self, client, valid_config):
        """Raw endpoint should set Content-Disposition for download"""
        response = client.post("/api/generate/raw", json={"config": valid_config})
        assert "Content-Disposition" in response.headers
        assert "attachment" in response.headers["Content-Disposition"]
    
    def test_raw_invalid_returns_400(self, client):
        """Raw endpoint should return 400 for invalid config"""
        invalid_config = {"switch": {}}
        response = client.post("/api/generate/raw", json={"config": invalid_config})
        assert response.status_code == 400


# ============================================================================
# DELL OS10 TESTS
# ============================================================================

class TestDellOS10Generation:
    """Tests for Dell OS10 config generation"""
    
    def test_dell_config_generates(self, client):
        """Dell OS10 config should generate successfully with valid config"""
        # Use a minimal valid Dell config
        dell_config = {
            "switch": {
                "vendor": "dellemc",
                "model": "S5248F-ON",
                "firmware": "os10",
                "hostname": "dell-tor1",
                "role": "TOR1",
                "deployment_pattern": "fully_converged"
            },
            "vlans": [
                {"vlan_id": 100, "name": "Management", "purpose": "management"}
            ],
            "interfaces": [],
            "port_channels": []
        }
        
        response = client.post("/api/generate", json={"config": dell_config})
        data = response.json()
        assert data["success"] is True
        assert data["config"] is not None
        assert "hostname dell-tor1" in data["config"]
