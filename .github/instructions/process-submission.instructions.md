---
applyTo: '**'
---

# Processing Config Submissions with Copilot

When a maintainer clicks "Code with agent mode" on a config submission issue, follow these steps:

## Step 1: Extract Issue Data

Parse the issue body to extract:
- **Vendor**: e.g., "Dell EMC" → normalize to "dellemc"
- **Firmware**: e.g., "OS10" → normalize to "os10"
- **Model**: e.g., "S5248F-ON"
- **Role**: Extract from dropdown, e.g., "TOR1 (Top-of-Rack Switch 1)" → "TOR1"
- **Deployment Pattern**: Extract from dropdown, e.g., "fully_converged (Storage...)" → "fully_converged"
- **Hostname**: Optional
- **Config**: The switch configuration text

## Step 2: Validate Metadata

Run the metadata validator to auto-fix common typos:

```bash
cd /workspace/backend
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
print('Validation Result:')
print(f'  Valid: {result.is_valid}')
print(f'  New Vendor: {result.is_new_vendor}')
for fr in result.field_results:
    print(f'  {fr.field_name}: {fr.original_value} → {fr.normalized_value} ({fr.status})')

corrected = result.get_corrected_metadata(metadata)
print(f'Corrected: {corrected}')
"
```

## Step 3: Detect Vendor from Config

Verify the config matches the stated vendor:

```bash
cd /workspace/backend
python -c "
from src.vendor_detector import detect_vendor, detect_model

config = '''<paste_config_here>'''

vendor, firmware = detect_vendor(config)
model = detect_model(config, vendor) if vendor else None

print(f'Detected: vendor={vendor}, firmware={firmware}, model={model}')
"
```

## Step 4: Section the Config

Split the config into logical sections:

```bash
cd /workspace/backend
python -c "
from src.config_sectioner import section_config, analyze_sections

config = '''<paste_config_here>'''
vendor = '<detected_or_stated_vendor>'
firmware = '<detected_or_stated_firmware>'

sections = section_config(config, vendor, firmware)
analysis = analyze_sections(sections)

print(f'Sections found: {list(sections.keys())}')
print(f'Analysis: {analysis}')
"
```

## Step 5: Create Submission Files

Create a new folder for this submission:

```
submissions/
└── <vendor>-<model>-<role>-issue<number>/
    ├── metadata.yaml       # Validated metadata
    ├── config.txt          # Original config
    ├── analysis.json       # Section analysis
    └── README.md           # Submission summary
```

### metadata.yaml
```yaml
# Auto-generated from Issue #<number>
vendor: <normalized_vendor>
firmware: <normalized_firmware>
model: <model>
role: <role>
deployment_pattern: <pattern>
hostname: <hostname>
source_issue: <issue_number>
submitted_by: <github_username>
submission_date: <date>
```

### analysis.json
```json
{
  "sections_found": ["system", "login", "vlan", "interface", ...],
  "section_sizes": {"system": 500, "vlan": 800, ...},
  "vlan_count": 6,
  "vlan_ids": [2, 7, 99, 201, 711, 712],
  "interface_count": 24,
  "port_channel_count": 2
}
```

### README.md
```markdown
# Config Submission: <vendor> <model> <role>

**Source:** Issue #<number>
**Submitted by:** @<username>
**Date:** <date>

## Metadata
| Field | Value |
|-------|-------|
| Vendor | <vendor> |
| Firmware | <firmware> |
| Model | <model> |
| Role | <role> |
| Pattern | <pattern> |

## Analysis
- **Sections:** <list>
- **VLANs:** <count> (<ids>)
- **Interfaces:** <count>
- **Port Channels:** <count>

## Notes
<any notes from the issue>
```

## Step 6: Create Pull Request

Create a PR with:
- **Title:** `feat(submissions): Add <vendor> <model> <role> config from issue #<number>`
- **Body:**
  ```markdown
  ## Config Submission
  
  Closes #<issue_number>
  
  ### Source
  - **Issue:** #<number>
  - **Submitted by:** @<username>
  
  ### Validated Metadata
  | Field | Original | Normalized |
  |-------|----------|------------|
  | Vendor | <orig> | <norm> |
  | ... | ... | ... |
  
  ### Config Analysis
  - Sections: <list>
  - VLANs: <count>
  - Interfaces: <count>
  
  ### Checklist
  - [ ] Config appears valid
  - [ ] No credentials detected
  - [ ] Vendor/firmware correctly identified
  ```

## Important Notes

1. **Never commit credentials** - If you see passwords/secrets in the config, stop and ask the user to sanitize
2. **New vendors are welcome** - If vendor is unknown, still create the submission with a note
3. **Reference only** - Remind that all configs are reference, customer responsible for validation
