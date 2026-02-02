# QoS Settings for RDMA

QoS configuration values for Azure Local. Switch QoS must match host requirements.

> **Key:** DCB is **required for RoCE**, optional for iWARP.

## Traffic Classes (Switch Must Match Host)

| Traffic Class | Priority | PFC | Bandwidth | Purpose |
|---------------|----------|-----|-----------|---------|
| **System** | 7 | No | 1-2%* | Cluster heartbeats |
| **RDMA** | 3 or 4 | **Yes** | 50% | Lossless storage (SMB Direct) |
| **Default** | 0 | No | Remaining | VM traffic, management |

*\*System bandwidth: 2% for 10GbE, 1% for 25GbE+*

## Switch Configuration Summary

```
Priority 7 → System heartbeats (no PFC, 1-2% BW)
Priority 3 → RDMA storage (PFC enabled, 50% BW)
Priority 0 → Default traffic (no PFC, remaining BW)
MTU: 9174 (jumbo frames)
```

## Template Usage

```jinja2
{#- QoS policy must match host traffic classes -#}
{#- Priority 3 = RDMA (PFC on, 50%), Priority 7 = System (1-2%) -#}
```

## Reference

- [Host network requirements - RDMA traffic](https://learn.microsoft.com/en-us/azure/azure-local/concepts/host-network-requirements)
