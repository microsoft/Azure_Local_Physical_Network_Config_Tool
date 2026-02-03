---
applyTo: '**'
---

# Processing Config Submissions with Copilot

> **Role:** You are the first-tier processor for config submissions. Your job is to validate, analyze, and create PRs. Human maintainers only review the final PR.

## Principles

1. **Reference Only** — All configs are reference examples, customer responsible for validation
2. **Auto-Fix Friendly** — Fix typos in vendor/firmware names, don't reject
3. **Welcome New Vendors** — Unknown vendors are contributions, not errors
4. **No Credentials** — Never commit passwords/secrets; stop and comment if found
5. **Structured Output** — Create consistent folder structure and PR format

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
| Vendor | "### Switch Vendor" section | lowercase, no spaces: `Dell EMC` → `dellemc` |
| Firmware | "### Firmware/OS Version" section | lowercase, no hyphens: `NX-OS` → `nxos` |
| Model | "### Switch Model" section | Keep as-is |
| Role | "### Switch Role" section | Extract first word: `TOR1 (Top-of-Rack...)` → `TOR1` |
| Pattern | "### Deployment Pattern" section | Extract first word: `fully_converged (Storage...)` → `fully_converged` |
| Hostname | "### Switch Hostname" section | Optional, keep as-is |
| Config | "### Switch Configuration" section | Full text content |
| Notes | "### Additional Notes" section | Optional |

### Normalization Rules

```python
# Vendor normalization
vendor_map = {
    'dell emc': 'dellemc', 'dell-emc': 'dellemc', 'dell': 'dellemc',
    'cisco': 'cisco', 'cisco systems': 'cisco',
    'arista': 'arista', 'juniper': 'juniper',
}

# Firmware normalization  
firmware_map = {
    'os10': 'os10', 'os-10': 'os10', 'dnos10': 'os10',
    'nxos': 'nxos', 'nx-os': 'nxos', 'nexus': 'nxos',
    'eos': 'eos', 'junos': 'junos',
}

# Role extraction
role = role_text.split('(')[0].strip().upper()  # "TOR1 (Top...)" → "TOR1"

# Pattern extraction
pattern = pattern_text.split('(')[0].strip().lower().replace('-', '_')
```

---

## Step 2: Validate with Backend Scripts

Run validation using the backend scripts:

```bash
cd /workspace/backend

# Validate metadata
python -c "
from src.metadata_validator import validate_metadata

metadata = {
    'vendor': '<extracted_vendor>',
    'firmware': '<extracted_firmware>',
    'role': '<extracted_role>',
    'deployment_pattern': '<extracted_pattern>',
    'hostname': '<extracted_hostname>'
}

result = validate_metadata(metadata, 'issue-<issue_number>')

print('=== Validation Result ===')
print(f'Valid: {result.is_valid}')
print(f'New Vendor: {result.is_new_vendor}')

for fr in result.field_results:
    status_icon = '✅' if fr.status in ['valid', 'auto_fixed'] else '⚠️'
    print(f'{status_icon} {fr.field_name}: {fr.original_value} → {fr.normalized_value}')

# Get corrected metadata
corrected = result.get_corrected_metadata(metadata)
print(f'Corrected metadata: {corrected}')
"
```

---

## Step 3: Detect Vendor from Config

Cross-check stated vendor against config content:

```bash
cd /workspace/backend

python -c "
from src.vendor_detector import detect_vendor, detect_model

config = '''
<paste_full_config_here>
'''

vendor, firmware = detect_vendor(config)
model = detect_model(config, vendor) if vendor else None

print(f'Detected: vendor={vendor}, firmware={firmware}, model={model}')

# Compare with stated values
stated_vendor = '<from_issue>'
if vendor and vendor != stated_vendor:
    print(f'⚠️ Mismatch: Issue says {stated_vendor}, config looks like {vendor}')
"
```

---

## Step 4: Analyze Config Sections

Split config into logical sections:

```bash
cd /workspace/backend

python -c "
from src.config_sectioner import section_config, analyze_sections

config = '''<paste_full_config_here>'''

sections = section_config(config, '<vendor>', '<firmware>')
analysis = analyze_sections(sections)

print('=== Config Analysis ===')
print(f'Sections: {list(sections.keys())}')
print(f'VLANs: {analysis.get(\"vlan_count\", 0)} - IDs: {analysis.get(\"vlan_ids\", [])}')
print(f'Interfaces: {analysis.get(\"interface_count\", 0)}')
print(f'Port-channels: {analysis.get(\"port_channel_count\", 0)}')
"
```

---

## Step 5: Check for Credentials

**CRITICAL:** Search config for credentials before committing:

```bash
# Search for credential patterns
grep -iE "(password|secret|community|key|credential)" <<< "<config_text>"
```

**If credentials found:**
1. **DO NOT create PR**
2. Add comment to issue:
   ```
   ⚠️ **Credentials Detected**
   
   Your config appears to contain passwords or secrets. Please:
   1. Edit your submission
   2. Replace credentials with `$CREDENTIAL_PLACEHOLDER$`
   3. Re-submit
   
   I'll process once sanitized.
   ```
3. Add label: `needs-sanitization`
4. Stop processing

---

## Step 6: Create Submission Files

Create folder structure:

```
submissions/
 <vendor>-<model>-<role>-issue<number>/
    ├── metadata.yaml
    ├── config.txt
    ├── analysis.json
    └── README.md
```

### metadata.yaml

```yaml
# Config Submission from Issue #<number>
# Generated by Copilot - validated by maintainer before merge

vendor: <normalized_vendor>
firmware: <normalized_firmware>
model: <model>
role: <role>
deployment_pattern: <pattern>
hostname: <hostname>

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
```

### config.txt

```
<full config content from issue>
```

### analysis.json

```json
{
  "sections_found": ["system", "login", "vlan", "interface", "port_channel", "bgp"],
  "section_sizes": {
    "system": 500,
    "vlan": 800
  },
  "total_lines": 287,
  "vlan_count": 6,
  "vlan_ids": [2, 7, 99, 201, 711, 712],
  "interface_count": 24,
  "port_channel_count": 2,
  "port_channel_ids": [50, 101]
}
```

### README.md

```markdown
# Config Submission: <vendor> <model> <role>

> **Reference Only:** This configuration is provided as a reference example.
> You are responsible for validating and testing in your environment.

## Source

- **Issue:** #<number>
- **Submitted by:** @<username>
- **Date:** <date>

## Metadata

| Field | Value |
|-------|-------|
| Vendor | <vendor> |
| Firmware | <firmware> |
| Model | <model> |
| Role | <role> |
| Deployment Pattern | <pattern> |

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

## Step 7: Create Pull Request

### Branch Name

```
submission/issue-<number>-<vendor>-<model>-<role>
```

Example: `submission/issue-86-dellemc-s5248f-tor1`

### PR Title

```
feat(submissions): Add <vendor> <model> <role> config from #<number>
```

### PR Body

```markdown
## 🔧 Config Submission

Closes #<issue_number>

### Source
| Field | Value |
|-------|-------|
| **Issue** | #<number> |
| **Submitted by** | @<username> |
| **Vendor** | <vendor> |
| **Model** | <model> |
| **Role** | <role> |

### Validation Summary

| Check | Result |
|-------|--------|
| Metadata validated | ✅ |
| Vendor detected from config | <vendor> |
| Vendor matches stated | ✅ / ⚠️ |
| No credentials found | ✅ |
| Config analyzed | ✅ |

### Auto-Fixed Fields
<list of auto-fixed fields or "None">

### Config Analysis
- **Sections:** <list>
- **VLANs:** <count> (<ids>)
- **Interfaces:** <count>
- **Port Channels:** <count>

### Files Created
- `submissions/<folder>/metadata.yaml`
- `submissions/<folder>/config.txt`
- `submissions/<folder>/analysis.json`
- `submissions/<folder>/README.md`

---

### Maintainer Checklist
- [ ] Config looks reasonable for stated vendor/pattern
- [ ] No credentials or sensitive data
- [ ] Analysis results make sense
- [ ] Ready to merge

> **Note:** This PR was auto-generated by Copilot from issue #<number>.
> Human maintainer review required before merge.
```

### PR Labels

Add these labels to the PR:
- `submission`
- `copilot-generated`
- `needs-review`

---

## Error Handling

### Issue has "See attached file"

1. Comment: "I see you attached a file. Please paste the config content directly in the issue, or a maintainer will extract it manually."
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

### Very Short Config

If < 50 lines:
1. Comment: "Config seems short. Is this the complete running config?"
2. Add label: `needs-verification`
3. Still create PR (maintainer will verify)

---

## Summary Checklist

Before creating PR, verify:
- [ ] All required fields extracted
- [ ] Metadata validated and normalized
- [ ] Vendor detected from config
- [ ] No credentials in config
- [ ] Config sectioned and analyzed
- [ ] All files created with correct format
- [ ] PR follows template exactly
