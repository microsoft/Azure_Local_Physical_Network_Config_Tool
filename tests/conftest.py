"""
Shared test fixtures and configuration for the config-generator test suite.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import pytest

# ── path setup ────────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent.parent
TEST_CASES_ROOT = ROOT_DIR / "tests" / "test_cases"
TEMPLATE_ROOT = ROOT_DIR / "input" / "jinja2_templates"

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Suppress noisy logging during tests
logging.basicConfig(level=logging.WARNING, force=True)


# ── helpers ───────────────────────────────────────────────────────────────

def load_json(path: Path) -> dict:
    """Load a JSON file or raise a clear assertion error."""
    assert path.exists(), f"JSON file not found: {path}"
    return json.loads(path.read_text(encoding="utf-8"))


def find_json_differences(expected, actual, path: str = "", max_diff: int = 10) -> list[str]:
    """Return a list of human-readable differences between two JSON trees."""
    diffs: list[str] = []

    if type(expected) is not type(actual):
        return [f"Type mismatch at '{path}': expected {type(expected).__name__}, got {type(actual).__name__}"]

    if isinstance(expected, dict):
        for key in sorted(set(expected) | set(actual)):
            child = f"{path}.{key}" if path else key
            if key not in expected:
                diffs.append(f"Unexpected key at '{child}': {actual[key]!r}")
            elif key not in actual:
                diffs.append(f"Missing key at '{child}'")
            else:
                diffs.extend(find_json_differences(expected[key], actual[key], child, max_diff))
            if len(diffs) >= max_diff:
                break

    elif isinstance(expected, list):
        if len(expected) != len(actual):
            diffs.append(f"List length at '{path}': expected {len(expected)}, got {len(actual)}")
        for i in range(min(len(expected), len(actual))):
            diffs.extend(find_json_differences(expected[i], actual[i], f"{path}[{i}]", max_diff))
            if len(diffs) >= max_diff:
                break

    elif expected != actual:
        diffs.append(f"Value at '{path}': expected {expected!r}, got {actual!r}")

    return diffs[:max_diff]


def find_text_differences(expected: str, actual: str, max_lines: int = 10) -> list[str]:
    """Line-by-line diff between two text blobs."""
    exp_lines = expected.splitlines()
    act_lines = actual.splitlines()
    diffs: list[str] = []

    if len(exp_lines) != len(act_lines):
        diffs.append(f"Line count: expected {len(exp_lines)}, got {len(act_lines)}")

    for i in range(min(len(exp_lines), len(act_lines))):
        if exp_lines[i] != act_lines[i]:
            diffs.append(f"Line {i + 1}: expected {exp_lines[i][:60]!r}  got {act_lines[i][:60]!r}")
            if len(diffs) >= max_lines:
                break

    return diffs
