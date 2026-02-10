---
applyTo: '**'
---

# Processing Config Submissions with Copilot

> **Role:** You are the first-tier processor for config submissions. Your job is to
> analyze issues, identify what needs to change in the codebase, sanitize customer data,
> and create PRs. Human maintainers only review the final PR.

## Principles

1. **Reference Only** — All configs are reference examples, customer responsible for validation
2. **Auto-Fix Friendly** — Fix typos in vendor/firmware names, don't reject
3. **Welcome New Vendors** — Unknown vendors are contributions, not errors
4. **No Credentials** — Never commit passwords/secrets; stop and comment if found
5. **Sanitize Customer Data** — Replace real IPs/hostnames with dummy values before committing
6. **Deployment Pattern Drives Everything** — Always identify pattern first; it determines VLAN layout, port roles, and BGP structure

---

## When to Process

Process issues that have:
- Label: `config-submission`
- Label: `copilot` or `validated`
- NOT label: `needs-info`

---

## Step 1: Extract Issue Data

Parse the issue body to extract these fields:

| Field | Location in Issue | Normalize To |
|-------|-------------------|--------------|
| Submission Type | "### What do you need?" section | Extract first phrase: `Fix / Improvement — ...` → `fix` or `New Vendor / Model — ...` → `new_vendor` |
| Pattern | "### Deployment Pattern" section | Extract first word: `HyperConverged (...)` → `hyperconverged` |
| Vendor | "### Switch Vendor" section | Lowercase, no spaces (see vendor map below) |
| Firmware | "### Firmware/OS Version" section | Lowercase, no hyphens (see firmware map below) |
| Model | "### Switch Model" section | Keep as-is |
| Role | "### Switch Role" section | Extract first word: `TOR1 (Top-of-Rack...)` → `TOR1` |
| Hostname | "### Switch Hostname" section | Optional, keep as-is |
| Node Count | "### Node Count" section | Optional, integer |
| What's Wrong | "### What's wrong or what needs to change?" section | Full text — this guides where to look in the codebase |
| Config | "### Switch Configuration" section | Full text content |
| Lab JSON | "### Lab JSON Input" section | Optional, full JSON content |
| Notes | "### Additional Notes" section | Optional |

### Normalization Rules

```python
# Vendor normalization — maps user input to constants.py vendor names
vendor_map = {
    'dell emc': 'dellemc', 'dell-emc': 'dellemc', 'dell': 'dellemc',
    'cisco': 'cisco', 'cisco systems': 'cisco',
    # New vendors: normalize to lowercase, no spaces/hyphens
    # e.g., 'arista' → 'arista', 'juniper' → 'juniper'
}

# Firmware normalization — maps user input to constants.py firmware names
firmware_map = {
    'os10': 'os10', 'os-10': 'os10', 'dnos10': 'os10',
    'nxos': 'nxos', 'nx-os': 'nxos', 'nexus': 'nxos',
    # New firmware: normalize to lowercase, no hyphens
    # e.g., 'eos' → 'eos', 'junos' → 'junos'
}

# Deployment pattern normalization — maps dropdown to internal constant
pattern_map = {
    'hyperconverged': 'hyperconverged',  # converter remaps to fully_converged internally
    'switched': 'switched',
    'switchless': 'switchless',
}

# Role extraction
role = role_text.split('(')[0].strip().upper()  # "TOR1 (Top...)" → "TOR1"

# Pattern extraction
pattern = pattern_text.split('(')[0].strip().lower().replace(' ', '')
```

### Known Vendor/Firmware Pairs (from constants.py)

| Vendor | Firmware | Status |
|--------|----------|--------|
| `cisco` | `nxos` | Fully supported — templates exist |
| `dellemc` | `os10` | Fully supported — templates exist |
| *anything else* | *anything else* | New vendor contribution — welcome! |

---

## Step 2: Validate Metadata (Inline)

Perform these checks directly — no external scripts needed:

1. **Vendor normalization**: Apply `vendor_map`. If vendor not in map, lowercase and strip
   spaces/hyphens. This is a new vendor contribution — flag it but don't reject.

2. **Firmware normalization**: Apply `firmware_map`. If not in map, lowercase and strip hyphens.

3. **Cross-check vendor↔firmware**: Check against `VENDOR_FIRMWARE_MAP` in `src/constants.py`:
   - `cisco` → `nxos`
   - `dellemc` → `os10`
   - Unknown pair → flag as new vendor, process normally

4. **Validate role**: Must be one of `TOR1`, `TOR2`, `BMC`

5. **Validate pattern**: Must be one of `hyperconverged`, `switched`, `switchless`

6. **New vendor detection**: If vendor not in `VENDOR_FIRMWARE_MAP`, mark `is_new_vendor: true`

---

## Step 3: Detect Vendor from Config (Inline)

Cross-check the stated vendor against patterns in the config text:

| Pattern in Config | Detected Vendor | Detected Firmware |
|-------------------|-----------------|-------------------|
| `NX-OS` or `feature bgp` or `feature vpc` | `cisco` | `nxos` |
| `OS10 Enterprise` or `dcb-map` or `vlt-domain` | `dellemc` | `os10` |
| `Arista` or `daemon` or `EOS` | `arista` | `eos` |
| `JunOS` or `set interfaces` | `juniper` | `junos` |
| Interface naming: `Ethernet 1/1/1` (three-level) | `dellemc` | — |
| Interface naming: `Ethernet1/48` (two-level) | `cisco` | — |

**If detected vendor differs from stated:**
1. Use detected vendor (config is truth)
2. Note mismatch in PR: "⚠️ Issue stated `<stated>` but config appears to be `<detected>`. Using detected value."

---

## Step 4: Analyze Config (Inline)

Count and extract from the config text directly:

- **VLANs**: Count `vlan <id>` lines, extract IDs
- **Interfaces**: Count `interface` lines (Ethernet, Vlan, Loopback, Port-channel)
- **Port-channels**: Count `port-channel` or `channel-group` references, extract IDs
- **BGP**: Extract ASN from `router bgp <asn>`, count neighbors
- **HSRP/VRRP**: Extract priorities, group numbers
- **QoS**: Check for QoS policy presence
- **Total lines**: `wc -l` equivalent
- **Config sections found**: system, login, vlan, interface, port_channel, bgp, qos, prefix_list, static_route

---

## Step 5: Check for Credentials

**CRITICAL:** Search config for credentials before committing:

```bash
grep -iE "(password|secret|community|key |key$|credential|tacacs|radius|enable secret)" <<< "<config_text>"
```

Also check for:
- SSH private keys (`BEGIN.*PRIVATE KEY`)
- SNMP community strings (`snmp-server community`)
- TACACS+ keys (`tacacs-server.*key`)
- RADIUS secrets (`radius-server.*key`)
- Enable passwords (`enable secret|enable password`)

**If credentials found:**
1. **DO NOT create PR**
2. Add comment to issue:
   ```
   ⚠️ **Credentials Detected**
   
   Your config appears to contain passwords or secrets. Please:
   1. Edit your submission
   2. Replace credentials with `$CREDENTIAL_PLACEHOLDER$`
   3. Save — validation will run again automatically
   
   I'll process once sanitized.
   ```
3. Add label: `needs-sanitization`
4. Stop processing

---

## Step 6: Sanitize Customer Data

Before creating any files, sanitize the submitted config:

| Data Type | Replace With | Example |
|-----------|--------------|---------|
| Real IP addresses | Example ranges | `10.1.1.x` → `10.1.1.x` (keep structure, change octets if sensitive) |
| Customer hostnames | `sample-<role>` | `prod-tor-nyc-1` → `sample-tor1` |
| Customer ASNs | 65000-range examples | `64512` → `65001` (only if clearly customer-specific) |
| Site names | `sample-site` | `nyc-datacenter` → `sample-site` |

**Rules:**
- Preserve the structural relationships (VLAN IDs, interface numbers, port-channel IDs stay the same)
- Keep IP addressing structure consistent (if /31 P2P links, keep as /31)
- Document what was changed in the PR description so maintainers can verify
- If the submitter already sanitized (dummy-looking values), leave as-is

---

## Step 7: Process by Submission Type

### 7A: Fix / Improvement

This is the most common case. The engineer found something wrong with the tool's output.

**Use the "What's wrong?" description to locate the affected codebase files:**

| Engineer Says | Look In | File(s) to Modify |
|---------------|---------|-------------------|
| HSRP/VRRP priority wrong | Redundancy defaults | `src/constants.py` → `REDUNDANCY_PRIORITY_ACTIVE/STANDBY` |
| Wrong VLAN on port / missing VLAN on trunk | Port layout for that model | `input/switch_interface_templates/<vendor>/<model>.json` |
| Missing BGP neighbor / BGP ASN wrong | BGP builder + template | `src/convertors/convertors_lab_switch_json.py` → `build_bgp()` + `input/jinja2_templates/<vendor>/<firmware>/bgp.j2` |
| QoS policy wrong / PFC settings | QoS template | `input/jinja2_templates/<vendor>/<firmware>/qos.j2` |
| Interface config wrong / MTU wrong | Interface template | `input/jinja2_templates/<vendor>/<firmware>/interface.j2` |
| Port-channel config / MLAG / VPC / VLT | Port-channel + VLT template | `input/jinja2_templates/<vendor>/<firmware>/port_channel.j2` (+ `vlt.j2` for Dell) |
| Login / AAA / TACACS wrong | Login template | `input/jinja2_templates/<vendor>/<firmware>/login.j2` |
| System settings / hostname format | System template | `input/jinja2_templates/<vendor>/<firmware>/system.j2` |
| VLAN name wrong / SVI config | VLAN template + converter | `input/jinja2_templates/<vendor>/<firmware>/vlan.j2` + `build_vlans()` |
| Static route missing | Static route template | `input/jinja2_templates/<vendor>/<firmware>/static_route.j2` |
| Prefix list wrong | Prefix list template + converter | `input/jinja2_templates/<vendor>/<firmware>/prefix_list.j2` + `build_prefix_lists()` |
| DHCP relay wrong | VLAN template (SVI section) | `input/jinja2_templates/<vendor>/<firmware>/vlan.j2` (dhcp_relay block) |
| New switch model — different port layout | Switch interface template | `input/switch_interface_templates/<vendor>/<model>.json` (create new) |

**Process:**
1. Read the "What's wrong?" description carefully
2. Identify the affected file(s) using the table above
3. Compare the engineer's working config against what the current templates/constants produce
4. Make the targeted fix in the specific file(s)
5. If the fix affects generated output, update affected golden-file test cases in `tests/test_cases/`
6. Run `python -m pytest tests/ -v` to verify no regressions
7. Create PR (see Step 8)

### 7B: New Vendor / Model

The engineer has a working config for a vendor or model not yet supported.

**Create these artifacts:**

1. **Constants entries** (if new vendor/firmware) — add to `src/constants.py`:
   ```python
   # Add new vendor
   NEWVENDOR = "newvendor"
   NEWFIRMWARE = "newfirmware"
   
   # Add to VENDOR_FIRMWARE_MAP
   VENDOR_FIRMWARE_MAP[NEWVENDOR] = NEWFIRMWARE
   ```

2. **Switch interface template** — create `input/switch_interface_templates/<vendor>/<model>.json`:
   - Reverse-engineer the port layout from the config
   - Follow the shared schema: `Make`, `Model`, `Type`, `interface_templates` (with `common`, pattern-specific keys), `port_channels`
   - Reference existing templates (e.g., `dellemc/S5248F-ON.json`) for structure

3. **Jinja2 template scaffolds** — create `input/jinja2_templates/<vendor>/<firmware>/*.j2`:
   - Create templates for each config section found: `bgp.j2`, `interface.j2`, `vlan.j2`, `port_channel.j2`, `login.j2`, `system.j2`, `qos.j2`, `prefix_list.j2`, `static_route.j2`, `full_config.j2`
   - Add vendor-specific templates as needed (e.g., Dell has `vlt.j2`)
   - **All templates must use guards** (`{% if bgp %}`, `{% if vlans %}`) for safe empty rendering
   - Mark scaffolds clearly: add `{# SCAFFOLD — needs human review #}` comment at top

4. **Reference config archive** — create `submissions/<vendor>-<model>-<role>-issue<N>/`:
   - `metadata.yaml` — submission metadata
   - `config.txt` — sanitized config
   - `analysis.json` — config analysis results
   - `README.md` — human-readable summary

5. **Golden-file test case** (if lab JSON provided) — create `tests/test_cases/convert_<vendor>_<firmware>_<pattern>/`:
   - `lab_<vendor>_<firmware>_switch_input.json` — the lab JSON input
   - `expected_outputs/` — run the converter to generate expected outputs

**File templates for submissions/ artifacts:**

### metadata.yaml

```yaml
# Config Submission from Issue #<number>
# Generated by Copilot — validated by maintainer before merge

submission_type: new_vendor  # or "fix"
vendor: <normalized_vendor>
firmware: <normalized_firmware>
model: <model>
role: <role>
deployment_pattern: <pattern>
hostname: <hostname>
node_count: <node_count or "not specified">

source:
  issue_number: <number>
  issue_url: https://github.com/<owner>/<repo>/issues/<number>
  submitted_by: <github_username>
  submission_date: <YYYY-MM-DD>

validation:
  auto_fixed_fields: [<list of auto-fixed fields>]
  is_new_vendor: <true/false>
  detected_vendor: <vendor_from_config>
  vendor_match: <true/false>

sanitization:
  hostnames_replaced: <true/false>
  ips_replaced: <true/false>
  asns_replaced: <true/false>
```

### analysis.json

```json
{
  "submission_type": "new_vendor",
  "sections_found": ["system", "login", "vlan", "interface", "port_channel", "bgp"],
  "total_lines": 287,
  "vlan_count": 6,
  "vlan_ids": [2, 7, 99, 201, 711, 712],
  "interface_count": 24,
  "port_channel_count": 2,
  "port_channel_ids": [50, 101],
  "bgp_asn": 65242,
  "bgp_neighbor_count": 4,
  "hsrp_vrrp_detected": "hsrp",
  "qos_detected": true,
  "deployment_pattern": "hyperconverged"
}
```

### README.md (for submissions/ folder)

```markdown
# Config Submission: <vendor> <model> <role>

> **Reference Only:** This configuration is provided as a reference example.
> You are responsible for validating and testing in your environment.

## Source

- **Issue:** #<number>
- **Submitted by:** @<username>
- **Date:** <date>
- **Type:** <Fix / Improvement or New Vendor / Model>

## Metadata

| Field | Value |
|-------|-------|
| Vendor | <vendor> |
| Firmware | <firmware> |
| Model | <model> |
| Role | <role> |
| Deployment Pattern | <pattern> |
| Node Count | <count or N/A> |

## What Was Requested

<paste "what's wrong" description>

## Config Analysis

| Metric | Value |
|--------|-------|
| Total Lines | <count> |
| Sections | <list> |
| VLANs | <count> (<ids>) |
| Interfaces | <count> |
| Port Channels | <count> |

## Notes

<notes from issue or "None provided">
```

---

## Step 8: Create Pull Request

### Branch Name

**For fixes:**
```
fix/issue-<number>-<vendor>-<short_description>
```
Example: `fix/issue-86-cisco-hsrp-priority`

**For new vendors:**
```
feat/issue-<number>-<vendor>-<model>-<role>
```
Example: `feat/issue-92-arista-7050x3-tor1`

### PR Title

**For fixes:**
```
fix(<area>): <short description> from #<number>
```
Example: `fix(templates): Update HSRP priority for storage VLANs from #86`

**For new vendors:**
```
feat(vendors): Add <vendor> <model> <role> support from #<number>
```
Example: `feat(vendors): Add Arista 7050X3 TOR1 support from #92`

### PR Body

```markdown
## 🔧 Config Submission

Closes #<issue_number>

### Source
| Field | Value |
|-------|-------|
| **Issue** | #<number> |
| **Type** | <Fix / Improvement or New Vendor / Model> |
| **Submitted by** | @<username> |
| **Vendor** | <vendor> |
| **Model** | <model> |
| **Role** | <role> |
| **Deployment Pattern** | <pattern> |

### What Was Requested
> <paste the "what's wrong" description>

### Validation Summary

| Check | Result |
|-------|--------|
| Metadata validated | ✅ |
| Vendor detected from config | <vendor> |
| Vendor matches stated | ✅ / ⚠️ <note if mismatch> |
| No credentials found | ✅ |
| Customer data sanitized | ✅ |
| Config analyzed | ✅ |

### Changes Made
<detailed description of what files were changed and why>

### Files Modified/Created
- `<list each file with brief description>`

### Test Results
<output of `python -m pytest tests/ -v` or note about which tests were updated>

---

### Maintainer Checklist
- [ ] Changes are correct for the stated deployment pattern (<pattern>)
- [ ] No credentials or customer-sensitive data
- [ ] Test cases pass or were appropriately updated
- [ ] Changes align with the codebase architecture (data-driven, no vendor-specific if/else)
- [ ] Ready to merge

> **Note:** This PR was auto-generated by Copilot from issue #<number>.
> Human maintainer review required before merge.
```

### PR Labels

**For fixes:**
- `submission`
- `copilot-generated`
- `needs-review`

**For new vendors:**
- `submission`
- `copilot-generated`
- `needs-review`
- `new-vendor` (if new vendor)
- `needs-heavy-review` (new vendor PRs need careful review)

---

## Error Handling

### Issue has "See attached file"

1. Comment: "I see you may have an attached file. Please paste the config content directly in the issue's config field, or a maintainer will extract it manually."
2. Add label: `needs-maintainer`
3. Don't create PR

### Unknown Vendor

1. Process normally — new vendors are welcome!
2. In PR, note: "⭐ **New Vendor Contribution:** This config is for a vendor not yet in our templates."
3. Add label: `new-vendor`

### Vendor Mismatch

If detected vendor differs from stated:
1. Use detected vendor (config is truth)
2. In PR, note: "⚠️ Issue stated `<stated>` but config appears to be `<detected>`. Using detected value."

### Very Short Config (< 50 lines)

1. Comment: "Config seems short. Is this the complete running config?"
2. Add label: `needs-verification`
3. Still create PR (maintainer will verify)

### "What's wrong?" is empty for Fix submission

1. Analyze the config and compare against current templates — try to identify differences
2. If differences are clear, proceed with fix and note: "The 'What's wrong?' field was empty. Based on config analysis, the following differences were found: ..."
3. If differences are unclear, comment asking for clarification and add label: `needs-info`

### Lab JSON provided

1. Validate JSON syntax
2. Check for expected top-level keys: `Version`, `InputData` (with `Switches`, `Supernets`)
3. If valid, use it to create a golden-file test case in `tests/test_cases/`
4. Run converter against it to verify it produces valid output

---

## Summary Checklist

Before creating PR, verify:
- [ ] All required fields extracted and normalized
- [ ] Submission type identified (fix vs new vendor)
- [ ] Deployment pattern identified and validated
- [ ] Vendor detected from config and cross-checked
- [ ] No credentials in config
- [ ] Customer data sanitized (IPs, hostnames, ASNs)
- [ ] Correct files identified and modified (for fixes) or created (for new vendors)
- [ ] Tests updated if output changes
- [ ] Tests pass (`python -m pytest tests/ -v`)
- [ ] PR follows template exactly
