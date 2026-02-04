---
name: azure-local-requirements
description: 'Azure Local physical network requirements and deployment pattern rules. Use when validating VLAN configurations, storage isolation, and deployment pattern compliance.'
---

# Azure Local Requirements

This skill provides the **strict** rules that all Azure Local physical network configurations must follow. These requirements come from official Microsoft documentation and are non-negotiable.

## When to Use This Skill

- Validating if a configuration meets Azure Local requirements
- Checking storage VLAN placement for a deployment pattern
- Understanding DCB/QoS requirements for RDMA

## References

| Reference | Content |
|-----------|---------|
| [Deployment Patterns](references/deployment-patterns.md) | Patterns, VLAN rules, host port assignments, peer-link guidance (sourced) |
| [DCB Requirements](references/dcb-requirements.md) | PFC, ETS, LLDP for RDMA |

## The Golden Rule

> Follow the **deployment-pattern VLAN distribution** rules.
>
> For peer-link VLAN guidance, use AzureLocal-Supportability’s HSRP peer-link reference (not the deployment-pattern overview):
> - Storage VLANs should **NOT** be allowed on the peer-link between ToRs.
>   - Reference: https://github.com/Azure/AzureLocal-Supportability/blob/main/TSG/Networking/Top-Of-Rack-Switch/Reference-TOR-Disaggregated-Switched-Storage.md#hsrp-peer-link
