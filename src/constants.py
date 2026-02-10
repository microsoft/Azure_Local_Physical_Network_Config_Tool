"""
Centralized constants for the Azure Local Network Switch Config Generator.

All magic strings, default values, and lookup tables live here so that
every module imports from one source of truth.
"""

# ── Switch vendors & firmware ──────────────────────────────────────────────
CISCO = "cisco"
DELL = "dellemc"

NXOS = "nxos"
OS10 = "os10"

# Vendor → firmware mapping (used by infer_firmware)
VENDOR_FIRMWARE_MAP: dict[str, str] = {
    CISCO: NXOS,
    DELL: OS10,
}

# ── Switch types / roles ──────────────────────────────────────────────────
TOR1 = "TOR1"
TOR2 = "TOR2"
BMC = "BMC"

# Switch types that go through the standard TOR converter pipeline
TOR_SWITCH_TYPES: list[str] = [TOR1, TOR2]

# ── Deployment patterns ───────────────────────────────────────────────────
# Customer-facing name → internal key mapping:
#   "HyperConverged" (Azure Local docs) → converter remaps to "fully_converged"
#   "Switched" / "Switchless" → used as-is in template lookup
PATTERN_HYPERCONVERGED = "hyperconverged"
PATTERN_FULLY_CONVERGED = "fully_converged"
PATTERN_FULLY_CONVERGED1 = "fully_converged1"  # trunk mode (Dell sub-variant)
PATTERN_FULLY_CONVERGED2 = "fully_converged2"  # access mode (Dell sub-variant)
PATTERN_SWITCHED = "switched"
PATTERN_SWITCHLESS = "switchless"

# ── Output defaults ──────────────────────────────────────────────────────
DEFAULT_OUTPUT_DIR = "output"
OUTPUT_FILE_EXTENSION = ".json"

# ── Network defaults ─────────────────────────────────────────────────────
JUMBO_MTU = 9216

# ── Redundancy ────────────────────────────────────────────────────────────
HSRP = "hsrp"
VRRP = "vrrp"
REDUNDANCY_PRIORITY_ACTIVE = 150
REDUNDANCY_PRIORITY_STANDBY = 140

# ── VLAN group prefixes (used to classify supernet GroupName → symbol) ────
# Maps a GroupName prefix to the symbolic VLAN-set key used in templates.
VLAN_GROUP_MAP: dict[str, str] = {
    "HNVPA":      "C",
    "INFRA":      "M",
    "TENANT":     "C",
    "L3FORWARD":  "C",
    "STORAGE":    "S",
    "UNUSED":     "UNUSED",
    "NATIVE":     "NATIVE",
}

# ── BMC VLAN definitions (hardcoded — DC4, Design Principle 8) ────────
# BMC switches are internal-only; these VLANs are hardcoded for simplicity.
#
# VLAN 2  – "UNUSED_VLAN": assigned to all ports by default then overridden;
#           keeps unused ports on a dead-end VLAN (security best practice).
# VLAN 99 – "NATIVE_VLAN": native/untagged VLAN on trunk links (To_TORs
#           port-channel). Must match the native_vlan in the BMC interface
#           templates (e.g. 9348GC-FXP.json port_channels[].native_vlan).
#
# To change: update both this list AND the corresponding template JSONs.
BMC_HARDCODED_VLANS: list[dict] = [
    {"vlan_id": 2, "name": "UNUSED_VLAN", "shutdown": True},
    {"vlan_id": 99, "name": "NATIVE_VLAN"},
]

# Supernet GroupName prefixes that produce VLANs on the BMC switch.
# "BMC" — the actual BMC management network (VLAN 125 in typical deployments)
# "UNUSED"/"NATIVE" — reserved VLANs already covered by the hardcoded list
#                      above, but included so the converter doesn't silently
#                      drop them if their IDs change in the input.
BMC_RELEVANT_GROUPS: list[str] = ["BMC", "UNUSED", "NATIVE"]

# ── IP map key prefixes (used by _build_ip_mapping) ──────────────────────
# These are assembled at runtime as e.g. "P2P_BORDER1_TOR1", "LOOPBACK0_TOR2"
IP_PREFIX_P2P_BORDER1 = "P2P_BORDER1"
IP_PREFIX_P2P_BORDER2 = "P2P_BORDER2"
IP_PREFIX_LOOPBACK0 = "LOOPBACK0"
IP_PREFIX_P2P_IBGP = "P2P_IBGP"

# ── In-code JSON templates (never mutate — always deepcopy) ──────────────

SWITCH_TEMPLATE: dict = {
    "make": "",
    "model": "",
    "type": "",
    "hostname": "",
    "version": "",
    "firmware": "",
    "site": "",
}

SVI_TEMPLATE: dict = {
    "ip": "",
    "cidr": 0,
    "mtu": JUMBO_MTU,
    "redundancy": {
        "type": "",
        "group": 0,
        "priority": 0,
        "virtual_ip": "",
    },
}

VLAN_TEMPLATE: dict = {
    "vlan_id": 0,
    "name": "",
}
