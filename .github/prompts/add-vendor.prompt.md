---
description: 'Add support for a new switch vendor by creating the Jinja2 template structure and validating against Azure Local requirements.'
---

# Add New Vendor

Create the complete template structure for a new switch vendor in this project.

## Context

This project generates physical network configurations for Azure Local deployments. We need to add support for a new vendor while maintaining strict adherence to Azure Local requirements.

## Instructions

1. **Gather Information**
   - Vendor name (normalize using `.github/skills/config-analyzer/references/vendor-normalization.md`)
   - Firmware/OS version (e.g., NXOS, OS10, JunOS, EOS)
   - Reference config or documentation for the vendor's CLI syntax

2. **Create Directory Structure**
   ```
   backend/templates/{vendor}/{firmware}/
   ├── system.j2
   ├── vlan.j2
   ├── interface.j2
   ├── port_channel.j2
   ├── qos.j2
   ├── bgp.j2
   ├── prefix_list.j2
   └── full_config.j2
   ```

3. **Reference Existing Implementations**
   - Read `backend/templates/cisco/nxos/` for Cisco NXOS examples
   - Read `backend/templates/dellemc/os10/` for Dell OS10 examples
   - Follow the same pattern structure

4. **Validate Against Schema**
   - Ensure templates use variables from `backend/schema/standard.json`
   - Run `python -m pytest backend/tests/` to validate

5. **Create Test Fixture**
   - Add sample JSON input in `backend/tests/fixtures/{vendor}-{firmware}/`
   - Include expected output configs

## Azure Local Requirements (MUST follow)

Reference: `.github/skills/azure-local-requirements/`

- Storage VLANs must follow isolation rules per deployment pattern
- DCB/QoS must be implemented for RDMA traffic
- Validate MLAG/VPC peer-link configuration per vendor best practices

## Output

Report:
- List of files created
- Any vendor-specific deviations from other implementations
- Commands to run validation tests
