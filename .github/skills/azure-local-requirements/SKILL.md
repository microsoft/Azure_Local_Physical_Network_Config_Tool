---
name: azure-local-requirements
description: 'Azure Local physical network requirements and deployment pattern rules. Use when validating VLAN configurations, storage isolation, peer-link rules, or deployment pattern compliance.'
---

# Azure Local Requirements

This skill provides the **strict** rules that all Azure Local physical network configurations must follow. These requirements come from official Microsoft documentation and are non-negotiable.

## When to Use This Skill

- Validating if a configuration meets Azure Local requirements
- Checking storage VLAN placement for a deployment pattern
- Verifying peer-link configuration
- Understanding DCB/QoS requirements for RDMA

## References

| Reference | Content |
|-----------|---------|
| [Deployment Patterns](references/deployment-patterns.md) | Patterns, VLAN rules, host port assignments, common mistakes |
| [DCB Requirements](references/dcb-requirements.md) | PFC, ETS, LLDP for RDMA |

## The Golden Rule

> **Storage VLANs are NEVER on the peer-link** — in any pattern.
