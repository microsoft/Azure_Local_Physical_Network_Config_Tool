# Community Config Submissions

> **Reference Only:** All configurations in this folder are community-contributed reference examples.
> You are responsible for validating and testing in your own environment.

## About This Folder

This folder contains switch configurations submitted by the community through GitHub Issues.
Each submission is:

1. **Validated** - Auto-validated by GitHub Actions workflow
2. **Processed** - Analyzed and organized by Copilot
3. **Reviewed** - Approved by a human maintainer before merge

## Folder Structure

```
submissions/
└── <vendor>-<model>-<role>-issue<number>/
    ├── metadata.yaml    # Submission metadata and validation results
    ├── config.txt       # Original config content
    ├── analysis.json    # Config analysis (VLANs, interfaces, etc.)
    └── README.md        # Human-readable summary
```

## Submitting Your Own Config

To submit a configuration:

1. Go to **Issues** → **New Issue**
2. Select **Config Submission** template
3. Fill in the required fields
4. Submit the issue

The workflow:
```
📝 You submit → 🔍 Auto-validated → 🤖 Copilot processes → 👤 Maintainer reviews → ✅ Merged
```

## Using Submitted Configs

These configs serve as:
- **Reference examples** for specific vendor/model/role combinations
- **Starting points** for your own configurations
- **Learning resources** to understand different deployment patterns

**Important:** Always review and customize any config before deploying to your environment.

## Questions?

- Open an issue with the `question` label
- See [SUPPORT.md](../SUPPORT.md) for more options
