"""
Convertors Package — Static Registry Pattern

All convertors are statically imported so PyInstaller can detect them
without needing hooks or hidden imports.
"""

from .convertors_lab_switch_json import convert_switch_input_json as convert_lab_switches
from .convertors_bmc_switch_json import convert_bmc_switches

# Registry mapping convertor names to functions
CONVERTORS = {
    # Primary convertor names (backward compatible)
    'convertors.convertors_lab_switch_json': convert_lab_switches,
    'convertors.convertors_bmc_switch_json': convert_bmc_switches,
    # Short aliases
    'lab': convert_lab_switches,
    'bmc': convert_bmc_switches,
}

__all__ = [
    'CONVERTORS',
    'convert_lab_switches',
    'convert_bmc_switches',
]
