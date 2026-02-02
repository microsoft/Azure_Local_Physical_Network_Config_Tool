# Deployment Patterns & Storage VLAN Rules

Azure Local supports three physical network deployment patterns. The fundamental difference is **how storage traffic is handled**.

## Pattern Comparison

| Aspect | Switchless | Switched | Fully-Converged |
|--------|------------|----------|-----------------|
| **Use Case** | Edge, remote sites, cost-sensitive | Enterprise, dedicated storage perf | General purpose, balanced |
| **Nodes** | 1-4 nodes only | Any scale | Any scale |
| **NICs per Host** | 2 (M+C) + direct storage | 4 (2 M+C, 2 storage) | 2 (all traffic) |
| **Storage Traffic** | Direct host-to-host | Dedicated NICs to ToR | Shared NICs via SET |

---

## Switchless

```
Host 1 ──NIC1──► ToR1 (M,C VLANs)
       ──NIC2──► ToR2 (M,C VLANs)
       ══════════► Host 2 (direct storage, no switch)
```

| Location | S1 VLAN | S2 VLAN | Other VLANs |
|----------|---------|---------|-------------|
| ToR1 | ❌ None | ❌ None | M, C |
| ToR2 | ❌ None | ❌ None | M, C |
| Host NICs | Direct | Direct | — |

- Storage flows directly between hosts (no switch involved)
- ToR switches only carry Management (M) and Compute (C) VLANs
- Most cost-effective for small deployments (1-4 nodes)

---

## Switched (Non-Converged)

```
Host ──NIC1 (M+C)──► ToR1 (M, C, S1 VLANs)
     ──NIC2 (M+C)──► ToR2 (M, C, S2 VLANs)
     ──NIC3 (S1)───► ToR1 (S1 only)
     ──NIC4 (S2)───► ToR2 (S2 only)
```

| Location | S1 VLAN | S2 VLAN | Other VLANs |
|----------|---------|---------|-------------|
| ToR1 | ✅ Yes | ❌ No | M, C |
| ToR2 | ❌ No | ✅ Yes | M, C |
| Peer-link | ❌ No | ❌ No | M, C |

- Dedicated storage NICs connect to specific ToRs
- S1 VLAN on ToR1 **only**, S2 VLAN on ToR2 **only**
- Maximum storage isolation and performance

---

## Fully-Converged

```
Host ──NIC1──► ToR1 (M, C, S1, S2 VLANs)
     ──NIC2──► ToR2 (M, C, S1, S2 VLANs)
```

| Location | S1 VLAN | S2 VLAN | Other VLANs |
|----------|---------|---------|-------------|
| ToR1 | ✅ Yes | ✅ Yes | M, C |
| ToR2 | ✅ Yes | ✅ Yes | M, C |
| Peer-link | ❌ No | ❌ No | M, C |

- All traffic shares 2 NICs via VLAN segmentation
- **Both** S1 and S2 must be on **both** ToRs for redundancy
- If ToR or host NIC fails, surviving path must carry all VLANs

---

## Peer-Link Rule (All Patterns)

> ⚠️ **Storage VLANs are NEVER on the peer-link** — in any pattern.

```
peer_link_vlans: M, C only
# Example: "7,201"
# NEVER include storage VLANs (711, 712)
```

---

## Host Port VLAN Assignment

| Pattern | Host Port VLANs |
|---------|-----------------|
| Switchless | M, C only (e.g., `7,201`) |
| Switched (M+C ports) | M, C (e.g., `7,201`) |
| Switched (S1 port) | S1 only (e.g., `711`) |
| Switched (S2 port) | S2 only (e.g., `712`) |
| Fully-Converged | M, C, S1, S2 (e.g., `7,201,711,712`) |

---

## Common Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| S1+S2 on ToR1 only (Switched) | S2 traffic fails | Put S2 on ToR2 |
| Only S1 per ToR (Fully-Converged) | Failover breaks | Put S1+S2 on both |
| Storage VLANs on peer-link | Performance/loop issues | Remove from peer-link |

---

## Official Sources

- [MS Learn: Network patterns overview](https://learn.microsoft.com/en-us/azure/azure-local/plan/network-patterns-overview)
- [AzureLocal-Supportability repo](https://github.com/Azure/AzureLocal-Supportability)
