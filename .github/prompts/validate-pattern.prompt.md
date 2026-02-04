---
description: 'Validate that a switch configuration or JSON input complies with Azure Local deployment pattern requirements.'
---

# Validate Azure Local Pattern

Analyze a configuration and verify it meets Azure Local physical network requirements.

## Context

Azure Local has strict requirements for physical network configurations based on the deployment pattern. This prompt validates configurations against those requirements.

## Instructions

1. **Identify the Deployment Pattern**
   - Read the input JSON for `deployment_pattern` field
   - Valid patterns: `switchless`, `switched`, `fully-converged`

2. **Validate Storage VLAN Rules**
   Reference: `.github/skills/azure-local-requirements/references/deployment-patterns.md`

   **Switchless:**
   - Storage VLANs must NOT be on any TOR switch
   - Storage traffic is direct node-to-node

   **Switched (Non-Converged):**
   - Storage VLANs MUST be on TOR switches
   - Storage VLANs are isolated per-TOR per pattern rules
   - Storage VLANs should **NOT** be allowed on the peer-link between ToRs (reference: AzureLocal-Supportability HSRP peer-link section)

   **Fully-Converged:**
   - Storage VLANs are present on both TORs for failover
   - All traffic shares the same physical ports (via VLAN segmentation)
   - Storage VLANs should **NOT** be allowed on the peer-link between ToRs (reference: AzureLocal-Supportability HSRP peer-link section)

3. **Validate DCB/QoS (if RDMA)**
   Reference: `.github/skills/azure-local-requirements/references/dcb-requirements.md`

   - PFC must be enabled for storage traffic class
   - ETS bandwidth allocation must be configured
   - Check for lossless queue configuration

4. **Validate MLAG/VPC Configuration (if present)**
   - Validate basic MLAG/vPC correctness (peer-link + keepalive isolation, vendor syntax)
   - Treat peer-link VLAN allowlists as vendor-specific **except** for storage VLAN exclusion; fail if storage VLANs are allowed on the peer-link

## Output

Report with:
- ✅ PASS or ❌ FAIL for each requirement
- Specific line/config section that violates requirements
- Remediation suggestions for any failures
- Overall compliance status
