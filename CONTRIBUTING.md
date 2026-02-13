# Contributing to Azure Local Network Config Tool

> [!CAUTION]
> **Reference Only — Customer Responsibility**
> 
> | This Repo Provides | You Are Responsible For |
> |--------------------|------------------------|
> | Reference templates & examples | Validating for your specific environment |
> | Community-driven, best-effort support | Testing before any production deployment |
> | Starting points for configurations | All deployment and operational decisions |
> 
> **Generated configurations are starting points, not production-ready solutions.**
> **You must validate and test all configurations before deploying to production.**

---

Thank you for helping improve Azure Local network templates! Whether you found something
the tool gets wrong or you have a config for a new vendor/model, this guide shows you
how to submit it. **No developer or AI knowledge required** — describe your issue in
plain English, paste your config, and automation handles the rest.

---

## Two Ways to Contribute

| I want to... | Choose | Example |
|--------------|--------|---------|
| **Fix something** the tool generates incorrectly | **Fix / Improvement** | "HSRP priority should be 200", "Missing BGP neighbor" |
| **Add support** for a new vendor or switch model | **New Vendor / Model** | "Here's a working Arista 7050X3 config" |

---

## Before You Start

### What We Need From You

| Item | Required | Description |
|------|:--------:|-------------|
| Submission type | ✅ | Fix / Improvement or New Vendor / Model |
| Deployment pattern | ✅ | HyperConverged, Switched, or Switchless |
| Switch vendor | ✅ | e.g., `Dell EMC`, `Cisco`, `Arista` |
| OS/Firmware | ✅ | e.g., `OS10`, `NX-OS`, `EOS` |
| Switch model | ✅ | e.g., `S5248F-ON`, `93180YC-FX3` |
| Switch role | ✅ | `TOR1`, `TOR2`, or `BMC` (lab only) |
| What's wrong | ✅ (for fixes) | Plain English description of the problem |
| Switch config | ✅ | Full running config (sanitized) |

### What We Do NOT Need

- ❌ Passwords, secrets, SSH keys, SNMP community strings
- ❌ Partial configs (we need the full running config)
- ❌ Developer knowledge — just describe what's wrong in plain English

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

Before submitting, replace credentials and sensitive information:

```diff
- username admin password MySuperSecret123!
+ username admin password $CREDENTIAL_PLACEHOLDER$

- enable secret MyEnablePassword
+ enable secret $CREDENTIAL_PLACEHOLDER$

- snmp-server community MyString RO
+ snmp-server community $CREDENTIAL_PLACEHOLDER$ RO
```

> **Tip:** Search for `password`, `secret`, `key`, `community`, and `tacacs` in your config.

Optionally, replace sensitive hostnames and IP addresses with dummy values if your
security policy requires it. The tool will also sanitize these during processing.

---

## Step 2: Identify Your Deployment Pattern

The deployment pattern is **critical** — it determines how the tool generates VLAN
assignments, port roles, and BGP structure. You must know your pattern before submitting.

### How to Identify Your Deployment Pattern

| Pattern | Storage Traffic | Host Port Config | When Used |
|---------|-----------------|------------------|-----------|
| **HyperConverged** | On switch (shared ports with compute) | Recommended: one storage VLAN per TOR (VLAN A on TOR1, VLAN B on TOR2) + compute VLANs on same host ports. Both storage VLANs on both TORs is also valid. | Most common — general purpose Azure Local |
| **Switched** | On switch (dedicated ports) | Compute ports carry management + compute VLANs only; separate dedicated ports for storage — strictly one storage VLAN per TOR (enforced) | Enterprise — network isolation between compute and storage |
| **Switchless** | Direct host-to-host (bypasses TOR) | No storage VLANs on host-facing ports (storage is direct-attached between nodes) | Edge — cost-sensitive, fewer nodes |

### Check Your Config to Confirm

```
! HyperConverged — recommended: one storage VLAN per TOR
! TOR1 carries Storage VLAN A (711), TOR2 carries Storage VLAN B (712)
! Both storage VLANs on both TORs is also accepted
interface range Ethernet1/1-16       ! on TOR1
  switchport trunk allowed vlan 7,201,711
interface range Ethernet1/1-16       ! on TOR2
  switchport trunk allowed vlan 7,201,712

! Switched — strictly one storage VLAN per TOR (enforced)
! Compute ports carry management + compute VLANs only
interface range Ethernet1/1-16
  switchport trunk allowed vlan 7,201

! No storage VLANs on switch at all → Switchless
interface range Ethernet1/1-16
  switchport trunk allowed vlan 7,201
  ! (storage is direct-attached between nodes)
```

### Switch Role

| Role | Description |
|------|-------------|
| **TOR1** | First Top-of-Rack switch (higher HSRP/VRRP priority — active/primary) |
| **TOR2** | Second Top-of-Rack switch (MLAG/vPC peer — standby/secondary) |
| **BMC** | Baseboard Management Controller switch (**lab use only** — not for customer deployments) |

---

## Step 3: Submit via GitHub Issue

### Open a New Issue

1. Go to [**Issues → New Issue**](../../issues/new/choose)
2. Select **"🔧 Switch Config Submission"**
3. Fill out the form:

| Field | What to Enter | Example |
|-------|---------------|---------|
| **What do you need?** | Choose Fix or New Vendor | `Fix / Improvement` |
| **Deployment Pattern** | Your Azure Local pattern | `HyperConverged` |
| **Vendor** | Your switch vendor | `Dell EMC` or `Cisco` |
| **Firmware/OS** | Operating system | `OS10` or `NX-OS` |
| **Model** | Switch model number | `S5248F-ON` |
| **Role** | TOR1, TOR2, or BMC | `TOR1` |
| **What's wrong?** | Describe in plain English | "HSRP priority should be 200" |
| **Config** | Paste full running config | (see below) |

### Describe What's Wrong (for Fix / Improvement)

This is the most important field for fixes. Be specific — mention exact values, VLAN
IDs, interface names, protocol settings. Examples:

| Good Description | What Copilot Does |
|-----------------|-------------------|
| "HSRP priority for storage VLANs should be 200 instead of 150" | Updates `REDUNDANCY_PRIORITY_ACTIVE` in constants |
| "BGP neighbor 10.1.1.1 for spine switch is missing" | Adds neighbor to `build_bgp()` converter logic |
| "VLAN 712 should not be on port Ethernet1/48" | Fixes the switch interface template JSON |
| "QoS policy needs DSCP marking for storage traffic class" | Updates the QoS Jinja2 template |
| "Port-channel 50 should have 4 members, not 2" | Fixes the switch interface template JSON |

### Paste Your Config

In the **Config** field, paste your entire sanitized running config:

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

## For Advanced Users: Lab JSON Input

If you used this tool's JSON input format and have the lab JSON that produced your
config, you can also paste it in the **Lab JSON Input** field. This helps create
automated test cases. The format looks like:

```json
{
  "Version": "1.0.0",
  "InputData": {
    "Switches": [
      { "Make": "Cisco", "Model": "93180YC-FX3", "Type": "TOR1", "ASN": 65242 }
    ],
    "Supernets": [...]
  }
}
```

Most users won't have this — it's completely optional.

---

## What Happens Next

```
┌─────────────────────────────────────────────────────────────┐
│  1. VALIDATION (Automatic — immediate)                      │
│     • Checks required fields, sanitization, config content  │
│     • Auto-fixes vendor/firmware typos                      │
│     • New vendors are welcomed, not rejected                │
├─────────────────────────────────────────────────────────────┤
│  2. COPILOT ANALYSIS (Automatic — minutes)                  │
│     • Reads your "What's wrong?" description                │
│     • Compares your config against current templates        │
│     • Identifies which files need to change                 │
│     • Creates a Pull Request with the fix                   │
├─────────────────────────────────────────────────────────────┤
│  3. MAINTAINER REVIEW (Human — 1-7 days)                    │
│     • Reviews the PR for correctness                        │
│     • Verifies fix matches your deployment pattern          │
│     • Runs tests to check for regressions                   │
├─────────────────────────────────────────────────────────────┤
│  4. MERGE                                                   │
│     • Fix becomes part of the tool                          │
│     • Your config helps the community                       │
│     • Updated templates available in next release           │
└─────────────────────────────────────────────────────────────┘
```

### Timeline

| Stage | Typical Time |
|-------|--------------|
| Validation | Immediate (automated) |
| Copilot Analysis + PR | Minutes (automated) |
| Maintainer Review | 1-7 days |
| Release | Next scheduled release |

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

**Great!** We welcome new vendors. Choose "New Vendor / Model" and submit your config —
the system will create scaffold templates and a maintainer will refine them.

### "I don't know what's wrong exactly"

That's OK! Describe what you see in your working config that differs from what the tool
generates. For example: "My switch has VRRP group 10 with priority 200, but the tool
generates group 6 with priority 150." Copilot will figure out which file to fix.

### "Can I submit multiple configs?"

Yes! Create a separate Issue for each:
- One Issue per switch (TOR1 and TOR2 are separate)
- One Issue per vendor/model combination

---

## Example: Fix / Improvement Submission

**Title:** `[Config] Cisco 93180YC-FX3 TOR1 — HSRP priority needs update`

**What do you need?:** `Fix / Improvement`  
**Deployment Pattern:** `HyperConverged`  
**Vendor:** `Cisco`  
**Firmware:** `NX-OS`  
**Model:** `93180YC-FX3`  
**Role:** `TOR1`  
**What's wrong?:** `HSRP priority for management VLAN should be 200 instead of 150. Our deployment requires higher priority on TOR1 for faster failover.`

**Config:** *(paste full running config showing the correct HSRP priority)*

---

## Example: New Vendor / Model Submission

**Title:** `[Config] Arista 7050X3 TOR1 — New vendor support`

**What do you need?:** `New Vendor / Model`  
**Deployment Pattern:** `HyperConverged`  
**Vendor:** `Arista`  
**Firmware:** `EOS 4.28`  
**Model:** `7050X3`  
**Role:** `TOR1`  
**What's wrong?:** `This is a new Arista switch. CLI syntax is different from Cisco/Dell — uses 'router bgp' but with 'neighbor ... activate' syntax similar to Dell OS10.`

**Config:** *(paste full running config)*

---

## Need Help?

- **Questions about submission:** Open a [Discussion](../../discussions)
- **Bug in the tool:** Open an [Issue](../../issues) with `[Bug]` prefix
- **Feature request:** Open an [Issue](../../issues) with `[Feature]` prefix

---

**Thank you for contributing!** Every submission helps network engineers worldwide.
