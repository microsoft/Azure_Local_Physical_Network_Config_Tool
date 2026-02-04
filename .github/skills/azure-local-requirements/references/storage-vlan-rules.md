# Storage VLAN Rules

Storage VLAN configuration is the most critical aspect of Azure Local physical networking. Incorrect configuration causes storage connectivity failures.

## Rules by Pattern

### Switchless

| Location | S1 VLAN | S2 VLAN |
|----------|---------|---------|
| ToR1 | ❌ None | ❌ None |
| ToR2 | ❌ None | ❌ None |
| Host NICs | Direct | Direct |

Storage flows directly between hosts without touching the switch.

### Switched

| Location | S1 VLAN | S2 VLAN |
|----------|---------|---------|
| ToR1 | ✅ Yes | ❌ No |
| ToR2 | ❌ No | ✅ Yes |
| Peer-link | Vendor-specific | Vendor-specific |

Each storage VLAN is isolated to its dedicated ToR.

### Fully-Converged

| Location | S1 VLAN | S2 VLAN |
|----------|---------|---------|
| ToR1 | ✅ Yes | ✅ Yes |
| ToR2 | ✅ Yes | ✅ Yes |
| Peer-link | Vendor-specific | Vendor-specific |

Both storage VLANs on both ToRs (required for SET).

## Host Port VLAN Assignment

| Pattern | Host Port VLANs |
|---------|-----------------|
| Switchless | M, C only (e.g., `7,201`) |
| Switched (M+C ports) | M, C (e.g., `7,201`) |
| Switched (S1 port) | S1 only (e.g., `711`) |
| Switched (S2 port) | S2 only (e.g., `712`) |
| Fully-Converged | M, C, S1, S2 (e.g., `7,201,711,712`) |

## Peer-Link VLAN Membership

Peer-link VLAN allowlists are vendor-specific implementation details.

AzureLocal-Supportability provides a concrete peer-link reference in the HSRP peer-link section:
https://github.com/Azure/AzureLocal-Supportability/blob/main/TSG/Networking/Top-Of-Rack-Switch/Reference-TOR-Disaggregated-Switched-Storage.md#hsrp-peer-link

- **Guidance:** Storage VLANs should **NOT** be allowed on the peer-link between ToRs.

## L2 vs L3 Storage VLANs

Storage VLANs can be configured as:

- **L2 (Recommended):** No IP subnet on switch, hosts handle all addressing
- **L3:** IP subnet configured on switch (more complex)

L2 is recommended because:
- Simpler VLAN tagging
- No predefined IP ranges needed
- Azure Local hosts manage storage IPs dynamically

## Common Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| S1+S2 on ToR1 only (Switched) | S2 traffic fails | Put S2 on ToR2 |
| Only S1 per ToR (Fully-Converged) | SET routing failures | Put S1+S2 on both |
| Incorrect peer-link VLAN allowlist | Vendor-dependent issues | Validate peer-link VLANs per vendor docs and design intent |
