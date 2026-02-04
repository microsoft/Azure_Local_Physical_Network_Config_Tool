# Contributing to Azure Local Network Config Tool

Thank you for helping expand vendor support! This guide explains how to submit your switch configuration so we can create templates for new vendors or improve existing ones.

---

## Before You Start

> [!IMPORTANT]
> **This is a REFERENCE tool.** Your submission helps the community, but all generated configs must be validated in your environment before production use.

### What We Need From You

| Item | Required | Description |
|------|:--------:|-------------|
| Switch config | ✅ | Full running config from your switch |
| Vendor | ✅ | e.g., `Dell EMC`, `Cisco`, `Juniper` |
| OS/Firmware | ✅ | e.g., `OS10`, `NX-OS`, `JunOS` |
| Model | ✅ | e.g., `S5248F-ON`, `93180YC-FX3` |
| Role | ✅ | `TOR1`, `TOR2`, or `BMC` |
| Deployment Pattern | ✅ | `fully_converged`, `switched`, or `switchless` |

### What We Do NOT Need

- ❌ Passwords or secrets (we'll reject configs with real credentials)
- ❌ Customer-specific data (please sanitize/replace hostnames, IPs, and internal endpoints)
- ❌ Partial configs (we need the full running config)

---

## Step 1: Prepare Your Config

### Export your running config

**Dell OS10:**
```
show running-configuration
```

**Cisco NX-OS:**
```
show running-config
```

**Other vendors:** Use your vendor's equivalent command.

### Remove sensitive data

Before submitting, replace any real credentials:

```diff
- username admin password MySuperSecret123!
+ username admin password $CREDENTIAL_PLACEHOLDER$

- enable secret MyEnablePassword
+ enable secret $CREDENTIAL_PLACEHOLDER$
```

> **Tip:** Search for `password`, `secret`, `key`, and `community` in your config.

> [!TIP]
> Also consider replacing real hostnames/IPs with placeholders (e.g., `$HOSTNAME$`, `$MGMT_IP$`) or RFC5737 test-net ranges.

---

## Step 2: Identify Your Setup

### Deployment Pattern

| Pattern | Storage Traffic | When to Use |
|---------|-----------------|-------------|
| **Fully Converged** | On switch (shared ports) | Most common, general purpose |
| **Switched** | On switch (dedicated ports) | Enterprise, network isolation |
| **Switchless** | Direct host-to-host | Edge, cost-sensitive |

Not sure? Look at your storage VLANs:
- Both storage VLANs (711, 712) on host ports → **Fully Converged**
- Only one storage VLAN per TOR → **Switched**
- No storage VLANs on switch → **Switchless**

### Switch Role

| Role | Description |
|------|-------------|
| **TOR1** | First Top-of-Rack switch (higher HSRP/VRRP priority) |
| **TOR2** | Second Top-of-Rack switch (MLAG/vPC peer) |
| **BMC** | Baseboard Management Controller switch |

---

## Step 3: Submit via GitHub Issue

### Open a New Issue

1. Go to [**Issues → New Issue**](../../issues/new/choose)
2. Select **"Template Submission"**
3. Fill out the form:

| Field | What to Enter | Example |
|-------|---------------|---------|
| **Vendor** | Your switch vendor | `Dell EMC` or `Cisco` or `Juniper` |
| **Firmware/OS** | Operating system | `OS10` or `NX-OS` or `JunOS` |
| **Model** | Switch model number | `S5248F-ON` |
| **Role** | TOR1, TOR2, or BMC | `TOR1` |
| **Pattern** | Deployment pattern | `fully_converged` |
| **Config** | Paste full config | (see below) |

### Paste Your Config

In the **Config** field, paste your entire sanitized config:

```
! Paste your full running-config here
! Make sure passwords are replaced with $CREDENTIAL_PLACEHOLDER$

hostname my-tor1
!
interface Vlan7
  description Management
  ip address 192.168.7.2/24
!
... (rest of config)
```

### Submit

Click **"Submit new issue"** — you're done!

---

## What Happens Next

```
┌─────────────────────────────────────────────────────────────┐
│  1. VALIDATION (Automatic)                                  │
│     • Your metadata is checked and auto-fixed if needed     │
│     • "Dell EMC" → "dellemc", "NX-OS" → "nxos"             │
│     • New vendors are welcomed, not rejected                │
├─────────────────────────────────────────────────────────────┤
│  2. ANALYSIS (Automatic)                                    │
│     • Config is split into sections (VLANs, interfaces...)  │
│     • Vendor/firmware auto-detected from config syntax      │
│     • Section counts and statistics generated               │
├─────────────────────────────────────────────────────────────┤
│  3. REVIEW (Maintainer)                                     │
│     • A maintainer reviews your submission                  │
│     • May ask clarifying questions                          │
│     • Creates Jinja2 templates based on your config         │
├─────────────────────────────────────────────────────────────┤
│  4. MERGE (Maintainer)                                      │
│     • Templates added to the repo                           │
│     • Your sanitized config becomes a test fixture           │
│     • Vendor support is now available in the wizard!        │
└─────────────────────────────────────────────────────────────┘

> [!NOTE]
> For repo reliability, sanitized configs are stored as versioned fixtures under `backend/tests/fixtures/submissions/`.
> This keeps the processing pipeline exercised by pytest in CI whenever the code changes.
```

### Timeline

| Stage | Typical Time |
|-------|--------------|
| Validation | Immediate (automated) |
| Analysis | Immediate (automated) |
| Maintainer Review | 1-7 days |
| Template Creation | Depends on complexity |

---

## Common Questions

### "I made a typo in vendor name"

No problem! The system auto-fixes common variations:

| You Enter | We Understand |
|-----------|---------------|
| `Dell EMC`, `dell-emc`, `DELLEMC` | `dellemc` |
| `CISCO`, `Cisco Systems` | `cisco` |
| `NX-OS`, `nx-os` | `nxos` |
| `OS-10`, `os 10` | `os10` |

### "My vendor isn't listed"

**Great!** We welcome new vendors. Just submit your config — the system will detect it as a new vendor contribution and guide the maintainers.

### "I don't know my deployment pattern"

Check your config:

```
! If you see both storage VLANs on host-facing ports:
interface range Ethernet1/1-16
  switchport trunk allowed vlan 7,201,711,712   ← Fully Converged

! If you see only ONE storage VLAN:
interface range Ethernet1/1-16  
  switchport trunk allowed vlan 7,201,711       ← Switched (TOR1)

! If no storage VLANs on switch at all:
interface range Ethernet1/1-16
  switchport trunk allowed vlan 7,201           ← Switchless
```

### "Can I submit multiple configs?"

Yes! Create a separate Issue for each:
- One Issue per switch (TOR1 and TOR2 are separate)
- One Issue per vendor/model combination

---

## Example Submission

Here's what a good submission looks like:

**Title:** `[Template] Dell S5248F-ON TOR1 Fully Converged`

**Vendor:** `Dell EMC`  
**Firmware:** `OS10`  
**Model:** `S5248F-ON`  
**Role:** `TOR1`  
**Pattern:** `fully_converged`

**Config:**
```
! Dell EMC OS10 Enterprise
! Version 10.5.5.5
!
hostname sample-tor1
!
interface vlan7
 description Management
 ip address 192.168.7.2/24
 ip helper-address 10.0.0.1
!
interface vlan201
 description Compute
 ip address 192.168.201.2/24
!
interface vlan711
 description Storage1
!
interface vlan712
 description Storage2
!
interface ethernet1/1/1
 description Host1-NIC1
 switchport mode trunk
 switchport trunk allowed vlan 7,201,711,712
 spanning-tree bpduguard enable
 dcb-map roce
!
... (full config continues)
```

---

## Need Help?

- **Questions about submission:** Open a [Discussion](../../discussions)
- **Bug in the wizard:** Open an [Issue](../../issues) with `[Bug]` prefix
- **Feature request:** Open an [Issue](../../issues) with `[Feature]` prefix

---

**Thank you for contributing!** Every submission helps network engineers worldwide. 🙏
