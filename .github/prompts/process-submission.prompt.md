---
description: 'Process a community golden config submission from a GitHub issue. Normalize, sanitize, and prepare for template generation.'
---

# Process Golden Config Submission

Process a community-submitted golden configuration and prepare it for inclusion in the template library.

## Context

Community members submit working switch configurations via GitHub issues. This prompt processes those submissions, sanitizes sensitive data, and prepares them for template extraction.

## Input

The issue will contain:
- **Vendor** (free text, e.g., "Cisco Nexus", "Dell PowerSwitch")
- **Model** (free text, e.g., "N9K-C93180YC-FX3")
- **Firmware Version** (free text, e.g., "NXOS 10.3(2)")
- **Deployment Pattern** (Switchless, Switched, or Fully-Converged)
- **Config Role** (TOR switch, Management switch, BMC switch)
- **Raw Configuration** (the actual switch config)

## Processing Steps

1. **Normalize Identifiers**
   Reference: `.github/skills/config-analyzer/references/vendor-normalization.md`
   Reference: `.github/skills/config-analyzer/references/model-normalization.md`

   - Map vendor to folder name
   - Standardize model identifier
   - Normalize firmware version

2. **Sanitize Sensitive Data**
   Reference: `.github/skills/config-analyzer/references/sensitive-data-patterns.md`

   - Replace hostnames with `{{hostname}}`
   - Replace IP addresses context-aware
   - Replace ALL passwords and secrets
   - Replace SNMP communities
   - Replace usernames

3. **Detect Configuration Sections**
   Reference: `.github/skills/config-analyzer/references/syntax-patterns.md`

   - Parse into logical sections (VLAN, interface, BGP, etc.)
   - Identify vendor-specific patterns

4. **Validate Azure Local Compliance**
   - Check against deployment pattern requirements
   - Flag any potential violations

5. **Generate Template Files**
   Reference: `.github/skills/config-analyzer/references/template-extraction-rules.md`

   - Extract Jinja2 templates per section
   - Create proper directory structure
   - Add TODO comments for uncertain sections

## Output

Create:
- `backend/templates/{vendor}/{firmware}/*.j2` files
- `tests/fixtures/{vendor}-{model}/std_*.json` sample input
- `tests/fixtures/{vendor}-{model}/generated_*.cfg` expected outputs

Report:
- Summary of normalization applied
- List of sanitized fields
- Any Azure Local compliance warnings
- Files created and their locations
- Next steps for manual review
